import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import type {
  ControlInputState,
  GameHudTelemetry,
  PlayPhase,
  StageConfig,
} from '../types/game';
import type {
  BounceEnvironmentHandle,
  BouncePrizeJarHandle,
  BridgeClawRigHandle,
} from './models';
import type { PhysicsCallbacks } from './physics';

const TROLLEY_Y = 2.25;
const START_X = -0.8;
const START_Z = 0.44;
const REST_HEAD_Y = 1.04;
const MIN_HEAD_Y = -0.22;

const GROUP_JAR = 1;
const GROUP_ARM = 2;
const GROUP_ENV = 4;
const GROUP_BALL = 8;

const _v1 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();

export const BOUNCE_JAR_LAYOUTS: Array<{
  x: number;
  z: number;
  title: string;
  bandColor: string;
  fruitColor: string;
  lidColor: number;
}> = [
  {
    x: -0.6,
    z: -0.34,
    title: 'パイン',
    bandColor: '#16a34a',
    fruitColor: '#fbbf24',
    lidColor: 0x15803d,
  },
  {
    x: 0.04,
    z: -0.34,
    title: 'マンゴー',
    bandColor: '#ea580c',
    fruitColor: '#f97316',
    lidColor: 0xca8a04,
  },
  {
    x: 0.68,
    z: -0.34,
    title: 'ピーチ',
    bandColor: '#db2777',
    fruitColor: '#fb7185',
    lidColor: 0x15803d,
  },
  {
    x: -0.28,
    z: -0.7,
    title: 'ミックス',
    bandColor: '#2563eb',
    fruitColor: '#f59e0b',
    lidColor: 0x16a34a,
  },
  {
    x: 0.4,
    z: -0.7,
    title: 'シトラス',
    bandColor: '#059669',
    fruitColor: '#a3e635',
    lidColor: 0xca8a04,
  },
];

export class BouncePhysicsWorld {
  private stage: StageConfig;
  private clawRig: BridgeClawRigHandle;
  private jarModels: BouncePrizeJarHandle[];
  private env: BounceEnvironmentHandle;
  private callbacks: PhysicsCallbacks;

  private world: CANNON.World;
  private headBody: CANNON.Body;
  private leftArmBody: CANNON.Body;
  private rightArmBody: CANNON.Body;
  private leftHinge: CANNON.HingeConstraint;
  private rightHinge: CANNON.HingeConstraint;
  private jarBodies: CANNON.Body[] = [];
  private ballBody: CANNON.Body;

  public trolleyPos = new THREE.Vector3(START_X, TROLLEY_Y, START_Z);
  private trolleyVel = new THREE.Vector3();
  private headY = REST_HEAD_Y;

  public phase: PlayPhase = 'move_right';
  private rightHeldOnce = false;
  private backHeldOnce = false;
  private bottomStage: 'pause' | 'closing' = 'pause';
  private bottomTimer = 0;
  private bounceStage: 'to_ball' | 'releasing' | 'watching' = 'to_ball';
  private bounceTimer = 0;
  private finishTriggered = false;
  private physicsAccumulator = 0;
  private targetArmOpen = 0.01;
  private armMotorForce = 0.25;

  private grabbedJar: CANNON.Body | null = null;
  private grabStartX = 0;
  private releasedJar: CANNON.Body | null = null;
  private wasGrabbed = false;

  constructor(
    stage: StageConfig,
    clawRig: BridgeClawRigHandle,
    jarModels: BouncePrizeJarHandle[],
    env: BounceEnvironmentHandle,
    callbacks: PhysicsCallbacks,
  ) {
    this.stage = stage;
    this.clawRig = clawRig;
    this.jarModels = jarModels;
    this.env = env;
    this.callbacks = callbacks;

    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -18.0, 0),
      allowSleep: false,
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    const solver = new CANNON.GSSolver();
    solver.iterations = 48;
    solver.tolerance = 0.00005;
    this.world.solver = solver;

