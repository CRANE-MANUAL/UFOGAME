import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import type {
  ControlInputState,
  GameHudTelemetry,
  PlayPhase,
  StageConfig,
} from '../types/game';
import type {
  CraneRingHandle,
  PrizeBundleHandle,
  UprightHookHandle,
} from './models';

export interface PhysicsCallbacks {
  onMetalClink: (intensity: number) => void;
  onHookCatch: () => void;
  onRingSlip: () => void;
  onWin: () => void;
  onFail: (reason: string) => void;
}

const CRANE_LINK_COUNT = 10;

const TETHER_LINK_COUNT = 3;
const TETHER_LINK_LEN = 0.11;

const TROLLEY_Y = 2.25;
const SHACKLE_OFFSET_Y = -0.24;
const START_X = -0.95;
const START_Z = 0.68;
const MIN_CABLE = 0.82;
const MAX_CABLE = 2.40;

const GROUP_RING = 1;
const GROUP_CABINET = 2;
const GROUP_CHAIN = 4;
const GROUP_PRIZE = 8;
const GROUP_HOOK = 16;

// Scratch math objects
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _invRingQuat = new THREE.Quaternion();
const _invHookQuat = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler();
const _cVec1 = new CANNON.Vec3();
const _cVec2 = new CANNON.Vec3();
const _cQuat = new CANNON.Quaternion();

export class CranePhysicsWorld {
  private stage: StageConfig;
  private ringModel: CraneRingHandle;
  private hookModel: UprightHookHandle;
  private prizeModel: PrizeBundleHandle;
  private grateTopY: number;
  private chuteCenter: THREE.Vector3;
  private callbacks: PhysicsCallbacks;

  // Cannon-es Rigid-Body World
  private world: CANNON.World;
  private trolleyBody: CANNON.Body;
  private shackleBody: CANNON.Body;
  private chainBodies: CANNON.Body[] = [];
  private chainConstraints: CANNON.PointToPointConstraint[] = [];
  private topShackleConstraint: CANNON.PointToPointConstraint;
  private ringJoint: CANNON.PointToPointConstraint;

  private ringBody: CANNON.Body;
  private craneToolCradleShapes = new Set<CANNON.Shape>();
  private craneSpineWorld: THREE.Vector3[] = [];
  private hookBody: CANNON.Body;
  private hookArchShapes = new Set<CANNON.Shape>();

  private tetherBodies: CANNON.Body[] = [];
  private tetherConstraints: CANNON.PointToPointConstraint[] = [];
  private prizeBody: CANNON.Body;

  // Exposed Three.js transforms & chain node positions for rendering
  public trolleyPos = new THREE.Vector3(START_X, TROLLEY_Y, START_Z);
  private trolleyVel = new THREE.Vector3();
  public cableLength = MIN_CABLE;

  public craneChainNodes: THREE.Vector3[] = [];
  public ringPos = new THREE.Vector3();
  public ringQuat = new THREE.Quaternion();

  public hookPos = new THREE.Vector3();
  public hookQuat = new THREE.Quaternion();
  private hookSpineWorld: THREE.Vector3[] = [];

  public prizeTetherNodes: THREE.Vector3[] = [];
  public prizePos = new THREE.Vector3();
  public prizeQuat = new THREE.Quaternion();

  // 5-Step Arcade State Machine
  public phase: PlayPhase = 'move_right';
  private rightHeldOnce = false;
  private backHeldOnce = false;
  private bottomPauseTimer = 0;
  private isThreaded = false;
  private isRingHooked = false;
  private hasHookDetached = false;
  private wasHookedPreviously = false;
  private returnStep: 'to_chute' | 'release' | 'done' = 'to_chute';
  private chuteSettleTimer = 0;
  private releaseTimer = 0;
  private finishTriggered = false;
  private clinkCooldown = 0;
  private physicsAccumulator = 0;

  constructor(
    stage: StageConfig,
    ringModel: CraneRingHandle,
    hookModel: UprightHookHandle,
    prizeModel: PrizeBundleHandle,
    grateTopY: number,
    _hookCradleY: number,
    hookBaseCenter: THREE.Vector3,
    hookBaseSize: THREE.Vector3,
    chuteCenter: THREE.Vector3,
    callbacks: PhysicsCallbacks,
  ) {
    this.stage = stage;
    this.ringModel = ringModel;
    this.hookModel = hookModel;
    this.prizeModel = prizeModel;
    this.grateTopY = grateTopY;
    this.chuteCenter = chuteCenter.clone();
    this.callbacks = callbacks;

    for (let i = 0; i < 11; i++) {
      this.craneChainNodes.push(new THREE.Vector3());
    }
    for (let i = 0; i < 5; i++) {
      this.prizeTetherNodes.push(new THREE.Vector3());
    }
    for (let i = 0; i < hookModel.spineLocal.length; i++) {
      this.hookSpineWorld.push(new THREE.Vector3());
    }
    for (let i = 0; i < ringModel.spineLocal.length; i++) {
      this.craneSpineWorld.push(new THREE.Vector3());
    }

    // 1. Initialize real 3D rigid-body world with high solver iterations & stiff chain constraints
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -22.0, 0),
      allowSleep: false,
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    const solver = new CANNON.GSSolver();
    solver.iterations = 64;
    solver.tolerance = 0.00001;
    this.world.solver = solver;

