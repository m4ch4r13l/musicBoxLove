import * as THREE from 'three';
import type { SceneEnvironment } from '../types/turntable';
import { buildStudioEnvironment } from './studioEnvironment';

export interface EnvironmentStyle {
  fogColor: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyColor: number;
  keyIntensity: number;
  rimColor: number;
  rimIntensity: number;
  exposure: number;
  particleColorA: number;
  particleColorB: number;
}

const ENV_STYLES: Record<
  SceneEnvironment,
  EnvironmentStyle & {
    skyTop: number;
    skyHorizon: number;
    skyBottom: number;
    skyGlow: number;
    sunDir: [number, number, number];
    nebulaMode: number;
  }
> = {
  valley: {
    skyTop: 0x24476b,
    skyHorizon: 0xdfb182,
    skyBottom: 0x2d4421,
    skyGlow: 0xffd28e,
    sunDir: [-0.42, 0.2, -0.88],
    nebulaMode: 0,
    fogColor: 0x9aa589,
    fogDensity: 0.0075,
    hemiSky: 0xd9ecff,
    hemiGround: 0x45632a,
    hemiIntensity: 1.05,
    keyColor: 0xffe4bd,
    keyIntensity: 70,
    rimColor: 0xf5b672,
    rimIntensity: 14,
    exposure: 1.06,
    particleColorA: 0xffe8a3,
    particleColorB: 0xd9f59d,
  },
  forest: {
    skyTop: 0x10221d,
    skyHorizon: 0x526b58,
    skyBottom: 0x131d15,
    skyGlow: 0xe3a468,
    sunDir: [0.48, 0.26, -0.84],
    nebulaMode: 0,
    fogColor: 0x213328,
    fogDensity: 0.013,
    hemiSky: 0xa4cfb8,
    hemiGround: 0x24361e,
    hemiIntensity: 0.9,
    keyColor: 0xffd7a8,
    keyIntensity: 66,
    rimColor: 0x7bc28e,
    rimIntensity: 14,
    exposure: 1.06,
    particleColorA: 0xdaf794,
    particleColorB: 0xffd082,
  },
  ocean: {
    skyTop: 0x16294a,
    skyHorizon: 0xe5966a,
    skyBottom: 0x112236,
    skyGlow: 0xffbe7a,
    sunDir: [0.0, 0.13, -1.0],
    nebulaMode: 0,
    fogColor: 0x544b5b,
    fogDensity: 0.0068,
    hemiSky: 0xc4dcfa,
    hemiGround: 0x38323e,
    hemiIntensity: 0.98,
    keyColor: 0xffd1a6,
    keyIntensity: 68,
    rimColor: 0xff925c,
    rimIntensity: 16,
    exposure: 1.06,
    particleColorA: 0xffe6ba,
    particleColorB: 0x9ae2ff,
  },
  space: {
    skyTop: 0x04050f,
    skyHorizon: 0x181130,
    skyBottom: 0x04050f,
    skyGlow: 0x6f4cb8,
    sunDir: [-0.55, 0.35, -0.75],
    nebulaMode: 1,
    fogColor: 0x070612,
    fogDensity: 0.004,
    hemiSky: 0x9fb8ff,
    hemiGround: 0x261b3a,
    hemiIntensity: 0.84,
    keyColor: 0xffe6cc,
    keyIntensity: 66,
    rimColor: 0x7b8cff,
    rimIntensity: 18,
    exposure: 1.12,
    particleColorA: 0xaad9ff,
    particleColorB: 0xffd2a3,
  },
  studio: {
    skyTop: 0x0e0a09,
    skyHorizon: 0x1a1310,
    skyBottom: 0x0c0908,
    skyGlow: 0x2d1e15,
    sunDir: [0.45, 0.55, 0.55],
    nebulaMode: 0,
    fogColor: 0x181210,
    fogDensity: 0.0028,
    hemiSky: 0xdce4f5,
    hemiGround: 0x543826,
    hemiIntensity: 0.92,
    keyColor: 0xffdfb8,
    keyIntensity: 68,
    rimColor: 0xf29c64,
    rimIntensity: 18,
    exposure: 1.12,
    particleColorA: 0xffc78a,
    particleColorB: 0xffebd1,
  },
};

