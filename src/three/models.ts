import * as THREE from 'three';
import type {
  CraneToolType,
  HookGeometryConfig,
  HookShapeType,
  PrizeBoxConfig,
  RingGeometryConfig,
} from '../types/game';
import {
  createArcadeWallPatternTexture,
  createCandyBoxTexture,
  createContactShadowTexture,
  createFigureBoxTexture,
  createPrizeBoxTexture,
  createRedTapeTexture,
  createSnackBagTexture,
  createUfoCatcherFaceTexture,
} from './textures';

export interface CraneRingHandle {
  group: THREE.Group;
  toolType: CraneToolType;
  eyeletLocalY: number;
  majorRadius: number;
  tubeRadius: number;
  spineLocal: THREE.Vector3[];
  cradleStartIdx: number;
  cradleEndIdx: number;
}

export function buildCraneRing(
  config: RingGeometryConfig,
  normalMap: THREE.Texture,
): CraneRingHandle {
  const group = new THREE.Group();
  const toolType: CraneToolType = config.toolType ?? 'ring';

  // Polished stainless steel / chrome material matching reference images
  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf0f6,
    metalness: 0.97,
    roughness: 0.11,
    anisotropy: 0.65,
    clearcoat: 0.5,
    clearcoatRoughness: 0.08,
    normalMap,
    normalScale: new THREE.Vector2(0.09, 0.09),
  });

  const weldMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.9,
    roughness: 0.28,
  });

  if (toolType === 'j_hook') {
    // High-detail sculpted forged chrome J-Hook matching Reference Image 2 (Screenshot_20261126-023755_2)
    // Outer contour (bevelSize expands outward by 0.008)
    const outerCtrl = [
      new THREE.Vector2(0.004, 0.198),
      new THREE.Vector2(-0.036, 0.184),
      new THREE.Vector2(-0.066, 0.122),
      new THREE.Vector2(-0.072, 0.038),
      new THREE.Vector2(-0.084, -0.04),
      new THREE.Vector2(-0.072, -0.135),
      new THREE.Vector2(0.012, -0.194),
      new THREE.Vector2(0.088, -0.134),
      new THREE.Vector2(0.114, -0.045),
      new THREE.Vector2(0.114, -0.002),
      new THREE.Vector2(0.11, 0.005),
      new THREE.Vector2(0.105, -0.002),
      new THREE.Vector2(0.095, -0.042),
      new THREE.Vector2(0.066, -0.106),
      new THREE.Vector2(0.016, -0.132),
      new THREE.Vector2(-0.026, -0.098),
      new THREE.Vector2(-0.036, -0.028),
      new THREE.Vector2(-0.028, 0.046),
      new THREE.Vector2(0.032, 0.084),
      new THREE.Vector2(0.064, 0.134),
      new THREE.Vector2(0.048, 0.18),
    ];
    const outerSpline = new THREE.SplineCurve(outerCtrl);
    const sampledOuter: THREE.Vector2[] = [];
    const nOuter = 112;
    for (let i = 0; i < nOuter; i++) {
      sampledOuter.push(outerSpline.getPoint(i / nOuter));
    }
    const hookShape = new THREE.Shape(sampledOuter);
    hookShape.closePath();

    // Tilted teardrop/oval cutout punched directly through the forged upper boss
    const holePts: THREE.Vector2[] = [];
    const holeCx = 0.002;
    const holeCy = 0.136;
    const holeRx = 0.028;
    const holeRy = 0.048;
    const holeTilt = -0.28;
    const cosT = Math.cos(holeTilt);
    const sinT = Math.sin(holeTilt);
    for (let i = 0; i < 36; i++) {
      const a = -(i / 36) * Math.PI * 2;
      const lx = Math.cos(a) * holeRx;
      const ly = Math.sin(a) * holeRy;
      holePts.push(
        new THREE.Vector2(
          holeCx + lx * cosT - ly * sinT,
          holeCy + lx * sinT + ly * cosT,
        ),
      );
    }
    const eyeCutout = new THREE.Path(holePts);
    eyeCutout.closePath();
    hookShape.holes.push(eyeCutout);

    const hookGeo = new THREE.ExtrudeGeometry(hookShape, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.013,
      bevelSize: 0.008,
      bevelSegments: 6,
      curveSegments: 24,
    });
    // Center in Z around z = 0 so the hook body is balanced symmetrically
    hookGeo.translate(0, 0, -0.005);
    hookGeo.computeVertexNormals();

    const hookMesh = new THREE.Mesh(hookGeo, steelMat);
    hookMesh.castShadow = true;
    hookMesh.receiveShadow = true;
    group.add(hookMesh);

    // Subtle recessed casting/pin dimple on upper-right forged shoulder (Image 2 detail)
    const dimpleMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7,
      metalness: 0.2,
    });
    const dimpleGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.037, 12);
    dimpleGeo.rotateX(Math.PI / 2);
    const dimple = new THREE.Mesh(dimpleGeo, dimpleMat);
    dimple.position.set(0.044, 0.162, 0);
    group.add(dimple);

    // Double-wound chrome split key ring passing directly through the top oval eyelet (Image 2)
    const splitRingMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1f5f9,
      metalness: 0.98,
      roughness: 0.09,
      clearcoat: 0.45,
    });
    const splitCoilGeo = new THREE.TorusGeometry(0.036, 0.005, 10, 28);
    [-0.004, 0.004].forEach((oz, idx) => {
      const coil = new THREE.Mesh(splitCoilGeo, splitRingMat);
      coil.position.set(0.002, 0.194, oz);
      coil.rotation.y = Math.PI * 0.42 + idx * 0.16;
      coil.rotation.x = 0.08 * (idx === 0 ? 1 : -1);
      coil.castShadow = true;
      group.add(coil);
    });

    // Top swivel shackle ring connecting split ring seamlessly to crane chain
    const eyeletLocalY = 0.232;
    const jumpRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.0075, 12, 24),
      steelMat,
    );
    jumpRing.rotation.y = Math.PI / 2;
    jumpRing.position.set(0, eyeletLocalY, 0);
    group.add(jumpRing);

    // Centerline spine matching exact forged J-hook silhouette for physics colliders & catch check
    const spineCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-0.002, 0.145, 0),
        new THREE.Vector3(-0.052, 0.048, 0),
        new THREE.Vector3(-0.06, -0.032, 0),
        new THREE.Vector3(-0.048, -0.116, 0),
        new THREE.Vector3(0.015, -0.166, 0),
        new THREE.Vector3(0.078, -0.122, 0),
        new THREE.Vector3(0.104, -0.044, 0),
        new THREE.Vector3(0.11, -0.002, 0),
      ],
      false,
      'centripetal',
      0.5,
    );
    const sampleCount = 28;
    const spineLocal: THREE.Vector3[] = [];
    for (let i = 0; i < sampleCount; i++) {
      spineLocal.push(spineCurve.getPointAt(i / (sampleCount - 1)));
    }

    return {
      group,
      toolType: 'j_hook',
      eyeletLocalY,
      majorRadius: config.majorRadius,
      tubeRadius: config.tubeRadius,
      spineLocal,
      cradleStartIdx: 8,
      cradleEndIdx: 25,
    };
  }

  // Stage 1: Main stainless torus ring centered at (0, 0, 0)
  const torusGeo = new THREE.TorusGeometry(
    config.majorRadius,
    config.tubeRadius,
    16,
    40,
  );
  torusGeo.computeTangents();
  const torusMesh = new THREE.Mesh(torusGeo, steelMat);
  torusMesh.castShadow = true;
  torusMesh.receiveShadow = true;
  group.add(torusMesh);

  // Welded seam collar at bottom of ring
  const seamGeo = new THREE.CylinderGeometry(
    config.tubeRadius * 1.18,
    config.tubeRadius * 1.18,
    0.048,
    18,
  );
  const seamMesh = new THREE.Mesh(seamGeo, weldMat);
  seamMesh.rotation.z = Math.PI / 2;
  seamMesh.position.set(0, -config.majorRadius, 0);
  group.add(seamMesh);

  // Top swivel eyelet connecting to the crane's chain
  const eyeletLocalY = config.majorRadius + 0.032;
  const jumpRingGeo = new THREE.TorusGeometry(0.036, 0.01, 12, 24);
  const jumpRing = new THREE.Mesh(jumpRingGeo, steelMat);
  jumpRing.rotation.y = Math.PI / 2;
  jumpRing.position.set(0, eyeletLocalY, 0);
  group.add(jumpRing);

  return {
    group,
    toolType: 'ring',
    eyeletLocalY,
    majorRadius: config.majorRadius,
    tubeRadius: config.tubeRadius,
    spineLocal: [],
    cradleStartIdx: 0,
    cradleEndIdx: 0,
  };
}

