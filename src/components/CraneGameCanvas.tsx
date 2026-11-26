import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BridgePhysicsWorld } from '../three/bridgePhysics';
import {
  buildArcadeTrolley,
  buildBridgeClawRig,
  buildBridgeEnvironment,
  buildBridgePrizeBox,
  buildCabinetEnvironment,
  buildChainLinks,
  buildCraneRing,
  buildPrizeBundle,
  buildUprightQuestionHook,
} from '../three/models';
import { CranePhysicsWorld } from '../three/physics';
import {
  applyStudioEnvironment,
  createStudioRenderer,
  detectSoftwareWebGL,
  scheduleSoftwareFrame,
} from '../three/rendererUtils';
import { createBrushedMetalNormalMap } from '../three/textures';
import type {
  CameraView,
  ControlInputState,
  GameHudTelemetry,
  StageConfig,
} from '../types/game';
import { arcadeAudio } from '../utils/audio';

interface CraneGameCanvasProps {
  stage: StageConfig;
  cameraView: CameraView;
  cameraPresetNonce: number;
  roundNonce: number;
  inputRef: React.MutableRefObject<ControlInputState>;
  onUserOrbitStart: () => void;
  onTelemetry: (telemetry: GameHudTelemetry) => void;
  onWin: () => void;
  onFail: (reason: string) => void;
}

const FRONT_CAM_POS = new THREE.Vector3(0.0, 0.42, 3.76);
const FRONT_CAM_TARGET = new THREE.Vector3(0.0, -0.1, -0.05);

const SIDE_CAM_POS = new THREE.Vector3(2.48, 0.28, 0.88);
const SIDE_CAM_TARGET = new THREE.Vector3(0.24, -0.18, 0.04);

const FREE_CAM_POS = new THREE.Vector3(1.38, 0.56, 2.52);
const FREE_CAM_TARGET = new THREE.Vector3(0.28, -0.16, 0.04);

const BRIDGE_FRONT_POS = new THREE.Vector3(0.0, 0.46, 3.25);
const BRIDGE_FRONT_TARGET = new THREE.Vector3(0.0, -0.26, 0.0);

const BRIDGE_SIDE_POS = new THREE.Vector3(2.25, 0.25, 0.72);
const BRIDGE_SIDE_TARGET = new THREE.Vector3(0.0, -0.35, 0.0);

const BRIDGE_FREE_POS = new THREE.Vector3(1.22, 0.62, 2.28);
const BRIDGE_FREE_TARGET = new THREE.Vector3(0.0, -0.32, 0.0);