function valueNoise2D(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const hash = (ix: number, iy: number) => {
    const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2D(x: number, y: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

function createTerrainTextures(
  maxAnisotropy: number,
  isForest: boolean
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  if (ctx && bCtx) {
    const img = ctx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);
    const d = img.data;
    const bd = bImg.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Tileable multi-frequency organic noise
        const nx = x / size;
        const ny = y / size;
        const n = fbm2D(nx * 10, ny * 10, 4);
        const fine = valueNoise2D(nx * 64, ny * 64);
        const idx = (y * size + x) * 4;

        if (isForest) {
          // Moss, pine needles & rich loamy soil
          const moss = Math.max(0, Math.min(1, n * 1.15));
          d[idx] = Math.round(28 + moss * 34 + fine * 12);
          d[idx + 1] = Math.round(42 + moss * 48 + fine * 14);
          d[idx + 2] = Math.round(22 + moss * 22 + fine * 8);
        } else {
          // Lush meadow grass + clover + subtle warm earth
          const lush = Math.max(0, Math.min(1, n * 1.2));
          d[idx] = Math.round(48 + lush * 48 + fine * 14);
          d[idx + 1] = Math.round(78 + lush * 64 + fine * 18);
          d[idx + 2] = Math.round(28 + lush * 24 + fine * 8);
        }
        d[idx + 3] = 255;

        const bumpVal = Math.round((n * 0.6 + fine * 0.4) * 255);
        bd[idx] = bumpVal;
        bd[idx + 1] = bumpVal;
        bd[idx + 2] = bumpVal;
        bd[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // Fine organic grass / pine-needle strokes on top
    for (let i = 0; i < 4200; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      ctx.strokeStyle = isForest
        ? i % 3 === 0
          ? 'rgba(110, 78, 46, 0.35)'
          : 'rgba(42, 74, 34, 0.42)'
        : i % 2 === 0
          ? 'rgba(134, 178, 66, 0.32)'
          : 'rgba(38, 68, 22, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (Math.random() - 0.5) * 6, py + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(16, 16);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(16, 16);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createGrassTuftGeometry(): THREE.BufferGeometry {
  // 3-blade crossed tuft so grass looks full from every angle including top-down
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const bladeCount = 3;
  const segs = 3;
  const bladeH = 0.44;
  const baseW = 0.055;

  let vertOffset = 0;
  for (let b = 0; b < bladeCount; b++) {
    const yaw = (b / bladeCount) * Math.PI * 2 + (b - 1) * 0.22;
    const tilt = 0.16 + b * 0.05;
    const ox = Math.cos(yaw) * 0.035;
    const oz = Math.sin(yaw) * 0.035;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = baseW * (1 - t * 0.92);
      const y = t * bladeH;
      const curve = t * t * tilt;

      const lx = -w * 0.5;
      const rx = w * 0.5;
      const zCurve = curve;

      // Rotate blade around Y
      const pxL = ox + lx * cosY - zCurve * sinY;
      const pzL = oz + lx * sinY + zCurve * cosY;
      const pxR = ox + rx * cosY - zCurve * sinY;
      const pzR = oz + rx * sinY + zCurve * cosY;

      positions.push(pxL, y, pzL, pxR, y, pzR);
      uvs.push(0, t, 1, t);
      normals.push(-sinY, 0.4, cosY, -sinY, 0.4, cosY);
    }

    for (let s = 0; s < segs; s++) {
      const a = vertOffset + s * 2;
      const b0 = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b0, c, b0, d, c);
    }
    vertOffset += (segs + 1) * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function createBarkTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const bump = document.createElement('canvas');
  bump.width = 256;
  bump.height = 512;
  const bCtx = bump.getContext('2d');

  if (ctx && bCtx) {
    ctx.fillStyle = '#3b281c';
    ctx.fillRect(0, 0, 256, 512);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 256, 512);

    for (let i = 0; i < 380; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 512;
      const len = 24 + Math.random() * 75;
      const dark = i % 3 !== 0;
      ctx.strokeStyle = dark ? 'rgba(22, 13, 8, 0.55)' : 'rgba(92, 66, 48, 0.35)';
      ctx.lineWidth = 1.5 + Math.random() * 3.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 6, y + len);
      ctx.stroke();

      bCtx.strokeStyle = dark ? 'rgba(30, 30, 30, 0.65)' : 'rgba(215, 215, 215, 0.45)';
      bCtx.lineWidth = 2 + Math.random() * 3;
      bCtx.beginPath();
      bCtx.moveTo(x, y);
      bCtx.lineTo(x + (Math.random() - 0.5) * 6, y + len);
      bCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createTreeRingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#735035';
    ctx.fillRect(0, 0, 512, 512);
    for (let r = 8; r < 250; r += 5 + Math.random() * 4) {
      ctx.strokeStyle = r % 2 === 0 ? 'rgba(48, 28, 14, 0.35)' : 'rgba(155, 115, 78, 0.22)';
      ctx.lineWidth = 1.5 + Math.random() * 1.6;
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPineFoliageTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);

    // Draw radial feathery pine branches around circumference (u=angle, v=top->rim)
    const branches = 26;
    for (let b = 0; b < branches; b++) {
      const bx = (b / branches) * size;
      const bw = 22 + Math.random() * 12;
      // Central woody shoot
      ctx.strokeStyle = '#362719';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, 18);
      ctx.lineTo(bx + (Math.random() - 0.5) * 14, size - 16);
      ctx.stroke();

      // Hundreds of dense pine needles fanning out
      for (let y = 24; y < size - 14; y += 3.5) {
        const spread = (y / size) * bw + 8;
        for (let side = -1; side <= 1; side += 2) {
          const tipX = bx + side * (spread * (0.65 + Math.random() * 0.45));
          const tipY = y + 8 + Math.random() * 14;
          const greenVar = Math.floor(Math.random() * 28);
          ctx.strokeStyle =
            y > size * 0.72
              ? `rgb(${32 + greenVar}, ${76 + greenVar}, ${44 + Math.floor(greenVar * 0.6)})`
              : `rgb(${20 + greenVar}, ${54 + greenVar}, ${32 + Math.floor(greenVar * 0.5)})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(bx, y);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPierWoodTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const bump = document.createElement('canvas');
  bump.width = 512;
  bump.height = 512;
  const bCtx = bump.getContext('2d');

  if (ctx && bCtx) {
    ctx.fillStyle = '#57402f';
    ctx.fillRect(0, 0, 512, 512);
    bCtx.fillStyle = '#909090';
    bCtx.fillRect(0, 0, 512, 512);

    const plankCount = 10;
    const plankH = 512 / plankCount;
    for (let p = 0; p < plankCount; p++) {
      const y0 = p * plankH;
      const shade = (p % 3) * 8 - 8;
      ctx.fillStyle = `rgb(${94 + shade}, ${70 + shade}, ${52 + shade})`;
      ctx.fillRect(0, y0 + 2, 512, plankH - 4);
      ctx.fillStyle = '#1b120c';
      ctx.fillRect(0, y0, 512, 3);

      bCtx.fillStyle = '#202020';
      bCtx.fillRect(0, y0, 512, 3);

      for (let g = 0; g < 45; g++) {
        ctx.strokeStyle = g % 2 === 0 ? 'rgba(28,18,10,0.24)' : 'rgba(155,126,98,0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const gy = y0 + 4 + Math.random() * (plankH - 8);
        ctx.moveTo(0, gy);
        ctx.lineTo(512, gy + (Math.random() - 0.5) * 4);
        ctx.stroke();

        bCtx.strokeStyle = g % 2 === 0 ? 'rgba(70,70,70,0.35)' : 'rgba(180,180,180,0.22)';
        bCtx.beginPath();
        bCtx.moveTo(0, gy);
        bCtx.lineTo(512, gy);
        bCtx.stroke();
      }

      // Subtle weathered nail heads on plank ends
      [26, 256, 486].forEach((nx) => {
        ctx.fillStyle = '#2c2521';
        ctx.beginPath();
        ctx.arc(nx, y0 + plankH * 0.5, 2.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createGasGiantTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(1024, 512);
    const d = img.data;
    for (let y = 0; y < 512; y++) {
      const ny = y / 512;
      for (let x = 0; x < 1024; x++) {
        const nx = x / 1024;
        const turb = fbm2D(nx * 8, ny * 6, 4) * 0.08;
        const band = Math.sin((ny + turb) * 34.0) * 0.5 + 0.5;
        const fine = fbm2D(nx * 20, ny * 18, 3);
        const idx = (y * 1024 + x) * 4;
        d[idx] = Math.round(145 + band * 75 + fine * 24);
        d[idx + 1] = Math.round(92 + band * 68 + fine * 20);
        d[idx + 2] = Math.round(68 + band * 48 + fine * 18);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPlanetaryRingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let x = 0; x < 512; x++) {
      const t = x / 512;
      const cassiniGap = Math.abs(t - 0.62) < 0.045 ? 0.12 : 1.0;
      const edgeFade = Math.sin(t * Math.PI);
      const bands = 0.55 + 0.45 * Math.sin(t * 75) * Math.cos(t * 31);
      const alpha = Math.max(0, Math.min(1, edgeFade * cassiniGap * (0.45 + bands * 0.5))) * 0.85;
      const r = Math.round(218 + bands * 28);
      const g = Math.round(188 + bands * 26);
      const b = Math.round(150 + bands * 24);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
      ctx.fillRect(x, 0, 1, 32);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createMoonTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bCtx = bump.getContext('2d');

  if (ctx && bCtx) {
    const img = ctx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm2D((x / size) * 8, (y / size) * 8, 4);
        const idx = (y * size + x) * 4;
        const shade = Math.round(155 + n * 75);
        img.data[idx] = shade;
        img.data[idx + 1] = Math.min(255, shade + 6);
        img.data[idx + 2] = Math.min(255, shade + 18);
        img.data[idx + 3] = 255;

        const bv = Math.round(n * 255);
        bImg.data[idx] = bv;
        bImg.data[idx + 1] = bv;
        bImg.data[idx + 2] = bv;
        bImg.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // Subtle lunar craters
    for (let i = 0; i < 48; i++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const cr = 5 + Math.random() * 22;
      ctx.strokeStyle = 'rgba(235, 240, 255, 0.25)';
      ctx.fillStyle = 'rgba(95, 102, 122, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      bCtx.strokeStyle = 'rgba(230, 230, 230, 0.45)';
      bCtx.fillStyle = 'rgba(45, 45, 45, 0.45)';
      bCtx.lineWidth = 2.5;
      bCtx.beginPath();
      bCtx.arc(cx, cy, cr, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.anisotropy = maxAnisotropy;
  return { map, bumpMap };
}

function valleyHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= 4.1) return 0;
  const blend = THREE.MathUtils.smoothstep(r, 4.1, 18.0);
  const roll =
    Math.sin(x * 0.085) * Math.cos(z * 0.075) * 1.7 +
    (fbm2D(x * 0.04 + 10, z * 0.04 + 10, 3) - 0.45) * 4.5 +
    Math.max(0, (r - 22) * 0.16);
  return Math.max(-0.18, roll * blend);
}

export class SceneEnvironmentController {
  private rootGroup: THREE.Group;
  private skyMat: THREE.ShaderMaterial;
  private valleyGrassMat: THREE.ShaderMaterial | null = null;
  private oceanMat: THREE.ShaderMaterial | null = null;
  private spaceStars: THREE.Points | null = null;
  private spacePlanetGroup: THREE.Group | null = null;

  private groups = new Map<SceneEnvironment, THREE.Group>();
  private disposables: { dispose: () => void }[] = [];
  private maxAnisotropy: number;
  private currentEnv: SceneEnvironment = 'valley';

  constructor(
    parentScene: THREE.Scene,
    maxAnisotropy: number,
    initialEnv: SceneEnvironment = 'valley'
  ) {
    this.maxAnisotropy = maxAnisotropy;
    this.rootGroup = new THREE.Group();
    parentScene.add(this.rootGroup);

    const skyGeo = new THREE.SphereGeometry(98, 36, 24);
    const initStyle = ENV_STYLES[initialEnv];
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(initStyle.skyTop) },
        uHorizonColor: { value: new THREE.Color(initStyle.skyHorizon) },
        uBottomColor: { value: new THREE.Color(initStyle.skyBottom) },
        uGlowColor: { value: new THREE.Color(initStyle.skyGlow) },
        uSunDir: { value: new THREE.Vector3(...initStyle.sunDir).normalize() },
        uNebulaMode: { value: initStyle.nebulaMode },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        uniform vec3 uGlowColor;
        uniform vec3 uSunDir;
        uniform float uNebulaMode;
        varying vec3 vWorldDir;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        float noise3(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = dir.y;
          vec3 sky = h >= 0.0
            ? mix(uHorizonColor, uTopColor, pow(clamp(h, 0.0, 1.0), 0.55))
            : mix(uHorizonColor, uBottomColor, pow(clamp(-h, 0.0, 1.0), 0.45));

          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float halo = pow(sunDot, 7.0) * 0.44;
          float horizonBand = exp(-abs(h) * 8.0) * 0.28;
          sky += uGlowColor * (halo + horizonBand * pow(sunDot, 1.4));

          if (uNebulaMode > 0.5) {
            float n1 = noise3(dir * 3.4);
            float n2 = noise3(dir * 7.2 + 4.1);
            float band = exp(-abs(dir.y * 0.8 + dir.x * 0.45 - 0.15) * 4.2);
            float neb = smoothstep(0.35, 0.85, n1 * 0.65 + n2 * 0.35) * band;
            sky += vec3(0.36, 0.20, 0.52) * neb * 0.55;
            sky += vec3(0.16, 0.34, 0.58) * (n2 * band) * 0.32;
          } else if (h > 0.03) {
            // Subtle sunlit high-altitude clouds
            float c1 = noise3(vec3(dir.x * 4.2, dir.y * 10.0, dir.z * 4.2));
            float c2 = noise3(vec3(dir.x * 8.5 + 3.0, dir.y * 16.0, dir.z * 8.5));
            float cloud = smoothstep(0.56, 0.82, c1 * 0.68 + c2 * 0.32) * smoothstep(0.03, 0.28, h);
            vec3 cloudCol = mix(uHorizonColor * 1.08, uGlowColor, 0.35 + sunDot * 0.45);
            sky = mix(sky, cloudCol, cloud * 0.28);
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    this.rootGroup.add(skyDome);
    this.disposables.push(skyGeo, this.skyMat);

    this.setEnvironment(initialEnv);
  }

  public setEnvironment(env: SceneEnvironment): EnvironmentStyle {
    this.currentEnv = env;
    const style = ENV_STYLES[env];

    this.skyMat.uniforms.uTopColor.value.setHex(style.skyTop);
    this.skyMat.uniforms.uHorizonColor.value.setHex(style.skyHorizon);
    this.skyMat.uniforms.uBottomColor.value.setHex(style.skyBottom);
    this.skyMat.uniforms.uGlowColor.value.setHex(style.skyGlow);
    this.skyMat.uniforms.uSunDir.value.set(...style.sunDir).normalize();
    this.skyMat.uniforms.uNebulaMode.value = style.nebulaMode;

    if (!this.groups.has(env)) {
      const group = this.buildEnvironmentGroup(env);
      this.groups.set(env, group);
      this.rootGroup.add(group);
    }

    this.groups.forEach((group, key) => {
      group.visible = key === env;
    });

    return style;
  }

  public update(elapsed: number): void {
    if (this.currentEnv === 'valley' && this.valleyGrassMat) {
      this.valleyGrassMat.uniforms.uTime.value = elapsed;
    } else if (this.currentEnv === 'ocean' && this.oceanMat) {
      this.oceanMat.uniforms.uTime.value = elapsed;
    } else if (this.currentEnv === 'space') {
      if (this.spaceStars) {
        this.spaceStars.rotation.y = elapsed * 0.008;
      }
      if (this.spacePlanetGroup) {
        this.spacePlanetGroup.rotation.y = elapsed * 0.028;
      }
    }
  }

  private buildEnvironmentGroup(env: SceneEnvironment): THREE.Group {
    switch (env) {
      case 'valley':
        return this.buildValleyGroup();
      case 'forest':
        return this.buildForestGroup();
      case 'ocean':
        return this.buildOceanGroup();
      case 'space':
        return this.buildSpaceGroup();
      case 'studio':
      default:
        return this.buildStudioGroup();
    }
  }

  private buildValleyGroup(): THREE.Group {
    const group = new THREE.Group();

    // Sculpted meadow terrain with natural organic relief
    const { map: grassTex, bumpMap: grassBump } = createTerrainTextures(this.maxAnisotropy, false);
    const terrainGeo = new THREE.PlaneGeometry(140, 140, 96, 96);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, valleyHeightAt(x, z));
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      bumpMap: grassBump,
      bumpScale: 0.09,
      roughness: 0.94,
      metalness: 0.02,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    group.add(terrain);
    this.disposables.push(grassTex, grassBump, terrainGeo, terrainMat);

    // Distant sculpted mountain ridge ring framing the valley horizon
    const ridgeGeo = new THREE.CylinderGeometry(52, 62, 11, 72, 6, true);
    const rPos = ridgeGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const y = rPos.getY(i);
      if (y > 0) {
        const x = rPos.getX(i);
        const z = rPos.getZ(i);
        const angle = Math.atan2(z, x);
        const peak =
          Math.sin(angle * 5.0) * 3.2 +
          Math.cos(angle * 11.0 + 1.4) * 1.8 +
          fbm2D(Math.cos(angle) * 3 + 5, Math.sin(angle) * 3 + 5, 3) * 4.5;
        rPos.setY(i, y + peak);
      }
    }
    ridgeGeo.computeVertexNormals();
    const ridgeMat = new THREE.MeshStandardMaterial({
      color: 0x3b4d3c,
      roughness: 0.96,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const ridges = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridges.position.y = -2.2;
    group.add(ridges);
    this.disposables.push(ridgeGeo, ridgeMat);

    // Dense 3-blade wind-swaying grass tufts (1,900 tufts = 5,700 grass blades!)
    const tuftGeo = createGrassTuftGeometry();
    this.valleyGrassMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uRootColor: { value: new THREE.Color(0x16290e) },
        uMidColor: { value: new THREE.Color(0x3f6b24) },
        uTipColor: { value: new THREE.Color(0x8bb846) },
        uFogColor: { value: new THREE.Color(0x9aa589) },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vShade;

        void main() {
          vUv = uv;
          vec3 pos = position;

          vec4 worldBase = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float bendMask = pow(uv.y, 1.65);
          float gust = sin(uTime * 1.85 + worldBase.x * 0.45 + worldBase.z * 0.35)
                     + 0.45 * sin(uTime * 3.3 + worldBase.x * 0.95 - worldBase.z * 0.7);
          pos.x += gust * 0.14 * bendMask;
          pos.z += gust * 0.08 * bendMask;
          pos.y -= abs(gust) * 0.025 * bendMask;

          vec4 wp = modelMatrix * instanceMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          vShade = 0.85 + 0.25 * sin(worldBase.x * 0.7 + worldBase.z * 0.9);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uRootColor;
        uniform vec3 uMidColor;
        uniform vec3 uTipColor;
        uniform vec3 uFogColor;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vShade;

        void main() {
          vec3 col = mix(uRootColor, uMidColor, smoothstep(0.0, 0.55, vUv.y));
          col = mix(col, uTipColor, smoothstep(0.45, 1.0, vUv.y));
          col *= vShade;

          float dist = length(vWorldPos.xz);
          float fogFactor = smoothstep(14.0, 36.0, dist);
          col = mix(col, uFogColor, fogFactor * 0.72);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const tuftCount = 1900;
    const grassMesh = new THREE.InstancedMesh(tuftGeo, this.valleyGrassMat, tuftCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < tuftCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.25 + Math.pow(Math.random(), 0.72) * 21.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = valleyHeightAt(x, z);

      dummy.position.set(x, y - 0.03, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      const s = 0.75 + Math.random() * 1.15;
      dummy.scale.set(s, s * (0.8 + Math.random() * 0.65), s);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);
    }
    grassMesh.instanceMatrix.needsUpdate = true;
    group.add(grassMesh);
    this.disposables.push(tuftGeo, this.valleyGrassMat);

    // Wildflower clusters with stems
    const stemGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.34, 5);
    stemGeo.translate(0, 0.17, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3b6624, roughness: 0.9 });
    const petalGeo = new THREE.DodecahedronGeometry(0.042, 0);
    const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.68, metalness: 0.0 });

    const flowerCount = 140;
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, flowerCount);
    const petals = new THREE.InstancedMesh(petalGeo, petalMat, flowerCount);
    const fCol = new THREE.Color();
    const palette = [0xfff6dc, 0xffd166, 0xe8c7ff, 0xffb4a2];

    for (let i = 0; i < flowerCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.6 + Math.random() * 14.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = valleyHeightAt(x, z);

      dummy.position.set(x, y - 0.02, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.16, Math.random() * Math.PI, (Math.random() - 0.5) * 0.16);
      const fs = 0.8 + Math.random() * 0.6;
      dummy.scale.set(fs, fs, fs);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, y + 0.31 * fs, z);
      dummy.scale.set(fs, fs * 0.65, fs);
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
      petals.setColorAt(i, fCol.setHex(palette[i % palette.length]));
    }
    stems.instanceMatrix.needsUpdate = true;
    petals.instanceMatrix.needsUpdate = true;
    if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
    group.add(stems, petals);
    this.disposables.push(stemGeo, stemMat, petalGeo, petalMat);

    return group;
  }

  private buildForestGroup(): THREE.Group {
    const group = new THREE.Group();

    // Moss & pine-needle forest floor with bump depth
    const { map: mossTex, bumpMap: mossBump } = createTerrainTextures(this.maxAnisotropy, true);
    const floorGeo = new THREE.PlaneGeometry(140, 140, 72, 72);
    floorGeo.rotateX(-Math.PI / 2);
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r > 4.2) {
        const blend = THREE.MathUtils.smoothstep(r, 4.2, 16.0);
        const h =
          ((fbm2D(x * 0.07 + 4, z * 0.07 + 4, 3) - 0.4) * 2.6 + Math.max(0, (r - 20) * 0.1)) *
          blend;
        pos.setY(i, Math.max(-0.15, h));
      }
    }
    floorGeo.computeVertexNormals();

    const floorMat = new THREE.MeshStandardMaterial({
      map: mossTex,
      bumpMap: mossBump,
      bumpScale: 0.1,
      roughness: 0.95,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    group.add(floor);
    this.disposables.push(mossTex, mossBump, floorGeo, floorMat);

    // Textured cedar tree-stump base with bark sides & ring top (flush at y=0)
    const { map: barkMap, bumpMap: barkBump } = createBarkTextures(this.maxAnisotropy);
    const ringMap = createTreeRingTexture(this.maxAnisotropy);
    const barkMat = new THREE.MeshStandardMaterial({
      map: barkMap,
      bumpMap: barkBump,
      bumpScale: 0.08,
      roughness: 0.92,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      map: ringMap,
      roughness: 0.82,
    });
    const stumpGeo = new THREE.CylinderGeometry(3.28, 3.55, 0.18, 48);
    const stump = new THREE.Mesh(stumpGeo, [barkMat, ringMat, barkMat]);
    stump.position.y = -0.09;
    stump.receiveShadow = true;
    group.add(stump);
    this.disposables.push(barkMap, barkBump, ringMap, barkMat, ringMat, stumpGeo);

    // Realistic feathery pine trees (furrowed bark trunks + 5 alpha-tested needle bough layers)
    const pineNeedleTex = createPineFoliageTexture(this.maxAnisotropy);
    const boughMat = new THREE.MeshStandardMaterial({
      map: pineNeedleTex,
      alphaTest: 0.28,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0.02,
    });

    const createDeformedBoughLayer = (radius: number, height: number, yOffset: number) => {
      const geo = new THREE.ConeGeometry(radius, height, 18, 3, true);
      geo.translate(0, yOffset, 0);
      const bp = geo.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const bx = bp.getX(i);
        const by = bp.getY(i);
        const bz = bp.getZ(i);
        const ang = Math.atan2(bz, bx);
        const droop = Math.sin(ang * 5.0 + yOffset) * 0.14;
        bp.setY(i, by + droop * (1 - Math.max(0, (by - yOffset) / height)));
      }
      geo.computeVertexNormals();
      return geo;
    };

    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.28, 4.4, 10);
    trunkGeo.translate(0, 2.2, 0);
    const layer1Geo = createDeformedBoughLayer(1.65, 2.1, 2.4);
    const layer2Geo = createDeformedBoughLayer(1.42, 1.9, 3.3);
    const layer3Geo = createDeformedBoughLayer(1.18, 1.75, 4.15);
    const layer4Geo = createDeformedBoughLayer(0.9, 1.55, 4.95);
    const layer5Geo = createDeformedBoughLayer(0.58, 1.35, 5.65);

    const treeCount = 85;
    const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, treeCount);
    trunks.castShadow = true;
    const l1 = new THREE.InstancedMesh(layer1Geo, boughMat, treeCount);
    const l2 = new THREE.InstancedMesh(layer2Geo, boughMat, treeCount);
    const l3 = new THREE.InstancedMesh(layer3Geo, boughMat, treeCount);
    const l4 = new THREE.InstancedMesh(layer4Geo, boughMat, treeCount);
    const l5 = new THREE.InstancedMesh(layer5Geo, boughMat, treeCount);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i++) {
      const a = (i / treeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
      // Keep a wide open clearing around the turntable and push foreground (+Z) trees far back
      const minRadius = Math.sin(a) > 0.15 ? 27.5 : 18.5;
      const r = minRadius + Math.random() * 26.0;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const s = 1.0 + Math.random() * 1.3;

      dummy.position.set(x, -0.05, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.95 + Math.random() * 0.4), s);
      dummy.updateMatrix();

      trunks.setMatrixAt(i, dummy.matrix);
      l1.setMatrixAt(i, dummy.matrix);
      l2.setMatrixAt(i, dummy.matrix);
      l3.setMatrixAt(i, dummy.matrix);
      l4.setMatrixAt(i, dummy.matrix);
      l5.setMatrixAt(i, dummy.matrix);
    }
    [trunks, l1, l2, l3, l4, l5].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      group.add(m);
    });
    this.disposables.push(
      pineNeedleTex,
      boughMat,
      trunkGeo,
      layer1Geo,
      layer2Geo,
      layer3Geo,
      layer4Geo,
      layer5Geo
    );

    // Understory woodland ferns
    const fernGeo = createGrassTuftGeometry();
    const fernMat = new THREE.MeshStandardMaterial({
      color: 0x305828,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const fernCount = 280;
    const ferns = new THREE.InstancedMesh(fernGeo, fernMat, fernCount);
    for (let i = 0; i < fernCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.8 + Math.random() * 16;
      dummy.position.set(Math.cos(a) * r, -0.02, Math.sin(a) * r);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      const fs = 1.2 + Math.random() * 1.4;
      dummy.scale.set(fs * 1.3, fs * 0.9, fs * 1.3);
      dummy.updateMatrix();
      ferns.setMatrixAt(i, dummy.matrix);
    }
    ferns.instanceMatrix.needsUpdate = true;
    group.add(ferns);
    this.disposables.push(fernGeo, fernMat);

    // Soft volumetric dappled sunlight rays slanting through canopy
    const rayGeo = new THREE.CylinderGeometry(0.45, 2.4, 14, 16, 1, true);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffe0ad,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    [
      [-5.5, 5.6, -8.2],
      [4.2, 5.8, -10.5],
      [-10.5, 5.5, -3.5],
    ].forEach(([rx, ry, rz]) => {
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(rx, ry, rz);
      ray.rotation.set(0.28, 0, -0.35);
      group.add(ray);
    });
    this.disposables.push(rayGeo, rayMat);

    return group;
  }

  private buildOceanGroup(): THREE.Group {
    const group = new THREE.Group();

    // Multi-wave Gerstner-style ocean shader with specular sun path & wave crests
    const oceanGeo = new THREE.PlaneGeometry(200, 200, 128, 128);
    oceanGeo.rotateX(-Math.PI / 2);
    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color(0x092136) },
        uShallowColor: { value: new THREE.Color(0x18526e) },
        uSkyReflect: { value: new THREE.Color(0xd98a5f) },
        uSunColor: { value: new THREE.Color(0xffd296) },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;
        varying float vCrest;

        vec3 gerstner(vec2 pos, vec2 dir, float steep, float wl, float speed, inout vec3 tangent, inout vec3 binormal) {
          float k = 6.28318 / wl;
          float c = sqrt(9.8 / k) * speed;
          vec2 d = normalize(dir);
          float f = k * (dot(d, pos) - c * uTime);
          float a = steep / k;

          tangent += vec3(
            -d.x * d.x * (steep * sin(f)),
            d.x * (steep * cos(f)),
            -d.x * d.y * (steep * sin(f))
          );
          binormal += vec3(
            -d.x * d.y * (steep * sin(f)),
            d.y * (steep * cos(f)),
            -d.y * d.y * (steep * sin(f))
          );

          return vec3(d.x * (a * cos(f)), a * sin(f), d.y * (a * cos(f)));
        }

        void main() {
          vec3 pos = position;
          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);

          vec3 disp = vec3(0.0);
          disp += gerstner(pos.xz, vec2(0.8, 0.55), 0.14, 9.5, 0.72, tangent, binormal);
          disp += gerstner(pos.xz, vec2(-0.6, 0.8), 0.11, 6.2, 0.85, tangent, binormal);
          disp += gerstner(pos.xz, vec2(0.35, -0.9), 0.09, 4.1, 0.95, tangent, binormal);
          disp += gerstner(pos.xz, vec2(-0.85, -0.45), 0.06, 2.5, 1.15, tangent, binormal);

          pos += disp;
          vCrest = disp.y;
          vWaveNormal = normalize(cross(binormal, tangent));

          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uSkyReflect;
        uniform vec3 uSunColor;
        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;
        varying float vCrest;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);

          // High-frequency surface micro-ripples
          float rx = sin(vWorldPos.x * 2.7 + uTime * 2.2) * cos(vWorldPos.z * 2.3 - uTime * 1.8);
          float rz = cos(vWorldPos.x * 2.1 - uTime * 1.9) * sin(vWorldPos.z * 2.9 + uTime * 2.4);
          vec3 n = normalize(vWaveNormal + vec3(rx * 0.09, 0.0, rz * 0.09));

          float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 3.6);
          float scatter = smoothstep(-0.08, 0.24, vCrest);
          vec3 waterBase = mix(uDeepColor, uShallowColor, scatter * 0.85);
          vec3 color = mix(waterBase, uSkyReflect, clamp(fresnel * 0.78, 0.0, 0.88));

          // Sun specular glitter across waves
          vec3 sunDir = normalize(vec3(0.0, 0.16, -1.0));
          vec3 halfDir = normalize(sunDir + viewDir);
          float specSharp = pow(max(dot(n, halfDir), 0.0), 140.0);
          float specBroad = pow(max(dot(n, halfDir), 0.0), 22.0);
          color += uSunColor * (specSharp * 1.65 + specBroad * 0.22);

          // Subtle foam near highest wave crests & around pier pilings
          float foamMask = smoothstep(0.18, 0.34, vCrest + rx * 0.05);
          color = mix(color, vec3(0.92, 0.93, 0.95), foamMask * 0.28);

          float distFade = smoothstep(26.0, 88.0, length(vWorldPos.xz));
          color = mix(color, uSkyReflect * 0.78, distFade * 0.72);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMat);
    oceanMesh.position.y = -0.4;
    group.add(oceanMesh);
    this.disposables.push(oceanGeo, this.oceanMat);

    // Textured coastal wooden pier deck (top flush at y=0)
    const { map: pierMap, bumpMap: pierBump } = createPierWoodTextures(this.maxAnisotropy);
    const pierMat = new THREE.MeshStandardMaterial({
      map: pierMap,
      bumpMap: pierBump,
      bumpScale: 0.05,
      roughness: 0.84,
      metalness: 0.05,
    });
    const pierGeo = new THREE.BoxGeometry(6.8, 0.14, 5.4);
    const pier = new THREE.Mesh(pierGeo, pierMat);
    pier.position.y = -0.07;
    pier.receiveShadow = true;
    group.add(pier);

    // Timber cross-beams + corner pilings
    const { map: barkMap, bumpMap: barkBump } = createBarkTextures(this.maxAnisotropy);
    const postMat = new THREE.MeshStandardMaterial({
      map: barkMap,
      bumpMap: barkBump,
      bumpScale: 0.06,
      color: 0x6a5342,
      roughness: 0.9,
    });
    const postGeo = new THREE.CylinderGeometry(0.16, 0.18, 1.6, 16);
    [
      [-3.15, -2.45],
      [3.15, -2.45],
      [-3.15, 2.45],
      [3.15, 2.45],
    ].forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, -0.42, pz);
      group.add(post);
    });

    // Distant coastal island headlands on horizon
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x262936,
      roughness: 0.95,
    });
    const islandGeo = new THREE.ConeGeometry(12, 4.5, 16);
    const island1 = new THREE.Mesh(islandGeo, islandMat);
    island1.position.set(-34, -0.5, -52);
    island1.scale.set(1.6, 0.8, 1.0);
    const island2 = new THREE.Mesh(islandGeo, islandMat);
    island2.position.set(38, -0.5, -56);
    island2.scale.set(1.4, 0.65, 0.9);
    group.add(island1, island2);

    // Sunset sun orb low on horizon
    const sunGeo = new THREE.SphereGeometry(4.4, 24, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd596 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(0, 6.0, -72);
    group.add(sun);

    this.disposables.push(
      pierMap,
      pierBump,
      pierMat,
      pierGeo,
      barkMap,
      barkBump,
      postMat,
      postGeo,
      islandGeo,
      islandMat,
      sunGeo,
      sunMat
    );

    return group;
  }

  private buildSpaceGroup(): THREE.Group {
    const group = new THREE.Group();

    // Brushed dark basalt/titanium orbital platform under turntable (top flush at y=0)
    const padGeo = new THREE.CylinderGeometry(3.4, 3.05, 0.14, 64);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x151324,
      roughness: 0.34,
      metalness: 0.75,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = -0.07;
    pad.receiveShadow = true;
    group.add(pad);

    const rimGeo = new THREE.TorusGeometry(3.41, 0.028, 12, 72);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xe89f65,
      emissive: 0xd97d3a,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.85,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = -0.01;
    group.add(rim);

    // Deep multi-color 3D Starfield
    const starCount = 1100;
    const sGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(starCount * 3);
    const sCol = new Float32Array(starCount * 3);
    const tmpColor = new THREE.Color();
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 46 + Math.random() * 40;
      sPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      sPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.88 + 0.4;
      sPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      tmpColor.setHSL(0.58 + (Math.random() - 0.5) * 0.48, 0.45, 0.78 + Math.random() * 0.22);
      sCol[i * 3] = tmpColor.r;
      sCol[i * 3 + 1] = tmpColor.g;
      sCol[i * 3 + 2] = tmpColor.b;
    }
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    const sMat = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.spaceStars = new THREE.Points(sGeo, sMat);
    group.add(this.spaceStars);

    // Textured Gas Giant Planet + Concentric Multi-Band Rings + Atmosphere Halo
    this.spacePlanetGroup = new THREE.Group();
    this.spacePlanetGroup.position.set(-19, 10.5, -36);

    const planetTex = createGasGiantTexture(this.maxAnisotropy);
    const planetGeo = new THREE.SphereGeometry(4.4, 40, 28);
    const planetMat = new THREE.MeshStandardMaterial({
      map: planetTex,
      roughness: 0.78,
      metalness: 0.06,
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    this.spacePlanetGroup.add(planet);

    const ringTex = createPlanetaryRingTexture(this.maxAnisotropy);
    const ringGeo = new THREE.RingGeometry(5.6, 9.8, 72);
    // Remap RingGeometry UVs radially (0 inner -> 1 outer) so concentric ring bands wrap properly!
    const rUv = ringGeo.attributes.uv;
    const rPos = ringGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rx = rPos.getX(i);
      const ry = rPos.getY(i);
      const rad = Math.hypot(rx, ry);
      const u = (rad - 5.6) / (9.8 - 5.6);
      rUv.setXY(i, u, 0.5);
    }
    ringGeo.rotateX(Math.PI * 0.38);
    ringGeo.rotateY(0.28);
    const ringMat = new THREE.MeshStandardMaterial({
      map: ringTex,
      roughness: 0.65,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.spacePlanetGroup.add(ring);
    group.add(this.spacePlanetGroup);

    // Cratered Lunar Moon
    const { map: moonMap, bumpMap: moonBump } = createMoonTextures(this.maxAnisotropy);
    const moonGeo = new THREE.SphereGeometry(1.9, 32, 24);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonMap,
      bumpMap: moonBump,
      bumpScale: 0.08,
      roughness: 0.88,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(17, 13, -32);
    group.add(moon);

    this.disposables.push(
      padGeo,
      padMat,
      rimGeo,
      rimMat,
      sGeo,
      sMat,
      planetTex,
      planetGeo,
      planetMat,
      ringTex,
      ringGeo,
      ringMat,
      moonMap,
      moonBump,
      moonGeo,
      moonMat
    );

    return group;
  }

  private buildStudioGroup(): THREE.Group {
    return buildStudioEnvironment(this.maxAnisotropy, this.disposables);
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.groups.clear();
  }
}