export interface UprightHookHandle {
  group: THREE.Group;
  hookType: HookShapeType;
  spineLocal: THREE.Vector3[];
  tubeRadius: number;
  bottomEyeletLocalY: number;
  baseLocalCenterY: number;
  plateTopLocalY: number;
  eyeHalfSpan: number;
  eyeTopLocalY: number;
  baseSize: THREE.Vector3;
  archStartIdx: number;
  archEndIdx: number;
  tipIdx: number;
}

export function buildUprightQuestionHook(
  config: HookGeometryConfig,
  normalMap: THREE.Texture,
  baseSize: THREE.Vector3 = new THREE.Vector3(1.14, 0.056, 0.44),
): UprightHookHandle {
  const group = new THREE.Group();
  const s = config.scale;
  const tubeRadius = config.tubeRadius * s;
  const baseTopLocalY = -0.2112;

  const metalMaterial = new THREE.MeshPhysicalMaterial({
    color: config.metalColor,
    metalness: config.type === 'eye_plate' ? 0.97 : 0.9,
    roughness: config.type === 'eye_plate' ? 0.14 : 0.18,
    anisotropy: 0.72,
    clearcoat: config.type === 'eye_plate' ? 0.55 : 0.45,
    clearcoatRoughness: 0.1,
    normalMap,
    normalScale: new THREE.Vector2(0.14, 0.14),
  });

  let curve: THREE.CatmullRomCurve3;
  let plateTopLocalY = baseTopLocalY;
  let eyeHalfSpan = 0.132;
  let eyeTopLocalY = baseTopLocalY + 0.25;
  let archStartIdx = 11;
  let archEndIdx = 23;

  if (config.type === 'eye_plate') {
    // Stage 2: Realistic Brushed Stainless Eye Plate (Image 1: beveled plate + 4 real punched countersunk holes + welded U-arch)
    const pw = 0.44;
    const pd = 0.29;
    const pThick = 0.022;
    const cr = 0.032;
    plateTopLocalY = baseTopLocalY + pThick;

    const plateShape = new THREE.Shape();
    const hx = pw * 0.5;
    const hz = pd * 0.5;
    plateShape.moveTo(-hx + cr, -hz);
    plateShape.lineTo(hx - cr, -hz);
    plateShape.quadraticCurveTo(hx, -hz, hx, -hz + cr);
    plateShape.lineTo(hx, hz - cr);
    plateShape.quadraticCurveTo(hx, hz, hx - cr, hz);
    plateShape.lineTo(-hx + cr, hz);
    plateShape.quadraticCurveTo(-hx, hz, -hx, hz - cr);
    plateShape.lineTo(-hx, -hz + cr);
    plateShape.quadraticCurveTo(-hx, -hz, -hx + cr, -hz);

    const holeOffsets: [number, number][] = [
      [-0.158, -0.092],
      [0.158, -0.092],
      [-0.158, 0.092],
      [0.158, 0.092],
    ];
    const holeR = 0.021;
    holeOffsets.forEach(([sx, sz]) => {
      const hPath = new THREE.Path();
      hPath.absarc(sx, sz, holeR, 0, Math.PI * 2, true);
      plateShape.holes.push(hPath);
    });

    const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
      depth: pThick - 0.005,
      bevelEnabled: true,
      bevelThickness: 0.0025,
      bevelSize: 0.003,
      bevelSegments: 3,
      curveSegments: 20,
    });
    plateGeo.rotateX(-Math.PI / 2);
    const plateMesh = new THREE.Mesh(plateGeo, metalMaterial);
    plateMesh.position.set(0, baseTopLocalY + 0.0025, 0);
    plateMesh.castShadow = true;
    plateMesh.receiveShadow = true;
    group.add(plateMesh);

    // 4 Chamfered countersink funnel bevels + flush Phillips screws seated inside the recesses
    const countersinkMat = new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      metalness: 0.94,
      roughness: 0.22,
      clearcoat: 0.35,
    });
    const screwHeadMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbe3ee,
      metalness: 0.96,
      roughness: 0.16,
    });
    const slotMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.3,
    });

    const csProfile = [
      new THREE.Vector2(0.015, -0.013),
      new THREE.Vector2(0.029, 0.0005),
      new THREE.Vector2(0.032, 0.0005),
      new THREE.Vector2(0.018, -0.014),
    ];
    const csGeo = new THREE.LatheGeometry(csProfile, 24);
    const screwGeo = new THREE.CylinderGeometry(0.0145, 0.011, 0.006, 18);
    const slotGeo = new THREE.BoxGeometry(0.016, 0.0022, 0.0032);

    holeOffsets.forEach(([sx, sz], idx) => {
      const funnel = new THREE.Mesh(csGeo, countersinkMat);
      funnel.position.set(sx, plateTopLocalY, -sz);
      const screw = new THREE.Mesh(screwGeo, screwHeadMat);
      screw.position.set(sx, plateTopLocalY - 0.009, -sz);
      const slotA = new THREE.Mesh(slotGeo, slotMat);
      slotA.position.set(sx, plateTopLocalY - 0.0055, -sz);
      slotA.rotation.y = idx * 0.45;
      const slotB = new THREE.Mesh(slotGeo, slotMat);
      slotB.position.set(sx, plateTopLocalY - 0.0055, -sz);
      slotB.rotation.y = idx * 0.45 + Math.PI / 2;
      group.add(funnel, screw, slotA, slotB);
    });

    // Welded stainless U-shaped loop rising cleanly from the Eye Plate
    eyeHalfSpan = 0.132;
    const archHeight = 0.256;
    eyeTopLocalY = plateTopLocalY + archHeight;
    const eyePts = [
      new THREE.Vector3(-eyeHalfSpan, baseTopLocalY + 0.01, 0),
      new THREE.Vector3(-eyeHalfSpan, plateTopLocalY + 0.09, 0),
      new THREE.Vector3(-eyeHalfSpan * 0.78, plateTopLocalY + archHeight * 0.81, 0),
      new THREE.Vector3(0, eyeTopLocalY, 0),
      new THREE.Vector3(eyeHalfSpan * 0.78, plateTopLocalY + archHeight * 0.81, 0),
      new THREE.Vector3(eyeHalfSpan, plateTopLocalY + 0.09, 0),
      new THREE.Vector3(eyeHalfSpan, baseTopLocalY + 0.01, 0),
    ];
    curve = new THREE.CatmullRomCurve3(eyePts, false, 'centripetal', 0.5);

    const archGeo = new THREE.TubeGeometry(curve, 44, tubeRadius, 16, false);
    archGeo.computeTangents();
    const archMesh = new THREE.Mesh(archGeo, metalMaterial);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    group.add(archMesh);

    // Concave TIG weld fillets around the two arch feet
    const weldFilletMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.28,
    });
    const weldProfile = [
      new THREE.Vector2(tubeRadius * 0.96, 0.016),
      new THREE.Vector2(tubeRadius * 1.06, 0.007),
      new THREE.Vector2(tubeRadius * 1.38, 0.001),
      new THREE.Vector2(tubeRadius * 1.44, 0.0),
    ];
    const weldFilletGeo = new THREE.LatheGeometry(weldProfile, 22);
    [-eyeHalfSpan, eyeHalfSpan].forEach((fx) => {
      const fillet = new THREE.Mesh(weldFilletGeo, weldFilletMat);
      fillet.position.set(fx, plateTopLocalY + 0.0005, 0);
      fillet.castShadow = true;
      group.add(fillet);
    });

    archStartIdx = 3;
    archEndIdx = 24;
  } else {
    // Stage 1: Brass '?' screw-hook curve with open mouth
    const collarPoints = [
      new THREE.Vector2(0.0, baseTopLocalY),
      new THREE.Vector2(0.064 * s, baseTopLocalY),
      new THREE.Vector2(0.064 * s, baseTopLocalY + 0.012 * s),
      new THREE.Vector2(0.032 * s, baseTopLocalY + 0.018 * s),
      new THREE.Vector2(0.02 * s, baseTopLocalY + 0.048 * s),
    ];
    const collarGeo = new THREE.LatheGeometry(collarPoints, 28);
    const collarMesh = new THREE.Mesh(collarGeo, metalMaterial);
    collarMesh.castShadow = true;
    group.add(collarMesh);

    const controlPts = [
      new THREE.Vector3(0.0, -0.24 * s, 0),
      new THREE.Vector3(0.0, -0.145 * s, 0),
      new THREE.Vector3(0.052 * s, -0.065 * s, 0),
      new THREE.Vector3(0.155 * s, 0.03 * s, 0),
      new THREE.Vector3(0.15 * s, 0.15 * s, 0),
      new THREE.Vector3(0.055 * s, 0.235 * s, 0),
      new THREE.Vector3(-0.068 * s, 0.225 * s, 0),
      new THREE.Vector3(-0.145 * s, 0.14 * s, 0),
      new THREE.Vector3(-0.185 * s, 0.045 * s, 0),
    ];

    curve = new THREE.CatmullRomCurve3(controlPts, false, 'centripetal', 0.45);
    const tubeGeo = new THREE.TubeGeometry(curve, 36, tubeRadius, 12, false);
    tubeGeo.computeTangents();
    const tubeMesh = new THREE.Mesh(tubeGeo, metalMaterial);
    tubeMesh.castShadow = true;
    tubeMesh.receiveShadow = true;
    group.add(tubeMesh);

    const tipPos = curve.getPointAt(1);
    const tipCapGeo = new THREE.SphereGeometry(tubeRadius * 1.02, 12, 12);
    const tipCapMesh = new THREE.Mesh(tipCapGeo, metalMaterial);
    tipCapMesh.position.copy(tipPos);
    tipCapMesh.castShadow = true;
    group.add(tipCapMesh);
  }

  // Unified Red Rectangular Base Board ("赤い土台") rigidly attached
  const baseLocalCenterY = baseTopLocalY - baseSize.y * 0.5;
  const redTapeTex = config.type === 'eye_plate' ? createRedTapeTexture() : null;
  const hookBaseMat = new THREE.MeshStandardMaterial({
    color: redTapeTex ? 0xffffff : 0xdc2626,
    map: redTapeTex,
    roughness: redTapeTex ? 0.28 : 0.36,
    metalness: 0.06,
  });
  const hookBaseRimMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.44,
    metalness: 0.1,
  });
  const baseBoardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(baseSize.x, baseSize.y, baseSize.z),
    hookBaseMat,
  );
  baseBoardMesh.position.set(0, baseLocalCenterY, 0);
  baseBoardMesh.castShadow = true;
  baseBoardMesh.receiveShadow = true;
  group.add(baseBoardMesh);

  const seamStripeGeo = new THREE.BoxGeometry(0.014, 0.004, baseSize.z * 0.99);
  [-0.42, -0.22, 0.22, 0.42].forEach((ox) => {
    const stripe = new THREE.Mesh(seamStripeGeo, hookBaseRimMat);
    stripe.position.set(ox, baseTopLocalY + 0.001, 0);
    group.add(stripe);
  });

  // Bottom eyelet on the underside of the red board connecting down to the prize tether chain
  const bottomEyeletLocalY = baseLocalCenterY - baseSize.y * 0.5 - 0.015;
  const eyeletGeo = new THREE.TorusGeometry(0.03 * s, 0.009 * s, 14, 28);
  const eyeletMesh = new THREE.Mesh(eyeletGeo, metalMaterial);
  eyeletMesh.position.set(0, bottomEyeletLocalY, 0);
  eyeletMesh.castShadow = true;
  group.add(eyeletMesh);

  const sampleCount = 28;
  const spineLocal: THREE.Vector3[] = [];
  for (let i = 0; i < sampleCount; i++) {
    spineLocal.push(curve.getPointAt(i / (sampleCount - 1)));
  }

  return {
    group,
    hookType: config.type,
    spineLocal,
    tubeRadius,
    bottomEyeletLocalY,
    baseLocalCenterY,
    plateTopLocalY,
    eyeHalfSpan,
    eyeTopLocalY,
    baseSize: baseSize.clone(),
    archStartIdx,
    archEndIdx,
    tipIdx: sampleCount - 1,
  };
}

