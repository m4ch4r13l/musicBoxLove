import * as THREE from 'three';
import { buildPhotoFrameProp } from './photoFrameProp';

type Disposable = { dispose: () => void };

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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// =========================================================
// PROCEDURAL PBR TEXTURES
// =========================================================
function createVarnishedWoodTextures(
  maxAnisotropy: number,
  baseHex: string,
  darkRgba: string,
  lightRgba: string,
  plankRows = 0
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
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
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 420; i++) {
      const y = Math.random() * size;
      const dark = i % 2 === 0;
      ctx.strokeStyle = dark ? darkRgba : lightRgba;
      ctx.lineWidth = 0.9 + Math.random() * 2.0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        size * 0.33,
        y + (Math.random() - 0.5) * 9,
        size * 0.66,
        y + (Math.random() - 0.5) * 9,
        size,
        y + (Math.random() - 0.5) * 5
      );
      ctx.stroke();

      bCtx.strokeStyle = dark ? 'rgba(55,55,55,0.28)' : 'rgba(195,195,195,0.2)';
      bCtx.lineWidth = 1.2;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(size, y);
      bCtx.stroke();
    }

    if (plankRows > 0) {
      const rowH = size / plankRows;
      for (let r = 0; r < plankRows; r++) {
        const py = r * rowH;
        ctx.fillStyle = 'rgba(18, 10, 6, 0.72)';
        ctx.fillRect(0, py, size, 3);
        bCtx.fillStyle = '#1d1d1d';
        bCtx.fillRect(0, py, size, 3.5);

        // Subtle brass bung/screw dots along plank battens
        [48, 256, 464].forEach((bx) => {
          ctx.fillStyle = 'rgba(42, 24, 14, 0.5)';
          ctx.beginPath();
          ctx.arc(bx, py + rowH * 0.5, 2.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
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

function createClinkerHullTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  // UV convention for outer hull: u = length (0 stern -> 1 bow), v = height from keel (0) to gunwale (1)
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const bump = document.createElement('canvas');
  bump.width = w;
  bump.height = h;
  const bCtx = bump.getContext('2d');

  if (ctx && bCtx) {
    // Upper topsides: deep maritime navy blue
    ctx.fillStyle = '#1b3146';
    ctx.fillRect(0, 0, w, h);

    // Lower hull below waterline (Canvas y is top-down: y=h is v=0 keel!)
    const waterlineY = h * 0.62; // v = 0.38
    ctx.fillStyle = '#622320'; // Traditional copper-oxide anti-fouling red
    ctx.fillRect(0, waterlineY, w, h - waterlineY);

    // Crisp cream-ivory boot-stripe just above waterline
    ctx.fillStyle = '#e8dfd0';
    ctx.fillRect(0, waterlineY - 12, w, 12);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, w, h);

    // Wood grain under painted finish
    for (let i = 0; i < 640; i++) {
      const y = Math.random() * h;
      const dark = i % 2 === 0;
      ctx.strokeStyle = dark ? 'rgba(8, 14, 22, 0.2)' : 'rgba(130, 165, 195, 0.08)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (Math.random() - 0.5) * 4);
      ctx.stroke();

      bCtx.strokeStyle = dark ? 'rgba(65,65,65,0.22)' : 'rgba(175,175,175,0.16)';
      bCtx.lineWidth = 1.1;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(w, y);
      bCtx.stroke();
    }

    // 7 Clinker / Lapstrake plank shadow seams + copper boat nails along strakes
    const strakeCount = 7;
    const strakeH = h / strakeCount;
    for (let s = 1; s < strakeCount; s++) {
      const sy = s * strakeH;
      const seamGrad = ctx.createLinearGradient(0, sy - 5, 0, sy + 6);
      seamGrad.addColorStop(0, 'rgba(0,0,0,0)');
      seamGrad.addColorStop(0.5, 'rgba(6, 10, 16, 0.62)');
      seamGrad.addColorStop(0.75, 'rgba(215, 228, 242, 0.14)');
      seamGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = seamGrad;
      ctx.fillRect(0, sy - 5, w, 11);

      bCtx.fillStyle = '#2a2a2a';
      bCtx.fillRect(0, sy - 2, w, 4);
      bCtx.fillStyle = '#c8c8c8';
      bCtx.fillRect(0, sy + 2, w, 2);

      // Subtle copper/bronze rivets spaced along each strake overlap
      for (let rx = 18; rx < w; rx += 38) {
        ctx.fillStyle = 'rgba(12, 16, 22, 0.45)';
        ctx.beginPath();
        ctx.arc(rx, sy - 6, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle salt-mist patina near waterline
    const saltGrad = ctx.createLinearGradient(0, waterlineY - 26, 0, waterlineY + 18);
    saltGrad.addColorStop(0, 'rgba(220, 226, 232, 0)');
    saltGrad.addColorStop(0.55, 'rgba(195, 206, 215, 0.13)');
    saltGrad.addColorStop(1, 'rgba(12, 22, 28, 0.26)');
    ctx.fillStyle = saltGrad;
    ctx.fillRect(0, waterlineY - 26, w, 44);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createWovenFabricTexture(
  maxAnisotropy: number,
  baseHex: string,
  stripeHex: string,
  plaid = false
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    if (plaid) {
      ctx.fillStyle = stripeHex;
      for (let i = 0; i < size; i += 32) {
        ctx.globalAlpha = 0.26;
        ctx.fillRect(i, 0, 10, size);
        ctx.fillRect(0, i, size, 10);
      }
      ctx.fillStyle = '#e7d6ba';
      for (let i = 16; i < size; i += 64) {
        ctx.globalAlpha = 0.35;
        ctx.fillRect(i, 0, 3, size);
        ctx.fillRect(0, i, size, 3);
      }
      ctx.globalAlpha = 1.0;
    }

    // Fine linen weave
    for (let y = 0; y < size; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.055)';
      ctx.fillRect(0, y, size, 1);
    }
    for (let x = 0; x < size; x += 3) {
      ctx.fillStyle = x % 6 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
      ctx.fillRect(x, 0, 1, size);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRopeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#b99d74';
    ctx.fillRect(0, 0, size, size);
    for (let i = -size; i < size * 2; i += 10) {
      ctx.strokeStyle = 'rgba(72, 52, 28, 0.42)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(232, 212, 178, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(i + 4, 0);
      ctx.lineTo(i + 4 + size, size);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSunGlowTextures(maxAnisotropy: number): {
  coreTex: THREE.CanvasTexture;
  bloomTex: THREE.CanvasTexture;
} {
  const cSize = 512;
  const coreCanvas = document.createElement('canvas');
  coreCanvas.width = cSize;
  coreCanvas.height = cSize;
  const cCtx = coreCanvas.getContext('2d');
  if (cCtx) {
    const half = cSize / 2;
    const grad = cCtx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 252, 232, 1.0)');
    grad.addColorStop(0.18, 'rgba(255, 234, 175, 0.98)');
    grad.addColorStop(0.28, 'rgba(255, 196, 108, 0.88)');
    grad.addColorStop(0.42, 'rgba(255, 148, 72, 0.44)');
    grad.addColorStop(0.68, 'rgba(246, 108, 62, 0.14)');
    grad.addColorStop(1.0, 'rgba(246, 92, 54, 0.0)');
    cCtx.fillStyle = grad;
    cCtx.fillRect(0, 0, cSize, cSize);
  }
  const coreTex = new THREE.CanvasTexture(coreCanvas);
  coreTex.colorSpace = THREE.SRGBColorSpace;
  coreTex.anisotropy = maxAnisotropy;

  const bSize = 512;
  const bloomCanvas = document.createElement('canvas');
  bloomCanvas.width = bSize;
  bloomCanvas.height = bSize;
  const bCtx = bloomCanvas.getContext('2d');
  if (bCtx) {
    const half = bSize / 2;
    const grad = bCtx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 214, 142, 0.72)');
    grad.addColorStop(0.24, 'rgba(255, 162, 92, 0.44)');
    grad.addColorStop(0.52, 'rgba(235, 114, 78, 0.18)');
    grad.addColorStop(0.78, 'rgba(195, 86, 82, 0.05)');
    grad.addColorStop(1.0, 'rgba(180, 72, 78, 0.0)');
    bCtx.fillStyle = grad;
    bCtx.fillRect(0, 0, bSize, bSize);
  }
  const bloomTex = new THREE.CanvasTexture(bloomCanvas);
  bloomTex.colorSpace = THREE.SRGBColorSpace;
  bloomTex.anisotropy = maxAnisotropy;

  return { coreTex, bloomTex };
}

function createMoonGlowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(220, 236, 255, 0.62)');
    grad.addColorStop(0.28, 'rgba(168, 202, 248, 0.32)');
    grad.addColorStop(0.58, 'rgba(116, 154, 218, 0.10)');
    grad.addColorStop(1.0, 'rgba(92, 128, 198, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createMoonSurfaceTextures(maxAnisotropy: number): {
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
        const n = fbm2D((x / size) * 7, (y / size) * 7, 4);
        const maria = fbm2D((x / size) * 2.6 + 2.1, (y / size) * 2.6 + 5.4, 3);
        const idx = (y * size + x) * 4;
        const shade = Math.round(168 + n * 62 - (maria > 0.52 ? 28 : 0));
        img.data[idx] = Math.min(255, shade);
        img.data[idx + 1] = Math.min(255, shade + 6);
        img.data[idx + 2] = Math.min(255, shade + 16);
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

    for (let i = 0; i < 48; i++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const cr = 5 + Math.random() * 20;
      ctx.strokeStyle = 'rgba(240, 246, 255, 0.25)';
      ctx.fillStyle = 'rgba(110, 118, 138, 0.24)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      bCtx.strokeStyle = 'rgba(230, 230, 230, 0.45)';
      bCtx.fillStyle = 'rgba(50, 50, 50, 0.42)';
      bCtx.lineWidth = 2;
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

// =========================================================
// PARAMETRIC CLASSIC CLINKER WOODEN ROWBOAT HULL (3.70 m x 1.64 m)
// =========================================================
const BOAT_YAW = 0.22;
const BOAT_PIVOT_Y = -2.55;
const X_STERN = -17.5;
const X_BOW = 19.5;

function fract(x: number): number {
  return x - Math.floor(x);
}

function seaVHash(px: number, py: number): number {
  let x = fract(px * 127.1);
  let y = fract(py * 311.7);
  const d = x * (x + 43.17) + y * (y + 43.17);
  x += d;
  y += d;
  return fract(x * y);
}

function seaQNoise(px: number, py: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  const ux = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0);
  const uy = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0);
  const a = seaVHash(ix, iy);
  const b = seaVHash(ix + 1, iy);
  const c = seaVHash(ix, iy + 1);
  const d = seaVHash(ix + 1, iy + 1);
  const ab = a + (b - a) * ux;
  const cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy - 0.5;
}

// Mirrors oceanMat vertexShader seaWaveHeight(xz) so the boat rocks at the exact wave rhythm
function sampleOceanWaveHeight(x: number, z: number, time: number): number {
  const r1x = 0.84 * x - 0.54 * z;
  const r1z = 0.54 * x + 0.84 * z;
  const r2x = 0.62 * x + 0.78 * z;
  const r2z = -0.78 * x + 0.62 * z;
  const r3x = -0.41 * x - 0.91 * z;
  const r3z = 0.91 * x - 0.41 * z;

  let h = 0;
  h += seaQNoise(x * 0.095 + time * 0.22, z * 0.095 - time * 0.16) * 0.42;
  h += seaQNoise(r1x * 0.19 - time * 0.31, r1z * 0.19 + time * 0.24) * 0.24;
  h += seaQNoise(r2x * 0.36 + time * 0.27, r2z * 0.36 + time * 0.38) * 0.13;
  h += seaQNoise(r3x * 0.64 - time * 0.42, r3z * 0.64 - time * 0.29) * 0.065;
  return h;
}

function hullProfileAt(x: number): { halfBeam: number; sheerY: number; keelY: number } {
  const t = Math.max(0, Math.min(1, (x - X_STERN) / (X_BOW - X_STERN)));
  // Wide flared transom at stern (t=0), full midships around t=0.44, graceful pointed bow at t=1
  const sternWidth = 4.65;
  const swell = Math.sin(Math.pow(t, 0.88) * Math.PI);
  const bowPinch = Math.pow(Math.max(0, 1 - t), 0.52);
  const halfBeam = Math.max(0.14, sternWidth * (1 - t) * bowPinch + 7.2 * Math.pow(swell, 0.78));

  // Classic upward sheer sweep toward bow & stern
  const sheerY =
    0.4 +
    Math.pow(Math.max(0, 0.46 - t) / 0.46, 2.0) * 0.56 +
    Math.pow(Math.max(0, t - 0.46) / 0.54, 2.2) * 1.12;

  // Deep rocker keel rising toward transom skeg and curving up at bow forefoot
  const keelY =
    -3.45 +
    Math.pow(Math.max(0, 0.25 - t) / 0.25, 2.1) * 1.25 +
    Math.pow(Math.max(0, t - 0.72) / 0.28, 2.3) * 3.55;

  return { halfBeam, sheerY, keelY };
}

function hullSurfacePoint(x: number, s: number, clinkerLaps: boolean): THREE.Vector3 {
  const absS = Math.abs(s);
  const { halfBeam, sheerY, keelY } = hullProfileAt(x);

  // Rounded wooden bilge curving smoothly up into flared gunwales
  let zMag = halfBeam * Math.pow(absS, 0.62);
  if (clinkerLaps && absS > 0.04 && absS < 0.985) {
    const strakes = 7.0;
    const phase = (absS * strakes) % 1.0;
    const taper = smoothstep(0.04, 0.14, absS) * (1 - Math.max(0, (x - 8) / 14) * 0.65);
    zMag += (1 - phase) * 0.13 * taper;
  }

  const z = Math.sign(s) * zMag;
  const y = THREE.MathUtils.lerp(keelY, sheerY, Math.pow(absS, 1.92));
  return new THREE.Vector3(x, y, z);
}

function createClinkerRowboatGeometries(): {
  outerHullGeo: THREE.BufferGeometry;
  innerHullGeo: THREE.BufferGeometry;
  transomGeo: THREE.BufferGeometry;
  portGunwale: THREE.Vector3[];
  starboardGunwale: THREE.Vector3[];
  keelCurvePts: THREE.Vector3[];
  ribCurves: THREE.Vector3[][];
} {
  const xSegs = 12;
  const uSegs = 14; // 7 clinker strakes per side, 1 crisp facet per strake

  const buildShell = (clinkerLaps: boolean, insetScale: number) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let ix = 0; ix <= xSegs; ix++) {
      const tx = ix / xSegs;
      const x = THREE.MathUtils.lerp(X_STERN, X_BOW, tx);
      for (let iu = 0; iu <= uSegs; iu++) {
        const tu = iu / uSegs;
        const s = tu * 2 - 1;
        const p = hullSurfacePoint(x, s, clinkerLaps);
        if (insetScale < 1) {
          p.z *= insetScale;
          p.y += 0.11 * (1 - Math.abs(s) * 0.5);
        }
        positions.push(p.x, p.y, p.z);
        // v = Math.abs(s) so keel is v=0 and both gunwales are v=1 (boot-stripe aligns both sides!)
        uvs.push(tx, Math.abs(s));
      }
    }

    const stride = uSegs + 1;
    for (let ix = 0; ix < xSegs; ix++) {
      for (let iu = 0; iu < uSegs; iu++) {
        const a = ix * stride + iu;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  const outerHullGeo = buildShell(true, 1.0);
  const innerHullGeo = buildShell(false, 0.982);

  // Sculpted Flat Angled Stern Transom Board closing X_STERN
  const transomShape = new THREE.Shape();
  const transomSamples = 10;
  for (let i = 0; i <= transomSamples; i++) {
    const s = (i / transomSamples) * 2 - 1;
    const pt = hullSurfacePoint(X_STERN, s, false);
    if (i === 0) transomShape.moveTo(pt.z, pt.y);
    else transomShape.lineTo(pt.z, pt.y);
  }
  transomShape.closePath();
  const transomGeo = new THREE.ExtrudeGeometry(transomShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  transomGeo.rotateY(Math.PI / 2);
  transomGeo.translate(X_STERN - 0.18, 0, 0);

  // Port & Starboard gunwale paths + external keel spine path
  const portGunwale: THREE.Vector3[] = [];
  const starboardGunwale: THREE.Vector3[] = [];
  const keelCurvePts: THREE.Vector3[] = [];

  for (let i = 0; i <= 14; i++) {
    const x = THREE.MathUtils.lerp(X_STERN, X_BOW, i / 14);
    portGunwale.push(hullSurfacePoint(x, -1, false));
    starboardGunwale.push(hullSurfacePoint(x, 1, false));
    const kp = hullSurfacePoint(x, 0, false);
    kp.y -= 0.08;
    keelCurvePts.push(kp);
  }

  // 7 Faceted Bent-Oak Internal Rib Frames hugging inner hull contour
  const ribCurves: THREE.Vector3[][] = [];
  for (let r = 0; r < 7; r++) {
    const rx = THREE.MathUtils.lerp(X_STERN + 2.6, X_BOW - 3.8, r / 6);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 10; k++) {
      const s = (k / 10) * 2 - 1;
      const p = hullSurfacePoint(rx, s * 0.96, false);
      p.z *= 0.968;
      p.y += 0.14;
      pts.push(p);
    }
    ribCurves.push(pts);
  }

  return {
    outerHullGeo,
    innerHullGeo,
    transomGeo,
    portGunwale,
    starboardGunwale,
    keelCurvePts,
    ribCurves,
  };
}

// =========================================================
// REALISTIC WOODEN ROWBOAT + DATE SETTING PROPS
// =========================================================
function buildRowboatAndDateProps(
  maxAnisotropy: number,
  disposables: Disposable[],
  photoTexture: THREE.Texture
): THREE.Group {
  const boat = new THREE.Group();

  // Procedural PBR textures
  const { map: hullMap, bumpMap: hullBump } = createClinkerHullTextures(maxAnisotropy);
  const { map: innerCreamMap, bumpMap: innerCreamBump } = createVarnishedWoodTextures(
    maxAnisotropy,
    '#cbbba2',
    'rgba(105, 86, 62, 0.22)',
    'rgba(244, 234, 216, 0.2)',
    7
  );
  const { map: mahoganyMap, bumpMap: mahoganyBump } = createVarnishedWoodTextures(
    maxAnisotropy,
    '#6d3c1e',
    'rgba(32, 14, 6, 0.34)',
    'rgba(165, 108, 62, 0.24)'
  );
  const { map: teakSlatsMap, bumpMap: teakSlatsBump } = createVarnishedWoodTextures(
    maxAnisotropy,
    '#8b5a34',
    'rgba(40, 22, 10, 0.3)',
    'rgba(198, 148, 98, 0.22)',
    5
  );
  const linenRedTex = createWovenFabricTexture(maxAnisotropy, '#7d2830', '#5a191f');
  const linenCreamTex = createWovenFabricTexture(maxAnisotropy, '#ece1cd', '#d5c7af');
  const plaidThrowTex = createWovenFabricTexture(maxAnisotropy, '#8c3438', '#2a3d4f', true);
  const ropeTex = createRopeTexture(maxAnisotropy);

  const hullOuterMat = new THREE.MeshPhysicalMaterial({
    map: hullMap,
    bumpMap: hullBump,
    bumpScale: 0.07,
    roughness: 0.42,
    metalness: 0.04,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
    flatShading: true,
    side: THREE.FrontSide,
  });
  const hullInnerMat = new THREE.MeshStandardMaterial({
    map: innerCreamMap,
    bumpMap: innerCreamBump,
    bumpScale: 0.05,
    roughness: 0.74,
    metalness: 0.02,
    flatShading: true,
    side: THREE.BackSide,
  });
  const mahoganyMat = new THREE.MeshPhysicalMaterial({
    map: mahoganyMap,
    bumpMap: mahoganyBump,
    bumpScale: 0.045,
    roughness: 0.38,
    metalness: 0.04,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
    flatShading: true,
  });
  const teakSlatMat = new THREE.MeshStandardMaterial({
    map: teakSlatsMap,
    bumpMap: teakSlatsBump,
    bumpScale: 0.045,
    roughness: 0.66,
    metalness: 0.03,
    flatShading: true,
  });
  const oakRibMat = new THREE.MeshStandardMaterial({
    color: 0xa5845e,
    roughness: 0.78,
    metalness: 0.02,
    flatShading: true,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a85a,
    roughness: 0.28,
    metalness: 0.86,
    flatShading: true,
  });

  // 1. Clinker Hull, Interior Shell, Transom & Bent-Oak Ribs
  const {
    outerHullGeo,
    innerHullGeo,
    transomGeo,
    portGunwale,
    starboardGunwale,
    keelCurvePts,
    ribCurves,
  } = createClinkerRowboatGeometries();

  const outerHull = new THREE.Mesh(outerHullGeo, hullOuterMat);
  outerHull.receiveShadow = true;
  boat.add(outerHull);

  const innerHull = new THREE.Mesh(innerHullGeo, hullInnerMat);
  innerHull.receiveShadow = true;
  boat.add(innerHull);

  const transom = new THREE.Mesh(transomGeo, mahoganyMat);
  transom.receiveShadow = true;
  boat.add(transom);

  // Varnished mahogany gunwale cap rails + external keel + stempost timber
  const portCurve = new THREE.CatmullRomCurve3(portGunwale);
  const starCurve = new THREE.CatmullRomCurve3(starboardGunwale);
  const keelCurve = new THREE.CatmullRomCurve3(keelCurvePts);

  const portRailGeo = new THREE.TubeGeometry(portCurve, 14, 0.24, 5, false);
  const starRailGeo = new THREE.TubeGeometry(starCurve, 14, 0.24, 5, false);
  const keelGeo = new THREE.TubeGeometry(keelCurve, 12, 0.16, 5, false);
  boat.add(
    new THREE.Mesh(portRailGeo, mahoganyMat),
    new THREE.Mesh(starRailGeo, mahoganyMat),
    new THREE.Mesh(keelGeo, mahoganyMat)
  );

  // Curved bow stempost timber rising cleanly to bow peak
  const bowTip = hullSurfacePoint(X_BOW, 0, false);
  const bowPeak = new THREE.Vector3(X_BOW + 0.12, hullProfileAt(X_BOW).sheerY + 0.16, 0);
  const stemCurve = new THREE.CatmullRomCurve3([
    hullSurfacePoint(X_BOW - 2.6, 0, false),
    new THREE.Vector3(X_BOW - 0.5, bowTip.y - 0.2, 0),
    bowPeak,
  ]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 8, 0.22, 5, false);
  boat.add(new THREE.Mesh(stemGeo, mahoganyMat));

  const innerHullHalfZAt = (x: number, yLevel: number): number => {
    const { halfBeam, sheerY, keelY } = hullProfileAt(x);
    if (yLevel <= keelY + 0.08) return 0;
    const frac = Math.min(1, (yLevel - keelY) / Math.max(0.1, sheerY - keelY));
    const absS = Math.pow(frac, 1 / 1.92);
    return halfBeam * Math.pow(absS, 0.62) * 0.968;
  };

  const createContouredBenchGeo = (
    xMin: number,
    xMax: number,
    yTop: number,
    thickness: number,
    zMargin = 0.08
  ): THREE.BufferGeometry => {
    const samples = 6;
    const shape = new THREE.Shape();
    for (let i = 0; i <= samples; i++) {
      const x = THREE.MathUtils.lerp(xMin, xMax, i / samples);
      const hz = Math.max(0.3, innerHullHalfZAt(x, yTop - thickness * 0.5) - zMargin);
      if (i === 0) shape.moveTo(x, -hz);
      else shape.lineTo(x, -hz);
    }
    for (let i = samples; i >= 0; i--) {
      const x = THREE.MathUtils.lerp(xMin, xMax, i / samples);
      const hz = Math.max(0.3, innerHullHalfZAt(x, yTop - thickness * 0.5) - zMargin);
      shape.lineTo(x, hz);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, yTop, 0);
    const uvAttr = geo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setXY(i, uvAttr.getX(i) * 0.14, uvAttr.getY(i) * 0.14);
    }
    uvAttr.needsUpdate = true;
    return geo;
  };

  // Carved triangular mahogany breasthook fitted flush inside bow gunwales
  const hookBackX = X_BOW - 2.8;
  const hookHalfZ = Math.max(0.5, hullSurfacePoint(hookBackX, 1, false).z * 0.94);
  const breasthookShape = new THREE.Shape();
  breasthookShape.moveTo(X_BOW - 0.35, 0);
  breasthookShape.lineTo(hookBackX, -hookHalfZ);
  breasthookShape.quadraticCurveTo(hookBackX + 0.5, 0, hookBackX, hookHalfZ);
  breasthookShape.closePath();
  const breasthookGeo = new THREE.ExtrudeGeometry(breasthookShape, {
    depth: 0.22,
    bevelEnabled: false,
  });
  breasthookGeo.rotateX(Math.PI / 2);
  const breasthook = new THREE.Mesh(breasthookGeo, mahoganyMat);
  breasthook.position.y = hullProfileAt(X_BOW - 1.4).sheerY + 0.04;
  boat.add(breasthook);

  // Bent-oak internal frame ribs
  const ribGeos: THREE.BufferGeometry[] = [];
  ribCurves.forEach((pts) => {
    const rGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.11, 4, false);
    ribGeos.push(rGeo);
    const ribMesh = new THREE.Mesh(rGeo, oakRibMat);
    ribMesh.receiveShadow = true;
    boat.add(ribMesh);
  });

  // Curved central keelson timber spine hugging the inner bilge rocker
  const keelsonPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const kx = THREE.MathUtils.lerp(X_STERN + 1.4, X_BOW - 2.8, i / 10);
    const kp = hullSurfacePoint(kx, 0, false);
    keelsonPts.push(new THREE.Vector3(kp.x, kp.y + 0.18, 0));
  }
  const keelsonGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(keelsonPts),
    12,
    0.16,
    4,
    false
  );
  const keelson = new THREE.Mesh(keelsonGeo, mahoganyMat);
  boat.add(keelson);

  // 2. Fitted Teak Duckboard Floorboards (cut precisely inside inner hull at y = -2.32)
  const floorboardGeos: THREE.BufferGeometry[] = [];
  [-3.2, -1.9, -0.65, 0.65, 1.9, 3.2].forEach((fz) => {
    const reqZ = Math.abs(fz) + 0.72;
    let xMin = -14.2;
    let xMax = 13.8;
    while (xMin < 0 && innerHullHalfZAt(xMin, -2.36) < reqZ) xMin += 0.4;
    while (xMax > 0 && innerHullHalfZAt(xMax, -2.36) < reqZ) xMax -= 0.4;
    const len = Math.max(4.0, xMax - xMin);
    const fGeo = new THREE.BoxGeometry(len, 0.14, 1.06);
    floorboardGeos.push(fGeo);
    const fMesh = new THREE.Mesh(fGeo, teakSlatMat);
    fMesh.position.set((xMin + xMax) * 0.5, -2.32, fz);
    fMesh.receiveShadow = true;
    boat.add(fMesh);
  });

  // 3. Hull-Contoured Thwarts (Benches) + Hanging Knees
  // Center Picnic/Turntable Thwart (top flush at y = -0.002 under turntable at y = 0!)
  const centerThwartGeo = createContouredBenchGeo(-5.4, 5.4, -0.002, 0.3, 0.06);
  const centerThwart = new THREE.Mesh(centerThwartGeo, teakSlatMat);
  centerThwart.receiveShadow = true;
  boat.add(centerThwart);

  // Subtle mahogany edge trim rails fore & aft of center thwart (flush at y = -0.002)
  const thwartTrimGeo = new THREE.BoxGeometry(0.28, 0.32, 1.0);
  [-5.4, 5.4].forEach((tx) => {
    const halfSpan = Math.max(2.0, innerHullHalfZAt(tx, -0.15) * 2 - 0.16);
    const trim = new THREE.Mesh(thwartTrimGeo, mahoganyMat);
    trim.scale.z = halfSpan;
    trim.position.set(tx, -0.162, 0);
    boat.add(trim);
  });

  // Hanging knees fastening center bench flush to port & starboard ribs
  const kneeZ = Math.max(3.0, innerHullHalfZAt(0, -0.35) - 0.16);
  const kneeGeo = new THREE.BoxGeometry(0.65, 1.15, 0.34);
  [-kneeZ, kneeZ].forEach((kz) => {
    const knee = new THREE.Mesh(kneeGeo, mahoganyMat);
    knee.position.set(0, -0.42, kz);
    boat.add(knee);
  });

  // Stern Seat (fitted to wide transom end, y = -0.95) & Bow Seat (y = -0.82)
  const sternSeatGeo = createContouredBenchGeo(-14.8, -9.6, -0.81, 0.28, 0.08);
  const sternSeat = new THREE.Mesh(sternSeatGeo, teakSlatMat);
  sternSeat.receiveShadow = true;
  boat.add(sternSeat);

  const bowSeatGeo = createContouredBenchGeo(8.2, 12.8, -0.68, 0.28, 0.08);
  const bowSeat = new THREE.Mesh(bowSeatGeo, teakSlatMat);
  bowSeat.receiveShadow = true;
  boat.add(bowSeat);

  // 4. SCULPTED WOODEN OARS WITH SPOON BLADES, LEATHER COLLARS & HORN ROWLOCKS
  const oarShaftPts = [
    new THREE.Vector2(0.0, 0.0), // grip end
    new THREE.Vector2(0.11, 0.12),
    new THREE.Vector2(0.14, 0.85), // contoured handle
    new THREE.Vector2(0.11, 1.45), // neck
    new THREE.Vector2(0.19, 3.6), // leather collar bulge
    new THREE.Vector2(0.16, 9.8), // loom
    new THREE.Vector2(0.12, 16.5), // blade throat
  ];
  const oarShaftGeo = new THREE.LatheGeometry(oarShaftPts, 7);
  oarShaftGeo.rotateZ(-Math.PI / 2); // grows along +X from 0 to 16.5

  const collarGeo = new THREE.CylinderGeometry(0.21, 0.21, 1.45, 7);
  collarGeo.rotateZ(Math.PI / 2);
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x3b2316,
    roughness: 0.72,
    flatShading: true,
  });

  // Sculpted tapered wooden spoon blade
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, -0.14);
  bladeShape.quadraticCurveTo(2.4, -0.68, 5.4, -0.76);
  bladeShape.quadraticCurveTo(6.1, -0.62, 6.2, 0);
  bladeShape.quadraticCurveTo(6.1, 0.62, 5.4, 0.76);
  bladeShape.quadraticCurveTo(2.4, 0.68, 0, 0.14);
  bladeShape.closePath();
  const oarBladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.11,
    curveSegments: 3,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.04,
    bevelSegments: 1,
  });
  oarBladeGeo.rotateX(Math.PI / 2);

  // Bronze horn rowlocks + gunwale socket plates
  const socketGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.14, 7);
  const hornGeo = new THREE.TorusGeometry(0.24, 0.055, 5, 8, Math.PI * 1.15);

  [-1, 1].forEach((side) => {
    const gunwalePt = hullSurfacePoint(2.2, side, false);
    const oarGroup = new THREE.Group();

    const shaft = new THREE.Mesh(oarShaftGeo, mahoganyMat);
    oarGroup.add(shaft);

    const collar = new THREE.Mesh(collarGeo, leatherMat);
    collar.position.set(4.5, 0, 0);
    oarGroup.add(collar);

    const blade = new THREE.Mesh(oarBladeGeo, teakSlatMat);
    blade.position.set(16.2, 0.06, 0);
    oarGroup.add(blade);

    // Rest oars neatly inside the boat across the outer wings of the center bench
    oarGroup.position.set(9.0, 0.2, side * 5.75);
    oarGroup.rotation.set(0, Math.PI - side * 0.06, 0);
    boat.add(oarGroup);

    // Brass rowlock socket + horn mounted right on the gunwale cap rail
    const socket = new THREE.Mesh(socketGeo, brassMat);
    socket.position.set(2.2, gunwalePt.y + 0.22, gunwalePt.z);
    const horn = new THREE.Mesh(hornGeo, brassMat);
    horn.position.set(2.2, gunwalePt.y + 0.45, gunwalePt.z);
    horn.rotation.set(Math.PI, 0, -0.15);
    boat.add(socket, horn);
  });

  // =========================================================
  // 5. ROMANTIC DATE DETAILS & NAUTICAL GEAR
  // =========================================================
  // Cushions with piped linen fabric + folded woven throw blanket
  const cushionRedMat = new THREE.MeshStandardMaterial({
    map: linenRedTex,
    roughness: 0.88,
    flatShading: true,
  });
  const cushionCreamMat = new THREE.MeshStandardMaterial({
    map: linenCreamTex,
    roughness: 0.9,
    flatShading: true,
  });
  const blanketMat = new THREE.MeshStandardMaterial({
    map: plaidThrowTex,
    roughness: 0.92,
    flatShading: true,
  });

  const cushionGeo = new THREE.BoxGeometry(3.4, 0.52, 3.8);
  [
    [-12.0, -0.55, -2.2, cushionRedMat, 0.12],
    [-12.0, -0.55, 2.2, cushionCreamMat, -0.1],
    [10.4, -0.42, -1.9, cushionCreamMat, -0.14],
    [10.4, -0.42, 1.9, cushionRedMat, 0.11],
  ].forEach(([cx, cy, cz, mat, ry]) => {
    const cush = new THREE.Mesh(cushionGeo, mat as THREE.Material);
    cush.position.set(cx as number, cy as number, cz as number);
    cush.rotation.y = ry as number;
    boat.add(cush);
  });

  // Folded plaid blanket draped across stern seat corner
  const blanketGeo = new THREE.BoxGeometry(3.2, 0.34, 2.6);
  const blanket = new THREE.Mesh(blanketGeo, blanketMat);
  blanket.position.set(-12.8, -0.64, -4.1);
  blanket.rotation.y = 0.22;
  boat.add(blanket);

  // Coiled Hemp Mooring Rope + Brass Cleat near bow breasthook
  const ropeMat = new THREE.MeshStandardMaterial({
    map: ropeTex,
    roughness: 0.92,
    flatShading: true,
  });
  const coilPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 6.5;
    const rad = 0.35 + (i / 24) * 0.95;
    coilPts.push(new THREE.Vector3(Math.cos(a) * rad, (i / 24) * 0.16, Math.sin(a) * rad));
  }
  const ropeCoilGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 24, 0.11, 5, false);
  const ropeCoil = new THREE.Mesh(ropeCoilGeo, ropeMat);
  ropeCoil.position.set(14.0, -2.14, -0.8);
  boat.add(ropeCoil);

  const cleatBarGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6);
  cleatBarGeo.rotateX(Math.PI / 2);
  const cleat = new THREE.Mesh(cleatBarGeo, brassMat);
  cleat.position.set(17.9, hullProfileAt(17.9).sheerY + 0.22, 0);
  boat.add(cleat);

  // Hammered Brass Wine Chiller Bucket with Ice on stern floorboard
  const chillerPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.82, 0),
    new THREE.Vector2(1.02, 1.55),
    new THREE.Vector2(1.08, 1.62),
    new THREE.Vector2(0.95, 1.62),
    new THREE.Vector2(0.76, 0.14),
    new THREE.Vector2(0, 0.14),
  ];
  const chillerGeo = new THREE.LatheGeometry(chillerPts, 10);
  const chiller = new THREE.Mesh(chillerGeo, brassMat);
  chiller.position.set(-7.6, -2.25, 2.35);
  boat.add(chiller);

  // Chilled Champagne Bottle & Two Sculpted Crystal Flutes on Center Bench (right of turntable)
  const bottleMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e4a2b,
    roughness: 0.16,
    metalness: 0.05,
    clearcoat: 1.0,
    flatShading: true,
  });
  const foilMat = new THREE.MeshStandardMaterial({
    color: 0xe3b963,
    roughness: 0.28,
    metalness: 0.85,
    flatShading: true,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.08,
    transparent: true,
    opacity: 0.45,
    clearcoat: 1.0,
    depthWrite: false,
    flatShading: true,
  });
  const wineMat = new THREE.MeshStandardMaterial({
    color: 0xf7d883,
    emissive: 0x6e4f12,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.82,
    flatShading: true,
  });

  const bottlePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.42, 0.0),
    new THREE.Vector2(0.42, 1.55),
    new THREE.Vector2(0.16, 2.2),
    new THREE.Vector2(0.16, 2.85),
    new THREE.Vector2(0.19, 2.95),
  ];
  const bottleGeo = new THREE.LatheGeometry(bottlePts, 10);
  const bottle = new THREE.Mesh(bottleGeo, bottleMat);
  bottle.position.set(4.1, 0, -1.55);
  boat.add(bottle);

  const neckFoilGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.72, 10);
  const neckFoil = new THREE.Mesh(neckFoilGeo, foilMat);
  neckFoil.position.set(4.1, 2.58, -1.55);
  boat.add(neckFoil);

  const flutePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.28, 0.0),
    new THREE.Vector2(0.26, 0.04),
    new THREE.Vector2(0.04, 0.12),
    new THREE.Vector2(0.035, 0.85),
    new THREE.Vector2(0.18, 1.05),
    new THREE.Vector2(0.23, 1.55),
    new THREE.Vector2(0.21, 1.85),
  ];
  const fluteGeo = new THREE.LatheGeometry(flutePts, 10);
  const fluteLiquidGeo = new THREE.CylinderGeometry(0.18, 0.11, 0.46, 10);

  [
    [4.35, 0.75],
    [3.5, 1.45],
  ].forEach(([gx, gz]) => {
    const flute = new THREE.Mesh(fluteGeo, glassMat);
    flute.position.set(gx, 0, gz);
    flute.renderOrder = 3;
    const gWine = new THREE.Mesh(fluteLiquidGeo, wineMat);
    gWine.position.set(gx, 1.24, gz);
    boat.add(flute, gWine);
  });

  // Romantic Rose Bouquet in a Ceramic Vase (left of turntable)
  const vaseMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2e9dc,
    roughness: 0.26,
    clearcoat: 0.7,
    flatShading: true,
  });
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x2f5e24,
    roughness: 0.82,
    flatShading: true,
  });
  const roseMat = new THREE.MeshStandardMaterial({
    color: 0xc92838,
    roughness: 0.56,
    flatShading: true,
  });
  const pinkRoseMat = new THREE.MeshStandardMaterial({
    color: 0xeb7882,
    roughness: 0.56,
    flatShading: true,
  });

  const vasePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.46, 0),
    new THREE.Vector2(0.54, 0.72),
    new THREE.Vector2(0.28, 1.32),
    new THREE.Vector2(0.36, 1.55),
  ];
  const vaseGeo = new THREE.LatheGeometry(vasePts, 9);
  const vase = new THREE.Mesh(vaseGeo, vaseMat);
  vase.position.set(-4.15, 0, -1.65);
  boat.add(vase);

  const roseStemGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5);
  const roseBudGeo = new THREE.DodecahedronGeometry(0.23, 0);
  [
    [-0.18, 0.1, -0.22, roseMat],
    [0.2, -0.08, 0.2, roseMat],
    [0.02, 0.24, 0.04, pinkRoseMat],
    [-0.14, -0.12, 0.24, pinkRoseMat],
    [0.18, 0.08, -0.18, roseMat],
  ].forEach(([ox, oy, oz, mat]) => {
    const rs = new THREE.Mesh(roseStemGeo, stemMat);
    rs.position.set(-4.15 + (ox as number) * 0.5, 1.55, -1.65 + (oz as number) * 0.5);
    rs.rotation.set(oz as number, 0, -(ox as number));
    const bud = new THREE.Mesh(roseBudGeo, mat as THREE.Material);
    bud.position.set(-4.15 + (ox as number), 2.05 + (oy as number), -1.65 + (oz as number));
    boat.add(rs, bud);
  });

  // Wooden photo frame resting on the center bench inside the rowboat (rocks with the waves)
  const photoFrame = buildPhotoFrameProp(photoTexture, maxAnisotropy, disposables);
  photoFrame.position.set(-4.15, 0, 1.15);
  photoFrame.rotation.y = 0.3;
  boat.add(photoFrame);

  // 6. CAGED BRASS & GLASS BOW STORM LANTERN + WIRED FAIRY LIGHTS ALONG GUNWALES
  const postBaseY = hullProfileAt(17.2).sheerY;
  const postGeo = new THREE.CylinderGeometry(0.16, 0.2, 2.35, 7);
  const bowPost = new THREE.Mesh(postGeo, mahoganyMat);
  bowPost.position.set(17.2, postBaseY + 1.1, 0);
  boat.add(bowPost);

  const lanternBaseGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.24, 8);
  const lanternBase = new THREE.Mesh(lanternBaseGeo, brassMat);
  lanternBase.position.set(17.2, postBaseY + 2.32, 0);
  boat.add(lanternBase);

  const lanternCapGeo = new THREE.ConeGeometry(0.56, 0.42, 8);
  const lanternCap = new THREE.Mesh(lanternCapGeo, brassMat);
  lanternCap.position.set(17.2, postBaseY + 3.18, 0);
  boat.add(lanternCap);

  const lanternGlassGeo = new THREE.CylinderGeometry(0.32, 0.3, 0.65, 8);
  const lanternGlass = new THREE.Mesh(lanternGlassGeo, glassMat);
  lanternGlass.position.set(17.2, postBaseY + 2.74, 0);
  lanternGlass.renderOrder = 4;
  boat.add(lanternGlass);

  const lanternGuardGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.72, 5);
  for (let g = 0; g < 4; g++) {
    const ang = (g / 4) * Math.PI * 2;
    const rod = new THREE.Mesh(lanternGuardGeo, brassMat);
    rod.position.set(
      17.2 + Math.cos(ang) * 0.36,
      postBaseY + 2.74,
      Math.sin(ang) * 0.36
    );
    boat.add(rod);
  }

  const lanternBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe4aa,
    emissive: 0xffa73d,
    emissiveIntensity: 3.4,
    flatShading: true,
  });
  const lanternBulbGeo = new THREE.IcosahedronGeometry(0.18, 0);
  const bowFlame = new THREE.Mesh(lanternBulbGeo, lanternBulbMat);
  bowFlame.position.set(17.2, postBaseY + 2.68, 0);
  boat.add(bowFlame);

  // String wire + warm bulbs hugging exact gunwale curves on port & starboard
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x26211c, roughness: 0.7 });
  const fairyBulbGeo = new THREE.IcosahedronGeometry(0.11, 0);
  const wireGeos: THREE.BufferGeometry[] = [];

  [-1, 1].forEach((side) => {
    const wirePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const fx = THREE.MathUtils.lerp(X_STERN + 2.2, X_BOW - 3.2, i / 14);
      const gp = hullSurfacePoint(fx, side, false);
      const sag = Math.abs(Math.sin((i / 14) * Math.PI * 4)) * 0.22;
      wirePts.push(new THREE.Vector3(gp.x, gp.y + 0.12 - sag, gp.z * 0.99));
    }
    const wireCurve = new THREE.CatmullRomCurve3(wirePts);
    const wGeo = new THREE.TubeGeometry(wireCurve, 16, 0.022, 4, false);
    wireGeos.push(wGeo);
    boat.add(new THREE.Mesh(wGeo, wireMat));

    for (let b = 0; b <= 8; b++) {
      const pt = wireCurve.getPointAt(b / 8);
      const bulb = new THREE.Mesh(fairyBulbGeo, lanternBulbMat);
      bulb.position.copy(pt).add(new THREE.Vector3(0, -0.07, 0));
      boat.add(bulb);
    }
  });

  // Warm romantic boat glow (non-shadow PointLights)
  const bowGlow = new THREE.PointLight(0xffad52, 28, 26, 1.4);
  bowGlow.position.set(15.2, postBaseY + 2.6, 0);
  boat.add(bowGlow);

  const sternGlow = new THREE.PointLight(0xffb464, 18, 22, 1.45);
  sternGlow.position.set(-11.5, 1.4, 0);
  boat.add(sternGlow);

  disposables.push(
    hullMap,
    hullBump,
    innerCreamMap,
    innerCreamBump,
    mahoganyMap,
    mahoganyBump,
    teakSlatsMap,
    teakSlatsBump,
    linenRedTex,
    linenCreamTex,
    plaidThrowTex,
    ropeTex,
    hullOuterMat,
    hullInnerMat,
    mahoganyMat,
    teakSlatMat,
    oakRibMat,
    brassMat,
    leatherMat,
    outerHullGeo,
    innerHullGeo,
    transomGeo,
    portRailGeo,
    starRailGeo,
    keelGeo,
    stemGeo,
    breasthookGeo,
    ...ribGeos,
    keelsonGeo,
    ...floorboardGeos,
    centerThwartGeo,
    thwartTrimGeo,
    kneeGeo,
    sternSeatGeo,
    bowSeatGeo,
    oarShaftGeo,
    collarGeo,
    oarBladeGeo,
    socketGeo,
    hornGeo,
    cushionRedMat,
    cushionCreamMat,
    blanketMat,
    cushionGeo,
    blanketGeo,
    ropeMat,
    ropeCoilGeo,
    cleatBarGeo,
    chillerGeo,
    bottleMat,
    foilMat,
    glassMat,
    wineMat,
    bottleGeo,
    neckFoilGeo,
    fluteGeo,
    fluteLiquidGeo,
    vaseMat,
    stemMat,
    roseMat,
    pinkRoseMat,
    vaseGeo,
    roseStemGeo,
    roseBudGeo,
    postGeo,
    lanternBaseGeo,
    lanternCapGeo,
    lanternGlassGeo,
    lanternGuardGeo,
    lanternBulbMat,
    lanternBulbGeo,
    wireMat,
    fairyBulbGeo,
    ...wireGeos
  );

  return boat;
}

