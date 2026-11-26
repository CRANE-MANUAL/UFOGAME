import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import type {
  ControlInputState,
  GameHudTelemetry,
  PlayPhase,
  StageConfig,
} from '../types/game';
import type {
  BridgeClawRigHandle,
  BridgeEnvironmentHandle,
  BridgePrizeBoxHandle,
} from './models';
import type { PhysicsCallbacks } from './physics';

const TROLLEY_Y = 2.25;
const START_X = -0.78;
const START_Z = 0.6;
const REST_HEAD_Y = 1.18;
const MIN_HEAD_Y = -0.045;

const GROUP_BOX = 1;
const GROUP_ROD = 2;
const GROUP_ARM = 4;
const GROUP_CABINET = 8;

const _v1 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();

export class BridgePhysicsWorld {
  private stage: StageConfig;
  private clawRig: BridgeClawRigHandle;
  private prizeModel: BridgePrizeBoxHandle;
  private env: BridgeEnvironmentHandle;
  private callbacks: PhysicsCallbacks;

  private world: CANNON.World;
  private headBody: CANNON.Body;
  private leftArmBody: CANNON.Body;
  private rightArmBody: CANNON.Body;
  private leftHinge: CANNON.HingeConstraint;
  private rightHinge: CANNON.HingeConstraint;
  private boxBody: CANNON.Body;

  public trolleyPos = new THREE.Vector3(START_X, TROLLEY_Y, START_Z);
  private trolleyVel = new THREE.Vector3();
  private headY = REST_HEAD_Y;

  public boxPos = new THREE.Vector3();
  public boxQuat = new THREE.Quaternion();

  public phase: PlayPhase = 'move_right';
  private rightHeldOnce = false;
  private backHeldOnce = false;
  private bottomStage: 'pause' | 'closing' = 'pause';
  private bottomTimer = 0;
  private homeCycleStage: 'moving' | 'opening' | 'closing' | 'done' = 'moving';
  private homeCycleTimer = 0;
  private returnSettleTimer = 0;
  private finishTriggered = false;
  private physicsAccumulator = 0;
  private targetArmOpen = 0.28;
  private armMotorForce = 3.2;
  private isBoxPinched = false;
  private wasBoxPinched = false;

  private readonly initialBoxPos: THREE.Vector3;

  constructor(
    stage: StageConfig,
    clawRig: BridgeClawRigHandle,
    prizeModel: BridgePrizeBoxHandle,
    env: BridgeEnvironmentHandle,
    callbacks: PhysicsCallbacks,
  ) {
    this.stage = stage;
    this.clawRig = clawRig;
    this.prizeModel = prizeModel;
    this.env = env;
    this.callbacks = callbacks;

    // Rest box centered across the two lower inner bridge rods (z = ±0.23, y = -0.76)
    const innerRodY = env.rodSpecs[1]?.y ?? -0.76;
    const rodR = env.rodSpecs[1]?.radius ?? 0.022;
    this.initialBoxPos = new THREE.Vector3(
      0,
      innerRodY + rodR + stage.prize.height * 0.5,
      0,
    );

    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -18.0, 0),
      allowSleep: false,
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    const solver = new CANNON.GSSolver();
    solver.iterations = 48;
    solver.tolerance = 0.00005;
    this.world.solver = solver;

