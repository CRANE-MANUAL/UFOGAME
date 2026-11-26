import * as THREE from 'three';

export function createSnackBagTexture(
  title: string,
  flavor: string,
  bgColor: string,
  bandColor: string,
  chipColor: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 128, 160);

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, 128, 9);
  ctx.fillRect(0, 151, 128, 9);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(12, 17, 104, 46, 8);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 18px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 64, 39);

  ctx.fillStyle = bandColor;
  ctx.beginPath();
  ctx.roundRect(23, 69, 82, 17, 4);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px "Noto Sans JP", sans-serif';
  ctx.fillText(flavor, 64, 77);

  for (let i = 0; i < 8; i++) {
    const cx = 18 + ((i * 23) % 92);
    const cy = 105 + ((i * 17) % 36);
    ctx.fillStyle = chipColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 7 + (i % 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 4);
  return tex;
}

export function createCandyBoxTexture(
  title: string,
  bgColor: string,
  stripeColor: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 128, 96);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7, 7, 114, 57);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 15px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 64, 35);

  ctx.fillStyle = stripeColor;
  ctx.fillRect(0, 71, 128, 25);

  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(16 + i * 24, 83, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 4);
  return tex;
}

export function createPrizeBoxTexture(
  label: string,
  subLabel: string,
  primaryColor: string,
  accentColor: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.lineTo(256, 0);
  ctx.lineTo(256, 48);
  ctx.lineTo(0, 108);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(28, 55, 200, 110, 14);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 36px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 97);

  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.roundRect(63, 126, 130, 23, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Noto Sans JP", sans-serif';
  ctx.fillText(subLabel, 128, 137);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px "Outfit", sans-serif';
  ctx.fillText('PRIZE EDITION', 128, 210);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 4);
  return tex;
}

export function createBrushedMetalNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 2) {
    const shade = 118 + Math.floor(Math.random() * 20);
    ctx.fillStyle = `rgb(${shade}, 128, 255)`;
    ctx.fillRect(0, y, 128, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.16)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRedTapeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 256, 128);

  // Subtle cloth duct-tape weave ribs
  for (let y = 0; y < 128; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(127,29,29,0.075)';
    ctx.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect(x, 0, 1, 128);
  }

  // Vertical overlap tape seams matching physical board wrap
  [36, 98, 158, 220].forEach((sx) => {
    ctx.fillStyle = 'rgba(127,29,29,0.22)';
    ctx.fillRect(sx, 0, 3, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(sx + 3, 0, 2, 128);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createUfoCatcherFaceTexture(
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 128);

  // Subtle top/bottom rainbow stripes inspired by UFO Catcher housing
  const bands = ['#facc15', '#22c55e', '#0f172a', '#ec4899'];
  bands.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(18, 22 + i * 18, 220, 14);
  });

  // White inner pill badge with 3 signature colored dots (red, yellow, blue)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(42, 30, 172, 68, 20);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  const dots = [
    { x: 86, c: '#e11d48' },
    { x: 128, c: '#facc15' },
    { x: 170, c: '#0284c7' },
  ];
  dots.forEach((d) => {
    ctx.fillStyle = d.c;
    ctx.beginPath();
    ctx.arc(d.x, 56, 11, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#334155';
  ctx.font = '800 13px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('UFO CATCHER', 128, 82);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 4);
  return tex;
}

export function createFigureBoxTexture(
  label: string,
  subLabel: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Glossy dark charcoal & steel collector figure packaging (matches article2_top_94084bdb.png)
  const bg = ctx.createLinearGradient(0, 0, 256, 256);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(0.55, '#1e293b');
  bg.addColorStop(1, '#090d16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle geometric silhouette highlight
  ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.beginPath();
  ctx.moveTo(130, 28);
  ctx.lineTo(232, 28);
  ctx.lineTo(232, 200);
  ctx.lineTo(95, 200);
  ctx.closePath();
  ctx.fill();

  // Bold white title block on left/top
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 26px "Outfit", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('KING OF', 18, 42);
  ctx.fillText('FIGURE', 18, 72);

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(18, 92, 118, 4);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px "Noto Sans JP", sans-serif';
  ctx.fillText(label, 18, 118);

  // Sky-blue brand square badge on right
  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.roundRect(186, 132, 52, 34, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 12px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PRIZE', 212, 149);

  // White & yellow caution/spec label panel at bottom (like photo)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(18, 174, 220, 62, 6);
  ctx.fill();

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(26, 182, 204, 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px "Noto Sans JP", sans-serif';
  ctx.fillText(subLabel, 128, 189);

  ctx.fillStyle = '#facc15';
  ctx.fillRect(26, 202, 204, 24);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px "Noto Sans JP", sans-serif';
  ctx.fillText('橋渡し専用・落下獲得タイプ', 128, 214);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 4);
  return tex;
}

export function createArcadeWallPatternTexture(
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(-Math.PI / 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let y = -180; y <= 180; y += 64) {
    for (let x = -180; x <= 180; x += 140) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
      ctx.font = '900 18px "Outfit", sans-serif';
      ctx.fillText('ENJOY!', x, y);
      ctx.fillStyle = 'rgba(225, 29, 72, 0.16)';
      ctx.font = 'bold 13px "Outfit", sans-serif';
      ctx.fillText('CRANE GAME', x + 42, y + 26);
    }
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = Math.min(maxAnisotropy, 4);
  return tex;
}
