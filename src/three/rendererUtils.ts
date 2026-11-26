import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export function createStudioRenderer(
  container: HTMLElement,
  isSoftwareGl: boolean,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  // Cap pixelRatio at 1.5 on mobile/desktop GPUs for smooth 60fps fillrate
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5),
  );
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const width = Math.max(container.clientWidth, 1);
  const height = Math.max(container.clientHeight, 1);
  renderer.setSize(width, height);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  container.appendChild(renderer.domElement);
  return renderer;
}

export function applyStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;
  scene.environment = envTexture;
  pmremGenerator.dispose();
  return envTexture;
}

export function scheduleSoftwareFrame(
  renderer: THREE.WebGLRenderer,
  cb: () => void,
  setTimerId: (id: number) => void,
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  if (!gl || typeof gl.fenceSync !== 'function') {
    setTimerId(window.setTimeout(cb, 80));
    return;
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
    if (state === gl.UNSIGNALED) {
      setTimerId(window.setTimeout(poll, 5));
    } else {
      if (sync) gl.deleteSync(sync);
      setTimerId(window.setTimeout(cb, 80));
    }
  };
  setTimerId(window.setTimeout(poll, 5));
}