    const boxMat = new CANNON.Material('bridgeBox');
    const rodMat = new CANNON.Material('tensionRod');
    const armMat = new CANNON.Material('clawArm');
    const cabinetMat = new CANNON.Material('cabinet');

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(boxMat, rodMat, {
        friction: 0.22,
        restitution: 0.04,
        contactEquationStiffness: 6e7,
        contactEquationRelaxation: 2.2,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(boxMat, armMat, {
        friction: 0.36,
        restitution: 0.04,
        contactEquationStiffness: 4.5e7,
        contactEquationRelaxation: 2.6,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(armMat, rodMat, {
        friction: 0.22,
        restitution: 0.08,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(boxMat, cabinetMat, {
        friction: 0.55,
        restitution: 0.06,
      }),
    );

    this.buildEnvironmentColliders(rodMat, cabinetMat);

    // Kinematic UFO Catcher head body
    this.headBody = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      mass: 0,
      collisionResponse: false,
    });
    this.world.addBody(this.headBody);

    // Dynamic left & right L-arms attached via motorized HingeConstraints
    this.leftArmBody = this.createArmBody(-1, armMat);
    this.rightArmBody = this.createArmBody(1, armMat);
    this.world.addBody(this.leftArmBody);
    this.world.addBody(this.rightArmBody);

    const lp = this.clawRig.leftArmPivotLocal;
    const rp = this.clawRig.rightArmPivotLocal;
    this.leftHinge = new CANNON.HingeConstraint(
      this.headBody,
      this.leftArmBody,
      {
        pivotA: new CANNON.Vec3(lp.x, lp.y, lp.z),
        axisA: new CANNON.Vec3(0, 0, 1),
        pivotB: new CANNON.Vec3(0, 0, 0),
        axisB: new CANNON.Vec3(0, 0, 1),
        maxForce: 1e6,
        collideConnected: false,
      },
    );
    this.rightHinge = new CANNON.HingeConstraint(
      this.headBody,
      this.rightArmBody,
      {
        pivotA: new CANNON.Vec3(rp.x, rp.y, rp.z),
        axisA: new CANNON.Vec3(0, 0, 1),
        pivotB: new CANNON.Vec3(0, 0, 0),
        axisB: new CANNON.Vec3(0, 0, 1),
        maxForce: 1e6,
        collideConnected: false,
      },
    );
    this.leftHinge.enableMotor();
    this.rightHinge.enableMotor();
    this.world.addConstraint(this.leftHinge);
    this.world.addConstraint(this.rightHinge);

    // Heavy Prize Box Rigid Body (shifts/tilts across rods rather than lifting cleanly into the air)
    this.boxBody = new CANNON.Body({
      mass: Math.max(2.6, stage.prize.mass),
      material: boxMat,
      linearDamping: 0.16,
      angularDamping: 0.28,
      collisionFilterGroup: GROUP_BOX,
      collisionFilterMask: GROUP_ROD | GROUP_ARM | GROUP_CABINET,
    });
    this.boxBody.addShape(
      new CANNON.Box(
        new CANNON.Vec3(
          stage.prize.width * 0.5,
          stage.prize.height * 0.5,
          stage.prize.depth * 0.5,
        ),
      ),
    );
    this.world.addBody(this.boxBody);

    this.resetRound(false);
  }

  private createArmBody(side: -1 | 1, mat: CANNON.Material): CANNON.Body {
    const body = new CANNON.Body({
      mass: 0.28,
      material: mat,
      linearDamping: 0.08,
      angularDamping: 0.35,
      collisionFilterGroup: GROUP_ARM,
      collisionFilterMask: GROUP_BOX | GROUP_ROD,
    });

    const s = side;
    const elbowX = 0.27 * s;
    const elbowY = -0.24;
    const botX = -0.12 * s;
    const botY = -0.57;

    // Upper diagonal segment
    const len1 = Math.hypot(elbowX, elbowY);
    const ang1 = Math.atan2(elbowY, elbowX);
    const q1 = new CANNON.Quaternion();
    q1.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), ang1);
    body.addShape(
      new CANNON.Box(new CANNON.Vec3(len1 * 0.5, 0.022, 0.022)),
      new CANNON.Vec3(elbowX * 0.5, elbowY * 0.5, 0),
      q1,
    );

    // Lower inward segment
    const len2 = Math.hypot(botX - elbowX, botY - elbowY);
    const ang2 = Math.atan2(botY - elbowY, botX - elbowX);
    const q2 = new CANNON.Quaternion();
    q2.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), ang2);
    body.addShape(
      new CANNON.Box(new CANNON.Vec3(len2 * 0.5, 0.022, 0.022)),
      new CANNON.Vec3((elbowX + botX) * 0.5, (elbowY + botY) * 0.5, 0),
      q2,
    );

    // Angled metal paddle claw tip ('爪')
    const qTip = new CANNON.Quaternion();
    qTip.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), 0.28 * s);
    body.addShape(
      new CANNON.Box(new CANNON.Vec3(0.05, 0.01, 0.024)),
      new CANNON.Vec3(botX - 0.042 * s, botY - 0.015, 0),
      qTip,
    );

    return body;
  }

  private buildEnvironmentColliders(
    rodMat: CANNON.Material,
    cabinetMat: CANNON.Material,
  ): void {
    // 4 horizontal cylindrical tension rods along X axis
    const rodQuat = new CANNON.Quaternion();
    rodQuat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);

    for (const spec of this.env.rodSpecs) {
      const rodBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        mass: 0,
        material: rodMat,
        collisionFilterGroup: GROUP_ROD,
        collisionFilterMask: GROUP_BOX | GROUP_ARM,
      });
      rodBody.addShape(
        new CANNON.Cylinder(
          spec.radius,
          spec.radius,
          spec.halfLength * 2,
          14,
        ),
        new CANNON.Vec3(0, 0, 0),
        rodQuat,
      );
      rodBody.position.set(0, spec.y, spec.z);
      this.world.addBody(rodBody);
    }

    const addStaticBox = (
      hx: number,
      hy: number,
      hz: number,
      px: number,
      py: number,
      pz: number,
    ) => {
      const b = new CANNON.Body({
        type: CANNON.Body.STATIC,
        mass: 0,
        material: cabinetMat,
        collisionFilterGroup: GROUP_CABINET,
        collisionFilterMask: GROUP_BOX,
      });
      b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
      b.position.set(px, py, pz);
      this.world.addBody(b);
    };

    // Side apron walls & clamp bars bounding the drop pit
    addStaticBox(0.575, 0.48, 1.35, -1.635, -1.3, -0.1);
    addStaticBox(0.575, 0.48, 1.35, 1.635, -1.3, -0.1);
    addStaticBox(1.07, 0.48, 0.36, 0, -1.3, -1.18);
    addStaticBox(1.07, 0.48, 0.325, 0, -1.3, 1.145);

    // Side clamp rails at x = ±1.04 + vertical risers for elevated outer rods
    addStaticBox(0.04, 0.06, 0.53, -1.04, -0.76, 0);
    addStaticBox(0.04, 0.06, 0.53, 1.04, -0.76, 0);
    addStaticBox(0.028, 0.08, 0.028, -1.04, -0.69, -0.44);
    addStaticBox(0.028, 0.08, 0.028, -1.04, -0.69, 0.44);
    addStaticBox(0.028, 0.08, 0.028, 1.04, -0.69, -0.44);
    addStaticBox(0.028, 0.08, 0.028, 1.04, -0.69, 0.44);

    // Clear acrylic guard decks blocking drops outside the middle 2 rods (z > 0.245 and z < -0.245)
    addStaticBox(1.04, 0.015, 0.3, 0, -0.785, 0.545);
    addStaticBox(1.04, 0.015, 0.3, 0, -0.785, -0.545);

    // Pit floor
    addStaticBox(3.4, 0.08, 2.25, 0, -1.86, -0.2);
  }

  public resetRound(preserveBox = false): void {
    this.trolleyPos.set(START_X, TROLLEY_Y, START_Z);
    this.trolleyVel.set(0, 0, 0);
    this.headY = REST_HEAD_Y;

    this.headBody.position.set(START_X, REST_HEAD_Y, START_Z);
    this.headBody.velocity.set(0, 0, 0);
    this.headBody.quaternion.set(0, 0, 0, 1);

    this.targetArmOpen = 0.01;
    this.armMotorForce = 2.6;

    const lp = this.clawRig.leftArmPivotLocal;
    const rp = this.clawRig.rightArmPivotLocal;

    this.leftArmBody.position.set(START_X + lp.x, REST_HEAD_Y + lp.y, START_Z);
    this.leftArmBody.velocity.set(0, 0, 0);
    this.leftArmBody.angularVelocity.set(0, 0, 0);
    this.leftArmBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 0, 1),
      -this.targetArmOpen,
    );

    this.rightArmBody.position.set(START_X + rp.x, REST_HEAD_Y + rp.y, START_Z);
    this.rightArmBody.velocity.set(0, 0, 0);
    this.rightArmBody.angularVelocity.set(0, 0, 0);
    this.rightArmBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 0, 1),
      this.targetArmOpen,
    );

    const boxAlreadyDropped =
      this.boxBody.position.y < this.env.pitDropY ||
      Math.abs(this.boxBody.position.x) > 1.2 ||
      Math.abs(this.boxBody.position.z) > 1.0;

    if (!preserveBox || boxAlreadyDropped) {
      this.boxBody.position.set(
        this.initialBoxPos.x,
        this.initialBoxPos.y,
        this.initialBoxPos.z,
      );
      this.boxBody.velocity.set(0, 0, 0);
      this.boxBody.angularVelocity.set(0, 0, 0);
      this.boxBody.quaternion.set(0, 0, 0, 1);
    } else {
      this.boxBody.wakeUp();
    }

    this.phase = 'move_right';
    this.rightHeldOnce = false;
    this.backHeldOnce = false;
    this.bottomStage = 'pause';
    this.bottomTimer = 0;
    this.homeCycleStage = 'moving';
    this.homeCycleTimer = 0;
    this.returnSettleTimer = 0;
    this.finishTriggered = false;
    this.physicsAccumulator = 0;
    this.isBoxPinched = false;
    this.wasBoxPinched = false;

    this.syncMeshes();
  }

  public step(frameDt: number, input: ControlInputState): GameHudTelemetry {
    const dt = Math.min(frameDt, 0.05);

    this.handleSequenceTransitions(input, dt);
    this.updateTrolleyAndHead(dt, input);

    const FIXED_DT = 1 / 180;
    this.physicsAccumulator += dt;
    let steps = 0;
    while (this.physicsAccumulator >= FIXED_DT && steps < 10) {
      this.updateArmMotors();
      this.world.step(FIXED_DT);
      this.evaluateWinAndContacts();
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
      this.targetArmOpen = 0.01;
      this.armMotorForce = 0.15;
      if (input.moveRight) {
        this.rightHeldOnce = true;
      } else if (this.rightHeldOnce) {
        this.phase = 'move_back';
      }
    } else if (this.phase === 'move_back') {
      this.targetArmOpen = 0.01;
      this.armMotorForce = 0.15;
      if (input.moveBack) {
        this.backHeldOnce = true;
      } else if (this.backHeldOnce) {
        this.phase = 'auto_down';
        this.bottomStage = 'pause';
        this.bottomTimer = 0;
      }
    } else if (this.phase === 'auto_down') {
      this.targetArmOpen = 0.64;
      this.armMotorForce = 0.18;
      if (this.headY <= MIN_HEAD_Y + 0.005) {
        this.bottomTimer += dt;
        if (this.bottomStage === 'pause' && this.bottomTimer >= 0.14) {
          this.bottomStage = 'closing';
          this.bottomTimer = 0;
        } else if (this.bottomStage === 'closing') {
          this.targetArmOpen = -0.02;
          // Gentle weak closing force (stroking/nudging feel)
          this.armMotorForce = 0.055;
          if (this.bottomTimer >= 0.62) {
            this.phase = 'auto_up';
          }
        }
      }
    } else if (this.phase === 'auto_up') {
      // Very weak stroking arm power: lightly strokes/nudges corners without lifting the heavy box
      this.targetArmOpen = -0.02;
      this.armMotorForce = this.headY > 0.16 ? 0.014 : 0.032;
      if (this.headY >= REST_HEAD_Y - 0.01) {
        this.phase = 'auto_return';
        this.homeCycleStage = 'moving';
        this.homeCycleTimer = 0;
        this.returnSettleTimer = 0;
      }
    }
  }

  private updateTrolleyAndHead(dt: number, input: ControlInputState): void {
    let targetVx = 0;
    let targetVz = 0;
    let targetHeadVy = 0;

    if (this.phase === 'move_right' && input.moveRight) {
      targetVx = 0.76;
    } else if (this.phase === 'move_back' && input.moveBack) {
      targetVz = -0.46;
    } else if (this.phase === 'auto_down') {
      if (this.headY > MIN_HEAD_Y) {
        targetHeadVy = -0.82;
        this.headY = Math.max(MIN_HEAD_Y, this.headY + targetHeadVy * dt);
      }
    } else if (this.phase === 'auto_up') {
      if (this.headY < REST_HEAD_Y) {
        targetHeadVy = 0.54;
        this.headY = Math.min(REST_HEAD_Y, this.headY + targetHeadVy * dt);
      }
    } else if (this.phase === 'auto_return') {
      if (this.homeCycleStage === 'moving') {
        this.targetArmOpen = 0.01;
        this.armMotorForce = 0.15;

        const dx = START_X - this.trolleyPos.x;
        const dz = START_Z - this.trolleyPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.04) {
          const speed = THREE.MathUtils.clamp(dist * 3.0, 0.28, 0.92);
          targetVx = (dx / dist) * speed;
          targetVz = (dz / dist) * speed;
        } else {
          this.trolleyPos.x = START_X;
          this.trolleyPos.z = START_Z;
          this.trolleyVel.set(0, 0, 0);
          this.homeCycleStage = 'opening';
          this.homeCycleTimer = 0;
        }
      } else if (this.homeCycleStage === 'opening') {
        this.targetArmOpen = 0.56;
        this.armMotorForce = 0.18;
        this.homeCycleTimer += dt;
        if (this.homeCycleTimer >= 0.42) {
          this.homeCycleStage = 'closing';
          this.homeCycleTimer = 0;
        }
      } else if (this.homeCycleStage === 'closing') {
        this.targetArmOpen = 0.01;
        this.armMotorForce = 0.16;
        this.homeCycleTimer += dt;
        if (this.homeCycleTimer >= 0.42) {
          this.homeCycleStage = 'done';
          this.returnSettleTimer = 0;
        }
      } else {
        this.targetArmOpen = 0.01;
        this.armMotorForce = 0.16;
        this.returnSettleTimer += dt;
        const boxSpeed = this.boxBody.velocity.length();
        if (
          (this.returnSettleTimer >= 0.3 && boxSpeed < 0.08) ||
          this.returnSettleTimer >= 1.1
        ) {
          if (!this.finishTriggered) {
            this.finishTriggered = true;
            this.phase = 'failed';
            this.callbacks.onFail(
              '箱を突っ張り棒の隙間に落とせませんでした',
            );
          }
        }
      }
    }

    if (
      this.phase === 'move_right' ||
      this.phase === 'move_back' ||
      (this.phase === 'auto_return' && this.homeCycleStage === 'moving')
    ) {
      const accel = targetVx === 0 && targetVz === 0 ? 14 : 11;
      this.trolleyVel.x = THREE.MathUtils.lerp(
        this.trolleyVel.x,
        targetVx,
        accel * dt,
      );
      this.trolleyVel.z = THREE.MathUtils.lerp(
        this.trolleyVel.z,
        targetVz,
        accel * dt,
      );
      this.trolleyPos.x = THREE.MathUtils.clamp(
        this.trolleyPos.x + this.trolleyVel.x * dt,
        -0.95,
        0.95,
      );
      this.trolleyPos.z = THREE.MathUtils.clamp(
        this.trolleyPos.z + this.trolleyVel.z * dt,
        -0.38,
        0.72,
      );

      if (this.phase === 'move_right' && this.trolleyPos.x >= 0.94) {
        this.phase = 'move_back';
      } else if (this.phase === 'move_back' && this.trolleyPos.z <= -0.37) {
        this.phase = 'auto_down';
        this.bottomStage = 'pause';
        this.bottomTimer = 0;
      }
    } else if (this.phase !== 'auto_return') {
      this.trolleyVel.set(0, 0, 0);
    }

    this.headBody.position.set(this.trolleyPos.x, this.headY, this.trolleyPos.z);
    this.headBody.velocity.set(this.trolleyVel.x, targetHeadVy, this.trolleyVel.z);
  }

  private getArmAngleZ(body: CANNON.Body): number {
    _q1.set(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w,
    );
    _v1.set(0, -1, 0).applyQuaternion(_q1);
    return Math.atan2(_v1.x, -_v1.y);
  }

  private updateArmMotors(): void {
    const leftAngle = this.getArmAngleZ(this.leftArmBody);
    const rightAngle = this.getArmAngleZ(this.rightArmBody);

    const leftTarget = -this.targetArmOpen;
    const rightTarget = this.targetArmOpen;

    const leftOmega = THREE.MathUtils.clamp(
      (leftTarget - leftAngle) * 11.0,
      -3.8,
      3.8,
    );
    const rightOmega = THREE.MathUtils.clamp(
      (rightTarget - rightAngle) * 11.0,
      -3.8,
      3.8,
    );

    // Note: in cannon-es HingeConstraint, motorSpeed drives -wB around axisB
    this.leftHinge.setMotorMaxForce(this.armMotorForce);
    this.leftHinge.setMotorSpeed(-leftOmega);

    this.rightHinge.setMotorMaxForce(this.armMotorForce);
    this.rightHinge.setMotorSpeed(-rightOmega);
  }

  private evaluateWinAndContacts(): void {
    let touchingBox = false;
    for (const c of this.world.contacts) {
      const isArmBox =
        (c.bi === this.boxBody &&
          (c.bj === this.leftArmBody || c.bj === this.rightArmBody)) ||
        (c.bj === this.boxBody &&
          (c.bi === this.leftArmBody || c.bi === this.rightArmBody));
      if (isArmBox) {
        touchingBox = true;
        break;
      }
    }

    this.isBoxPinched =
      touchingBox &&
      (this.phase === 'auto_down' || this.phase === 'auto_up');
    if (this.isBoxPinched && !this.wasBoxPinched) {
      this.callbacks.onHookCatch();
    }
    this.wasBoxPinched = this.isBoxPinched;

    // Invisible win sensor inside the drop pit below the 4 tension rods
    const bx = this.boxBody.position.x;
    const by = this.boxBody.position.y;
    const bz = this.boxBody.position.z;
    const { minX, maxX, minZ, maxZ } = this.env.pitBounds;

    if (
      !this.finishTriggered &&
      (this.phase === 'auto_down' ||
        this.phase === 'auto_up' ||
        this.phase === 'auto_return') &&
      bx > minX &&
      bx < maxX &&
      bz > minZ &&
      bz < maxZ &&
      by < this.env.pitDropY
    ) {
      this.finishTriggered = true;
      this.phase = 'won';
      this.callbacks.onWin();
    }
  }

  private syncMeshes(): void {
    this.boxPos.set(
      this.boxBody.position.x,
      this.boxBody.position.y,
      this.boxBody.position.z,
    );
    this.boxQuat.set(
      this.boxBody.quaternion.x,
      this.boxBody.quaternion.y,
      this.boxBody.quaternion.z,
      this.boxBody.quaternion.w,
    );
    this.prizeModel.group.position.copy(this.boxPos);
    this.prizeModel.group.quaternion.copy(this.boxQuat);

    this.clawRig.carriageGroup.position.copy(this.trolleyPos);
    this.clawRig.headGroup.position.set(
      this.headBody.position.x,
      this.headBody.position.y,
      this.headBody.position.z,
    );
    this.clawRig.updatePole(this.trolleyPos, this.clawRig.headGroup.position);

    this.clawRig.leftArmGroup.position.set(
      this.leftArmBody.position.x,
      this.leftArmBody.position.y,
      this.leftArmBody.position.z,
    );
    this.clawRig.leftArmGroup.quaternion.set(
      this.leftArmBody.quaternion.x,
      this.leftArmBody.quaternion.y,
      this.leftArmBody.quaternion.z,
      this.leftArmBody.quaternion.w,
    );

    this.clawRig.rightArmGroup.position.set(
      this.rightArmBody.position.x,
      this.rightArmBody.position.y,
      this.rightArmBody.position.z,
    );
    this.clawRig.rightArmGroup.quaternion.set(
      this.rightArmBody.quaternion.x,
      this.rightArmBody.quaternion.y,
      this.rightArmBody.quaternion.z,
      this.rightArmBody.quaternion.w,
    );
  }

  private buildTelemetry(): GameHudTelemetry {
    const lift = Math.max(0, this.boxPos.y - this.initialBoxPos.y);
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
        guideDetail = 'アームを開いて箱へ降下中';
        break;
      case 'auto_up':
        guideTitle = '↑ 上昇（自動）';
        guideDetail = this.isBoxPinched
          ? 'アームで箱を移動中！'
          : '引き上げ中…';
        break;
      case 'auto_return':
        guideTitle = '← 戻る（自動）';
        guideDetail =
          this.homeCycleStage === 'opening' ||
          this.homeCycleStage === 'closing'
            ? '初期位置でアームを開閉中…'
            : '箱の動きを確認中…';
        break;
      case 'won':
        guideTitle = 'GET!';
        guideDetail = '箱を落として獲得しました！';
        break;
      case 'failed':
        guideTitle = 'おしい！';
        guideDetail = 'ずれた位置からもう一度狙おう';
        break;
    }

    return {
      phase: this.phase,
      isRingHooked: this.isBoxPinched,
      ringLiftHeight: lift,
      guideTitle,
      guideDetail,
      failReason:
        this.phase === 'failed'
          ? '箱を突っ張り棒の隙間に落とせませんでした'
          : null,
    };
  }
}