export interface PrizeBundleHandle {
  group: THREE.Group;
  tetherAnchorLocalY: number;
}

export function buildPrizeBundle(
  prizeConfig: PrizeBoxConfig,
  normalMap: THREE.Texture,
  maxAnisotropy: number,
): PrizeBundleHandle {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.96,
    roughness: 0.16,
    normalMap,
    normalScale: new THREE.Vector2(0.1, 0.1),
  });

  const boxTex = createPrizeBoxTexture(
    prizeConfig.label,
    prizeConfig.subLabel,
    prizeConfig.primaryColor,
    prizeConfig.accentColor,
    maxAnisotropy,
  );

  // 1. Pink cushioned pouch ("ふわ玉") matching Photo
  const pw = prizeConfig.width;
  const ph = prizeConfig.height;
  const pd = prizeConfig.depth;

  const pouchShape = new THREE.Shape();
  const rx = pw * 0.5;
  const rz = pd * 0.5;
  const rCorner = 0.06;
  pouchShape.moveTo(-rx + rCorner, -rz);
  pouchShape.lineTo(rx - rCorner, -rz);
  pouchShape.quadraticCurveTo(rx, -rz, rx, -rz + rCorner);
  pouchShape.lineTo(rx, rz - rCorner);
  pouchShape.quadraticCurveTo(rx, rz, rx - rCorner, rz);
  pouchShape.lineTo(-rx + rCorner, rz);
  pouchShape.quadraticCurveTo(-rx, rz, -rx, rz - rCorner);
  pouchShape.lineTo(-rx, -rz + rCorner);
  pouchShape.quadraticCurveTo(-rx, -rz, -rx + rCorner, -rz);

  const pouchGeo = new THREE.ExtrudeGeometry(pouchShape, {
    depth: ph * 0.72,
    bevelEnabled: true,
    bevelThickness: 0.032,
    bevelSize: 0.025,
    bevelSegments: 4,
  });
  pouchGeo.rotateX(-Math.PI / 2);
  pouchGeo.center();

  const pouchMat = new THREE.MeshStandardMaterial({
    map: boxTex,
    roughness: 0.34,
    metalness: 0.05,
  });
  const pouchMesh = new THREE.Mesh(pouchGeo, pouchMat);
  pouchMesh.position.set(-0.18, 0.11, 0.06);
  pouchMesh.rotation.y = 0.12;
  pouchMesh.castShadow = true;
  pouchMesh.receiveShadow = true;
  group.add(pouchMesh);

  // 2. Blue mini-box ("ミニ箱") matching Photo
  const miniTex = createCandyBoxTexture(
    'ミニ箱',
    '#2563eb',
    '#1d4ed8',
    maxAnisotropy,
  );
  const miniBoxGeo = new THREE.BoxGeometry(0.32, 0.24, 0.26);
  const miniBoxMat = new THREE.MeshStandardMaterial({
    map: miniTex,
    roughness: 0.42,
    metalness: 0.04,
  });
  const miniBox = new THREE.Mesh(miniBoxGeo, miniBoxMat);
  miniBox.position.set(0.22, 0.12, 0.02);
  miniBox.rotation.y = -0.2;
  miniBox.castShadow = true;
  miniBox.receiveShadow = true;
  group.add(miniBox);

  // 3. Yellow cylindrical snack can behind the boxes (Photo)
  const canGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.28, 24);
  const canMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.28,
    metalness: 0.15,
  });
  const canMesh = new THREE.Mesh(canGeo, canMat);
  canMesh.rotation.z = Math.PI / 2;
  canMesh.rotation.y = 0.42;
  canMesh.position.set(-0.16, 0.09, -0.18);
  canMesh.castShadow = true;
  group.add(canMesh);

  // 4. White strap + tether ring connecting prize up to '?' hook
  const strapGeo = new THREE.BoxGeometry(0.46, 0.025, 0.1);
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.55,
    metalness: 0.02,
  });
  const strapMesh = new THREE.Mesh(strapGeo, strapMat);
  strapMesh.position.set(0.02, 0.22, 0.0);
  group.add(strapMesh);

  const tetherAnchorLocalY = 0.26;
  const anchorRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.036, 0.01, 10, 22),
    steelMat,
  );
  anchorRing.position.set(0.0, tetherAnchorLocalY, 0.0);
  group.add(anchorRing);

  return {
    group,
    tetherAnchorLocalY,
  };
}

export interface TrolleyHandle {
  carriageGroup: THREE.Group;
  coilMesh: THREE.Mesh;
  shackleWorldOffsetY: number;
}

