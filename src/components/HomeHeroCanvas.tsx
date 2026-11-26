import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { STAGES } from '../data/stages';
import {
  buildBouncePrizeJar,
  buildBridgeClawRig,
  buildBridgePrizeBox,
  buildChainLinks,
  buildCraneRing,
  buildUprightQuestionHook,
} from '../three/models';
import {
  applyStudioEnvironment,
  createStudioRenderer,
  detectSoftwareWebGL,
  scheduleSoftwareFrame,
} from '../three/rendererUtils';
import { createBrushedMetalNormalMap } from '../three/textures';

export function HomeHeroCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = createStudioRenderer(container, isSoftwareGl);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.11);

    const envTex = applyStudioEnvironment(renderer, scene);
    const normalMap = createBrushedMetalNormalMap();

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      40,
    );
    camera.position.set(0, 0.24, 2.75);
    camera.lookAt(0, -0.14, 0);

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.05);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.3);
    keyLight.position.set(2.4, 3.6, 2.8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.4);
    rimLight.position.set(-2.4, 1.6, -2.0);
    scene.add(rimLight);

    const showcaseGroup = new THREE.Group();
    scene.add(showcaseGroup);

    // Sleek arcade turntable plinth
    const plinthMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.16, 1.24, 0.08, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.35,
        metalness: 0.45,
      }),
    );
    plinthMesh.position.set(0, -0.66, 0);
    plinthMesh.receiveShadow = true;
    showcaseGroup.add(plinthMesh);

    const plinthTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.16, 0.012, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.75,
        roughness: 0.25,
      }),
    );
    plinthTrim.rotation.x = Math.PI / 2;
    plinthTrim.position.set(0, -0.62, 0);
    showcaseGroup.add(plinthTrim);

    // 1. Center-Top: Crane Head ("トレすぎ倉庫") + Dual Acrylic Claws
    const clawRig = buildBridgeClawRig(normalMap, maxAniso, isSoftwareGl);
    const trolleyPos = new THREE.Vector3(0, 1.65, 0);
    const headPos = new THREE.Vector3(0, 0.44, 0);
    clawRig.headGroup.position.copy(headPos);
    clawRig.updatePole(trolleyPos, headPos);
    clawRig.leftArmGroup.position.copy(headPos).add(clawRig.leftArmPivotLocal);
    clawRig.rightArmGroup.position
      .copy(headPos)
      .add(clawRig.rightArmPivotLocal);
    showcaseGroup.add(
      clawRig.poleMesh,
      clawRig.headGroup,
      clawRig.leftArmGroup,
      clawRig.rightArmGroup,
    );

    // 2. Center-Bottom: Bridge Rods + Collector Figure Box (橋渡し)
    const bridgeGroup = new THREE.Group();
    const rodSteelMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.88,
      roughness: 0.22,
    });
    const rodPinkMat = new THREE.MeshPhysicalMaterial({
      color: 0xf472b6,
      roughness: 0.48,
      metalness: 0.05,
      clearcoat: 0.25,
    });
    [-0.12, 0.12].forEach((rz) => {
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.82, 14),
        rodSteelMat,
      );
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, -0.5, rz);
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.66, 14),
        rodPinkMat,
      );
      sleeve.rotation.z = Math.PI / 2;
      sleeve.position.set(0, -0.5, rz);
      bridgeGroup.add(rod, sleeve);
    });
    const figureBox = buildBridgePrizeBox(STAGES[2].prize, maxAniso);
    figureBox.group.scale.setScalar(0.84);
    figureBox.group.position.set(0, -0.35, 0);
    bridgeGroup.add(figureBox.group);
    showcaseGroup.add(bridgeGroup);

    // 3. Left Showcase: Chain + Ring + '?' Hook (フック)
    const hookShowcase = new THREE.Group();
    hookShowcase.position.set(-0.7, 0.02, 0.12);
    const chain = buildChainLinks(4, normalMap);
    const chainNodes: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      chainNodes.push(new THREE.Vector3(0, 0.52 - i * 0.088, 0));
    }
    chain.updateFromNodes(chainNodes);
    hookShowcase.add(chain.group);

    const ring = buildCraneRing(STAGES[0].ring, normalMap);
    ring.group.scale.setScalar(0.76);
    ring.group.position.set(0, 0.08, 0);
    ring.group.rotation.y = THREE.MathUtils.degToRad(STAGES[0].ring.restYawDeg);
    hookShowcase.add(ring.group);

    const hook = buildUprightQuestionHook(
      { ...STAGES[0].hook, scale: 0.72 },
      normalMap,
    );
    hook.group.position.set(-0.01, -0.2, 0.01);
    hookShowcase.add(hook.group);
    showcaseGroup.add(hookShowcase);

    // 4. Right Showcase: Glossy Blue Bounce Ball + Square Fruit Box (バウンド)
    const bounceShowcase = new THREE.Group();
    bounceShowcase.position.set(0.68, -0.46, 0.1);
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 28, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        roughness: 0.09,
        metalness: 0.24,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      }),
    );
    ballMesh.position.set(-0.08, 0, 0.08);
    bounceShowcase.add(ballMesh);

    const fruitBox = buildBouncePrizeJar(
      'マンゴー',
      '#ea580c',
      '#f97316',
      0xca8a04,
      maxAniso,
    );
    fruitBox.group.scale.setScalar(0.95);
    fruitBox.group.position.set(0.16, -0.02, -0.1);
    fruitBox.group.rotation.y = -0.3;
    bounceShowcase.add(fruitBox.group);
    showcaseGroup.add(bounceShowcase);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const tick = () => {
      if (disposed) return;
      const t = clock.getElapsedTime();

      showcaseGroup.rotation.y = Math.sin(t * 0.55) * 0.36;

      const armSwing = 0.22 + Math.sin(t * 1.4) * 0.12;
      clawRig.leftArmGroup.rotation.z = -armSwing;
      clawRig.rightArmGroup.rotation.z = armSwing;

      ring.group.rotation.z = Math.sin(t * 1.35) * 0.05;
      hook.group.rotation.z = Math.sin(t * 1.35 - 0.5) * 0.08;
      ballMesh.position.y = Math.abs(Math.sin(t * 2.1)) * 0.08;

      renderer.render(scene, camera);
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
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
}