    const jarMat = new CANNON.Material('bounceJar');
    const armMat = new CANNON.Material('rubberClawArm');
    const envMat = new CANNON.Material('bounceCabinet');
    const ballMat = new CANNON.Material('bouncyBall');

    // Enlarged black rubber claw boots: high grip so well-aimed grabs catch reliably every time
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(jarMat, armMat, {
        friction: 1.25,
        restitution: 0.02,
        contactEquationStiffness: 6e7,
        contactEquationRelaxation: 2.0,
      }),
    );
    // Springy blue ball rebound against square targets
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(jarMat, ballMat, {
        friction: 0.14,
        restitution: 0.78,
        contactEquationStiffness: 6e7,
        contactEquationRelaxation: 1.8,
      }),
    );
    // Physical collision between claw arms and blue ball
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(armMat, ballMat, {
        friction: 0.8,
        restitution: 0.28,
        contactEquationStiffness: 5e7,
        contactEquationRelaxation: 2.0,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(ballMat, envMat, {
        friction: 0.4,
        restitution: 0.45,
        contactEquationStiffness: 5e7,
        contactEquationRelaxation: 2.0,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(jarMat, envMat, {
        friction: 0.42,
        restitution: 0.34,
        contactEquationStiffness: 5e7,
        contactEquationRelaxation: 2.4,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(jarMat, jarMat, {
        friction: 0.35,
        restitution: 0.18,
      }),
    );

    this.buildEnvironmentColliders(envMat);

    // Kinematic round UFO Catcher head body
    this.headBody = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      mass: 0,
      collisionResponse: false,
    });
    this.world.addBody(this.headBody);

    // Dynamic S-size L-arms with large black rubber boots + collision with ball
    this.leftArmBody = this.createSmallArmBody(-1, armMat);
    this.rightArmBody = this.createSmallArmBody(1, armMat);
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

    // Square box target bodies ("ターゲットを四角にして")
    const boxHalfExtents = new CANNON.Vec3(0.105, 0.14, 0.105);
    const boxShape = new CANNON.Box(boxHalfExtents);
    for (let i = 0; i < this.jarModels.length; i++) {
      const body = new CANNON.Body({
        mass: Math.max(0.55, stage.prize.mass),
        material: jarMat,
        linearDamping: 0.08,
        angularDamping: 0.22,
        collisionFilterGroup: GROUP_JAR,
        collisionFilterMask: GROUP_JAR | GROUP_ARM | GROUP_ENV | GROUP_BALL,
      });
      body.addShape(boxShape);
      this.world.addBody(body);
      this.jarBodies.push(body);
    }

    // Dynamic bouncy blue ball cradled by white guide rods & spring-centered ("ボールにも当たり判定")
    this.ballBody = new CANNON.Body({
      mass: 1.5,
      material: ballMat,
      linearDamping: 0.38,
      angularDamping: 0.45,
      collisionFilterGroup: GROUP_BALL,
      collisionFilterMask: GROUP_JAR | GROUP_ARM | GROUP_ENV,
    });
    this.ballBody.addShape(new CANNON.Sphere(this.env.ballRadius));
    this.ballBody.position.set(
      this.env.ballPos.x,
      this.env.ballPos.y,
      this.env.ballPos.z,
    );
    this.world.addBody(this.ballBody);

    this.resetRound(false);
  }

  private createSmallArmBody(side: -1 | 1, mat: CANNON.Material): CANNON.Body {
    const body = new CANNON.Body({
      mass: 0.22,
      material: mat,
      linearDamping: 0.08,
      angularDamping: 0.35,
      collisionFilterGroup: GROUP_ARM,
      collisionFilterMask: GROUP_JAR | GROUP_ENV | GROUP_BALL,
    });

    const s = side;
    const elbowX = 0.175 * s;
    const elbowY = -0.155;
    const botX = -0.072 * s;
    const botY = -0.365;

    const len1 = Math.hypot(elbowX, elbowY);
    const ang1 = Math.atan2(elbowY, elbowX);
    const q1 = new CANNON.Quaternion();
    q1.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), ang1);
    body.addShape(
      new CANNON.Box(new CANNON.Vec3(len1 * 0.5, 0.018, 0.018)),
      new CANNON.Vec3(elbowX * 0.5, elbowY * 0.5, 0),
      q1,
    );

    const len2 = Math.hypot(botX - elbowX, botY - elbowY);
    const ang2 = Math.atan2(botY - elbowY, botX - elbowX);
    const q2 = new CANNON.Quaternion();
    q2.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), ang2);
    body.addShape(
      new CANNON.Box(new CANNON.Vec3(len2 * 0.5, 0.018, 0.018)),
      new CANNON.Vec3((elbowX + botX) * 0.5, (elbowY + botY) * 0.5, 0),
      q2,
    );

    // Enlarged black rubber boot collider matching visual rubber tip
    const qTip = new CANNON.Quaternion();
    qTip.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), 0.28 * s);
    body.addShape(
      new CANNON.Box(new CANNON.Vec3(0.059, 0.022, 0.056)),
      new CANNON.Vec3(botX - 0.044 * s, botY - 0.017, 0),
      qTip,
    );

    return body;
  }

  private buildEnvironmentColliders(envMat: CANNON.Material): void {
    const addStaticBox = (
      hx: number,
      hy: number,
      hz: number,
      px: number,
      py: number,
      pz: number,
      mask: number = GROUP_JAR | GROUP_ARM | GROUP_BALL,
    ) => {
      const b = new CANNON.Body({
        type: CANNON.Body.STATIC,
        mass: 0,
        material: envMat,
        collisionFilterGroup: GROUP_ENV,
        collisionFilterMask: mask,
      });
      b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
      b.position.set(px, py, pz);
      this.world.addBody(b);
    };

    // Back green-striped deck (top = greenDeckTopY = -0.78)
    addStaticBox(1.28, 0.49, 0.59, 0, this.env.greenDeckTopY - 0.49, -0.61);
    addStaticBox(1.21, 0.018, 0.01, 0, this.env.greenDeckTopY + 0.018, -0.04);

    // Central pink ball cradle deck (x in [-0.40, 0.40], top = pinkDeckTopY = -0.84)
    addStaticBox(0.4, 0.46, 0.46, 0, this.env.pinkDeckTopY - 0.46, 0.44);

    // White ball cradle guide bars around (0, 0.44)
    addStaticBox(
      0.018,
      0.022,
      0.27,
      -0.24,
      this.env.pinkDeckTopY + 0.022,
      this.env.ballPos.z,
    );
    addStaticBox(
      0.018,
      0.022,
      0.27,
      0.24,
      this.env.pinkDeckTopY + 0.022,
      this.env.ballPos.z,
    );
    addStaticBox(
      0.24,
      0.022,
      0.018,
      this.env.ballPos.x,
      this.env.pinkDeckTopY + 0.022,
      this.env.ballPos.z - 0.25,
    );
    addStaticBox(
      0.24,
      0.022,
      0.018,
      this.env.ballPos.x,
      this.env.pinkDeckTopY + 0.022,
      this.env.ballPos.z + 0.25,
    );

    // 4 cylindrical guard rods across BOTH Left and Right drop holes ('獲得口に棒をつけてとれにくくして')
    const rodQuat = new CANNON.Quaternion();
    rodQuat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    for (const spec of this.env.guardRodSpecs) {
      const rodBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        mass: 0,
        material: envMat,
        collisionFilterGroup: GROUP_ENV,
        collisionFilterMask: GROUP_JAR | GROUP_ARM,
      });
      rodBody.addShape(
        new CANNON.Cylinder(spec.radius, spec.radius, spec.length, 12),
        new CANNON.Vec3(0, 0, 0),
        rodQuat,
      );
      rodBody.position.set(spec.x, spec.y, spec.z);
      this.world.addBody(rodBody);
    }

    // Outer left & right aprons outside drop holes
    addStaticBox(0.425, 0.49, 1.1, -1.64, -1.29, -0.1);
    addStaticBox(0.425, 0.49, 1.1, 1.64, -1.29, -0.1);

    // Clear left, right, front & back containment walls
    addStaticBox(0.015, 0.35, 1.04, -1.22, -0.5, -0.14);
    addStaticBox(0.015, 0.35, 1.04, 1.22, -0.5, -0.14);
    addStaticBox(1.27, 0.42, 0.23, 0, -1.34, 1.12);
    addStaticBox(1.22, 0.17, 0.015, 0, -0.68, 0.89);
    addStaticBox(1.28, 0.45, 0.04, 0, -0.35, -1.22);

    // Chute pit floor
    addStaticBox(3.4, 0.08, 2.25, 0, -1.86, -0.2);
  }

  public resetRound(preservePrizes = false): void {
    this.trolleyPos.set(START_X, TROLLEY_Y, START_Z);
    this.trolleyVel.set(0, 0, 0);
    this.headY = REST_HEAD_Y;

    this.headBody.position.set(START_X, REST_HEAD_Y, START_Z);
    this.headBody.velocity.set(0, 0, 0);
    this.headBody.quaternion.set(0, 0, 0, 1);

    this.targetArmOpen = 0.01;
    this.armMotorForce = 0.25;

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

    this.ballBody.position.set(
      this.env.ballPos.x,
      this.env.ballPos.y,
      this.env.ballPos.z,
    );
    this.ballBody.velocity.set(0, 0, 0);
    this.ballBody.angularVelocity.set(0, 0, 0);

    const jarRestY = this.env.greenDeckTopY + 0.14;
    const hasRemainingPrizeOnDeck = this.jarBodies.some(
      (b) => b.position.y > this.env.pitDropY && b.position.z < -0.05,
    );

    if (!preservePrizes || !hasRemainingPrizeOnDeck) {
      this.jarBodies.forEach((body, idx) => {
        const spec = BOUNCE_JAR_LAYOUTS[idx] ?? { x: 0, z: -0.34 };
        body.position.set(spec.x, jarRestY, spec.z);
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.quaternion.set(0, 0, 0, 1);
      });
    } else {
      this.jarBodies.forEach((body) => {
        if (body.position.y < this.env.pitDropY) {
          body.position.set(0, -1.65, 2.2);
          body.velocity.set(0, 0, 0);
          body.angularVelocity.set(0, 0, 0);
        } else {
          body.wakeUp();
        }
      });
    }

    this.phase = 'move_right';
    this.rightHeldOnce = false;
    this.backHeldOnce = false;
    this.bottomStage = 'pause';
    this.bottomTimer = 0;
    this.bounceStage = 'to_ball';
    this.bounceTimer = 0;
    this.finishTriggered = false;
    this.physicsAccumulator = 0;
    this.grabbedJar = null;
    this.grabStartX = 0;
    this.releasedJar = null;
    this.wasGrabbed = false;

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
      this.applyBallCradleSpring();
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

  private applyBallCradleSpring(): void {
    // Keep the blue vinyl ball centered inside its 4 white cradle rods while reacting dynamically to hits
    const k = 220;
    const c = 16;
    const dx = this.env.ballPos.x - this.ballBody.position.x;
    const dy = this.env.ballPos.y - this.ballBody.position.y;
    const dz = this.env.ballPos.z - this.ballBody.position.z;

    this.ballBody.force.x += dx * k - this.ballBody.velocity.x * c;
    this.ballBody.force.y += dy * k - this.ballBody.velocity.y * c;
    this.ballBody.force.z += dz * k - this.ballBody.velocity.z * c;
  }

  private findClosestGrabbedJar(): CANNON.Body | null {
    let bestJar: CANNON.Body | null = null;
    let bestDist = 0.28;
    for (const jar of this.jarBodies) {
      let touchesArm = false;
      for (const c of this.world.contacts) {
        if (
          (c.bi === jar &&
            (c.bj === this.leftArmBody || c.bj === this.rightArmBody)) ||
          (c.bj === jar &&
            (c.bi === this.leftArmBody || c.bi === this.rightArmBody))
        ) {
          touchesArm = true;
          break;
        }
      }
      if (!touchesArm) continue;
      const d = Math.hypot(
        jar.position.x - this.trolleyPos.x,
        jar.position.z - this.trolleyPos.z,
      );
      if (d < bestDist) {
        bestDist = d;
        bestJar = jar;
      }
    }
    return bestJar;
  }

  private handleSequenceTransitions(
    input: ControlInputState,
    dt: number,
  ): void {
    if (this.phase === 'move_right') {
      this.targetArmOpen = 0.01;
      this.armMotorForce = 0.28;
      if (input.moveRight) {
        this.rightHeldOnce = true;
      } else if (this.rightHeldOnce) {
        this.phase = 'move_back';
      }
    } else if (this.phase === 'move_back') {
      this.targetArmOpen = 0.01;
      this.armMotorForce = 0.28;
      if (input.moveBack) {
        this.backHeldOnce = true;
      } else if (this.backHeldOnce) {
        this.phase = 'auto_down';
        this.bottomStage = 'pause';
        this.bottomTimer = 0;
      }
    } else if (this.phase === 'auto_down') {
      this.targetArmOpen = 0.68;
      this.armMotorForce = 0.34;
      if (this.headY <= MIN_HEAD_Y + 0.005) {
        this.bottomTimer += dt;
        if (this.bottomStage === 'pause' && this.bottomTimer >= 0.12) {
          this.bottomStage = 'closing';
          this.bottomTimer = 0;
        } else if (this.bottomStage === 'closing') {
          this.targetArmOpen = -0.05;
          // Power MAX clamping with enlarged black rubber boots
          this.armMotorForce = 0.85;
          if (this.bottomTimer >= 0.48) {
            this.grabbedJar = this.findClosestGrabbedJar();
            this.grabStartX = this.grabbedJar
              ? this.grabbedJar.position.x
              : this.trolleyPos.x;
            this.phase = 'auto_up';
          }
        }
      }
    } else if (this.phase === 'auto_up') {
      // Power MAX: clamp rock-solid so the square prize doesn't drop until reaching the front ball
      this.targetArmOpen = -0.05;
      this.armMotorForce = 0.85;
      if (!this.grabbedJar) {
        this.grabbedJar = this.findClosestGrabbedJar();
        if (this.grabbedJar) {
          this.grabStartX = this.grabbedJar.position.x;
        }
      }
      if (this.headY >= REST_HEAD_Y - 0.01) {
        this.phase = 'auto_return';
        this.bounceStage = 'to_ball';
        this.bounceTimer = 0;
      }
    }
  }

  private updateTrolleyAndHead(dt: number, input: ControlInputState): void {
    let targetVx = 0;
    let targetVz = 0;
    let targetHeadVy = 0;

    if (this.phase === 'move_right' && input.moveRight) {
      targetVx = 0.78;
    } else if (this.phase === 'move_back' && input.moveBack) {
      targetVz = -0.48;
    } else if (this.phase === 'auto_down') {
      if (this.headY > MIN_HEAD_Y) {
        targetHeadVy = -0.88;
        this.headY = Math.max(MIN_HEAD_Y, this.headY + targetHeadVy * dt);
      }
    } else if (this.phase === 'auto_up') {
      if (this.headY < REST_HEAD_Y) {
        targetHeadVy = 0.64;
        this.headY = Math.min(REST_HEAD_Y, this.headY + targetHeadVy * dt);
      }
    } else if (this.phase === 'auto_return') {
      if (this.bounceStage === 'to_ball') {
        this.targetArmOpen = -0.05;
        this.armMotorForce = 0.85;

        // Release over the left or right shoulder of the front blue ball toward the flanking drop holes
        const sideBias = this.grabStartX >= 0 ? 0.08 : -0.08;
        const dropTargetX = this.env.ballPos.x + sideBias;
        const dropTargetZ = this.env.ballPos.z;
        const dx = dropTargetX - this.trolleyPos.x;
        const dz = dropTargetZ - this.trolleyPos.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.035) {
          const speed = THREE.MathUtils.clamp(dist * 3.0, 0.28, 0.9);
          targetVx = (dx / dist) * speed;
          targetVz = (dz / dist) * speed;
        } else {
          this.trolleyPos.x = dropTargetX;
          this.trolleyPos.z = dropTargetZ;
          this.trolleyVel.set(0, 0, 0);
          this.releasedJar = this.grabbedJar;
          this.grabbedJar = null;
          this.bounceStage = 'releasing';
          this.bounceTimer = 0;
        }
      } else if (this.bounceStage === 'releasing') {
        this.targetArmOpen = 0.68;
        this.armMotorForce = 0.5;
        this.bounceTimer += dt;
        if (this.bounceTimer >= 0.48) {
          this.bounceStage = 'watching';
          this.bounceTimer = 0;
        }
      } else {
        this.bounceTimer += dt;
        const dx = START_X - this.trolleyPos.x;
        const dz = START_Z - this.trolleyPos.z;
        const dist = Math.hypot(dx, dz);
        if (this.bounceTimer > 0.35 && dist > 0.04) {
          this.targetArmOpen = 0.01;
          this.armMotorForce = 0.28;
          const speed = THREE.MathUtils.clamp(dist * 2.8, 0.25, 0.85);
          targetVx = (dx / dist) * speed;
          targetVz = (dz / dist) * speed;
        } else if (dist <= 0.04) {
          this.targetArmOpen = 0.01;
          this.armMotorForce = 0.28;
          this.trolleyPos.x = START_X;
          this.trolleyPos.z = START_Z;
          this.trolleyVel.set(0, 0, 0);
        }

        const droppedSpeed = this.releasedJar
          ? this.releasedJar.velocity.length()
          : 0;
        const settled = !this.releasedJar
          ? this.bounceTimer >= 0.65
          : (this.bounceTimer >= 1.25 && droppedSpeed < 0.09) ||
            this.bounceTimer >= 2.8;

        if (settled && !this.finishTriggered) {
          this.finishTriggered = true;
          this.phase = 'failed';
          this.callbacks.onFail(
            this.releasedJar
              ? '獲得口の棒に弾かれ、穴に入りませんでした'
              : '奥の景品を掴めませんでした',
          );
        }
      }
    }

    if (
      this.phase === 'move_right' ||
      this.phase === 'move_back' ||
      (this.phase === 'auto_return' &&
        (this.bounceStage === 'to_ball' ||
          (this.bounceStage === 'watching' && this.bounceTimer > 0.35)))
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
        -0.96,
        0.96,
      );
      this.trolleyPos.z = THREE.MathUtils.clamp(
        this.trolleyPos.z + this.trolleyVel.z * dt,
        -0.84,
        0.58,
      );

      if (this.phase === 'move_right' && this.trolleyPos.x >= 0.95) {
        this.phase = 'move_back';
      } else if (this.phase === 'move_back' && this.trolleyPos.z <= -0.83) {
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
      (leftTarget - leftAngle) * 11.5,
      -4.2,
      4.2,
    );
    const rightOmega = THREE.MathUtils.clamp(
      (rightTarget - rightAngle) * 11.5,
      -4.2,
      4.2,
    );

    this.leftHinge.setMotorMaxForce(this.armMotorForce);
    this.leftHinge.setMotorSpeed(-leftOmega);

    this.rightHinge.setMotorMaxForce(this.armMotorForce);
    this.rightHinge.setMotorSpeed(-rightOmega);
  }

  private isInsideHole(x: number, z: number): boolean {
    const l = this.env.holeBoundsLeft;
    const r = this.env.holeBoundsRight;
    const inLeft = x > l.minX && x < l.maxX && z > l.minZ && z < l.maxZ;
    const inRight = x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
    return inLeft || inRight;
  }

  private evaluateWinAndContacts(): void {
    const hasGrab =
      this.grabbedJar !== null &&
      (this.phase === 'auto_down' ||
        this.phase === 'auto_up' ||
        (this.phase === 'auto_return' && this.bounceStage === 'to_ball'));

    if (hasGrab && !this.wasGrabbed) {
      this.callbacks.onHookCatch();
    }
    this.wasGrabbed = hasGrab;

    if (!this.finishTriggered) {
      for (const jar of this.jarBodies) {
        if (
          jar.position.y < this.env.pitDropY &&
          this.isInsideHole(jar.position.x, jar.position.z)
        ) {
          this.finishTriggered = true;
          this.phase = 'won';
          this.callbacks.onWin();
          break;
        }
      }
    }
  }

  private syncMeshes(): void {
    for (let i = 0; i < this.jarModels.length; i++) {
      const body = this.jarBodies[i];
      const model = this.jarModels[i];
      model.group.position.set(
        body.position.x,
        body.position.y,
        body.position.z,
      );
      model.group.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
    }

    this.env.ballMesh.position.set(
      this.ballBody.position.x,
      this.ballBody.position.y,
      this.ballBody.position.z,
    );
    this.env.ballMesh.quaternion.set(
      this.ballBody.quaternion.x,
      this.ballBody.quaternion.y,
      this.ballBody.quaternion.z,
      this.ballBody.quaternion.w,
    );

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
    const lift = this.grabbedJar
      ? Math.max(0, this.grabbedJar.position.y - (this.env.greenDeckTopY + 0.14))
      : 0;
    let guideTitle = '→ 横移動';
    let guideDetail = '長押しで右へ移動';

    switch (this.phase) {
      case 'move_right':
        guideTitle = '→ 横移動';
        guideDetail = '奥の景品を狙って右へ';
        break;
      case 'move_back':
        guideTitle = '↑ 奥移動';
        guideDetail = '四角い景品の上で離そう';
        break;
      case 'auto_down':
        guideTitle = '↓ 下降（自動）';
        guideDetail = '大型ゴム爪・パワーMAXで掴み中';
        break;
      case 'auto_up':
        guideTitle = '↑ 上昇（自動）';
        guideDetail = this.grabbedJar
          ? '景品をがっちり持ち上げ中！'
          : '上昇中…';
        break;
      case 'auto_return':
        guideTitle = '● バウンド！';
        guideDetail =
          this.bounceStage === 'to_ball'
            ? '手前の青いボールへ運搬中…'
            : this.bounceStage === 'releasing'
              ? 'ボールの上でアーム開放！'
              : '左右どちらの穴に入るか注目！';
        break;
      case 'won':
        guideTitle = 'GET!';
        guideDetail = 'バウンドさせて穴に落としました！';
        break;
      case 'failed':
        guideTitle = 'おしい！';
        guideDetail = '狙いを変えてもう一度挑戦しよう';
        break;
    }

    return {
      phase: this.phase,
      isRingHooked: this.grabbedJar !== null,
      ringLiftHeight: lift,
      guideTitle,
      guideDetail,
      failReason:
        this.phase === 'failed'
          ? '獲得口の棒に弾かれ、穴に入りませんでした'
          : null,
    };
  }
}