export function buildArcadeTrolley(normalMap: THREE.Texture): TrolleyHandle {
  const carriageGroup = new THREE.Group();

  const whitePlasticMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.24,
    metalness: 0.08,
  });

  const darkAcrylicMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.12,
    metalness: 0.2,
  });

  const blackAnodizedMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.35,
    metalness: 0.78,
  });

  const pinkAccentMat = new THREE.MeshStandardMaterial({
    color: 0xec4899,
    roughness: 0.3,
    metalness: 0.1,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.18,
  });

  const poleGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.42, 12);
  const poleMesh = new THREE.Mesh(poleGeo, blackAnodizedMat);
  poleMesh.position.set(0, 0.25, 0);
  poleMesh.castShadow = true;
  carriageGroup.add(poleMesh);

  const bodyShape = new THREE.Shape();
  const bw = 0.38;
  const bh = 0.18;
  const br = 0.08;
  bodyShape.moveTo(-bw + br, -bh);
  bodyShape.lineTo(bw - br, -bh);
  bodyShape.quadraticCurveTo(bw, -bh, bw, -bh + br);
  bodyShape.lineTo(bw, bh - br);
  bodyShape.quadraticCurveTo(bw, bh, bw - br, bh);
  bodyShape.lineTo(-bw + br, bh);
  bodyShape.quadraticCurveTo(-bw, bh, -bw, bh - br);
  bodyShape.lineTo(-bw, -bh + br);
  bodyShape.quadraticCurveTo(-bw, -bh, -bw + br, -bh);

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  bodyGeo.center();
  const bodyMesh = new THREE.Mesh(bodyGeo, whitePlasticMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  carriageGroup.add(bodyMesh);

  const windowGeo = new THREE.BoxGeometry(0.42, 0.11, 0.04);
  const windowMesh = new THREE.Mesh(windowGeo, darkAcrylicMat);
  windowMesh.position.set(0, -0.01, 0.205);
  carriageGroup.add(windowMesh);

  const trimGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12);
  trimGeo.rotateZ(Math.PI / 2);
  const leftTrim = new THREE.Mesh(trimGeo, pinkAccentMat);
  leftTrim.position.set(-0.415, -0.02, 0);
  const rightTrim = new THREE.Mesh(trimGeo, pinkAccentMat);
  rightTrim.position.set(0.415, -0.02, 0);
  carriageGroup.add(leftTrim, rightTrim);

  const shackleGeo = new THREE.TorusGeometry(0.04, 0.012, 8, 16);
  const shackleMesh = new THREE.Mesh(shackleGeo, chromeMat);
  shackleMesh.position.set(0, -0.23, 0);
  carriageGroup.add(shackleMesh);

  const coilPts: THREE.Vector3[] = [];
  const turns = 9;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const angle = t * turns * Math.PI * 2;
    coilPts.push(
      new THREE.Vector3(
        0.18 + Math.cos(angle) * 0.042,
        0.48 - t * 0.34,
        Math.sin(angle) * 0.042,
      ),
    );
  }
  const coilCurve = new THREE.CatmullRomCurve3(coilPts);
  const coilGeo = new THREE.TubeGeometry(coilCurve, 44, 0.011, 6, false);
  const coilMesh = new THREE.Mesh(coilGeo, blackAnodizedMat);
  carriageGroup.add(coilMesh);

  return {
    carriageGroup,
    coilMesh,
    shackleWorldOffsetY: -0.24,
  };
}

export interface ChainVisualHandle {
  group: THREE.Group;
  links: THREE.Mesh[];
  updateFromNodes: (nodes: THREE.Vector3[]) => void;
}

const _segDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _midPt = new THREE.Vector3();
const _baseQuat = new THREE.Quaternion();
const _twistQuat = new THREE.Quaternion();

export function buildChainLinks(
  linkCount: number,
  _normalMap: THREE.Texture,
): ChainVisualHandle {
  const group = new THREE.Group();
  const links: THREE.Mesh[] = [];

  const linkMat = new THREE.MeshStandardMaterial({
    color: 0xdbe3ee,
    metalness: 0.92,
    roughness: 0.22,
  });

  const linkGeo = new THREE.TorusGeometry(0.034, 0.0085, 6, 12);
  linkGeo.scale(0.68, 1.38, 1.0);

  for (let i = 0; i < linkCount; i++) {
    const mesh = new THREE.Mesh(linkGeo, linkMat);
    mesh.castShadow = true;
    group.add(mesh);
    links.push(mesh);
  }

  return {
    group,
    links,
    updateFromNodes: (nodes: THREE.Vector3[]) => {
      const segs = Math.min(links.length, nodes.length - 1);
      for (let i = 0; i < segs; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        _midPt.addVectors(a, b).multiplyScalar(0.5);
        _segDir.subVectors(b, a);
        const len = _segDir.length();
        if (len > 1e-5) {
          _segDir.divideScalar(len);
          _baseQuat.setFromUnitVectors(_upAxis, _segDir);
          _twistQuat.setFromAxisAngle(
            _upAxis,
            i % 2 === 0 ? 0 : Math.PI * 0.5,
          );
          links[i].quaternion.copy(_baseQuat).multiply(_twistQuat);
          links[i].scale.set(1, Math.max(0.55, len / 0.09), 1);
        }
        links[i].position.copy(_midPt);
        links[i].visible = true;
      }
      for (let i = segs; i < links.length; i++) {
        links[i].visible = false;
      }
    },
  };
}

export interface CabinetEnvironmentHandle {
  group: THREE.Group;
  grateTopY: number;
  hookCradleY: number;
  hookBaseCenter: THREE.Vector3;
  hookBaseSize: THREE.Vector3;
  chuteCenter: THREE.Vector3;
  zBridgeGroup: THREE.Group;
}