export function CraneGameCanvas({
  stage,
  cameraView,
  cameraPresetNonce,
  roundNonce,
  inputRef,
  onUserOrbitStart,
  onTelemetry,
  onWin,
  onFail,
}: CraneGameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const transitionRef = useRef<{ active: boolean; view: CameraView }>({
    active: false,
    view: cameraView,
  });
  const physicsRef = useRef<CranePhysicsWorld | BridgePhysicsWorld | null>(
    null,
  );
  const callbacksRef = useRef({
    onUserOrbitStart,
    onTelemetry,
    onWin,
    onFail,
  });

  useEffect(() => {
    if (cameraPresetNonce > 0) {
      transitionRef.current = { active: true, view: cameraView };
    }
  }, [cameraPresetNonce, cameraView]);

  useEffect(() => {
    callbacksRef.current = { onUserOrbitStart, onTelemetry, onWin, onFail };
  }, [onUserOrbitStart, onTelemetry, onWin, onFail]);

  useEffect(() => {
    if (physicsRef.current && roundNonce > 0) {
      physicsRef.current.resetRound(true);
    }
  }, [roundNonce]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isBridgeStage = stage.stageType === 'bridge';
    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = createStudioRenderer(container, isSoftwareGl);
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef2f6);
    scene.fog = new THREE.Fog(0xeef2f6, 5.2, 10.5);

    const envTex = applyStudioEnvironment(renderer, scene);
    const normalMap = createBrushedMetalNormalMap();

    const camera = new THREE.PerspectiveCamera(
      43,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      30,
    );
    camera.position.copy(isBridgeStage ? BRIDGE_FRONT_POS : FRONT_CAM_POS);

    // Free 3D OrbitControls (1-finger / mouse drag to rotate, pinch / wheel to zoom, 2-finger / right-drag to pan)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(
      isBridgeStage ? BRIDGE_FRONT_TARGET : FRONT_CAM_TARGET,
    );
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.65;
    controls.minDistance = 0.95;
    controls.maxDistance = 5.4;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.update();

    const handleOrbitStart = () => {
      transitionRef.current.active = false;
      callbacksRef.current.onUserOrbitStart();
    };
    controls.addEventListener('start', handleOrbitStart);

    // 3-Point + Showcase Arcade Cabinet Lighting
    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x64748b, 0.68);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7e6, 2.35);
    keyLight.position.set(2.2, 3.8, 2.8);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 12;
      keyLight.shadow.camera.left = -2.4;
      keyLight.shadow.camera.right = 2.4;
      keyLight.shadow.camera.top = 3.0;
      keyLight.shadow.camera.bottom = -2.2;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.018;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xc7d2fe, 1.35);
    rimLight.position.set(-2.5, 2.2, -1.5);
    scene.add(rimLight);

    const showcaseLight = new THREE.PointLight(0xfffbeb, 1.25, 7.2, 1.5);
    showcaseLight.position.set(0.25, 1.45, 0.95);
    scene.add(showcaseLight);

    let onTickSceneUpdate: (dt: number, input: ControlInputState) => GameHudTelemetry;
    let bridgeZBridge: THREE.Group | null = null;
    let hookZBridge: THREE.Group | null = null;

    if (isBridgeStage) {
      const bridgeEnv = buildBridgeEnvironment(isSoftwareGl, maxAnisotropy);
      scene.add(bridgeEnv.group);
      bridgeZBridge = bridgeEnv.zBridgeGroup;

      const clawRig = buildBridgeClawRig(normalMap, maxAnisotropy, isSoftwareGl);
      scene.add(
        clawRig.carriageGroup,
        clawRig.poleMesh,
        clawRig.headGroup,
        clawRig.leftArmGroup,
        clawRig.rightArmGroup,
      );

      const bridgeBox = buildBridgePrizeBox(stage.prize, maxAnisotropy);
      scene.add(bridgeBox.group);

      const bridgePhysics = new BridgePhysicsWorld(
        stage,
        clawRig,
        bridgeBox,
        bridgeEnv,
        {
          onMetalClink: (intensity) => arcadeAudio.playMetalClink(intensity),
          onHookCatch: () => arcadeAudio.playHookCatch(),
          onRingSlip: () => arcadeAudio.playRingSlip(),
          onWin: () => callbacksRef.current.onWin(),
          onFail: (reason) => callbacksRef.current.onFail(reason),
        },
      );
      physicsRef.current = bridgePhysics;

      onTickSceneUpdate = (dt, input) => {
        const telemetry = bridgePhysics.step(dt, input);
        if (bridgeZBridge) {
          bridgeZBridge.position.x = bridgePhysics.trolleyPos.x;
        }
        return telemetry;
      };
    } else {
      const cabinet = buildCabinetEnvironment(isSoftwareGl, maxAnisotropy);
      scene.add(cabinet.group);
      hookZBridge = cabinet.zBridgeGroup;

      const trolley = buildArcadeTrolley(normalMap);
      scene.add(trolley.carriageGroup);

      const craneChain = buildChainLinks(10, normalMap);
      scene.add(craneChain.group);

      const craneRing = buildCraneRing(stage.ring, normalMap);
      scene.add(craneRing.group);

      const uprightHook = buildUprightQuestionHook(
        stage.hook,
        normalMap,
        cabinet.hookBaseSize,
      );
      scene.add(uprightHook.group);

      const prizeTetherChain = buildChainLinks(5, normalMap);
      scene.add(prizeTetherChain.group);

      const prizeBundle = buildPrizeBundle(stage.prize, normalMap, maxAnisotropy);
      scene.add(prizeBundle.group);

      const physics = new CranePhysicsWorld(
        stage,
        craneRing,
        uprightHook,
        prizeBundle,
        cabinet.grateTopY,
        cabinet.hookCradleY,
        cabinet.hookBaseCenter,
        cabinet.hookBaseSize,
        cabinet.chuteCenter,
        {
          onMetalClink: (intensity) => arcadeAudio.playMetalClink(intensity),
          onHookCatch: () => arcadeAudio.playHookCatch(),
          onRingSlip: () => arcadeAudio.playRingSlip(),
          onWin: () => callbacksRef.current.onWin(),
          onFail: (reason) => callbacksRef.current.onFail(reason),
        },
      );
      physicsRef.current = physics;

      onTickSceneUpdate = (dt, input) => {
        const telemetry = physics.step(dt, input);
        if (hookZBridge) {
          hookZBridge.position.x = physics.trolleyPos.x;
        }
        trolley.carriageGroup.position.copy(physics.trolleyPos);
        craneChain.updateFromNodes(physics.craneChainNodes);
        prizeTetherChain.updateFromNodes(physics.prizeTetherNodes);
        return telemetry;
      };
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    let lastHudPush = 0;

    const handleResize = () => {
      if (!container || disposed) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      const input = inputRef.current;
      const telemetry = onTickSceneUpdate(dt, input);

      // Smooth preset camera transitions that automatically yield to OrbitControls on drag/zoom
      if (transitionRef.current.active) {
        const preset = transitionRef.current.view;
        const desiredPos = isBridgeStage
          ? preset === 'side'
            ? BRIDGE_SIDE_POS
            : preset === 'free'
              ? BRIDGE_FREE_POS
              : BRIDGE_FRONT_POS
          : preset === 'side'
            ? SIDE_CAM_POS
            : preset === 'free'
              ? FREE_CAM_POS
              : FRONT_CAM_POS;
        const desiredTarget = isBridgeStage
          ? preset === 'side'
            ? BRIDGE_SIDE_TARGET
            : preset === 'free'
              ? BRIDGE_FREE_TARGET
              : BRIDGE_FRONT_TARGET
          : preset === 'side'
            ? SIDE_CAM_TARGET
            : preset === 'free'
              ? FREE_CAM_TARGET
              : FRONT_CAM_TARGET;

        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          desiredPos.x,
          8,
          dt,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          desiredPos.y,
          8,
          dt,
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          desiredPos.z,
          8,
          dt,
        );

        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          desiredTarget.x,
          8,
          dt,
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          desiredTarget.y,
          8,
          dt,
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          desiredTarget.z,
          8,
          dt,
        );

        if (
          camera.position.distanceToSquared(desiredPos) < 0.0004 &&
          controls.target.distanceToSquared(desiredTarget) < 0.0004
        ) {
          camera.position.copy(desiredPos);
          controls.target.copy(desiredTarget);
          transitionRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      const now = performance.now();
      if (now - lastHudPush > 70) {
        lastHudPush = now;
        callbacksRef.current.onTelemetry(telemetry);
      }

      if (isSoftwareGl) {
        scheduleSoftwareFrame(renderer, tick, (id) => {
          timerId = id;
        });
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', handleOrbitStart);
      controls.dispose();
      physicsRef.current = null;
      envTex.dispose();
      normalMap.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [stage, inputRef]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
    />
  );
}