    const steelMat = new CANNON.Material('steel');
    const prizeMat = new CANNON.Material('prize');
    const cabinetMat = new CANNON.Material('cabinet');

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(steelMat, steelMat, {
        friction: 0.48,
        restitution: 0.14,
        contactEquationStiffness: 8e7,
        contactEquationRelaxation: 1.8,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(steelMat, cabinetMat, {
        friction: 0.56,
        restitution: 0.10,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(prizeMat, cabinetMat, {
        friction: 0.55,
        restitution: 0.08,
      }),
    );

    // 2. Static Cabinet Colliders (Wire Grate, Pedestal Stand Pads, Widened Chute Pit Walls & Floor, Cabinet Floor)
    this.buildCabinetColliders(cabinetMat, hookBaseCenter, hookBaseSize);

    // 3. Trolley & Shackle (Kinematic crane head)
    this.trolleyBody = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      mass: 0,
      collisionResponse: false,
    });
    this.world.addBody(this.trolleyBody);

    this.shackleBody = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      mass: 0,
      collisionResponse: false,
    });
    this.world.addBody(this.shackleBody);

    const stiffen = (c: CANNON.Constraint) => {
      for (const eq of c.equations) {
        eq.setSpookParams(1.5e8, 2.0, 1 / 180);
      }
    };

    const isEyePlateStage = this.hookModel.hookType === 'eye_plate';

    // 4. Full 10-Link Articulated Rigid-Body Crane Chain with collision against hook, base, prizes & cabinet
    const initHalfSpan = (MIN_CABLE / CRANE_LINK_COUNT) * 0.5;
    for (let i = 0; i < CRANE_LINK_COUNT; i++) {
      const linkBody = new CANNON.Body({
        mass: 0.20,
        material: steelMat,
        linearDamping: 0.008,
        angularDamping: isEyePlateStage ? 0.42 : 0.04,
        collisionFilterGroup: GROUP_CHAIN,
        collisionFilterMask: GROUP_HOOK | GROUP_CABINET | GROUP_PRIZE,
      });
      linkBody.addShape(new CANNON.Sphere(0.022), new CANNON.Vec3(0, -0.055, 0));
      linkBody.addShape(new CANNON.Sphere(0.022), new CANNON.Vec3(0, -0.018, 0));
      linkBody.addShape(new CANNON.Sphere(0.022), new CANNON.Vec3(0, 0.018, 0));
      linkBody.addShape(new CANNON.Sphere(0.022), new CANNON.Vec3(0, 0.055, 0));
      this.world.addBody(linkBody);
      this.chainBodies.push(linkBody);
    }

    // Top shackle joint -> chainBodies[0]
    this.topShackleConstraint = new CANNON.PointToPointConstraint(
      this.shackleBody,
      new CANNON.Vec3(0, 0, 0),
      this.chainBodies[0],
      new CANNON.Vec3(0, initHalfSpan, 0),
      1e7,
    );
    stiffen(this.topShackleConstraint);
    this.world.addConstraint(this.topShackleConstraint);

    // Ball-socket chain joints between all 10 rigid chain links
    for (let i = 0; i < CRANE_LINK_COUNT - 1; i++) {
      const c = new CANNON.PointToPointConstraint(
        this.chainBodies[i],
        new CANNON.Vec3(0, -initHalfSpan, 0),
        this.chainBodies[i + 1],
        new CANNON.Vec3(0, initHalfSpan, 0),
        1e7,
      );
      stiffen(c);
      this.world.addConstraint(c);
      this.chainConstraints.push(c);
    }

    // 5. Crane Tool Body: Stage 1 Stainless Ring OR Stage 2 Forged J-Hook
    this.ringBody = new CANNON.Body({
      mass: 0.40,
      material: steelMat,
      linearDamping: 0.005,
      angularDamping: isEyePlateStage ? 0.48 : 0.016,
      collisionFilterGroup: GROUP_RING,
      collisionFilterMask: GROUP_HOOK | GROUP_CABINET | GROUP_PRIZE,
    });
    if (this.ringModel.toolType === 'j_hook') {
      const cSpine = this.ringModel.spineLocal;
      const cSphereR = this.ringModel.tubeRadius * 1.12;
      for (let i = 0; i < cSpine.length; i++) {
        const pt = cSpine[i];
        const s1 = new CANNON.Sphere(cSphereR);
        this.ringBody.addShape(s1, new CANNON.Vec3(pt.x, pt.y, pt.z));
        if (
          i >= this.ringModel.cradleStartIdx &&
          i <= this.ringModel.cradleEndIdx
        ) {
          this.craneToolCradleShapes.add(s1);
        }
        if (i < cSpine.length - 1) {
          const nextPt = cSpine[i + 1];
          const midS = new CANNON.Sphere(cSphereR);
          this.ringBody.addShape(
            midS,
            new CANNON.Vec3(
              (pt.x + nextPt.x) * 0.5,
              (pt.y + nextPt.y) * 0.5,
              (pt.z + nextPt.z) * 0.5,
            ),
          );
          if (
            i >= this.ringModel.cradleStartIdx &&
            i < this.ringModel.cradleEndIdx
          ) {
            this.craneToolCradleShapes.add(midS);
          }
        }
      }
      // Top forged oval boss collider matching sculpted silhouette
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.ringBody.addShape(
          new CANNON.Sphere(0.018),
          new CANNON.Vec3(
            0.002 + Math.cos(a) * 0.042,
            0.138 + Math.sin(a) * 0.052,
            0,
          ),
        );
      }
    } else {
      const torusSegs = 40;
      const R = this.stage.ring.majorRadius;
      const rTube = this.stage.ring.tubeRadius * 1.12;
      for (let i = 0; i < torusSegs; i++) {
        const theta = (i / torusSegs) * Math.PI * 2;
        this.ringBody.addShape(
          new CANNON.Sphere(rTube),
          new CANNON.Vec3(Math.cos(theta) * R, Math.sin(theta) * R, 0),
        );
      }
    }
    // Swivel collar sphere at top of crane tool
    this.ringBody.addShape(
      new CANNON.Sphere(0.022),
      new CANNON.Vec3(0, this.ringModel.eyeletLocalY, 0),
    );
    this.world.addBody(this.ringBody);

    // Joint connecting bottom chain link to crane tool's top swivel eyelet
    this.ringJoint = new CANNON.PointToPointConstraint(
      this.chainBodies[CRANE_LINK_COUNT - 1],
      new CANNON.Vec3(0, -initHalfSpan, 0),
      this.ringBody,
      new CANNON.Vec3(0, this.ringModel.eyeletLocalY, 0),
      1e7,
    );
    stiffen(this.ringJoint);
    this.world.addConstraint(this.ringJoint);

    // 6. Unified Prize Target (? Hook OR Eye Plate) + Red Rectangular Base Board (ALWAYS DYNAMIC!)
    this.hookBody = new CANNON.Body({
      type: CANNON.Body.DYNAMIC,
      mass: 0.78,
      material: steelMat,
      linearDamping: isEyePlateStage ? 0.18 : 0.14,
      angularDamping: isEyePlateStage ? 0.68 : 0.38,
      collisionFilterGroup: GROUP_HOOK,
      collisionFilterMask:
        GROUP_RING | GROUP_CHAIN | GROUP_CABINET | GROUP_PRIZE,
    });
    const spine = this.hookModel.spineLocal;
    const hookSphereR = this.hookModel.tubeRadius * 1.1;
    const archStart = this.hookModel.hookType === 'eye_plate' ? this.hookModel.archStartIdx : 7;
    const archEnd = this.hookModel.hookType === 'eye_plate' ? this.hookModel.archEndIdx : 26;
    for (let i = 0; i < spine.length; i++) {
      const pt = spine[i];
      const sphere = new CANNON.Sphere(hookSphereR);
      this.hookBody.addShape(sphere, new CANNON.Vec3(pt.x, pt.y, pt.z));
      if (i >= archStart && i <= archEnd) {
        this.hookArchShapes.add(sphere);
      }
      // Interpolated midpoint sphere eliminates any gap where Ring/J-hook could tunnel under load
      if (i < spine.length - 1) {
        const nextPt = spine[i + 1];
        const midSphere = new CANNON.Sphere(hookSphereR);
        this.hookBody.addShape(
          midSphere,
          new CANNON.Vec3(
            (pt.x + nextPt.x) * 0.5,
            (pt.y + nextPt.y) * 0.5,
            (pt.z + nextPt.z) * 0.5,
          ),
        );
        if (i >= archStart && i < archEnd) {
          this.hookArchShapes.add(midSphere);
        }
      }
    }
    if (this.hookModel.hookType === 'eye_plate') {
      // Stainless base plate collider sitting on top of the red board
      this.hookBody.addShape(
        new CANNON.Box(new CANNON.Vec3(0.21, 0.011, 0.14)),
        new CANNON.Vec3(0, this.hookModel.plateTopLocalY - 0.011, 0),
      );
    }
    // Red base board compound collider attached rigidly (always dynamic & moves together!)
    this.hookBody.addShape(
      new CANNON.Box(
        new CANNON.Vec3(
          this.hookModel.baseSize.x * 0.5,
          this.hookModel.baseSize.y * 0.5,
          this.hookModel.baseSize.z * 0.5,
        ),
      ),
      new CANNON.Vec3(0, this.hookModel.baseLocalCenterY, 0),
    );
    this.hookBody.addShape(
      new CANNON.Sphere(0.014),
      new CANNON.Vec3(0, this.hookModel.bottomEyeletLocalY, 0),
    );
    this.world.addBody(this.hookBody);

    // 7. Prize Bundle Rigid Body (Compound boxes for ふわ玉 + ミニ箱, collides with Ring & cabinet)
    this.prizeBody = new CANNON.Body({
      mass: 0.28,
      material: prizeMat,
      linearDamping: 0.14,
      angularDamping: isEyePlateStage ? 0.48 : 0.28,
      collisionFilterGroup: GROUP_PRIZE,
      collisionFilterMask: GROUP_CABINET | GROUP_RING | GROUP_HOOK,
    });
    this.prizeBody.addShape(
      new CANNON.Box(
        new CANNON.Vec3(
          this.stage.prize.width * 0.48,
          this.stage.prize.height * 0.48,
          this.stage.prize.depth * 0.48,
        ),
      ),
      new CANNON.Vec3(-0.18, 0.11, 0.06),
    );
    this.prizeBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.16, 0.12, 0.13)),
      new CANNON.Vec3(0.22, 0.12, 0.02),
    );
    this.world.addBody(this.prizeBody);

    // 8. 3-Link Rigid Tether Chain connecting '?' hook bottom eyelet to prize top eyelet
    for (let i = 0; i < TETHER_LINK_COUNT; i++) {
      const tb = new CANNON.Body({
        mass: 0.11,
        material: steelMat,
        linearDamping: isEyePlateStage ? 0.14 : 0.04,
        angularDamping: isEyePlateStage ? 0.45 : 0.15,
        collisionFilterGroup: GROUP_CHAIN,
        collisionFilterMask: 0,
      });
      tb.addShape(new CANNON.Sphere(0.018));
      this.world.addBody(tb);
      this.tetherBodies.push(tb);
    }

    const tcTop = new CANNON.PointToPointConstraint(
      this.hookBody,
      new CANNON.Vec3(0, this.hookModel.bottomEyeletLocalY, 0),
      this.tetherBodies[0],
      new CANNON.Vec3(0, TETHER_LINK_LEN * 0.5, 0),
      1e7,
    );
    stiffen(tcTop);
    this.world.addConstraint(tcTop);
    this.tetherConstraints.push(tcTop);

    for (let i = 0; i < TETHER_LINK_COUNT - 1; i++) {
      const tc = new CANNON.PointToPointConstraint(
        this.tetherBodies[i],
        new CANNON.Vec3(0, -TETHER_LINK_LEN * 0.5, 0),
        this.tetherBodies[i + 1],
        new CANNON.Vec3(0, TETHER_LINK_LEN * 0.5, 0),
        1e7,
      );
      stiffen(tc);
      this.world.addConstraint(tc);
      this.tetherConstraints.push(tc);
    }

    const tcBot = new CANNON.PointToPointConstraint(
      this.tetherBodies[TETHER_LINK_COUNT - 1],
      new CANNON.Vec3(0, -TETHER_LINK_LEN * 0.5, 0),
      this.prizeBody,
      new CANNON.Vec3(0, this.prizeModel.tetherAnchorLocalY, 0),
      1e7,
    );
    stiffen(tcBot);
    this.world.addConstraint(tcBot);
    this.tetherConstraints.push(tcBot);

    this.resetRound();
  }

  private buildCabinetColliders(
    cabinetMat: CANNON.Material,
    hookBaseCenter: THREE.Vector3,
    hookBaseSize: THREE.Vector3,
  ): void {
    const addStaticBox = (
      hx: number,
      hy: number,
      hz: number,
      px: number,
      py: number,
      pz: number,
      group = GROUP_CABINET,
      mask = GROUP_RING | GROUP_CABINET | GROUP_PRIZE | GROUP_HOOK | GROUP_CHAIN,
    ): CANNON.Body => {
      const b = new CANNON.Body({
        type: CANNON.Body.STATIC,
        mass: 0,
        material: cabinetMat,
        collisionFilterGroup: group,
        collisionFilterMask: mask,
      });
      b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
      b.position.set(px, py, pz);
      this.world.addBody(b);
      return b;
    };

    // Pedestal stand support pads that cradle the dynamic '?' hook + red base board until bumped or lifted
    const legSpanH = Math.max(
      0.1,
      hookBaseCenter.y - hookBaseSize.y * 0.5 - this.grateTopY,
    );
    [-hookBaseSize.x * 0.36, hookBaseSize.x * 0.36].forEach((ox) => {
      [-hookBaseSize.z * 0.3, hookBaseSize.z * 0.3].forEach((oz) => {
        addStaticBox(
          0.036,
          legSpanH * 0.5,
          0.036,
          hookBaseCenter.x + ox,
          this.grateTopY + legSpanH * 0.5,
          hookBaseCenter.z + oz,
          GROUP_CABINET,
          GROUP_HOOK | GROUP_RING | GROUP_CHAIN,
        );
      });
    });

    // Wire grate platform (center 0.28, top at grateTopY = -1.05)
    addStaticBox(0.78, 0.04, 0.62, 0.28, this.grateTopY - 0.04, 0.04);

    // Widened Chute rim collar walls matching models.ts (chuteCenter = (-1.18, -1.12, 0.14))
    const cx = this.chuteCenter.x;
    const cz = this.chuteCenter.z;
    addStaticBox(0.68, 0.08, 0.03, cx, -1.04, cz - 0.5);
    addStaticBox(0.68, 0.08, 0.03, cx, -1.04, cz + 0.5);
    addStaticBox(0.03, 0.08, 0.53, cx - 0.65, -1.04, cz);
    addStaticBox(0.03, 0.08, 0.53, cx + 0.65, -1.04, cz);
    // Chute pit floor
    addStaticBox(0.63, 0.05, 0.48, cx, -1.72, cz);

    // Cabinet main floor
    addStaticBox(3.2, 0.08, 2.2, 0, -1.86, -0.2);
  }

  public resetRound(preserveSwing = false): void {
    const prevTrolleyX = this.trolleyPos.x;
    const prevTrolleyZ = this.trolleyPos.z;
    const shiftX = START_X - prevTrolleyX;
    const shiftZ = START_Z - prevTrolleyZ;

    this.trolleyPos.set(START_X, TROLLEY_Y, START_Z);
    this.trolleyVel.set(0, 0, 0);
    this.cableLength = MIN_CABLE;

    this.trolleyBody.position.set(START_X, TROLLEY_Y, START_Z);
    this.trolleyBody.velocity.set(0, 0, 0);

    const shackleY = TROLLEY_Y + SHACKLE_OFFSET_Y;
    this.shackleBody.position.set(START_X, shackleY, START_Z);
    this.shackleBody.velocity.set(0, 0, 0);

    const linkSpan = this.cableLength / CRANE_LINK_COUNT;
    const halfSpan = linkSpan * 0.5;
    this.topShackleConstraint.pivotB.set(0, halfSpan, 0);
    for (const c of this.chainConstraints) {
      c.pivotA.set(0, -halfSpan, 0);
      c.pivotB.set(0, halfSpan, 0);
    }
    this.ringJoint.pivotA.set(0, -halfSpan, 0);

    if (preserveSwing) {
      // Shift live chain + Ring relative to home while keeping 100% of swing offset, velocity, and spin
      if (Math.abs(shiftX) > 1e-4 || Math.abs(shiftZ) > 1e-4) {
        for (const link of this.chainBodies) {
          link.position.x += shiftX;
          link.position.z += shiftZ;
        }
        this.ringBody.position.x += shiftX;
        this.ringBody.position.z += shiftZ;
      }
      for (const link of this.chainBodies) link.wakeUp();
      this.ringBody.wakeUp();
    } else {
      let yCursor = shackleY;
      for (let i = 0; i < CRANE_LINK_COUNT; i++) {
        const link = this.chainBodies[i];
        link.position.set(START_X, yCursor - halfSpan, START_Z);
        link.velocity.set(0, 0, 0);
        link.angularVelocity.set(0, 0, 0);
        link.quaternion.set(0, 0, 0, 1);
        yCursor -= linkSpan;
      }

      const ringY = shackleY - this.cableLength - this.ringModel.eyeletLocalY;
      this.ringBody.position.set(START_X, ringY, START_Z);
      this.ringBody.velocity.set(0, 0, 0);
      this.ringBody.angularVelocity.set(0, 0, 0);
      this.ringBody.quaternion.setFromEuler(
        0,
        THREE.MathUtils.degToRad(this.stage.ring.restYawDeg),
        0,
      );
    }

    const hookDroppedOffStand =
      this.hookBody.position.y < this.stage.hook.anchorPosition[1] - 0.15;
    if (!preserveSwing || this.hasHookDetached || hookDroppedOffStand) {
      // '?' hook + red base board is ALWAYS dynamic, resting naturally on its 4-leg pedestal stand
      const [hx, hy, hz] = this.stage.hook.anchorPosition;
      this.hookBody.type = CANNON.Body.DYNAMIC;
      this.hookBody.mass = 0.78;
      this.hookBody.updateMassProperties();
      this.hookBody.position.set(hx, hy, hz);
      this.hookBody.velocity.set(0, 0, 0);
      this.hookBody.angularVelocity.set(0, 0, 0);
      this.hookBody.quaternion.set(0, 0, 0, 1);

      // Prize bundle sits on wire grate directly below '?' hook
      const prizeY = this.grateTopY + 0.01;
      this.prizeBody.position.set(hx, prizeY, hz);
      this.prizeBody.velocity.set(0, 0, 0);
      this.prizeBody.angularVelocity.set(0, 0, 0);
      this.prizeBody.quaternion.set(0, 0, 0, 1);

      // Arrange tether chain slackly between hook bottom eyelet and prize top eyelet
      const topHookY = hy + this.hookModel.bottomEyeletLocalY;
      const botPrizeY = prizeY + this.prizeModel.tetherAnchorLocalY;
      for (let i = 0; i < TETHER_LINK_COUNT; i++) {
        const f = (i + 0.5) / TETHER_LINK_COUNT;
        const tb = this.tetherBodies[i];
        tb.position.set(
          hx + Math.sin(f * Math.PI) * 0.04,
          THREE.MathUtils.lerp(topHookY, botPrizeY, f),
          hz + Math.sin(f * Math.PI) * 0.03,
        );
        tb.velocity.set(0, 0, 0);
        tb.angularVelocity.set(0, 0, 0);
        tb.quaternion.set(0, 0, 0, 1);
      }
    }

    this.phase = 'move_right';
    this.rightHeldOnce = false;
    this.backHeldOnce = false;
    this.bottomPauseTimer = 0;
    this.isThreaded = false;
    this.isRingHooked = false;
    this.hasHookDetached = false;
    this.wasHookedPreviously = false;
    this.returnStep = 'to_chute';
    this.chuteSettleTimer = 0;
    this.releaseTimer = 0;
    this.finishTriggered = false;
    this.clinkCooldown = 0;
    this.physicsAccumulator = 0;

    this.syncMeshes();
  }

  public step(frameDt: number, input: ControlInputState): GameHudTelemetry {
    const dt = Math.min(frameDt, 0.05);
    this.clinkCooldown = Math.max(0, this.clinkCooldown - dt);

    this.handleSequenceTransitions(input, dt);
    this.updateTrolleyAndWinch(dt, input);

    // Deterministic 180Hz real-time fixed-step loop prevents thin sphere tunneling under heavy load
    const FIXED_DT = 1 / 180;
    this.physicsAccumulator += dt;
    let steps = 0;
    while (this.physicsAccumulator >= FIXED_DT && steps < 10) {
      this.applyPreStepForcesAndConstraints(FIXED_DT);
      this.world.step(FIXED_DT);
      this.enforceChainInextensibility();
      this.evaluateContactsAndCatch(FIXED_DT);
      this.physicsAccumulator -= FIXED_DT;
      steps++;
    }
    if (steps === 10) {
      this.physicsAccumulator = 0;
    }

    this.syncMeshes();
    return this.buildTelemetry();
  }

  private handleSequenceTransitions(
    input: ControlInputState,
    dt: number,
  ): void {
    if (this.phase === 'move_right') {
      if (input.moveRight) {
        this.rightHeldOnce = true;
      } else if (this.rightHeldOnce) {
        this.phase = 'move_back';
      }
    } else if (this.phase === 'move_back') {
      if (input.moveBack) {
        this.backHeldOnce = true;
      } else if (this.backHeldOnce) {
        this.phase = 'auto_down';
      }
    } else if (this.phase === 'auto_down') {
      if (this.cableLength >= MAX_CABLE - 0.01) {
        this.bottomPauseTimer += dt;
        if (this.bottomPauseTimer >= 0.25) {
          this.phase = 'auto_up';
        }
      }
    } else if (this.phase === 'auto_up') {
      if (this.cableLength <= MIN_CABLE + 0.01) {
        const liftedCleanly =
          this.isRingHooked ||
          (this.hasHookDetached &&
            this.hookPos.y > this.stage.hook.anchorPosition[1] + 0.30 &&
            this.prizePos.y > this.grateTopY + 0.12);

        if (liftedCleanly) {
          this.returnStep = 'done';
          if (!this.finishTriggered) {
            this.finishTriggered = true;
            this.phase = 'won';
            this.callbacks.onWin();
          }
        } else {
          this.phase = 'auto_return';
          this.returnStep = 'to_chute';
        }
      }
    }
  }

  private updateTrolleyAndWinch(dt: number, input: ControlInputState): void {
    let targetVx = 0;
    let targetVz = 0;

    if (this.phase === 'move_right' && input.moveRight) {
      targetVx = 0.88;
    } else if (this.phase === 'move_back' && input.moveBack) {
      targetVz = -0.46;
    } else if (this.phase === 'auto_down') {
      this.cableLength = Math.min(MAX_CABLE, this.cableLength + 0.90 * dt);
    } else if (this.phase === 'auto_up') {
      const liftSpeed = this.isRingHooked ? 0.54 : 0.84;
      this.cableLength = Math.max(MIN_CABLE, this.cableLength - liftSpeed * dt);
    } else if (this.phase === 'auto_return') {
      this.stepAutoReturn(dt);
    }

    if (this.phase !== 'auto_return') {
      const isEyePlateStage = this.hookModel.hookType === 'eye_plate';
      const accelRate = isEyePlateStage
        ? targetVx === 0 && targetVz === 0
          ? 10.5
          : 7.5
        : targetVx === 0 && targetVz === 0
          ? 20
          : 15;
      this.trolleyVel.x = THREE.MathUtils.lerp(
        this.trolleyVel.x,
        targetVx,
        accelRate * dt,
      );
      this.trolleyVel.z = THREE.MathUtils.lerp(
        this.trolleyVel.z,
        targetVz,
        accelRate * dt,
      );
      this.trolleyPos.x = THREE.MathUtils.clamp(
        this.trolleyPos.x + this.trolleyVel.x * dt,
        -1.25,
        1.25,
      );
      this.trolleyPos.z = THREE.MathUtils.clamp(
        this.trolleyPos.z + this.trolleyVel.z * dt,
        -0.68,
        0.78,
      );

      if (this.phase === 'move_right' && this.trolleyPos.x >= 1.24) {
        this.phase = 'move_back';
      } else if (this.phase === 'move_back' && this.trolleyPos.z <= -0.67) {
        this.phase = 'auto_down';
      }
    }

    this.trolleyBody.position.set(
      this.trolleyPos.x,
      TROLLEY_Y,
      this.trolleyPos.z,
    );
    this.trolleyBody.velocity.set(this.trolleyVel.x, 0, this.trolleyVel.z);

    this.shackleBody.position.set(
      this.trolleyPos.x,
      TROLLEY_Y + SHACKLE_OFFSET_Y,
      this.trolleyPos.z,
    );
    this.shackleBody.velocity.set(this.trolleyVel.x, 0, this.trolleyVel.z);
  }

  private applyPreStepForcesAndConstraints(dt: number): void {
    // 1. Dynamically update winch chain link span across all 10 articulated rigid-body links
    const halfSpan = (this.cableLength / CRANE_LINK_COUNT) * 0.5;
    this.topShackleConstraint.pivotB.set(0, halfSpan, 0);
    for (let i = 0; i < this.chainConstraints.length; i++) {
      const c = this.chainConstraints[i];
      c.pivotA.set(0, -halfSpan, 0);
      c.pivotB.set(0, halfSpan, 0);
    }
    this.ringJoint.pivotA.set(0, -halfSpan, 0);

    const isEyePlateStage = this.hookModel.hookType === 'eye_plate';

    // 2. Gimbal-free swivel elasticity (Stage 1: soft free-spin, Stage 2: stabilized anti-sway)
    const restYaw = THREE.MathUtils.degToRad(this.stage.ring.restYawDeg);
    this.ringQuat.set(
      this.ringBody.quaternion.x,
      this.ringBody.quaternion.y,
      this.ringBody.quaternion.z,
      this.ringBody.quaternion.w,
    );

    _v1.set(1, 0, 0).applyQuaternion(this.ringQuat);
    const horizLen = Math.hypot(_v1.x, _v1.z);
    const yawK = isEyePlateStage ? 0.14 : 0.024;
    const yawDamp = isEyePlateStage ? 0.055 : 0.008;
    if (horizLen > 0.25) {
      const currentYaw = Math.atan2(-_v1.z, _v1.x);
      let yawErr = restYaw - currentYaw;
      while (yawErr > Math.PI) yawErr -= Math.PI * 2;
      while (yawErr < -Math.PI) yawErr += Math.PI * 2;
      this.ringBody.torque.y += yawErr * yawK - this.ringBody.angularVelocity.y * yawDamp;
    } else {
      this.ringBody.torque.y -= this.ringBody.angularVelocity.y * yawDamp;
    }

    // Stage-2-only directional horizontal sway damping (leaves vertical drop/lift 100% crisp)
    if (isEyePlateStage) {
      const chainDamp = 6.5;
      for (let i = 0; i < this.chainBodies.length; i++) {
        const link = this.chainBodies[i];
        link.force.x -= (link.velocity.x - this.trolleyVel.x) * link.mass * chainDamp;
        link.force.z -= (link.velocity.z - this.trolleyVel.z) * link.mass * chainDamp;
      }

      const hookLatDamp = this.isRingHooked ? 4.2 : 7.8;
      this.ringBody.force.x -=
        (this.ringBody.velocity.x - this.trolleyVel.x) * this.ringBody.mass * hookLatDamp;
      this.ringBody.force.z -=
        (this.ringBody.velocity.z - this.trolleyVel.z) * this.ringBody.mass * hookLatDamp;
      this.ringBody.torque.x -= this.ringBody.angularVelocity.x * 0.085;
      this.ringBody.torque.z -= this.ringBody.angularVelocity.z * 0.085;

      if (this.isRingHooked || this.hasHookDetached) {
        this.hookBody.force.x -= this.hookBody.velocity.x * this.hookBody.mass * 3.8;
        this.hookBody.force.z -= this.hookBody.velocity.z * this.hookBody.mass * 3.8;
        this.prizeBody.force.x -= this.prizeBody.velocity.x * this.prizeBody.mass * 4.5;
        this.prizeBody.force.z -= this.prizeBody.velocity.z * this.prizeBody.mass * 4.5;
      }
    }

    // During chute release, apply clean local-axis pitching torque to tip the Ring & drop the '?' hook
    if (this.phase === 'auto_return' && this.returnStep === 'release') {
      _tmpEuler.setFromQuaternion(this.ringQuat, 'YXZ');
      const targetPitch = 1.65;
      const pitchErr = targetPitch - _tmpEuler.x;
      const localOmega =
        this.ringBody.angularVelocity.x * _v1.x +
        this.ringBody.angularVelocity.y * _v1.y +
        this.ringBody.angularVelocity.z * _v1.z;
      const pitchRate = pitchErr * 7.2 - localOmega * 0.25;
      this.ringBody.torque.x += _v1.x * pitchRate;
      this.ringBody.torque.z += _v1.z * pitchRate;
    }

    void dt;
  }

  private enforceChainInextensibility(): void {
    // 1. Prevent crane chain from ever rubber-band stretching beyond cableLength + 2cm
    const shackleX = this.shackleBody.position.x;
    const shackleY = this.shackleBody.position.y;
    const shackleZ = this.shackleBody.position.z;

    this.ringBody.pointToWorldFrame(
      _cVec1.set(0, this.ringModel.eyeletLocalY, 0),
      _cVec2,
    );
    const dx = _cVec2.x - shackleX;
    const dy = _cVec2.y - shackleY;
    const dz = _cVec2.z - shackleZ;
    const craneDist = Math.hypot(dx, dy, dz);
    const maxCraneDist = this.cableLength + 0.008;

    if (craneDist > maxCraneDist && craneDist > 1e-5) {
      const inv = 1 / craneDist;
      const nx = dx * inv;
      const ny = dy * inv;
      const nz = dz * inv;
      const excess = craneDist - maxCraneDist;

      this.ringBody.position.x -= nx * excess;
      this.ringBody.position.y -= ny * excess;
      this.ringBody.position.z -= nz * excess;

      const vOut =
        this.ringBody.velocity.x * nx +
        this.ringBody.velocity.y * ny +
        this.ringBody.velocity.z * nz;
      if (vOut > 0) {
        this.ringBody.velocity.x -= nx * vOut;
        this.ringBody.velocity.y -= ny * vOut;
        this.ringBody.velocity.z -= nz * vOut;
      }

      // CRITICAL: Co-translate hooked '?' board by the exact same vector so Ring NEVER tunnels upward through the hook wire
      if (
        this.isRingHooked ||
        this.hasHookDetached ||
        this.wasHookedPreviously
      ) {
        this.hookBody.position.x -= nx * excess;
        this.hookBody.position.y -= ny * excess;
        this.hookBody.position.z -= nz * excess;
        const hookVOut =
          this.hookBody.velocity.x * nx +
          this.hookBody.velocity.y * ny +
          this.hookBody.velocity.z * nz;
        if (hookVOut > 0) {
          this.hookBody.velocity.x -= nx * hookVOut;
          this.hookBody.velocity.y -= ny * hookVOut;
          this.hookBody.velocity.z -= nz * hookVOut;
        }
      }

      // Snap chain links proportionally along the taut span so visual chain links never gap
      const updatedEx = _cVec2.x - nx * excess;
      const updatedEy = _cVec2.y - ny * excess;
      const updatedEz = _cVec2.z - nz * excess;
      for (let i = 0; i < CRANE_LINK_COUNT; i++) {
        const f = (i + 0.5) / CRANE_LINK_COUNT;
        const link = this.chainBodies[i];
        const tx = THREE.MathUtils.lerp(shackleX, updatedEx, f);
        const ty = THREE.MathUtils.lerp(shackleY, updatedEy, f);
        const tz = THREE.MathUtils.lerp(shackleZ, updatedEz, f);
        link.position.x = THREE.MathUtils.lerp(link.position.x, tx, 0.72);
        link.position.y = THREE.MathUtils.lerp(link.position.y, ty, 0.72);
        link.position.z = THREE.MathUtils.lerp(link.position.z, tz, 0.72);
      }
    }

    // 2. Prevent prize tether chain from ever stretching beyond TETHER_LINK_COUNT * TETHER_LINK_LEN
    this.hookBody.pointToWorldFrame(
      _cVec1.set(0, this.hookModel.bottomEyeletLocalY, 0),
      _cVec2,
    );
    const hx = _cVec2.x;
    const hy = _cVec2.y;
    const hz = _cVec2.z;

    this.prizeBody.pointToWorldFrame(
      _cVec1.set(0, this.prizeModel.tetherAnchorLocalY, 0),
      _cVec2,
    );
    const tdx = _cVec2.x - hx;
    const tdy = _cVec2.y - hy;
    const tdz = _cVec2.z - hz;
    const tetherDist = Math.hypot(tdx, tdy, tdz);
    const maxTetherDist = TETHER_LINK_COUNT * TETHER_LINK_LEN + 0.008;

    if (tetherDist > maxTetherDist && tetherDist > 1e-5) {
      const inv = 1 / tetherDist;
      const nx = tdx * inv;
      const ny = tdy * inv;
      const nz = tdz * inv;
      const excess = tetherDist - maxTetherDist;

      // Pull prize toward hook board proportionally to inverse masses (0.74 vs 0.26)
      this.prizeBody.position.x -= nx * excess * 0.74;
      this.prizeBody.position.y -= ny * excess * 0.74;
      this.prizeBody.position.z -= nz * excess * 0.74;
      this.hookBody.position.x += nx * excess * 0.26;
      this.hookBody.position.y += ny * excess * 0.26;
      this.hookBody.position.z += nz * excess * 0.26;

      const relVx = this.prizeBody.velocity.x - this.hookBody.velocity.x;
      const relVy = this.prizeBody.velocity.y - this.hookBody.velocity.y;
      const relVz = this.prizeBody.velocity.z - this.hookBody.velocity.z;
      const vSep = relVx * nx + relVy * ny + relVz * nz;
      if (vSep > 0) {
        this.prizeBody.velocity.x -= nx * vSep * 0.74;
        this.prizeBody.velocity.y -= ny * vSep * 0.74;
        this.prizeBody.velocity.z -= nz * vSep * 0.74;
        this.hookBody.velocity.x += nx * vSep * 0.26;
        this.hookBody.velocity.y += ny * vSep * 0.26;
        this.hookBody.velocity.z += nz * vSep * 0.26;
      }

      for (let i = 0; i < TETHER_LINK_COUNT; i++) {
        const f = (i + 0.5) / TETHER_LINK_COUNT;
        const tb = this.tetherBodies[i];
        tb.position.x = THREE.MathUtils.lerp(
          hx + nx * excess * 0.26,
          _cVec2.x - nx * excess * 0.74,
          f,
        );
        tb.position.y = THREE.MathUtils.lerp(
          hy + ny * excess * 0.26,
          _cVec2.y - ny * excess * 0.74,
          f,
        );
        tb.position.z = THREE.MathUtils.lerp(
          hz + nz * excess * 0.26,
          _cVec2.z - nz * excess * 0.74,
          f,
        );
      }
    }
  }

  private evaluateContactsAndCatch(_dt: number): void {
    const isReleasing =
      this.phase === 'auto_return' && this.returnStep === 'release';

    // Update world transforms of Ring & Hook spine for hole piercing geometry check
    this.ringPos.set(
      this.ringBody.position.x,
      this.ringBody.position.y,
      this.ringBody.position.z,
    );
    this.ringQuat.set(
      this.ringBody.quaternion.x,
      this.ringBody.quaternion.y,
      this.ringBody.quaternion.z,
      this.ringBody.quaternion.w,
    );
    this.hookPos.set(
      this.hookBody.position.x,
      this.hookBody.position.y,
      this.hookBody.position.z,
    );
    this.hookQuat.set(
      this.hookBody.quaternion.x,
      this.hookBody.quaternion.y,
      this.hookBody.quaternion.z,
      this.hookBody.quaternion.w,
    );

    const spineLocal = this.hookModel.spineLocal;
    const count = spineLocal.length;
    for (let i = 0; i < count; i++) {
      this.hookSpineWorld[i]
        .copy(spineLocal[i])
        .applyQuaternion(this.hookQuat)
        .add(this.hookPos);
    }

    let piercedRingHole = false;
    let piercedIdx = -1;

    if (
      this.ringModel.toolType === 'j_hook' &&
      this.hookModel.hookType === 'eye_plate'
    ) {
      // Stage 2: Check if crane's J-hook curve passes through the Eye Plate's U-arch window
      const craneLocal = this.ringModel.spineLocal;
      const cCount = craneLocal.length;
      for (let i = 0; i < cCount; i++) {
        this.craneSpineWorld[i]
          .copy(craneLocal[i])
          .applyQuaternion(this.ringQuat)
          .add(this.ringPos);
      }

      _invHookQuat.copy(this.hookQuat).invert();
      const maxX = this.hookModel.eyeHalfSpan - 0.012;
      const minY = this.hookModel.plateTopLocalY - 0.008;
      const maxY = this.hookModel.eyeTopLocalY;

      for (let i = 0; i < cCount - 1; i++) {
        _v1
          .subVectors(this.craneSpineWorld[i], this.hookPos)
          .applyQuaternion(_invHookQuat);
        _v2
          .subVectors(this.craneSpineWorld[i + 1], this.hookPos)
          .applyQuaternion(_invHookQuat);

        if ((_v1.z >= 0 && _v2.z <= 0) || (_v1.z <= 0 && _v2.z >= 0)) {
          const dz = _v2.z - _v1.z;
          const alpha = Math.abs(dz) > 1e-6 ? -_v1.z / dz : 0.5;
          const cx = THREE.MathUtils.lerp(_v1.x, _v2.x, alpha);
          const cy = THREE.MathUtils.lerp(_v1.y, _v2.y, alpha);
          if (Math.abs(cx) < maxX && cy > minY && cy < maxY) {
            piercedRingHole = true;
            piercedIdx = i;
          }
        }
      }
    } else {
      // Stage 1: Check if '?' hook spine passes through the hollow interior of the Ring
      _invRingQuat.copy(this.ringQuat).invert();
      const R = this.stage.ring.majorRadius;
      const rTube = this.stage.ring.tubeRadius;

      for (let i = 0; i < count - 1; i++) {
        _v1
          .subVectors(this.hookSpineWorld[i], this.ringPos)
          .applyQuaternion(_invRingQuat);
        _v2
          .subVectors(this.hookSpineWorld[i + 1], this.ringPos)
          .applyQuaternion(_invRingQuat);

        if ((_v1.z >= 0 && _v2.z <= 0) || (_v1.z <= 0 && _v2.z >= 0)) {
          const dz = _v2.z - _v1.z;
          const alpha = Math.abs(dz) > 1e-6 ? -_v1.z / dz : 0.5;
          const cx = THREE.MathUtils.lerp(_v1.x, _v2.x, alpha);
          const cy = THREE.MathUtils.lerp(_v1.y, _v2.y, alpha);
          const rho = Math.hypot(cx, cy);
          if (rho < R - rTube * 0.15) {
            piercedRingHole = true;
            piercedIdx = i;
          }
        }
      }
    }

    // Inspect real cannon-es contact equations between ringBody and hookBody
    let archContactDetected = false;
    let maxImpact = 0;

    for (const c of this.world.contacts) {
      const isChainHit =
        c.bi.collisionFilterGroup === GROUP_CHAIN ||
        c.bj.collisionFilterGroup === GROUP_CHAIN;
      if (isChainHit) {
        const impactVel = Math.abs(c.getImpactVelocityAlongNormal());
        if (impactVel * 0.55 > maxImpact) maxImpact = impactVel * 0.55;
        continue;
      }

      const isRingHookPair =
        (c.bi === this.ringBody && c.bj === this.hookBody) ||
        (c.bi === this.hookBody && c.bj === this.ringBody);
      if (!isRingHookPair) continue;

      const impactVel = Math.abs(c.getImpactVelocityAlongNormal());
      if (impactVel > maxImpact) maxImpact = impactVel;

      const hookShape = c.bi === this.hookBody ? c.si : c.sj;
      const ringShape = c.bi === this.ringBody ? c.si : c.sj;
      if (this.hookArchShapes.has(hookShape)) {
        if (this.ringModel.toolType === 'j_hook') {
          // Stage 2: J-hook's bottom cradle contacting the Eye Plate U-arch
          if (
            this.craneToolCradleShapes.has(ringShape) &&
            this.ringPos.y > this.hookPos.y - 0.18 &&
            this.ringPos.y < this.hookPos.y + 0.34
          ) {
            archContactDetected = true;
          }
        } else {
          // Stage 1: Ring bottom rim lifting under the '?' crown
          if (
            this.ringPos.y > this.hookPos.y - 0.14 &&
            this.ringPos.y < this.hookPos.y + 0.38
          ) {
            archContactDetected = true;
          }
        }
      }
    }

    if (maxImpact > 0.35 && this.clinkCooldown <= 0) {
      this.clinkCooldown = 0.08;
      this.callbacks.onMetalClink(Math.min(1, maxImpact * 0.55));
    }

    this.isThreaded = !isReleasing && piercedRingHole;
    const canEngageHook =
      !isReleasing &&
      (this.phase === 'auto_up' ||
        this.phase === 'auto_return' ||
        this.hasHookDetached);

    const inUpperArch =
      this.ringModel.toolType === 'j_hook'
        ? piercedIdx >= 5 && piercedIdx <= 27
        : piercedIdx >= 6 && piercedIdx <= 27;
    const hookStillSuspendedOnRing =
      this.wasHookedPreviously &&
      this.hookPos.y > this.grateTopY + 0.48 &&
      this.hookPos.distanceTo(this.ringPos) < 0.48;

    this.isRingHooked =
      canEngageHook &&
      ((piercedRingHole &&
        (archContactDetected || (this.hasHookDetached && inUpperArch))) ||
        hookStillSuspendedOnRing);

    // Mark detached once the always-dynamic '?' hook + red board is lifted off its stand
    if (
      this.isRingHooked &&
      !this.hasHookDetached &&
      this.hookPos.y > this.stage.hook.anchorPosition[1] + 0.04
    ) {
      this.hasHookDetached = true;
    }

    // Invisible win sensor covering the chute opening AND extending upward above the chute
    const inChuteSensor = (p: THREE.Vector3) =>
      p.x > this.chuteCenter.x - 0.64 &&
      p.x < this.chuteCenter.x + 0.64 &&
      p.z > this.chuteCenter.z - 0.5 &&
      p.z < this.chuteCenter.z + 0.5 &&
      p.y > -1.85 &&
      p.y < TROLLEY_Y;

    if (
      !this.finishTriggered &&
      (this.phase === 'auto_down' ||
        this.phase === 'auto_up' ||
        this.phase === 'auto_return') &&
      (inChuteSensor(this.prizePos) || inChuteSensor(this.hookPos))
    ) {
      this.finishTriggered = true;
      this.phase = 'won';
      this.callbacks.onWin();
      return;
    }

    if (this.isRingHooked && !this.wasHookedPreviously) {
      this.callbacks.onHookCatch();
    } else if (
      this.wasHookedPreviously &&
      !this.isRingHooked &&
      this.hookPos.y > this.stage.hook.anchorPosition[1] + 0.12 &&
      this.phase !== 'auto_return'
    ) {
      this.callbacks.onRingSlip();
    }
    this.wasHookedPreviously = this.isRingHooked;
  }

  private stepAutoReturn(dt: number): void {
    if (this.returnStep === 'to_chute') {
      const targetX = this.isRingHooked ? this.chuteCenter.x : START_X;
      const targetZ = this.isRingHooked ? this.chuteCenter.z : START_Z;
      const dx = targetX - this.trolleyPos.x;
      const dz = targetZ - this.trolleyPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.05) {
        const speed = this.isRingHooked
          ? THREE.MathUtils.clamp(dist * 3.2, 0.25, 0.92)
          : 0.98;
        const desiredVx = (dx / dist) * speed;
        const desiredVz = (dz / dist) * speed;
        this.trolleyVel.x = THREE.MathUtils.lerp(
          this.trolleyVel.x,
          desiredVx,
          12 * dt,
        );
        this.trolleyVel.z = THREE.MathUtils.lerp(
          this.trolleyVel.z,
          desiredVz,
          12 * dt,
        );
        this.trolleyPos.x += this.trolleyVel.x * dt;
        this.trolleyPos.z += this.trolleyVel.z * dt;
      } else {
        this.trolleyPos.x = targetX;
        this.trolleyPos.z = targetZ;
        this.trolleyVel.set(0, 0, 0);
        if (this.isRingHooked) {
          this.chuteSettleTimer += dt;
          const hookChuteOffset = Math.hypot(
            this.hookPos.x - this.chuteCenter.x,
            this.hookPos.z - this.chuteCenter.z,
          );
          if (hookChuteOffset < 0.36 || this.chuteSettleTimer >= 0.55) {
            this.returnStep = 'release';
            this.releaseTimer = 0;
          }
        } else {
          this.returnStep = 'done';
          if (!this.finishTriggered) {
            this.finishTriggered = true;
            this.phase = 'failed';
            this.callbacks.onFail(
              this.hookModel.hookType === 'eye_plate'
                ? 'フックが金具に掛かりませんでした'
                : 'リングが？型フックに掛かりませんでした',
            );
          }
        }
      }
    } else if (this.returnStep === 'release') {
      this.releaseTimer += dt;
      this.cableLength = Math.min(1.12, this.cableLength + 0.42 * dt);
      if (
        this.prizePos.y < -1.10 ||
        this.hookPos.y < -0.55 ||
        this.releaseTimer > 1.75
      ) {
        this.returnStep = 'done';
        if (!this.finishTriggered) {
          this.finishTriggered = true;
          this.phase = 'won';
          this.callbacks.onWin();
        }
      }
    }
  }

  private buildTelemetry(): GameHudTelemetry {
    const lift = Math.max(0, this.prizePos.y - (this.grateTopY + 0.02));
    const isEyePlate = this.hookModel.hookType === 'eye_plate';
    let guideTitle = '→ 横移動';
    let guideDetail = '長押しで右へ移動';

    switch (this.phase) {
      case 'move_right':
        guideTitle = '→ 横移動';
        guideDetail = '長押しで右へ移動';
        break;
      case 'move_back':
        guideTitle = '↑ 奥移動';
        guideDetail = '長押しで奥へ移動';
        break;
      case 'auto_down':
        guideTitle = '↓ 下降（自動）';
        guideDetail = isEyePlate
          ? 'Jフックが景品の金具へ降下中'
          : 'リングが？型フックへ降下中';
        break;
      case 'auto_up':
        guideTitle = '↑ 上昇（自動）';
        guideDetail = this.isRingHooked
          ? 'キャッチ！景品を持ち上げ中'
          : '引き上げ中…';
        break;
      case 'auto_return':
        guideTitle = '← 戻る（自動）';
        guideDetail = this.isRingHooked
          ? '獲得口へ運んでいます…！'
          : '初期位置へ戻っています';
        break;
      case 'won':
        guideTitle = 'GET!';
        guideDetail = '景品を獲得しました！';
        break;
      case 'failed':
        guideTitle = 'おしい！';
        guideDetail = 'もう一度挑戦しよう';
        break;
    }

    return {
      phase: this.phase,
      isRingHooked: this.isRingHooked,
      ringLiftHeight: lift,
      guideTitle,
      guideDetail,
      failReason:
        this.phase === 'failed'
          ? isEyePlate
            ? 'フックが金具に掛かりませんでした'
            : 'リングが？型フックに掛かりませんでした'
          : null,
    };
  }

  private syncMeshes(): void {
    // Sync Ring
    this.ringPos.set(
      this.ringBody.position.x,
      this.ringBody.position.y,
      this.ringBody.position.z,
    );
    this.ringQuat.set(
      this.ringBody.quaternion.x,
      this.ringBody.quaternion.y,
      this.ringBody.quaternion.z,
      this.ringBody.quaternion.w,
    );
    this.ringModel.group.position.copy(this.ringPos);
    this.ringModel.group.quaternion.copy(this.ringQuat);

    // Sync '?' Hook
    this.hookPos.set(
      this.hookBody.position.x,
      this.hookBody.position.y,
      this.hookBody.position.z,
    );
    this.hookQuat.set(
      this.hookBody.quaternion.x,
      this.hookBody.quaternion.y,
      this.hookBody.quaternion.z,
      this.hookBody.quaternion.w,
    );
    this.hookModel.group.position.copy(this.hookPos);
    this.hookModel.group.quaternion.copy(this.hookQuat);

    // Sync Prize Bundle
    this.prizePos.set(
      this.prizeBody.position.x,
      this.prizeBody.position.y,
      this.prizeBody.position.z,
    );
    this.prizeQuat.set(
      this.prizeBody.quaternion.x,
      this.prizeBody.quaternion.y,
      this.prizeBody.quaternion.z,
      this.prizeBody.quaternion.w,
    );
    this.prizeModel.group.position.copy(this.prizePos);
    this.prizeModel.group.quaternion.copy(this.prizeQuat);

    // Build 11 crane chain visual nodes directly from the 10 articulated physics chain joints -> Ring eyelet
    const halfSpan = (this.cableLength / CRANE_LINK_COUNT) * 0.5;
    this.craneChainNodes[0].set(
      this.shackleBody.position.x,
      this.shackleBody.position.y,
      this.shackleBody.position.z,
    );
    for (let i = 0; i < CRANE_LINK_COUNT - 1; i++) {
      this.chainBodies[i].pointToWorldFrame(
        _cVec1.set(0, -halfSpan, 0),
        _cVec2,
      );
      this.craneChainNodes[i + 1].set(_cVec2.x, _cVec2.y, _cVec2.z);
    }
    _v3
      .set(0, this.ringModel.eyeletLocalY, 0)
      .applyQuaternion(this.ringQuat)
      .add(this.ringPos);
    this.craneChainNodes[10].copy(_v3);

    // Build 5 tether visual nodes: Hook bottom eyelet -> 3 rigid tether bodies -> Prize top eyelet
    this.hookBody.pointToWorldFrame(
      _cVec1.set(0, this.hookModel.bottomEyeletLocalY, 0),
      _cVec2,
    );
    this.prizeTetherNodes[0].set(_cVec2.x, _cVec2.y, _cVec2.z);
    for (let i = 0; i < TETHER_LINK_COUNT; i++) {
      const tb = this.tetherBodies[i];
      this.prizeTetherNodes[1 + i].set(
        tb.position.x,
        tb.position.y,
        tb.position.z,
      );
    }
    this.prizeBody.pointToWorldFrame(
      _cVec1.set(0, this.prizeModel.tetherAnchorLocalY, 0),
      _cVec2,
    );
    this.prizeTetherNodes[4].set(_cVec2.x, _cVec2.y, _cVec2.z);
    void _cQuat;
  }
}
