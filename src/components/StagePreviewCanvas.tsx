import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BOUNCE_JAR_LAYOUTS } from '../three/bouncePhysics';
import {
  buildArcadeTrolley,
  buildBounceClawRig,
  buildBounceEnvironment,
  buildBouncePrizeJar,
  buildBridgeClawRig,
  buildBridgeEnvironment,
  buildBridgePrizeBox,
  buildCabinetEnvironment,
  buildChainLinks,
  buildCraneRing,
  buildPrizeBundle,
  buildUprightQuestionHook,
} from '../three/models';
import {
  applyStudioEnvironment,
  createStudioRenderer,
  detectSoftwareWebGL,
  scheduleSoftwareFrame,
} from '../three/rendererUtils';
import { createBrushedMetalNormalMap } from '../three/textures';
import type { StageConfig } from '../types/game';

interface StagePreviewCanvasProps {
  stage: StageConfig;
}

export function StagePreviewCanvas({ stage }: StagePreviewCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isBridgeStage = stage.stageType === 'bridge';
    const isBounceStage = stage.stageType === 'bounce';
    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = createStudioRenderer(container, isSoftwareGl);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe2e8f0);
    const envTex = applyStudioEnvironment(renderer, scene);
    const normalMap = createBrushedMetalNormalMap();

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      40,
    );
    if (isBounceStage) {
      camera.position.set(0.0, 0.56, 2.85);
      camera.lookAt(0.0, -0.34, 0);
    } else if (isBridgeStage) {
      camera.position.set(0.0, 0.34, 2.75);
      camera.lookAt(0.0, -0.34, 0);
    } else {
      camera.position.set(0.05, 0.2, 3.35);
      camera.lookAt(0.05, -0.22, 0);
    }

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.1);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfffbeb, 1.8);
    key.position.set(2, 4, 3);
    scene.add(key);

    if (isBridgeStage) {
      const bridgeEnv = buildBridgeEnvironment(isSoftwareGl, maxAniso);
      bridgeEnv.zBridgeGroup.position.x = -0.18;
      scene.add(bridgeEnv.group);

      const clawRig = buildBridgeClawRig(normalMap, maxAniso, isSoftwareGl);
      const trolleyPos = new THREE.Vector3(-0.18, 2.25, 0.1);
      const headPos = new THREE.Vector3(-0.18, 0.72, 0.1);
      clawRig.carriageGroup.position.copy(trolleyPos);
      clawRig.headGroup.position.copy(headPos);
      clawRig.updatePole(trolleyPos, headPos);

      clawRig.leftArmGroup.position
        .copy(headPos)
        .add(clawRig.leftArmPivotLocal);
      clawRig.leftArmGroup.rotation.z = -0.02;

      clawRig.rightArmGroup.position
        .copy(headPos)
        .add(clawRig.rightArmPivotLocal);
      clawRig.rightArmGroup.rotation.z = 0.02;

      scene.add(
        clawRig.carriageGroup,
        clawRig.poleMesh,
        clawRig.headGroup,
        clawRig.leftArmGroup,
        clawRig.rightArmGroup,
      );

      const box = buildBridgePrizeBox(stage.prize, maxAniso);
      const innerRodY = bridgeEnv.rodSpecs[1]?.y ?? -0.72;
      const rodR = bridgeEnv.rodSpecs[1]?.radius ?? 0.022;
      box.group.position.set(0, innerRodY + rodR + stage.prize.height * 0.5, 0);
      scene.add(box.group);
    } else if (isBounceStage) {
      const bounceEnv = buildBounceEnvironment(isSoftwareGl, maxAniso);
      bounceEnv.zBridgeGroup.position.x = 0.04;
      scene.add(bounceEnv.group);

      const clawRig = buildBounceClawRig(normalMap, maxAniso, isSoftwareGl);
      const trolleyPos = new THREE.Vector3(0.04, 2.25, -0.34);
      const headPos = new THREE.Vector3(0.04, 0.65, -0.34);
      clawRig.carriageGroup.position.copy(trolleyPos);
      clawRig.headGroup.position.copy(headPos);
      clawRig.updatePole(trolleyPos, headPos);

      clawRig.leftArmGroup.position
        .copy(headPos)
        .add(clawRig.leftArmPivotLocal);
      clawRig.leftArmGroup.rotation.z = -0.18;

      clawRig.rightArmGroup.position
        .copy(headPos)
        .add(clawRig.rightArmPivotLocal);
      clawRig.rightArmGroup.rotation.z = 0.18;

      scene.add(
        clawRig.carriageGroup,
        clawRig.poleMesh,
        clawRig.headGroup,
        clawRig.leftArmGroup,
        clawRig.rightArmGroup,
      );

      BOUNCE_JAR_LAYOUTS.forEach((spec) => {
        const jar = buildBouncePrizeJar(
          spec.title,
          spec.bandColor,
          spec.fruitColor,
          spec.lidColor,
          maxAniso,
        );
        jar.group.position.set(
          spec.x,
          bounceEnv.greenDeckTopY + jar.height * 0.5,
          spec.z,
        );
        scene.add(jar.group);
      });
    } else {
      const cabinet = buildCabinetEnvironment(isSoftwareGl, maxAniso);
      cabinet.zBridgeGroup.position.x = -0.22;
      scene.add(cabinet.group);

      // Trolley + Hanging Ring on crane chain
      const trolley = buildArcadeTrolley(normalMap);
      trolley.carriageGroup.position.set(-0.22, 2.25, 0.15);
      scene.add(trolley.carriageGroup);

      const craneChain = buildChainLinks(10, normalMap);
      scene.add(craneChain.group);
      const nodes: THREE.Vector3[] = [];
      for (let i = 0; i < 11; i++) {
        nodes.push(new THREE.Vector3(-0.22, 2.01 - i * 0.11, 0.15));
      }
      craneChain.updateFromNodes(nodes);

      const ring = buildCraneRing(stage.ring, normalMap);
      ring.group.position.set(-0.22, 0.68, 0.15);
      ring.group.rotation.y = THREE.MathUtils.degToRad(stage.ring.restYawDeg);
      scene.add(ring.group);

      // Upright '?' Hook + Tether Chain + Prize Bundle on grate
      const [hx, hy, hz] = stage.hook.anchorPosition;
      const hook = buildUprightQuestionHook(
        stage.hook,
        normalMap,
        cabinet.hookBaseSize,
      );
      hook.group.position.set(hx, hy, hz);
      scene.add(hook.group);

      const prize = buildPrizeBundle(stage.prize, normalMap, maxAniso);
      prize.group.position.set(hx, cabinet.grateTopY + 0.02, hz);
      scene.add(prize.group);

      const tether = buildChainLinks(5, normalMap);
      scene.add(tether.group);
      const tNodes: THREE.Vector3[] = [];
      for (let i = 0; i < 6; i++) {
        tNodes.push(
          new THREE.Vector3(
            hx,
            THREE.MathUtils.lerp(
              hy + hook.bottomEyeletLocalY,
              cabinet.grateTopY + 0.02 + prize.tetherAnchorLocalY,
              i / 5,
            ),
            hz,
          ),
        );
      }
      tether.updateFromNodes(tNodes);
    }

    let rafId = 0;
    let timerId = 0;
    let disposed = false;

    const renderOnce = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };

    if (isSoftwareGl) {
      rafId = requestAnimationFrame(() => {
        renderOnce();
        scheduleSoftwareFrame(renderer, () => {}, (id) => {
          timerId = id;
        });
      });
    } else {
      rafId = requestAnimationFrame(renderOnce);
    }

    const handleResize = () => {
      if (!container || disposed) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestAnimationFrame(renderOnce);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
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
  }, [stage]);

  return <div ref={mountRef} className="w-full h-full" />;
}
