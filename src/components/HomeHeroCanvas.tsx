import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { STAGES } from '../data/stages';
import {
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
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.14);

    const envTex = applyStudioEnvironment(renderer, scene);
    const normalMap = createBrushedMetalNormalMap();

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      40,
    );
    camera.position.set(0.15, 0.05, 1.9);
    camera.lookAt(0, -0.05, 0);

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.4);
    keyLight.position.set(2.5, 3.2, 2.8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.5);
    rimLight.position.set(-2.4, 1.5, -2.0);
    scene.add(rimLight);

    const stage = STAGES[0];
    const showcaseGroup = new THREE.Group();
    scene.add(showcaseGroup);

    // Hanging Chain + Metal Ring at top (Crane side)
    const chain = buildChainLinks(7, normalMap);
    showcaseGroup.add(chain.group);

    const ring = buildCraneRing(stage.ring, normalMap);
    ring.group.position.set(0, 0.12, 0);
    ring.group.rotation.y = THREE.MathUtils.degToRad(stage.ring.restYawDeg);
    showcaseGroup.add(ring.group);

    // Upright '?' Hook hooked inside the Metal Ring below
    const hook = buildUprightQuestionHook(
      { ...stage.hook, scale: 1.08 },
      normalMap,
    );
    hook.group.position.set(-0.02, -0.26, 0.02);
    showcaseGroup.add(hook.group);

    const chainNodes: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      chainNodes.push(new THREE.Vector3(0, 1.15 - i * 0.095, 0));
    }
    chain.updateFromNodes(chainNodes);

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

      showcaseGroup.rotation.y = Math.sin(t * 0.65) * 0.42;
      ring.group.rotation.z = Math.sin(t * 1.35) * 0.05;
      hook.group.rotation.z = Math.sin(t * 1.35 - 0.5) * 0.08;

      for (let i = 0; i < chainNodes.length; i++) {
        const frac = i / (chainNodes.length - 1);
        chainNodes[i].set(
          Math.sin(t * 1.35) * 0.04 * frac,
          1.12 - i * 0.092,
          0,
        );
      }
      chain.updateFromNodes(chainNodes);

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