export function buildCabinetEnvironment(
  isSoftwareGl: boolean,
  maxAnisotropy: number,
): CabinetEnvironmentHandle {
  const group = new THREE.Group();
  const grateTopY = -1.05;
  const hookBaseSize = new THREE.Vector3(1.14, 0.056, 0.44);
  const hookBaseCenter = new THREE.Vector3(0.32, -0.489, 0.04);
  const hookCradleY = hookBaseCenter.y + hookBaseSize.y * 0.5; // -0.461

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.72,
    metalness: 0.05,
  });

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 6.2), wallMat);
  backWall.position.set(0, 0.5, -2.15);
  backWall.receiveShadow = true;
  group.add(backWall);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.55,
    metalness: 0.15,
  });
  const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 4.5),
    floorMat,
  );
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.set(0, -1.78, -0.2);
  floorPlane.receiveShadow = true;
  group.add(floorPlane);

  // Slim corner cabinet pillars so Side camera view is unobstructed
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.65,
    roughness: 0.32,
  });
  const pillarGeo = new THREE.BoxGeometry(0.16, 5.4, 0.18);
  const cornerPositions: [number, number][] = [
    [-2.18, 1.48],
    [2.18, 1.48],
    [-2.18, -1.52],
    [2.18, -1.52],
  ];
  cornerPositions.forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(pillarGeo, frameMat);
    pillar.position.set(px, 0.5, pz);
    group.add(pillar);
  });

  // Overhead 3D Dual-Axis Gantry (fixed front/back X-rails + moving Z-bridge carriage)
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.24,
  });
  const frontXTrack = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 0.07, 0.08),
    railMat,
  );
  frontXTrack.position.set(0, 2.52, 1.08);
  const backXTrack = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 0.07, 0.08),
    railMat,
  );
  backXTrack.position.set(0, 2.52, -1.08);
  group.add(frontXTrack, backXTrack);

  const zBridgeGroup = new THREE.Group();
  zBridgeGroup.position.set(0, 2.5, 0);
  const zBridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.08, 2.24),
    railMat,
  );
  zBridgeBeam.castShadow = true;
  const endTruckGeo = new THREE.BoxGeometry(0.24, 0.12, 0.16);
  const endTruckFront = new THREE.Mesh(endTruckGeo, railMat);
  endTruckFront.position.set(0, 0.02, 1.08);
  const endTruckBack = new THREE.Mesh(endTruckGeo, railMat);
  endTruckBack.position.set(0, 0.02, -1.08);
  zBridgeGroup.add(zBridgeBeam, endTruckFront, endTruckBack);
  group.add(zBridgeGroup);

  // Subtle trim material for shelf lips
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.42,
    metalness: 0.25,
  });

  const ledStripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.06, 0.24),
    ledStripMat,
  );
  ledStrip.position.set(0, 2.72, -0.55);
  const ledFrontStrip = new THREE.Mesh(
    new THREE.BoxGeometry(3.9, 0.05, 0.12),
    ledStripMat,
  );
  ledFrontStrip.position.set(0, 2.72, 1.25);
  group.add(ledStrip, ledFrontStrip);

  // Background 3D Japanese Snack Shelves with deep shelf lip & volumetric pillow pouches
  const shelfMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.08,
  });
  const shelfHeights = [1.55, 0.58, -0.28, -0.98];
  shelfHeights.forEach((sy) => {
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.055, 0.62),
      shelfMat,
    );
    shelf.position.set(0, sy, -1.72);
    shelf.receiveShadow = true;
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.08, 0.025),
      trimMat,
    );
    lip.position.set(0, sy + 0.03, -1.42);
    group.add(shelf, lip);
  });

  const snackConfigs = [
    { title: 'しろまる', flavor: 'ミルク味', bg: '#f8fafc', band: '#2563eb', chip: '#fde68a' },
    { title: 'ひよこ', flavor: 'バター味', bg: '#fef9c3', band: '#ca8a04', chip: '#fbbf24' },
    { title: 'しろまる', flavor: 'ミルク味', bg: '#f8fafc', band: '#2563eb', chip: '#fde68a' },
    { title: 'こがね', flavor: 'しょうゆ', bg: '#fef08a', band: '#15803d', chip: '#f59e0b' },
    { title: 'ももはな', flavor: 'いちご味', bg: '#fce7f3', band: '#db2777', chip: '#f472b6' },
  ];

  // Reuse 5 snack bag materials & 6 candy box materials (saves 11 textures & shader switches)
  const snackMaterials = snackConfigs.map((cfg) => {
    const tex = createSnackBagTexture(
      cfg.title,
      cfg.flavor,
      cfg.bg,
      cfg.band,
      cfg.chip,
      maxAnisotropy,
    );
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.36,
      metalness: 0.05,
    });
  });

  // Sculpted 3D pillow-pouch snack bag geometry (bulges smoothly in Z instead of flat box)
  const pouchGeo = new THREE.BoxGeometry(0.60, 0.78, 0.22, 6, 8, 2);
  const pPos = pouchGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    const px = pPos.getX(i);
    const py = pPos.getY(i);
    const pz = pPos.getZ(i);
    const nx = px / 0.30;
    const ny = py / 0.39;
    const pinch = Math.max(0.18, 1 - ny * ny * 0.85) * Math.max(0.45, 1 - nx * nx * 0.45);
    pPos.setZ(i, pz * (0.35 + pinch * 1.15));
  }
  pouchGeo.computeVertexNormals();

  [1.97, 1.01].forEach((rowY, rowIdx) => {
    for (let col = 0; col < 5; col++) {
      const mat = snackMaterials[(col + rowIdx * 2) % snackMaterials.length];
      const bag = new THREE.Mesh(pouchGeo, mat);
      bag.position.set(
        -1.45 + col * 0.72,
        rowY,
        -1.66 - (col % 2) * 0.06,
      );
      bag.rotation.x = -0.09;
      bag.rotation.y = ((col % 2) - 0.5) * 0.14;
      bag.castShadow = !isSoftwareGl;
      bag.receiveShadow = true;
      group.add(bag);
    }
  });

  const boxConfigs = [
    { title: 'ぷちぷち', bg: '#bae6fd', stripe: '#0284c7' },
    { title: 'ころころ', bg: '#fed7aa', stripe: '#ea580c' },
    { title: 'ほしくず', bg: '#fef08a', stripe: '#ca8a04' },
    { title: 'つぶつぶ', bg: '#bbf7d0', stripe: '#16a34a' },
    { title: 'ももいろ', bg: '#fbcfe8', stripe: '#db2777' },
    { title: 'みどり', bg: '#a7f3d0', stripe: '#059669' },
  ];
  const candyMaterials = boxConfigs.map((cfg) => {
    const tex = createCandyBoxTexture(
      cfg.title,
      cfg.bg,
      cfg.stripe,
      maxAnisotropy,
    );
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.44,
      metalness: 0.04,
    });
  });

  const candyBoxGeo = new THREE.BoxGeometry(0.60, 0.48, 0.28);
  [0.02, -0.68].forEach((rowY, rIdx) => {
    for (let col = 0; col < 6; col++) {
      const mat = candyMaterials[(col + rIdx * 3) % candyMaterials.length];
      const box = new THREE.Mesh(candyBoxGeo, mat);
      box.position.set(
        -1.62 + col * 0.65,
        rowY,
        -1.68 + ((col + rIdx) % 2) * 0.04,
      );
      box.rotation.y = ((col % 3) - 1) * 0.05;
      box.castShadow = !isSoftwareGl;
      box.receiveShadow = true;
      group.add(box);
    }
  });

  // Central Silver Wire Grate ("網")
  const grateMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    metalness: 0.88,
    roughness: 0.24,
  });

  const grateCenterX = 0.28;
  const grateCenterZ = 0.04;
  const grateWidth = 1.56;
  const grateDepth = 1.24;

  const frameXGeo = new THREE.CylinderGeometry(0.016, 0.016, grateWidth, 12);
  frameXGeo.rotateZ(Math.PI / 2);
  const frontEdge = new THREE.Mesh(frameXGeo, grateMat);
  frontEdge.position.set(grateCenterX, grateTopY, grateCenterZ + grateDepth / 2);
  const backEdge = new THREE.Mesh(frameXGeo, grateMat);
  backEdge.position.set(grateCenterX, grateTopY, grateCenterZ - grateDepth / 2);
  group.add(frontEdge, backEdge);

  const frameZGeo = new THREE.CylinderGeometry(0.016, 0.016, grateDepth, 12);
  frameZGeo.rotateX(Math.PI / 2);
  const leftEdge = new THREE.Mesh(frameZGeo, grateMat);
  leftEdge.position.set(grateCenterX - grateWidth / 2, grateTopY, grateCenterZ);
  const rightEdge = new THREE.Mesh(frameZGeo, grateMat);
  rightEdge.position.set(grateCenterX + grateWidth / 2, grateTopY, grateCenterZ);
  group.add(leftEdge, rightEdge);

  const xRodGeo = new THREE.CylinderGeometry(0.007, 0.007, grateWidth, 8);
  xRodGeo.rotateZ(Math.PI / 2);
  const xCount = 13;
  const xInst = new THREE.InstancedMesh(xRodGeo, grateMat, xCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < xCount; i++) {
    const z =
      grateCenterZ - grateDepth / 2 + ((i + 0.5) / xCount) * grateDepth;
    dummy.position.set(grateCenterX, grateTopY, z);
    dummy.updateMatrix();
    xInst.setMatrixAt(i, dummy.matrix);
  }
  xInst.instanceMatrix.needsUpdate = true;
  xInst.computeBoundingSphere();
  group.add(xInst);

  const zRodGeo = new THREE.CylinderGeometry(0.007, 0.007, grateDepth, 8);
  zRodGeo.rotateX(Math.PI / 2);
  const zCount = 15;
  const zInst = new THREE.InstancedMesh(zRodGeo, grateMat, zCount);
  for (let i = 0; i < zCount; i++) {
    const x =
      grateCenterX - grateWidth / 2 + ((i + 0.5) / zCount) * grateWidth;
    dummy.position.set(x, grateTopY + 0.004, grateCenterZ);
    dummy.updateMatrix();
    zInst.setMatrixAt(i, dummy.matrix);
  }
  zInst.instanceMatrix.needsUpdate = true;
  zInst.computeBoundingSphere();
  group.add(zInst);

  const legGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.72, 12);
  [
    [-grateWidth * 0.45, -grateDepth * 0.42],
    [grateWidth * 0.45, -grateDepth * 0.42],
    [-grateWidth * 0.45, grateDepth * 0.42],
    [grateWidth * 0.45, grateDepth * 0.42],
  ].forEach(([ox, oz]) => {
    const leg = new THREE.Mesh(legGeo, grateMat);
    leg.position.set(grateCenterX + ox, grateTopY - 0.36, grateCenterZ + oz);
    group.add(leg);
  });

  const shadowTex = createContactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
  });
  const grateShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.7),
    shadowMat,
  );
  grateShadow.rotation.x = -Math.PI / 2;
  grateShadow.position.set(grateCenterX, -1.76, grateCenterZ);
  group.add(grateShadow);

  // Stationary 4-corner chrome pedestal columns resting on the grate that support the always-dynamic '?' hook board
  const legSpanH = Math.max(0.1, hookBaseCenter.y - hookBaseSize.y * 0.5 - grateTopY);
  const baseSupportGeo = new THREE.CylinderGeometry(0.015, 0.015, legSpanH, 10);
  const capPadGeo = new THREE.CylinderGeometry(0.032, 0.022, 0.014, 12);
  [-hookBaseSize.x * 0.36, hookBaseSize.x * 0.36].forEach((ox) => {
    [-hookBaseSize.z * 0.3, hookBaseSize.z * 0.3].forEach((oz) => {
      const leg = new THREE.Mesh(baseSupportGeo, grateMat);
      leg.position.set(
        hookBaseCenter.x + ox,
        grateTopY + legSpanH * 0.5,
        hookBaseCenter.z + oz,
      );
      leg.castShadow = true;
      const capPad = new THREE.Mesh(capPadGeo, grateMat);
      capPad.position.set(
        hookBaseCenter.x + ox,
        grateTopY + legSpanH - 0.007,
        hookBaseCenter.z + oz,
      );
      group.add(leg, capPad);
    });
  });

  // Widened Prize Chute ("獲得口") on the Left Side so the whole '?' hook + red board drops inside cleanly
  const chuteCenter = new THREE.Vector3(-1.18, -1.12, 0.14);
  const chuteWallMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.55,
    metalness: 0.35,
  });
  const chuteRimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.24,
    metalness: 0.48,
    emissive: 0x78350f,
    emissiveIntensity: 0.28,
  });

  // 4-walled hollow chute collar (inner opening 1.24 x 0.94)
  const chuteNorthRim = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.16, 0.06),
    chuteRimMat,
  );
  chuteNorthRim.position.set(chuteCenter.x, -1.04, chuteCenter.z - 0.5);
  const chuteSouthRim = chuteNorthRim.clone();
  chuteSouthRim.position.set(chuteCenter.x, -1.04, chuteCenter.z + 0.5);
  const chuteWestRim = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.16, 1.06),
    chuteRimMat,
  );
  chuteWestRim.position.set(chuteCenter.x - 0.65, -1.04, chuteCenter.z);
  const chuteEastRim = chuteWestRim.clone();
  chuteEastRim.position.set(chuteCenter.x + 0.65, -1.04, chuteCenter.z);

  const chuteFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1.26, 0.08, 0.96),
    chuteWallMat,
  );
  chuteFloor.position.set(chuteCenter.x, -1.72, chuteCenter.z);
  group.add(chuteNorthRim, chuteSouthRim, chuteWestRim, chuteEastRim, chuteFloor);

  // Front glass pane + two iconic dark horizontal glass frame bars (Photo)
  const barMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.75,
    roughness: 0.26,
  });
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.032, 0.045), barMat);
  bar1.position.set(0, -0.24, 1.55);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.032, 0.045), barMat);
  bar2.position.set(0, -0.44, 1.55);
  group.add(bar1, bar2);

  // Single-pass lightweight reflective glass
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.28,
    roughness: 0.05,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
  });
  const frontGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 4.4),
    glassMat,
  );
  frontGlass.position.set(0, 0.4, 1.54);
  frontGlass.renderOrder = 12;
  group.add(frontGlass);

  return {
    group,
    grateTopY,
    hookCradleY,
    hookBaseCenter,
    hookBaseSize,
    chuteCenter,
    zBridgeGroup,
  };
}