// =========================================================
// MAIN OCEAN SUNSET & MOONRISE DATE ENVIRONMENT BUILDER
// =========================================================
export interface BoatPlatformMotion {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export function buildOceanDateEnvironment(
  maxAnisotropy: number,
  disposables: Disposable[],
  photoTexture: THREE.Texture
): {
  group: THREE.Group;
  oceanMat: THREE.ShaderMaterial;
  starMat: THREE.ShaderMaterial;
  platformMotion: BoatPlatformMotion;
  updateBoatMotion: (elapsed: number, dt: number) => void;
} {
  const group = new THREE.Group();

  // 1. Non-periodic quintic-noise random ocean waves with clean silky water texture
  const oceanGeo = new THREE.PlaneGeometry(320, 320, 180, 180);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(0x061428) },
      uShallowColor: { value: new THREE.Color(0x113d58) },
      uSkyReflect: { value: new THREE.Color(0xd86f38) },
      uSunColor: { value: new THREE.Color(0xffca7a) },
      uMoonColor: { value: new THREE.Color(0xb8d4ff) },
      uBoatInvMatrix: { value: new THREE.Matrix4() },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vWaveNormal;
      varying float vCrest;

      float vhash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 43.17);
        return fract(p.x * p.y);
      }

      // Smooth C2 quintic value noise (zero straight-line sine symmetry)
      float qnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        float a = vhash(i);
        float b = vhash(i + vec2(1.0, 0.0));
        float c = vhash(i + vec2(0.0, 1.0));
        float d = vhash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) - 0.5;
      }

      float seaWaveHeight(vec2 xz) {
        mat2 rot1 = mat2(0.84, 0.54, -0.54, 0.84);
        mat2 rot2 = mat2(0.62, -0.78, 0.78, 0.62);
        mat2 rot3 = mat2(-0.41, 0.91, -0.91, -0.41);

        float h = 0.0;
        h += qnoise(xz * 0.095 + vec2(uTime * 0.22, -uTime * 0.16)) * 0.42;
        h += qnoise((rot1 * xz) * 0.19 + vec2(-uTime * 0.31, uTime * 0.24)) * 0.24;
        h += qnoise((rot2 * xz) * 0.36 + vec2(uTime * 0.27, uTime * 0.38)) * 0.13;
        h += qnoise((rot3 * xz) * 0.64 + vec2(-uTime * 0.42, -uTime * 0.29)) * 0.065;
        return h;
      }

      void main() {
        vec3 pos = position;
        float eps = 0.42;
        float h0 = seaWaveHeight(pos.xz);
        float hx = seaWaveHeight(pos.xz + vec2(eps, 0.0));
        float hz = seaWaveHeight(pos.xz + vec2(0.0, eps));

        pos.y += h0;
        vCrest = h0;

        vec3 tangent = normalize(vec3(eps, hx - h0, 0.0));
        vec3 binormal = normalize(vec3(0.0, hz - h0, eps));
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
      uniform vec3 uMoonColor;
      uniform mat4 uBoatInvMatrix;
      varying vec3 vWorldPos;
      varying vec3 vWaveNormal;
      varying float vCrest;

      void main() {
        // Clip ocean cleanly inside the rocking rowboat hull volume so the boat interior stays 100% dry
        vec3 boatLocal = (uBoatInvMatrix * vec4(vWorldPos, 1.0)).xyz;
        float bx = boatLocal.x;
        float by = boatLocal.y;
        float bz = boatLocal.z;
        if (bx > -17.4 && bx < 19.35) {
          float bt = clamp((bx + 17.5) / 37.0, 0.0, 1.0);
          float swell = sin(pow(max(bt, 0.0001), 0.88) * 3.14159265);
          float bowPinch = pow(max(1.0 - bt, 0.0001), 0.52);
          float halfBeam = max(0.14, 4.65 * (1.0 - bt) * bowPinch + 7.2 * pow(max(swell, 0.0001), 0.78));

          float sheerY = 0.4 + pow(max(0.0001, 0.46 - bt) / 0.46, 2.0) * 0.56
                             + pow(max(0.0001, bt - 0.46) / 0.54, 2.2) * 1.12;
          float keelY = -3.45 + pow(max(0.0001, 0.25 - bt) / 0.25, 2.1) * 1.25
                              + pow(max(0.0001, bt - 0.72) / 0.28, 2.3) * 3.55;

          if (by > keelY + 0.02) {
            float frac = clamp((by - keelY) / max(0.1, sheerY - keelY), 0.0001, 1.0);
            float absS = pow(frac, 1.0 / 1.92);
            float outerHalfZ = halfBeam * pow(max(absS, 0.0001), 0.62);
            if (abs(bz) < max(0.0, outerHalfZ - 0.14)) {
              discard;
            }
          }
        }

        vec3 viewDir = normalize(cameraPosition - vWorldPos);

        // Clean silky surface sheen (gentle non-grid ripples matching previous water texture)
        float ra = sin(dot(vWorldPos.xz, vec2(1.8, 1.35)) + uTime * 1.9);
        float rb = cos(dot(vWorldPos.xz, vec2(-1.45, 2.05)) - uTime * 1.6);
        vec3 n = normalize(vWaveNormal + vec3(ra * 0.045, 0.0, rb * 0.045));

        float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 3.6);
        float scatter = smoothstep(-0.12, 0.24, vCrest);
        vec3 waterBase = mix(uDeepColor, uShallowColor, scatter * 0.82);

        float sunsetWeight = smoothstep(55.0, -55.0, vWorldPos.z);
        vec3 nightSea = vec3(0.032, 0.055, 0.115);
        vec3 horizReflect = mix(nightSea, uSkyReflect, sunsetWeight);
        vec3 color = mix(waterBase, horizReflect, clamp(fresnel * 0.78, 0.0, 0.88));

        // Warm Sunset Glitter Path (-Z)
        vec3 sunDir = normalize(vec3(0.0, 0.14, -1.0));
        vec3 sunHalf = normalize(sunDir + viewDir);
        float sunSharp = pow(max(dot(n, sunHalf), 0.0), 130.0);
        float sunBroad = pow(max(dot(n, sunHalf), 0.0), 18.0);
        color += uSunColor * (sunSharp * 1.85 + sunBroad * 0.3);

        // Cool Silver Moonrise Shimmer Path (+Z opposite the sun)
        vec3 moonDir = normalize(vec3(0.0, 0.15, 1.0));
        vec3 moonHalf = normalize(moonDir + viewDir);
        float moonSharp = pow(max(dot(n, moonHalf), 0.0), 140.0);
        float moonBroad = pow(max(dot(n, moonHalf), 0.0), 22.0);
        color += uMoonColor * (moonSharp * 1.1 + moonBroad * 0.16);

        float foamMask = smoothstep(0.18, 0.32, vCrest + (ra + rb) * 0.025);
        color = mix(color, vec3(0.88, 0.9, 0.94), foamMask * 0.2);

        float distFade = smoothstep(42.0, 145.0, length(vWorldPos.xz));
        color = mix(color, horizReflect, distFade * 0.85);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.y = -2.92;
  group.add(oceanMesh);

  // 2. Realistic Clinker Wooden Rowboat centered under turntable (center bench flush at y = -0.002)
  const rowboat = buildRowboatAndDateProps(maxAnisotropy, disposables, photoTexture);
  rowboat.rotation.y = BOAT_YAW;
  group.add(rowboat);

  rowboat.updateMatrixWorld(true);
  oceanMat.uniforms.uBoatInvMatrix.value.copy(rowboat.matrixWorld).invert();

  // 3. Distant Coastal Island Silhouettes flanking the sunset horizon
  const islandMat = new THREE.MeshStandardMaterial({
    color: 0x262938,
    roughness: 0.95,
  });
  const islandGeo = new THREE.ConeGeometry(16, 6.2, 18);
  const island1 = new THREE.Mesh(islandGeo, islandMat);
  island1.position.set(-56, -2.5, -88);
  island1.scale.set(1.8, 0.85, 1.0);
  const island2 = new THREE.Mesh(islandGeo, islandMat);
  island2.position.set(62, -2.5, -92);
  island2.scale.set(1.5, 0.72, 0.9);
  group.add(island1, island2);

  // 4. SUNSET SUN WITH SOFT ATMOSPHERIC FOG/BLOOM GLOW (-Z Horizon)
  const { coreTex, bloomTex } = createSunGlowTextures(maxAnisotropy);

  const sunBloomMat = new THREE.SpriteMaterial({
    map: bloomTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sunBloom = new THREE.Sprite(sunBloomMat);
  sunBloom.position.set(0, 10.5, -135);
  sunBloom.scale.set(78, 78, 1);
  group.add(sunBloom);

  const sunCoreMat = new THREE.SpriteMaterial({
    map: coreTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sunCore = new THREE.Sprite(sunCoreMat);
  sunCore.position.set(0, 10.5, -133);
  sunCore.scale.set(28, 28, 1);
  group.add(sunCore);

  // 5. RISING FULL MOON ON THE OPPOSITE HORIZON (+Z)
  const { map: moonMap, bumpMap: moonBump } = createMoonSurfaceTextures(maxAnisotropy);
  const moonHaloTex = createMoonGlowTexture(maxAnisotropy);

  const moonMat = new THREE.MeshStandardMaterial({
    map: moonMap,
    bumpMap: moonBump,
    bumpScale: 0.08,
    emissive: new THREE.Color(0x9cbbe8),
    emissiveMap: moonMap,
    emissiveIntensity: 0.75,
    roughness: 0.85,
    fog: false,
  });
  const moonGeo = new THREE.SphereGeometry(5.6, 36, 26);
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(0, 10.2, 132);
  moon.rotation.y = Math.PI * 0.75;
  group.add(moon);

  const moonHaloMat = new THREE.SpriteMaterial({
    map: moonHaloTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const moonHalo = new THREE.Sprite(moonHaloMat);
  moonHalo.position.set(0, 10.2, 135);
  moonHalo.scale.set(40, 40, 1);
  group.add(moonHalo);

  // 6. TWINKLING TWILIGHT SKY STARS (crisp overhead & across moonlit sky, fading gently near sunset)
  const starCount = 1450;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhases = new Float32Array(starCount);
  const starSpeeds = new Float32Array(starCount);
  const starPalette = [
    new THREE.Color(0xd2e4ff),
    new THREE.Color(0xf6f8ff),
    new THREE.Color(0xffe7c2),
    new THREE.Color(0xbcd6ff),
  ];

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const sinElev = 0.04 + Math.pow(Math.random(), 0.78) * 0.96;
    const cosElev = Math.sqrt(1 - sinElev * sinElev);
    const r = 186 + Math.random() * 18;

    starPos[i * 3] = r * cosElev * Math.cos(theta);
    starPos[i * 3 + 1] = r * sinElev;
    starPos[i * 3 + 2] = r * cosElev * Math.sin(theta);

    const col = starPalette[i % starPalette.length];
    const brightness = 0.7 + Math.random() * 0.3;
    starCol[i * 3] = col.r * brightness;
    starCol[i * 3 + 1] = col.g * brightness;
    starCol[i * 3 + 2] = col.b * brightness;

    const isBrightStar = Math.random() < 0.1;
    starSizes[i] = isBrightStar ? 4.8 + Math.random() * 3.4 : 1.9 + Math.random() * 2.4;
    starPhases[i] = Math.random() * Math.PI * 2;
    starSpeeds[i] = 1.1 + Math.random() * 2.6;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starCol, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
  starGeo.setAttribute('aSpeed', new THREE.BufferAttribute(starSpeeds, 1));

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aSpeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 dir = normalize(position);
        float horizonFade = smoothstep(0.04, 0.24, dir.y);
        float sunDot = max(dot(dir, normalize(vec3(0.0, 0.14, -1.0))), 0.0);
        float sunsetSuppress = 1.0 - smoothstep(0.55, 0.94, sunDot) * 0.85;
        float twinkle = 0.7 + 0.3 * sin(uTime * aSpeed + aPhase);

        vColor = aColor;
        vAlpha = horizonFade * sunsetSuppress * twinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (0.85 + 0.2 * twinkle);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (d > 1.0) discard;
        float core = exp(-d * d * 6.5) + smoothstep(0.55, 0.0, d) * 0.45;
        gl_FragColor = vec4(vColor, vAlpha * core);
      }
    `,
  });

  const starPoints = new THREE.Points(starGeo, starMat);
  group.add(starPoints);

  disposables.push(
    oceanGeo,
    oceanMat,
    islandGeo,
    islandMat,
    coreTex,
    bloomTex,
    sunBloomMat,
    sunCoreMat,
    moonMap,
    moonBump,
    moonHaloTex,
    moonMat,
    moonGeo,
    moonHaloMat,
    starGeo,
    starMat
  );

  const platformMotion: BoatPlatformMotion = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };

  // Pre-allocated buoyancy helpers (zero per-frame allocations)
  const cosYaw = Math.cos(BOAT_YAW);
  const sinYaw = Math.sin(BOAT_YAW);
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), BOAT_YAW);
  const qYawInv = qYaw.clone().invert();
  const qLocalTilt = new THREE.Quaternion();
  const eLocalTilt = new THREE.Euler(0, 0, 0, 'XZY');
  const pivotVec = new THREE.Vector3(0, -BOAT_PIVOT_Y, 0);
  const rotatedPivot = new THREE.Vector3();

  const sampleWaveAtBoatLocal = (lx: number, lz: number, t: number): number => {
    const wx = lx * cosYaw + lz * sinYaw;
    const wz = -lx * sinYaw + lz * cosYaw;
    return sampleOceanWaveHeight(wx, wz, t);
  };

  let curHeave = 0;
  let curPitch = 0;
  let curRoll = 0;
  let motionInitialized = false;

  const updateBoatMotion = (elapsed: number, dt: number): void => {
    // Integrate wave height over the hull footprint (5x3 stations) so motion matches actual sea swells
    let sumAll = 0;
    let bowSum = 0;
    let sternSum = 0;
    let portSum = 0;
    let starSum = 0;

    const xStations = [-9.5, -4.75, 0, 4.75, 9.5];
    const zStations = [-3.8, 0, 3.8];

    for (let ix = 0; ix < xStations.length; ix++) {
      const lx = xStations[ix];
      for (let iz = 0; iz < zStations.length; iz++) {
        const lz = zStations[iz];
        const h = sampleWaveAtBoatLocal(lx, lz, elapsed);
        sumAll += h;
        if (ix === 0) sternSum += h;
        if (ix === 4) bowSum += h;
        if (iz === 0) portSum += h;
        if (iz === 2) starSum += h;
      }
    }

    const avgH = sumAll / (xStations.length * zStations.length);
    const bowH = bowSum / zStations.length;
    const sternH = sternSum / zStations.length;
    const portH = portSum / xStations.length;
    const starH = starSum / xStations.length;

    const targetHeave = THREE.MathUtils.clamp(avgH * 1.05, -0.36, 0.36);
    const targetPitch = THREE.MathUtils.clamp(Math.atan((bowH - sternH) / 19.0) * 1.45, -0.055, 0.055);
    const targetRoll = THREE.MathUtils.clamp(-Math.atan((starH - portH) / 7.6) * 1.35, -0.072, 0.072);

    if (!motionInitialized) {
      curHeave = targetHeave;
      curPitch = targetPitch;
      curRoll = targetRoll;
      motionInitialized = true;
    } else {
      const safeDt = Math.min(Math.max(dt, 0), 0.08);
      curHeave = THREE.MathUtils.damp(curHeave, targetHeave, 5.2, safeDt);
      curPitch = THREE.MathUtils.damp(curPitch, targetPitch, 5.2, safeDt);
      curRoll = THREE.MathUtils.damp(curRoll, targetRoll, 5.6, safeDt);
    }

    // World-space tilt quaternion (preserves turntable yaw=0 while tilting in boat's pitch/roll axes)
    eLocalTilt.set(curRoll, 0, curPitch, 'XZY');
    qLocalTilt.setFromEuler(eLocalTilt);
    platformMotion.quaternion.copy(qYaw).multiply(qLocalTilt).multiply(qYawInv);

    // Pivot around waterline BOAT_PIVOT_Y so both boat bench and turntable stay 100% locked together
    rotatedPivot.copy(pivotVec).applyQuaternion(platformMotion.quaternion);
    platformMotion.position.set(
      rotatedPivot.x,
      BOAT_PIVOT_Y + curHeave + rotatedPivot.y,
      rotatedPivot.z
    );

    rowboat.position.copy(platformMotion.position);
    rowboat.quaternion.copy(platformMotion.quaternion).multiply(qYaw);
    rowboat.updateMatrixWorld(true);
    oceanMat.uniforms.uBoatInvMatrix.value.copy(rowboat.matrixWorld).invert();
  };

  return { group, oceanMat, starMat, platformMotion, updateBoatMotion };
}