export interface BridgeClawRigHandle {
  carriageGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  poleMesh: THREE.Mesh;
  leftArmPivotLocal: THREE.Vector3;
  rightArmPivotLocal: THREE.Vector3;
  updatePole: (trolleyPos: THREE.Vector3, headPos: THREE.Vector3) => void;
}

function buildClearAcrylicArm(
  side: -1 | 1,
  normalMap: THREE.Texture,
  isSoftwareGl: boolean,
): THREE.Group {
  const armGroup = new THREE.Group();

  const clearAcrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    metalness: 0.04,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    ior: 1.49,
    transparent: true,
    opacity: isSoftwareGl ? 0.46 : 0.44,
    depthWrite: false,
  });

  const ribAcrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.08,
    roughness: 0.12,
    clearcoat: 1.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.65 : 0.62,
  });

  const whiteInsertMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.08,
  });

  const stainlessTipMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.96,
    roughness: 0.16,
    anisotropy: 0.72,
    clearcoat: 0.4,
    normalMap,
    normalScale: new THREE.Vector2(0.08, 0.08),
  });

  // Top square mounting block at pivot (0, 0, 0)
  const mountBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.068, 0.052),
    whiteInsertMat,
  );
  mountBlock.castShadow = true;
  armGroup.add(mountBlock);

  // L-shaped molded acrylic arm profile (mirrored by side = -1 | 1)
  // Coordinates from pivot (0,0) -> elbow (+0.27*side, -0.24) -> bottom (-0.13*side, -0.57)
  const s = side;
  const elbowX = 0.27 * s;
  const elbowY = -0.24;
  const botX = -0.12 * s;
  const botY = -0.57;

  const armSpine = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(elbowX, elbowY),
    new THREE.Vector2(botX, botY),
  ];

  // Build clean 2D L-contour with rounded outer elbow & bevels matching images__92__d1c6460f.jpeg
  const armShape = new THREE.Shape();
  const halfW = 0.025;
  const d1 = new THREE.Vector2(elbowX, elbowY).normalize();
  const n1 = new THREE.Vector2(-d1.y, d1.x).multiplyScalar(halfW);
  const d2 = new THREE.Vector2(botX - elbowX, botY - elbowY).normalize();
  const n2 = new THREE.Vector2(-d2.y, d2.x).multiplyScalar(halfW);

  // Compute outer & inner mitered elbow corners
  const outerSign = s;
  const outerN1 = n1.clone().multiplyScalar(outerSign);
  const outerN2 = n2.clone().multiplyScalar(outerSign);
  const innerN1 = outerN1.clone().negate();
  const innerN2 = outerN2.clone().negate();

  const p0Out = armSpine[0].clone().add(outerN1);
  const p1OutA = armSpine[1].clone().add(outerN1);
  const p1OutB = armSpine[1].clone().add(outerN2);
  const p2Out = armSpine[2].clone().add(outerN2);
  const p2In = armSpine[2].clone().add(innerN2);
  const p1InB = armSpine[1].clone().add(innerN2);
  const p1InA = armSpine[1].clone().add(innerN1);
  const p0In = armSpine[0].clone().add(innerN1);

  const elbowOuterMid = p1OutA
    .clone()
    .add(p1OutB)
    .multiplyScalar(0.5)
    .add(outerN1.clone().add(outerN2).multiplyScalar(0.35));
  const elbowInnerMid = p1InA.clone().add(p1InB).multiplyScalar(0.5);

  armShape.moveTo(p0Out.x, p0Out.y);
  armShape.lineTo(p1OutA.x, p1OutA.y);
  armShape.quadraticCurveTo(elbowOuterMid.x, elbowOuterMid.y, p1OutB.x, p1OutB.y);
  armShape.lineTo(p2Out.x, p2Out.y);
  armShape.lineTo(p2In.x, p2In.y);
  armShape.lineTo(p1InB.x, p1InB.y);
  armShape.quadraticCurveTo(elbowInnerMid.x, elbowInnerMid.y, p1InA.x, p1InA.y);
  armShape.lineTo(p0In.x, p0In.y);
  armShape.closePath();

  const armBodyGeo = new THREE.ExtrudeGeometry(armShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 10,
  });
  armBodyGeo.translate(0, 0, -0.015);
  const armBodyMesh = new THREE.Mesh(armBodyGeo, clearAcrylicMat);
  armBodyMesh.renderOrder = 6;
  armGroup.add(armBodyMesh);

  // Subtle molded edge reinforcement rails (visible crisp acrylic edge highlights)
  const seg1Len = Math.hypot(elbowX, elbowY);
  const seg1Angle = Math.atan2(elbowY, elbowX);
  const seg2Len = Math.hypot(botX - elbowX, botY - elbowY);
  const seg2Angle = Math.atan2(botY - elbowY, botX - elbowX);

  const rail1Geo = new THREE.BoxGeometry(seg1Len, 0.008, 0.04);
  const rail2Geo = new THREE.BoxGeometry(seg2Len, 0.008, 0.04);
  [-0.022, 0.022].forEach((offset) => {
    const r1 = new THREE.Mesh(rail1Geo, ribAcrylicMat);
    r1.position.set(
      elbowX * 0.5 - Math.sin(seg1Angle) * offset,
      elbowY * 0.5 + Math.cos(seg1Angle) * offset,
      0,
    );
    r1.rotation.z = seg1Angle;

    const r2 = new THREE.Mesh(rail2Geo, ribAcrylicMat);
    r2.position.set(
      (elbowX + botX) * 0.5 - Math.sin(seg2Angle) * offset,
      (elbowY + botY) * 0.5 + Math.cos(seg2Angle) * offset,
      0,
    );
    r2.rotation.z = seg2Angle;
    armGroup.add(r1, r2);
  });

  // White inner plastic tip bracket & two stainless mounting pins (images__92__d1c6460f.jpeg)
  const insertGeo = new THREE.BoxGeometry(0.11, 0.028, 0.024);
  const insertMesh = new THREE.Mesh(insertGeo, whiteInsertMat);
  insertMesh.position.set(
    botX - Math.cos(seg2Angle) * 0.045,
    botY - Math.sin(seg2Angle) * 0.045,
    0,
  );
  insertMesh.rotation.z = seg2Angle;
  armGroup.add(insertMesh);

  const pinGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.044, 10);
  pinGeo.rotateX(Math.PI / 2);
  [0.025, 0.07].forEach((distBack) => {
    const pin = new THREE.Mesh(pinGeo, stainlessTipMat);
    pin.position.set(
      botX - Math.cos(seg2Angle) * distBack,
      botY - Math.sin(seg2Angle) * distBack,
      0,
    );
    armGroup.add(pin);
  });

  // Angled stainless steel flat paddle claw tip ('爪') extending inward
  const tipGeo = new THREE.BoxGeometry(0.095, 0.007, 0.044);
  const tipMesh = new THREE.Mesh(tipGeo, stainlessTipMat);
  tipMesh.position.set(botX - 0.042 * s, botY - 0.015, 0);
  tipMesh.rotation.z = 0.28 * s;
  tipMesh.castShadow = true;
  armGroup.add(tipMesh);

  return armGroup;
}

export function buildBridgeClawRig(
  normalMap: THREE.Texture,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): BridgeClawRigHandle {
  const carriageGroup = new THREE.Group();
  const headGroup = new THREE.Group();

  const whiteHousingMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.06,
    clearcoat: 0.65,
    clearcoatRoughness: 0.14,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.94,
    roughness: 0.16,
    anisotropy: 0.6,
    normalMap,
    normalScale: new THREE.Vector2(0.07, 0.07),
  });

  const blackAnodizedMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.35,
    metalness: 0.78,
  });

  const pinkAccentMat = new THREE.MeshStandardMaterial({
    color: 0xec4899,
    roughness: 0.28,
    metalness: 0.12,
  });

  const clearDomeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.06,
    clearcoat: 1.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.34 : 0.3,
    depthWrite: false,
  });

  // 1. Gantry carriage slider on top rail
  const sliderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.14, 0.34),
    whiteHousingMat,
  );
  sliderMesh.castShadow = true;
  const collarMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.056, 0.18, 16),
    blackAnodizedMat,
  );
  collarMesh.position.set(0, -0.1, 0);
  carriageGroup.add(sliderMesh, collarMesh);

  // 2. Telescoping vertical chrome shaft (updated dynamically between carriage & head)
  const poleGeo = new THREE.CylinderGeometry(0.038, 0.038, 1.0, 16);
  const poleMesh = new THREE.Mesh(poleGeo, chromeMat);
  poleMesh.castShadow = true;

  // 3. UFO Catcher Pill/Capsule Head Housing (matching Screenshot_20261126_173130 & m57785504782_8)
  const hw = 0.31;
  const hh = 0.15;
  const hr = 0.12;
  const headShape = new THREE.Shape();
  headShape.moveTo(-hw + hr, -hh);
  headShape.lineTo(hw - hr, -hh);
  headShape.quadraticCurveTo(hw, -hh, hw, -hh + hr);
  headShape.lineTo(hw, hh - hr);
  headShape.quadraticCurveTo(hw, hh, hw - hr, hh);
  headShape.lineTo(-hw + hr, hh);
  headShape.quadraticCurveTo(-hw, hh, -hw, hh - hr);
  headShape.lineTo(-hw, -hh + hr);
  headShape.quadraticCurveTo(-hw, -hh, -hw + hr, -hh);

  const headBodyGeo = new THREE.ExtrudeGeometry(headShape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.038,
    bevelSize: 0.032,
    bevelSegments: 4,
    curveSegments: 16,
  });
  headBodyGeo.center();
  const headBodyMesh = new THREE.Mesh(headBodyGeo, whiteHousingMat);
  headBodyMesh.castShadow = true;
  headBodyMesh.receiveShadow = true;
  headGroup.add(headBodyMesh);

  // Front printed UFO Catcher panel
  const faceTex = createUfoCatcherFaceTexture(maxAnisotropy);
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    roughness: 0.26,
    metalness: 0.05,
  });
  const faceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.21),
    faceMat,
  );
  faceMesh.position.set(0, 0, 0.179);
  headGroup.add(faceMesh);

  const backFaceMesh = faceMesh.clone();
  backFaceMesh.rotation.y = Math.PI;
  backFaceMesh.position.set(0, 0, -0.179);
  headGroup.add(backFaceMesh);

  // Four subtle magenta corner ticks on front face (m57785504782_8)
  const tickGeo = new THREE.BoxGeometry(0.036, 0.008, 0.008);
  [
    [-0.22, 0.11, 0.72],
    [0.22, 0.11, -0.72],
    [-0.22, -0.11, -0.72],
    [0.22, -0.11, 0.72],
  ].forEach(([tx, ty, rot]) => {
    const tick = new THREE.Mesh(tickGeo, pinkAccentMat);
    tick.position.set(tx, ty, 0.181);
    tick.rotation.z = rot;
    headGroup.add(tick);
  });

  // Outer clear protective acrylic shell + top crest shield
  const domeGeo = new THREE.ExtrudeGeometry(headShape, {
    depth: 0.32,
    bevelEnabled: true,
    bevelThickness: 0.044,
    bevelSize: 0.044,
    bevelSegments: 4,
    curveSegments: 16,
  });
  domeGeo.center();
  const domeMesh = new THREE.Mesh(domeGeo, clearDomeMat);
  domeMesh.renderOrder = 7;
  headGroup.add(domeMesh);

  const topFinMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.075, 0.018),
    clearDomeMat,
  );
  topFinMesh.position.set(0, 0.21, 0.02);
  topFinMesh.renderOrder = 7;
  headGroup.add(topFinMesh);

  // Top shaft socket on UFO head
  const headCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.056, 0.06, 16),
    blackAnodizedMat,
  );
  headCollar.position.set(0, 0.19, 0);
  headGroup.add(headCollar);

  // Bottom LED illumination bar
  const ledUnderBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.014, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  ledUnderBar.position.set(0, -0.182, 0.05);
  headGroup.add(ledUnderBar);

  // 4. Left & Right Transparent Acrylic L-Arms
  const leftArmPivotLocal = new THREE.Vector3(-0.22, -0.13, 0);
  const rightArmPivotLocal = new THREE.Vector3(0.22, -0.13, 0);

  const leftArmGroup = buildClearAcrylicArm(-1, normalMap, isSoftwareGl);
  const rightArmGroup = buildClearAcrylicArm(1, normalMap, isSoftwareGl);

  return {
    carriageGroup,
    headGroup,
    leftArmGroup,
    rightArmGroup,
    poleMesh,
    leftArmPivotLocal,
    rightArmPivotLocal,
    updatePole: (trolleyPos: THREE.Vector3, headPos: THREE.Vector3) => {
      const topY = trolleyPos.y - 0.12;
      const botY = headPos.y + 0.18;
      const span = Math.max(0.08, topY - botY);
      poleMesh.position.set(
        THREE.MathUtils.lerp(trolleyPos.x, headPos.x, 0.5),
        (topY + botY) * 0.5,
        THREE.MathUtils.lerp(trolleyPos.z, headPos.z, 0.5),
      );
      poleMesh.scale.set(1, span, 1);
    },
  };
}

export interface BridgePrizeBoxHandle {
  group: THREE.Group;
}

export function buildBridgePrizeBox(
  prizeConfig: PrizeBoxConfig,
  maxAnisotropy: number,
): BridgePrizeBoxHandle {
  const group = new THREE.Group();

  const boxTex = createFigureBoxTexture(
    prizeConfig.label,
    prizeConfig.subLabel,
    maxAnisotropy,
  );

  // Cellophane-wrapped collector figure box matching article2_top_94084bdb.png
  const boxMat = new THREE.MeshPhysicalMaterial({
    map: boxTex,
    roughness: 0.24,
    metalness: 0.06,
    clearcoat: 0.72,
    clearcoatRoughness: 0.12,
  });

  const boxGeo = new THREE.BoxGeometry(
    prizeConfig.width,
    prizeConfig.height,
    prizeConfig.depth,
  );
  const boxMesh = new THREE.Mesh(boxGeo, boxMat);
  boxMesh.castShadow = true;
  boxMesh.receiveShadow = true;
  group.add(boxMesh);

  // Subtle cellophane seam tape strips along side edges
  const tapeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.12,
    transparent: true,
    opacity: 0.22,
  });
  const topStrip = new THREE.Mesh(
    new THREE.BoxGeometry(prizeConfig.width * 1.004, 0.012, 0.045),
    tapeMat,
  );
  topStrip.position.set(0, prizeConfig.height * 0.5, 0);
  group.add(topStrip);

  return { group };
}

export interface BridgeRodSpec {
  z: number;
  y: number;
  radius: number;
  halfLength: number;
}

export interface BridgeEnvironmentHandle {
  group: THREE.Group;
  zBridgeGroup: THREE.Group;
  rodSpecs: BridgeRodSpec[];
  pitDropY: number;
  pitBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function buildBridgeEnvironment(
  isSoftwareGl: boolean,
  maxAnisotropy: number,
): BridgeEnvironmentHandle {
  const group = new THREE.Group();

  // Patterned bright arcade backdrop wall (matching Screenshot_20261126_173130_X_8d8a0f0f.jpg)
  const wallTex = createArcadeWallPatternTexture(maxAnisotropy);
  const backWallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.65,
    metalness: 0.04,
  });
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 6.2),
    backWallMat,
  );
  backWall.position.set(0, 0.5, -2.15);
  backWall.receiveShadow = true;
  group.add(backWall);

  // White cabinet floor
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.36,
    metalness: 0.08,
  });
  const pitWallMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.45,
    metalness: 0.08,
  });

  const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 4.5),
    pitWallMat,
  );
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.set(0, -1.78, -0.2);
  floorPlane.receiveShadow = true;
  group.add(floorPlane);

  // Corner cabinet pillars
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.65,
    roughness: 0.32,
  });
  const pillarGeo = new THREE.BoxGeometry(0.16, 5.4, 0.18);
  [
    [-2.18, 1.48],
    [2.18, 1.48],
    [-2.18, -1.52],
    [2.18, -1.52],
  ].forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(pillarGeo, frameMat);
    pillar.position.set(px, 0.5, pz);
    group.add(pillar);
  });

  // Overhead 3D Dual-Axis Gantry
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.24,
  });
  const frontXTrack = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 0.07, 0.08),
    railMat,
  );
  frontXTrack.position.set(0, 2.52, 1.08);
  const backXTrack = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 0.07, 0.08),
    railMat,
  );
  backXTrack.position.set(0, 2.52, -1.08);
  group.add(frontXTrack, backXTrack);

  const zBridgeGroup = new THREE.Group();
  zBridgeGroup.position.set(0, 2.5, 0);
  const zBridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.08, 2.24),
    railMat,
  );
  zBridgeBeam.castShadow = true;
  const endTruckGeo = new THREE.BoxGeometry(0.24, 0.12, 0.16);
  const endTruckFront = new THREE.Mesh(endTruckGeo, railMat);
  endTruckFront.position.set(0, 0.02, 1.08);
  const endTruckBack = new THREE.Mesh(endTruckGeo, railMat);
  endTruckBack.position.set(0, 0.02, -1.08);
  zBridgeGroup.add(zBridgeBeam, endTruckFront, endTruckBack);
  group.add(zBridgeGroup);

  // LED ceiling strips
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const led1 = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 0.24), ledMat);
  led1.position.set(0, 2.72, -0.55);
  const led2 = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.05, 0.12), ledMat);
  led2.position.set(0, 2.72, 1.25);
  group.add(led1, led2);

  // Background Display Shelf & Stacked Prize Boxes (matching article2_top_94084bdb.png)
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.055, 0.62),
    whiteMat,
  );
  shelf.position.set(0, -0.78, -1.68);
  shelf.receiveShadow = true;
  group.add(shelf);

  const dispTex = createFigureBoxTexture(
    '限定フィギュア',
    'DISPLAY',
    maxAnisotropy,
  );
  const dispMat = new THREE.MeshStandardMaterial({
    map: dispTex,
    roughness: 0.34,
    metalness: 0.06,
  });
  const dispBoxGeo = new THREE.BoxGeometry(0.56, 0.64, 0.34);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      const box = new THREE.Mesh(dispBoxGeo, dispMat);
      box.position.set(-1.35 + col * 0.67, -0.42 + row * 0.68, -1.72);
      box.castShadow = !isSoftwareGl;
      box.receiveShadow = true;
      group.add(box);
    }
  }

  // Central White Drop Pit Walls & Apron Decks around the 4-Rod Bridge Opening
  const pitBounds = {
    minX: -1.06,
    maxX: 1.06,
    minZ: -0.82,
    maxZ: 0.82,
  };
  const pitDropY = -0.92;

  // Surrounding upper deck aprons (left, right, back, front) forming the central pit
  const leftApron = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.96, 2.7),
    whiteMat,
  );
  leftApron.position.set(-1.635, -1.3, -0.1);
  leftApron.receiveShadow = true;
  const rightApron = leftApron.clone();
  rightApron.position.set(1.635, -1.3, -0.1);

  const backApron = new THREE.Mesh(
    new THREE.BoxGeometry(2.14, 0.96, 0.72),
    whiteMat,
  );
  backApron.position.set(0, -1.3, -1.18);
  backApron.receiveShadow = true;
  const frontApron = new THREE.Mesh(
    new THREE.BoxGeometry(2.14, 0.96, 0.65),
    whiteMat,
  );
  frontApron.position.set(0, -1.3, 1.145);
  frontApron.receiveShadow = true;

  group.add(leftApron, rightApron, backApron, frontApron);

  // Two dark rubber pit wall bumpers inside the drop pit (matching photos!)
  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.1,
  });
  const bumperGeo = new THREE.BoxGeometry(0.12, 0.1, 0.08);
  [-0.56, 0.56].forEach((bx) => {
    const b = new THREE.Mesh(bumperGeo, bumperMat);
    b.position.set(bx, -1.42, -0.8);
    group.add(b);
  });

  // Left & Right White Tension Rod Clamp Rails (at x = ±1.04)
  const clampBarGeo = new THREE.BoxGeometry(0.08, 0.1, 1.32);
  [-1.04, 1.04].forEach((rx) => {
    const bar = new THREE.Mesh(clampBarGeo, whiteMat);
    bar.position.set(rx, -0.71, 0);
    bar.castShadow = true;
    bar.receiveShadow = true;
    group.add(bar);
  });

  // 4 Horizontal Tension Rods ('突っ張り棒') with Silicone Anti-Slip Sleeves
  const rodRadius = 0.022;
  const rodHalfLen = 1.04;
  const rodSpecs: BridgeRodSpec[] = [
    { z: 0.52, y: -0.68, radius: rodRadius, halfLength: rodHalfLen },
    { z: 0.2, y: -0.72, radius: rodRadius, halfLength: rodHalfLen },
    { z: -0.2, y: -0.72, radius: rodRadius, halfLength: rodHalfLen },
    { z: -0.52, y: -0.68, radius: rodRadius, halfLength: rodHalfLen },
  ];

  const steelRodMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.94,
    roughness: 0.16,
  });
  const sleeveMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5d0fe,
    roughness: 0.34,
    metalness: 0.06,
    clearcoat: 0.5,
  });
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.1,
  });
  const oRingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
  });

  const rodCoreGeo = new THREE.CylinderGeometry(
    rodRadius * 0.78,
    rodRadius * 0.78,
    rodHalfLen * 2,
    16,
  );
  rodCoreGeo.rotateZ(Math.PI / 2);

  const sleeveGeo = new THREE.CylinderGeometry(
    rodRadius,
    rodRadius,
    rodHalfLen * 1.72,
    18,
  );
  sleeveGeo.rotateZ(Math.PI / 2);

  const endBracketGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.08, 14);
  endBracketGeo.rotateZ(Math.PI / 2);

  const oRingGeo = new THREE.TorusGeometry(rodRadius * 1.02, 0.006, 8, 16);
  oRingGeo.rotateY(Math.PI / 2);

  rodSpecs.forEach((spec) => {
    const core = new THREE.Mesh(rodCoreGeo, steelRodMat);
    core.position.set(0, spec.y, spec.z);
    core.castShadow = true;

    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeve.position.set(0, spec.y, spec.z);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;

    const leftCap = new THREE.Mesh(endBracketGeo, collarMat);
    leftCap.position.set(-rodHalfLen, spec.y, spec.z);
    const rightCap = new THREE.Mesh(endBracketGeo, collarMat);
    rightCap.position.set(rodHalfLen, spec.y, spec.z);

    const ringL = new THREE.Mesh(oRingGeo, oRingMat);
    ringL.position.set(-0.66, spec.y, spec.z);
    const ringR = new THREE.Mesh(oRingGeo, oRingMat);
    ringR.position.set(0.66, spec.y, spec.z);

    group.add(core, sleeve, leftCap, rightCap, ringL, ringR);
  });

  // Subtle LED front edge strip & green stage '3' marker (article2_top_94084bdb.png)
  const frontLed = new THREE.Mesh(
    new THREE.BoxGeometry(2.14, 0.035, 0.04),
    ledMat,
  );
  frontLed.position.set(0, -0.82, 0.83);
  group.add(frontLed);

  // Front cabinet glass pane
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.28,
    roughness: 0.05,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
  });
  const frontGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 4.4),
    glassMat,
  );
  frontGlass.position.set(0, 0.4, 1.54);
  frontGlass.renderOrder = 12;
  group.add(frontGlass);

  return {
    group,
    zBridgeGroup,
    rodSpecs,
    pitDropY,
    pitBounds,
  };
}
