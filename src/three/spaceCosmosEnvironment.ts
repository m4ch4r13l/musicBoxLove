import * as THREE from 'three';

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

// =========================================================
// PROCEDURAL CELESTIAL TEXTURES
// =========================================================
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

type PlanetSurfaceKind = 'terran' | 'crimson' | 'tealGiant' | 'violet';

function createProceduralPlanetTexture(
  maxAnisotropy: number,
  kind: PlanetSurfaceKind
): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      const polar = Math.abs(ny - 0.5) * 2.0;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const idx = (y * w + x) * 4;
        const n1 = fbm2D(nx * 6.5 + 1.3, ny * 4.5 + 2.7, 4);
        const n2 = fbm2D(nx * 14.0 + 7.1, ny * 10.0 + 3.9, 3);

        let r = 128;
        let g = 128;
        let b = 128;

        if (kind === 'terran') {
          const land = n1 * 0.78 + n2 * 0.22;
          const clouds = fbm2D(nx * 8.5 - 3.2, ny * 6.0 + 4.1, 4);
          if (polar > 0.84 + (n2 - 0.5) * 0.08) {
            r = 232;
            g = 242;
            b = 252;
          } else if (land > 0.51) {
            const elev = Math.min(1, (land - 0.51) * 4.0);
            r = 52 + elev * 78;
            g = 112 + elev * 36;
            b = 58 + elev * 28;
          } else {
            const depth = land / 0.51;
            r = 18 + depth * 28;
            g = 62 + depth * 64;
            b = 132 + depth * 72;
          }
          if (clouds > 0.54) {
            const cMix = Math.min(0.85, (clouds - 0.54) * 2.4);
            r = r * (1 - cMix) + 245 * cMix;
            g = g * (1 - cMix) + 248 * cMix;
            b = b * (1 - cMix) + 255 * cMix;
          }
        } else if (kind === 'crimson') {
          const canyon = Math.abs(n1 - 0.5) * 2.0;
          r = 152 + n2 * 64 - canyon * 28;
          g = 62 + n2 * 38 - canyon * 16;
          b = 42 + n1 * 24;
          if (polar > 0.88) {
            r = r * 0.55 + 225 * 0.45;
            g = g * 0.55 + 205 * 0.45;
            b = b * 0.55 + 198 * 0.45;
          }
        } else if (kind === 'tealGiant') {
          const swirl = fbm2D(nx * 5.0, ny * 5.0, 3) * 0.08;
          const band = Math.sin((ny + swirl) * 26.0) * 0.5 + 0.5;
          r = 34 + band * 48 + n2 * 22;
          g = 128 + band * 68 + n2 * 26;
          b = 158 + band * 72 + n2 * 24;
        } else {
          // violet marbled exoplanet
          const swirl = fbm2D(nx * 6.0 + n2 * 0.4, ny * 5.0, 4);
          r = 88 + swirl * 102 + n2 * 24;
          g = 46 + swirl * 58 + n2 * 18;
          b = 136 + swirl * 96 + n2 * 22;
        }

        d[idx] = Math.max(0, Math.min(255, Math.round(r)));
        d[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
        d[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
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

function createNebulaCloudTexture(
  maxAnisotropy: number,
  innerRgb: [number, number, number],
  outerRgb: [number, number, number],
  seedOffset: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const img = ctx.createImageData(size, size);
    const d = img.data;
    const half = size * 0.5;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - half) / half;
        const dy = (y - half) / half;
        const r = Math.hypot(dx, dy);
        if (r >= 1.0) continue;

        const nx = (x / size) * 4.4 + seedOffset;
        const ny = (y / size) * 4.4 + seedOffset * 0.63;
        const warpX = fbm2D(nx, ny, 3) * 1.4;
        const warpY = fbm2D(nx + 5.2, ny + 1.3, 3) * 1.4;
        const density = fbm2D(nx + warpX, ny + warpY, 4);
        const wisps = fbm2D(nx * 2.1 - warpY, ny * 2.1 + warpX, 3);

        const radialFade = Math.pow(Math.max(0, 1.0 - r), 1.85);
        const cloud = Math.max(0, (density * 0.72 + wisps * 0.45 - 0.24) * 1.65) * radialFade;
        const coreMix = Math.max(0, Math.min(1, radialFade * (0.4 + density * 0.8)));

        const idx = (y * size + x) * 4;
        d[idx] = Math.min(255, Math.round(outerRgb[0] * (1 - coreMix) + innerRgb[0] * coreMix));
        d[idx + 1] = Math.min(255, Math.round(outerRgb[1] * (1 - coreMix) + innerRgb[1] * coreMix));
        d[idx + 2] = Math.min(255, Math.round(outerRgb[2] * (1 - coreMix) + innerRgb[2] * coreMix));
        d[idx + 3] = Math.min(255, Math.round(cloud * 210));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSpiralGalaxyTexture(
  maxAnisotropy: number,
  coreRgb: [number, number, number],
  armRgb: [number, number, number],
  accentRgb: [number, number, number],
  arms = 2,
  tightness = 3.2
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const img = ctx.createImageData(size, size);
    const d = img.data;
    const half = size * 0.5;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - half) / half;
        const dy = (y - half) / half;
        const dist = Math.hypot(dx, dy);
        if (dist >= 1.0) continue;

        const angle = Math.atan2(dy, dx);
        const logR = Math.log(dist + 0.065);
        const spiralPhase = angle * arms - logR * tightness * arms;
        const armWave = Math.pow(0.5 + 0.5 * Math.cos(spiralPhase), 2.1);
        const subArm = Math.pow(0.5 + 0.5 * Math.cos(spiralPhase * 2.0 + 0.7), 3.0) * 0.35;

        const dustNoise = fbm2D(dx * 5.5 + 11.2, dy * 5.5 + 4.7, 4);
        const starKnots = fbm2D(dx * 12.0 + 3.1, dy * 12.0 + 8.9, 3);

        const bulge = Math.exp(-dist * dist * 24.0);
        const innerDisk = Math.exp(-dist * 3.4);
        const edgeFade = Math.max(0, 1.0 - dist);

        const armGlow =
          (armWave + subArm) *
          innerDisk *
          Math.pow(edgeFade, 0.85) *
          (0.55 + dustNoise * 0.85);
        const knotBoost =
          starKnots > 0.58 ? (starKnots - 0.58) * 1.9 * armWave * innerDisk * edgeFade : 0;

        const totalIntensity = Math.min(1, bulge * 1.15 + armGlow * 0.95 + knotBoost * 0.75);

        const rCol =
          coreRgb[0] * bulge +
          armRgb[0] * armGlow * (1 - bulge * 0.6) +
          accentRgb[0] * knotBoost;
        const gCol =
          coreRgb[1] * bulge +
          armRgb[1] * armGlow * (1 - bulge * 0.6) +
          accentRgb[1] * knotBoost;
        const bCol =
          coreRgb[2] * bulge +
          armRgb[2] * armGlow * (1 - bulge * 0.6) +
          accentRgb[2] * knotBoost;

        const idx = (y * size + x) * 4;
        d[idx] = Math.min(255, Math.round(rCol));
        d[idx + 1] = Math.min(255, Math.round(gCol));
        d[idx + 2] = Math.min(255, Math.round(bCol));
        d[idx + 3] = Math.min(255, Math.round(totalIntensity * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPlanetAtmosphereTexture(
  maxAnisotropy: number,
  rgb: [number, number, number]
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size * 0.5;
    const grad = ctx.createRadialGradient(half, half, half * 0.25, half, half, half);
    grad.addColorStop(0.0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.0)`);
    grad.addColorStop(0.55, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.36)`);
    grad.addColorStop(0.76, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.14)`);
    grad.addColorStop(1.0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// =========================================================
// ANIMATED SHOOTING STARS / METEORS
// =========================================================
interface ShootingStarTrack {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  arcLift: THREE.Vector3;
  cycleDuration: number;
  activeDuration: number;
  phaseOffset: number;
  baseLength: number;
}

const _tmpPos = new THREE.Vector3();
const _tmpNext = new THREE.Vector3();

function evaluateArcPoint(
  out: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
  lift: THREE.Vector3,
  t: number
): THREE.Vector3 {
  out.lerpVectors(start, end, t);
  const arch = Math.sin(t * Math.PI);
  out.addScaledVector(lift, arch);
  return out;
}

// =========================================================
// MAIN DEEP-SPACE COSMOS ENVIRONMENT BUILDER
// =========================================================
export function buildSpaceCosmosEnvironment(
  maxAnisotropy: number,
  disposables: Disposable[]
): {
  group: THREE.Group;
  updateSpace: (elapsed: number) => void;
} {
  const group = new THREE.Group();

  // 1. Brushed dark basalt/titanium orbital platform under turntable (top flush at y=0)
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

  // Subtle brass & glowing beacon cleats around orbital platform perimeter (below y=0)
  const cleatGeo = new THREE.BoxGeometry(0.28, 0.08, 0.16);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x99d9ff,
    emissive: 0x52b8ff,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const beaconGeo = new THREE.SphereGeometry(0.036, 10, 8);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.26;
    const cx = Math.cos(ang) * 3.32;
    const cz = Math.sin(ang) * 3.32;
    const cleat = new THREE.Mesh(cleatGeo, padMat);
    cleat.position.set(cx, -0.055, cz);
    cleat.rotation.y = -ang;
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(Math.cos(ang) * 3.44, -0.015, Math.sin(ang) * 3.44);
    group.add(cleat, beacon);
  }

  // Subtle underside orbital stabilizer ring so viewing from below looks finished
  const underRingGeo = new THREE.TorusGeometry(1.85, 0.032, 10, 48);
  underRingGeo.rotateX(Math.PI / 2);
  const underRingMat = new THREE.MeshStandardMaterial({
    color: 0x7fd4ff,
    emissive: 0x3b9eff,
    emissiveIntensity: 1.2,
    roughness: 0.25,
    metalness: 0.6,
  });
  const underRing = new THREE.Mesh(underRingGeo, underRingMat);
  underRing.position.y = -0.145;
  group.add(underRing);

  disposables.push(
    padGeo,
    padMat,
    rimGeo,
    rimMat,
    cleatGeo,
    beaconMat,
    beaconGeo,
    underRingGeo,
    underRingMat
  );

  // 2. Twinkling Multi-Spectral 3D Starfield distributed uniformly across the ENTIRE sphere (top & bottom)
  const starCount = 3200;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhases = new Float32Array(starCount);
  const starSpeeds = new Float32Array(starCount);

  const starPalette = [
    new THREE.Color(0xc2dcff), // O/B blue-white
    new THREE.Color(0xf6f8ff), // A/F white
    new THREE.Color(0xffe7bd), // G/K warm gold
    new THREE.Color(0xffc99c), // K/M amber
    new THREE.Color(0xe6d4ff), // violet-tinted faint star
  ];

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    // Uniform spherical distribution across all 3D directions (-1..+1)
    const sinElev = -1.0 + Math.random() * 2.0;
    const cosElev = Math.sqrt(Math.max(0, 1 - sinElev * sinElev));
    const r = 152 + Math.random() * 46;

    starPos[i * 3] = r * cosElev * Math.cos(theta);
    starPos[i * 3 + 1] = r * sinElev;
    starPos[i * 3 + 2] = r * cosElev * Math.sin(theta);

    const col = starPalette[i % starPalette.length];
    const brightness = 0.62 + Math.random() * 0.38;
    starCol[i * 3] = col.r * brightness;
    starCol[i * 3 + 1] = col.g * brightness;
    starCol[i * 3 + 2] = col.b * brightness;

    const isHeroStar = Math.random() < 0.08;
    starSizes[i] = isHeroStar ? 5.8 + Math.random() * 4.0 : 1.8 + Math.random() * 2.8;
    starPhases[i] = Math.random() * Math.PI * 2;
    starSpeeds[i] = 0.9 + Math.random() * 2.4;
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
        float twinkle = 0.68 + 0.32 * sin(uTime * aSpeed + aPhase);
        vColor = aColor;
        vAlpha = 0.72 + 0.28 * twinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (0.85 + 0.22 * twinkle);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv) * 2.0;
        if (d > 1.0) discard;
        float core = exp(-d * d * 7.5) + smoothstep(0.65, 0.0, d) * 0.38;
        // Subtle 4-point diffraction sparkle on brightest cores
        float crossSpark = exp(-abs(uv.x) * 18.0) * exp(-abs(uv.y) * 5.0)
                         + exp(-abs(uv.y) * 18.0) * exp(-abs(uv.x) * 5.0);
        float glow = core + crossSpark * 0.22 * smoothstep(1.0, 0.2, d);
        gl_FragColor = vec4(vColor, vAlpha * clamp(glow, 0.0, 1.0));
      }
    `,
  });

  const starField = new THREE.Points(starGeo, starMat);
  group.add(starField);
  disposables.push(starGeo, starMat);

  // 3. Layered Volumetric-Style Cosmic Nebulae (3 regional nebula complexes)
  const nebVioletTex = createNebulaCloudTexture(maxAnisotropy, [238, 125, 255], [98, 42, 185], 1.7);
  const nebTealTex = createNebulaCloudTexture(maxAnisotropy, [120, 232, 255], [32, 86, 165], 6.4);
  const nebAmberTex = createNebulaCloudTexture(maxAnisotropy, [255, 192, 118], [168, 66, 98], 12.3);
  disposables.push(nebVioletTex, nebTealTex, nebAmberTex);

  const nebulaCluster = new THREE.Group();
  const nebulaConfigs: Array<{
    pos: [number, number, number];
    scale: number;
    tex: THREE.CanvasTexture;
    opacity: number;
    rot: number;
  }> = [
    // Orion/Carina Veil behind & flanking the ringed gas giant (-X, -Z)
    { pos: [-66, 26, -108], scale: 96, tex: nebVioletTex, opacity: 0.26, rot: 0.3 },
    { pos: [-52, 18, -116], scale: 82, tex: nebTealTex, opacity: 0.22, rot: 1.4 },
    { pos: [-78, 34, -96], scale: 76, tex: nebAmberTex, opacity: 0.19, rot: -0.8 },
    // Rose-Gold & Cyan Pillar Nebula across opposite horizon (+X, +Z)
    { pos: [68, 28, 96], scale: 94, tex: nebAmberTex, opacity: 0.24, rot: 0.9 },
    { pos: [54, 38, 108], scale: 84, tex: nebVioletTex, opacity: 0.21, rot: -1.2 },
    { pos: [82, 19, 82], scale: 74, tex: nebTealTex, opacity: 0.19, rot: 2.1 },
    // Overhead Milky Way Cosmic Rift
    { pos: [-8, 86, -42], scale: 110, tex: nebTealTex, opacity: 0.16, rot: 0.6 },
    { pos: [18, 82, 24], scale: 105, tex: nebVioletTex, opacity: 0.15, rot: -0.5 },
    { pos: [-34, 72, 32], scale: 88, tex: nebAmberTex, opacity: 0.14, rot: 1.8 },
    // Lower-Hemisphere & Below-Platform Cosmic Nebulae (eliminates dark void underneath!)
    { pos: [-16, -46, -98], scale: 98, tex: nebTealTex, opacity: 0.24, rot: -0.4 },
    { pos: [14, -54, -84], scale: 90, tex: nebVioletTex, opacity: 0.23, rot: 1.1 },
    { pos: [62, -32, -58], scale: 84, tex: nebAmberTex, opacity: 0.19, rot: -1.7 },
    { pos: [-68, -28, 46], scale: 92, tex: nebVioletTex, opacity: 0.22, rot: 0.7 },
    { pos: [-54, -44, 62], scale: 80, tex: nebTealTex, opacity: 0.2, rot: 2.3 },
    { pos: [48, -48, 72], scale: 94, tex: nebAmberTex, opacity: 0.21, rot: -0.9 },
    { pos: [8, -88, -14], scale: 116, tex: nebVioletTex, opacity: 0.22, rot: 0.2 },
    { pos: [-28, -84, 26], scale: 106, tex: nebTealTex, opacity: 0.2, rot: -1.5 },
    { pos: [34, -82, 18], scale: 96, tex: nebAmberTex, opacity: 0.17, rot: 1.6 },
  ];

  nebulaConfigs.forEach((cfg) => {
    const sMat = new THREE.SpriteMaterial({
      map: cfg.tex,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      rotation: cfg.rot,
    });
    const sp = new THREE.Sprite(sMat);
    sp.position.set(...cfg.pos);
    sp.scale.set(cfg.scale, cfg.scale * 0.72, 1);
    nebulaCluster.add(sp);
    disposables.push(sMat);
  });
  group.add(nebulaCluster);

  // 4. Distant 3D Spiral Galaxies (with rotating spiral disks + 3D star-cluster particle halos)
  const spiralAndromedaTex = createSpiralGalaxyTexture(
    maxAnisotropy,
    [255, 224, 168],
    [118, 168, 255],
    [255, 130, 210],
    2,
    3.1
  );
  const spiralCrimsonTex = createSpiralGalaxyTexture(
    maxAnisotropy,
    [255, 214, 155],
    [225, 128, 196],
    [130, 215, 255],
    3,
    2.6
  );
  const spiralGoldenTex = createSpiralGalaxyTexture(
    maxAnisotropy,
    [255, 232, 185],
    [235, 165, 105],
    [165, 210, 255],
    2,
    3.8
  );
  disposables.push(spiralAndromedaTex, spiralCrimsonTex, spiralGoldenTex);

  const galaxyDisks: Array<{ disk: THREE.Object3D; speed: number }> = [];
  const galaxyPlaneGeo = new THREE.PlaneGeometry(1, 1);
  disposables.push(galaxyPlaneGeo);

  const createGalaxy = (
    pos: [number, number, number],
    tiltEuler: [number, number, number],
    size: number,
    tex: THREE.CanvasTexture,
    spinSpeed: number,
    starTintHex: number
  ) => {
    const gRoot = new THREE.Group();
    gRoot.position.set(...pos);
    gRoot.rotation.set(...tiltEuler);

    const diskGroup = new THREE.Group();
    const gMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    const diskMesh = new THREE.Mesh(galaxyPlaneGeo, gMat);
    diskMesh.scale.set(size, size, 1);
    diskGroup.add(diskMesh);
    disposables.push(gMat);

    // Subtle 3D star-cluster points matching spiral arms for crisp depth
    const ptsCount = 160;
    const pGeo = new THREE.BufferGeometry();
    const pArr = new Float32Array(ptsCount * 3);
    for (let i = 0; i < ptsCount; i++) {
      const arm = i % 2;
      const frac = Math.pow(Math.random(), 0.72);
      const rad = frac * size * 0.44;
      const angle = arm * Math.PI + frac * 4.4 + (Math.random() - 0.5) * 0.75;
      pArr[i * 3] = Math.cos(angle) * rad;
      pArr[i * 3 + 1] = Math.sin(angle) * rad;
      pArr[i * 3 + 2] = (Math.random() - 0.5) * size * 0.035;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
    const pMat = new THREE.PointsMaterial({
      color: starTintHex,
      size: 0.52,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const gPts = new THREE.Points(pGeo, pMat);
    diskGroup.add(gPts);
    disposables.push(pGeo, pMat);

    gRoot.add(diskGroup);
    group.add(gRoot);
    galaxyDisks.push({ disk: diskGroup, speed: spinSpeed });
  };

  // Grand Andromeda-style Blue/Gold Spiral Galaxy (upper front-right sky)
  createGalaxy([48, 34, -104], [-0.92, 0.38, 0.42], 46, spiralAndromedaTex, 0.012, 0xd8e8ff);
  // Rose-Violet 3-Arm Spiral Galaxy (upper rear-left sky)
  createGalaxy([-62, 42, 92], [1.05, -0.45, -0.35], 40, spiralCrimsonTex, -0.014, 0xffd2f2);
  // Nearly Edge-On Golden Dust-Lane Galaxy (far left-mid sky)
  createGalaxy([-105, 22, -26], [1.36, 0.25, 0.85], 34, spiralGoldenTex, 0.01, 0xffe4b8);
  // Lower-Hemisphere Whirlpool Spiral Galaxy (visible downward past the platform)
  createGalaxy([-22, -52, -92], [0.68, -0.32, 0.28], 44, spiralAndromedaTex, -0.013, 0xcbe4ff);
  // Deep-Field Southern Amber/Violet Galaxy (lower right-rear sky)
  createGalaxy([56, -48, 72], [-0.74, 0.52, -0.44], 38, spiralCrimsonTex, 0.015, 0xffe0c4);

  // 5. Animated Shooting Stars / Meteors across the background cosmos
  const streakGeo = new THREE.ConeGeometry(0.32, 16.5, 10, 1, true);
  // Orient so tip (head) points along +Z and wide tail trails behind at -Z
  streakGeo.rotateX(Math.PI / 2);
  disposables.push(streakGeo);

  const shootingStars: ShootingStarTrack[] = [];
  const meteorSpecs: Array<{
    start: [number, number, number];
    end: [number, number, number];
    lift: [number, number, number];
    cycle: number;
    active: number;
    offset: number;
    length: number;
    headColor: number;
    tailColor: number;
  }> = [
    {
      start: [-88, 62, -92],
      end: [38, 22, -118],
      lift: [-4, 11, 2],
      cycle: 7.4,
      active: 1.15,
      offset: 0.6,
      length: 1.05,
      headColor: 0xffffff,
      tailColor: 0x7fd8ff,
    },
    {
      start: [94, 54, -68],
      end: [14, 18, -124],
      lift: [2, 9, -4],
      cycle: 9.2,
      active: 1.05,
      offset: 2.9,
      length: 0.9,
      headColor: 0xfff3d6,
      tailColor: 0xffa75e,
    },
    {
      start: [-28, 78, -108],
      end: [-98, 24, -44],
      lift: [-6, 10, 4],
      cycle: 8.6,
      active: 1.25,
      offset: 5.1,
      length: 1.15,
      headColor: 0xeaf6ff,
      tailColor: 0xb68cff,
    },
    {
      start: [78, 68, 78],
      end: [-24, 28, 114],
      lift: [4, 12, -3],
      cycle: 10.4,
      active: 1.2,
      offset: 1.8,
      length: 1.0,
      headColor: 0xffffff,
      tailColor: 0x86e8ff,
    },
    {
      start: [-92, 52, 62],
      end: [-22, 16, 118],
      lift: [-3, 9, 4],
      cycle: 8.1,
      active: 1.0,
      offset: 6.4,
      length: 0.85,
      headColor: 0xfff0d4,
      tailColor: 0xf48cff,
    },
    {
      start: [42, 86, -42],
      end: [108, 30, 38],
      lift: [6, 10, 2],
      cycle: 11.3,
      active: 1.15,
      offset: 4.0,
      length: 0.95,
      headColor: 0xffffff,
      tailColor: 0x76cfff,
    },
    {
      start: [-56, 44, -104],
      end: [26, 58, -96],
      lift: [0, 8, -2],
      cycle: 6.9,
      active: 0.95,
      offset: 3.6,
      length: 0.82,
      headColor: 0xfff5de,
      tailColor: 0xffc07a,
    },
    {
      start: [102, 46, -12],
      end: [48, 20, 98],
      lift: [5, 11, 3],
      cycle: 9.8,
      active: 1.18,
      offset: 7.5,
      length: 1.05,
      headColor: 0xe6f8ff,
      tailColor: 0x80d8ff,
    },
    // Lower-hemisphere & downward-view shooting stars
    {
      start: [-74, -26, -86],
      end: [46, -54, -92],
      lift: [-2, -8, -4],
      cycle: 7.8,
      active: 1.12,
      offset: 1.2,
      length: 1.05,
      headColor: 0xffffff,
      tailColor: 0x7cd8ff,
    },
    {
      start: [86, -18, -62],
      end: [-18, -64, -104],
      lift: [4, -10, -2],
      cycle: 8.9,
      active: 1.15,
      offset: 4.4,
      length: 1.0,
      headColor: 0xfff3d8,
      tailColor: 0xffa868,
    },
    {
      start: [-82, -38, 56],
      end: [24, -68, 92],
      lift: [-4, -9, 3],
      cycle: 9.5,
      active: 1.1,
      offset: 2.3,
      length: 0.95,
      headColor: 0xeaf6ff,
      tailColor: 0xc48cff,
    },
    {
      start: [64, -44, 88],
      end: [94, -12, -36],
      lift: [6, -8, 2],
      cycle: 10.6,
      active: 1.2,
      offset: 6.1,
      length: 1.08,
      headColor: 0xffffff,
      tailColor: 0x76e6ff,
    },
  ];

  meteorSpecs.forEach((spec) => {
    const mMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: {
        uAlpha: { value: 0 },
        uHeadColor: { value: new THREE.Color(spec.headColor) },
        uTailColor: { value: new THREE.Color(spec.tailColor) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        void main() {
          vUv = uv;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        uniform vec3 uHeadColor;
        uniform vec3 uTailColor;
        varying vec2 vUv;
        varying vec3 vNormalView;

        void main() {
          // ConeGeometry uv.y = 1 at tip (head), 0 at base (tail)
          float t = clamp(vUv.y, 0.0001, 1.0);
          float trail = pow(t, 3.0) * smoothstep(1.0, 0.91, t);
          float headFlash = exp(-pow(abs(t - 0.93) * 16.0, 2.0)) * 2.2;
          float viewSoft = pow(max(abs(vNormalView.z), 0.0001), 0.75);
          float intensity = (trail + headFlash) * viewSoft * uAlpha;
          vec3 col = mix(uTailColor, uHeadColor, smoothstep(0.45, 0.96, t));
          gl_FragColor = vec4(col, clamp(intensity, 0.0, 1.0));
        }
      `,
    });

    const mesh = new THREE.Mesh(streakGeo, mMat);
    mesh.visible = false;
    group.add(mesh);
    disposables.push(mMat);

    shootingStars.push({
      mesh,
      mat: mMat,
      startPos: new THREE.Vector3(...spec.start),
      endPos: new THREE.Vector3(...spec.end),
      arcLift: new THREE.Vector3(...spec.lift),
      cycleDuration: spec.cycle,
      activeDuration: spec.active,
      phaseOffset: spec.offset,
      baseLength: spec.length,
    });
  });

  // 6. Textured Gas Giant Planet + Concentric Multi-Band Rings + Atmosphere Glow + Orbiting Moons
  const spacePlanetGroup = new THREE.Group();
  spacePlanetGroup.position.set(-19, 10.5, -36);

  const planetTex = createGasGiantTexture(maxAnisotropy);
  const planetGeo = new THREE.SphereGeometry(4.4, 40, 28);
  const planetMat = new THREE.MeshStandardMaterial({
    map: planetTex,
    roughness: 0.78,
    metalness: 0.06,
    fog: false,
  });
  const planet = new THREE.Mesh(planetGeo, planetMat);
  spacePlanetGroup.add(planet);

  const planetAtmoTex = createPlanetAtmosphereTexture(maxAnisotropy, [242, 174, 118]);
  const planetAtmoMat = new THREE.SpriteMaterial({
    map: planetAtmoTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const planetAtmo = new THREE.Sprite(planetAtmoMat);
  planetAtmo.scale.set(14.5, 14.5, 1);
  spacePlanetGroup.add(planetAtmo);

  const ringTex = createPlanetaryRingTexture(maxAnisotropy);
  const ringGeo = new THREE.RingGeometry(5.6, 9.8, 72);
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
    fog: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  spacePlanetGroup.add(ring);

  // Two small icy shepherd moons orbiting outside the rings
  const miniMoonGeo = new THREE.SphereGeometry(0.32, 16, 12);
  const miniMoonMat = new THREE.MeshStandardMaterial({
    color: 0xd9e3f5,
    roughness: 0.8,
    fog: false,
  });
  const miniMoonA = new THREE.Mesh(miniMoonGeo, miniMoonMat);
  const miniMoonB = new THREE.Mesh(miniMoonGeo, miniMoonMat);
  miniMoonB.scale.setScalar(0.68);
  spacePlanetGroup.add(miniMoonA, miniMoonB);

  group.add(spacePlanetGroup);
  disposables.push(
    planetTex,
    planetGeo,
    planetMat,
    planetAtmoTex,
    planetAtmoMat,
    ringTex,
    ringGeo,
    ringMat,
    miniMoonGeo,
    miniMoonMat
  );

  // 7. Cratered Lunar Moon + Soft Halo
  const { map: moonMap, bumpMap: moonBump } = createMoonTextures(maxAnisotropy);
  const moonGeo = new THREE.SphereGeometry(1.9, 32, 24);
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonMap,
    bumpMap: moonBump,
    bumpScale: 0.08,
    roughness: 0.88,
    fog: false,
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(17, 13, -32);
  group.add(moon);

  const moonGlowTex = createPlanetAtmosphereTexture(maxAnisotropy, [165, 200, 255]);
  const moonGlowMat = new THREE.SpriteMaterial({
    map: moonGlowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const moonGlow = new THREE.Sprite(moonGlowMat);
  moonGlow.position.copy(moon.position);
  moonGlow.scale.set(6.8, 6.8, 1);
  group.add(moonGlow);

  disposables.push(moonMap, moonBump, moonGeo, moonMat, moonGlowTex, moonGlowMat);

  // Distant Ice-Blue Exoplanet in the lower cosmos so looking downward reveals worlds below too
  const icePlanetGeo = new THREE.SphereGeometry(2.6, 28, 20);
  const icePlanetMat = new THREE.MeshStandardMaterial({
    color: 0x5ca8e6,
    emissive: 0x183c6b,
    emissiveIntensity: 0.45,
    roughness: 0.62,
    metalness: 0.1,
    fog: false,
  });
  const icePlanet = new THREE.Mesh(icePlanetGeo, icePlanetMat);
  icePlanet.position.set(28, -19, -48);
  group.add(icePlanet);

  const iceGlowTex = createPlanetAtmosphereTexture(maxAnisotropy, [110, 200, 255]);
  const iceGlowMat = new THREE.SpriteMaterial({
    map: iceGlowTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const iceGlow = new THREE.Sprite(iceGlowMat);
  iceGlow.position.copy(icePlanet.position);
  iceGlow.scale.set(9.2, 9.2, 1);
  group.add(iceGlow);
  disposables.push(icePlanetGeo, icePlanetMat, iceGlowTex, iceGlowMat);

  // Additional Diverse Planets across all 360° quadrants (upper, mid, lower)
  const extraPlanets: Array<{ mesh: THREE.Mesh; speed: number }> = [];

  const addAtmosphericPlanet = (
    kind: PlanetSurfaceKind,
    radius: number,
    pos: [number, number, number],
    haloRgb: [number, number, number],
    haloScale: number,
    spinSpeed: number,
    tiltZ = 0.15
  ): THREE.Group => {
    const pGroup = new THREE.Group();
    pGroup.position.set(...pos);
    pGroup.rotation.z = tiltZ;

    const tex = createProceduralPlanetTexture(maxAnisotropy, kind);
    const geo = new THREE.SphereGeometry(radius, 32, 22);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.72,
      metalness: 0.06,
      fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    pGroup.add(mesh);

    const hTex = createPlanetAtmosphereTexture(maxAnisotropy, haloRgb);
    const hMat = new THREE.SpriteMaterial({
      map: hTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const halo = new THREE.Sprite(hMat);
    halo.scale.set(haloScale, haloScale, 1);
    pGroup.add(halo);

    group.add(pGroup);
    disposables.push(tex, geo, mat, hTex, hMat);
    extraPlanets.push({ mesh, speed: spinSpeed });
    return pGroup;
  };

  // A) Terran Ocean/Cloud World (+X, +Z) with a small orbiting moonlet
  const terranGroup = addAtmosphericPlanet('terran', 3.0, [34, 10, 26], [118, 196, 255], 10.6, 0.032, 0.22);
  const terranMoonGeo = new THREE.SphereGeometry(0.42, 16, 12);
  const terranMoonMat = new THREE.MeshStandardMaterial({ color: 0xd4dae4, roughness: 0.86, fog: false });
  const terranMoon = new THREE.Mesh(terranMoonGeo, terranMoonMat);
  terranGroup.add(terranMoon);
  disposables.push(terranMoonGeo, terranMoonMat);

  // B) Crimson Rust Mars-like Planet (-X, -Y, +Z)
  addAtmosphericPlanet('crimson', 2.65, [-36, -15, 29], [255, 134, 92], 9.4, 0.028, -0.18);

  // C) Teal Banded Ice Giant with delicate tilted cyan ice ring (-X, +Y, +Z)
  const tealGroup = addAtmosphericPlanet('tealGiant', 3.25, [-38, 17, 15], [105, 238, 245], 11.4, 0.045, 0.34);
  const tealRingGeo = new THREE.RingGeometry(4.2, 6.2, 56);
  tealRingGeo.rotateX(Math.PI * 0.44);
  const tealRingMat = new THREE.MeshBasicMaterial({
    color: 0x86e8f2,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const tealRing = new THREE.Mesh(tealRingGeo, tealRingMat);
  tealGroup.add(tealRing);
  disposables.push(tealRingGeo, tealRingMat);

  // D) Deep-Space Violet Marbled Exoplanet in lower cosmos
  addAtmosphericPlanet('violet', 2.35, [-14, -32, 42], [218, 128, 255], 8.8, 0.038, -0.25);

  // 7B. EASTER EGG: Rare Deep-Space Cruiser / Spaceship Flyby (appears ~every 38s)
  const shipGroup = new THREE.Group();
  shipGroup.visible = false;

  const hullAlloyMat = new THREE.MeshStandardMaterial({
    color: 0xdbe3ee,
    roughness: 0.26,
    metalness: 0.85,
    flatShading: true,
    fog: false,
  });
  const hullDarkMat = new THREE.MeshStandardMaterial({
    color: 0x262d3d,
    roughness: 0.42,
    metalness: 0.72,
    flatShading: true,
    fog: false,
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x58c8ff,
    emissive: 0x164a78,
    emissiveIntensity: 0.75,
    roughness: 0.12,
    metalness: 0.2,
    clearcoat: 1.0,
    fog: false,
  });
  const thrusterMat = new THREE.MeshBasicMaterial({
    color: 0x7ae6ff,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const navRedMat = new THREE.MeshBasicMaterial({ color: 0xff5a6e, fog: false });
  const navCyanMat = new THREE.MeshBasicMaterial({ color: 0x62f2ff, fog: false });

  // Sleek tapered fuselage pointing forward along +Z
  const fuselageGeo = new THREE.ConeGeometry(0.46, 2.8, 8);
  fuselageGeo.rotateX(Math.PI / 2);
  fuselageGeo.scale(1.25, 0.68, 1.0);
  const fuselage = new THREE.Mesh(fuselageGeo, hullAlloyMat);
  shipGroup.add(fuselage);

  const aftHullGeo = new THREE.CylinderGeometry(0.45, 0.36, 1.15, 8);
  aftHullGeo.rotateX(Math.PI / 2);
  aftHullGeo.scale(1.25, 0.7, 1.0);
  const aftHull = new THREE.Mesh(aftHullGeo, hullDarkMat);
  aftHull.position.z = -1.1;
  shipGroup.add(aftHull);

  // Tinted glass cockpit canopy
  const canopyGeo = new THREE.SphereGeometry(0.28, 10, 8);
  canopyGeo.scale(0.95, 0.62, 1.85);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.21, 0.25);
  shipGroup.add(canopy);

  // Swept delta wings + dorsal fin
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.2, 0.15);
  wingShape.lineTo(1.75, -0.95);
  wingShape.lineTo(1.62, -1.32);
  wingShape.lineTo(0.2, -1.05);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });
  wingGeo.rotateX(Math.PI / 2);
  wingGeo.translate(0, 0.03, 0);

  const rightWing = new THREE.Mesh(wingGeo, hullAlloyMat);
  rightWing.position.set(0, 0, -0.2);
  const leftWing = new THREE.Mesh(wingGeo, hullAlloyMat);
  leftWing.rotation.z = Math.PI;
  leftWing.position.set(0, 0, -0.2);
  shipGroup.add(rightWing, leftWing);

  const finGeo = new THREE.BoxGeometry(0.06, 0.52, 0.75);
  const fin = new THREE.Mesh(finGeo, hullDarkMat);
  fin.position.set(0, 0.32, -1.18);
  fin.rotation.x = -0.36;
  shipGroup.add(fin);

  // Wingtip navigation beacons
  const tipLightGeo = new THREE.SphereGeometry(0.065, 8, 6);
  const leftBeacon = new THREE.Mesh(tipLightGeo, navRedMat);
  leftBeacon.position.set(-1.7, 0.0, -1.25);
  const rightBeacon = new THREE.Mesh(tipLightGeo, navCyanMat);
  rightBeacon.position.set(1.7, 0.0, -1.25);
  shipGroup.add(leftBeacon, rightBeacon);

  // Twin rear ion thruster pods & glowing plasma exhaust cones
  const podGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.72, 8);
  podGeo.rotateX(Math.PI / 2);
  const plumeGeo = new THREE.ConeGeometry(0.15, 1.85, 8, 1, true);
  plumeGeo.rotateX(-Math.PI / 2); // cone tip points backward (-Z)
  plumeGeo.translate(0, 0, -0.92);

  const plumes: THREE.Mesh[] = [];
  [-0.36, 0.36].forEach((px) => {
    const pod = new THREE.Mesh(podGeo, hullDarkMat);
    pod.position.set(px, 0.02, -1.45);
    const plume = new THREE.Mesh(plumeGeo, thrusterMat);
    plume.position.set(px, 0.02, -1.78);
    shipGroup.add(pod, plume);
    plumes.push(plume);
  });

  // Soft thruster / warp-flash glow sprite behind ship
  const shipGlowTex = createPlanetAtmosphereTexture(maxAnisotropy, [105, 225, 255]);
  const shipGlowMat = new THREE.SpriteMaterial({
    map: shipGlowTex,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const shipGlow = new THREE.Sprite(shipGlowMat);
  shipGlow.position.set(0, 0.02, -1.9);
  shipGlow.scale.set(2.4, 2.4, 1);
  shipGroup.add(shipGlow);

  group.add(shipGroup);
  disposables.push(
    hullAlloyMat,
    hullDarkMat,
    canopyMat,
    thrusterMat,
    navRedMat,
    navCyanMat,
    fuselageGeo,
    aftHullGeo,
    canopyGeo,
    wingGeo,
    finGeo,
    tipLightGeo,
    podGeo,
    plumeGeo,
    shipGlowTex,
    shipGlowMat
  );

  const shipRoutes: Array<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    lift: THREE.Vector3;
    bank: number;
  }> = [
    {
      start: new THREE.Vector3(-46, 8, -28),
      end: new THREE.Vector3(48, 16, -24),
      lift: new THREE.Vector3(0, 7, 10),
      bank: -0.32,
    },
    {
      start: new THREE.Vector3(42, -12, -34),
      end: new THREE.Vector3(-42, 18, 22),
      lift: new THREE.Vector3(-8, 9, -8),
      bank: 0.35,
    },
    {
      start: new THREE.Vector3(-34, 14, 38),
      end: new THREE.Vector3(44, -6, -32),
      lift: new THREE.Vector3(10, 6, 4),
      bank: -0.28,
    },
  ];

  // 7C. EASTER EGG #2: Rocky's Eridian Starship ("Blip-A" from Project Hail Mary)
  const blipAGroup = new THREE.Group();
  blipAGroup.visible = false;

  const xenoniteDarkMat = new THREE.MeshStandardMaterial({
    color: 0x3b3532,
    emissive: 0x160e0a,
    roughness: 0.28,
    metalness: 0.62,
    flatShading: true,
    fog: false,
  });
  const xenoniteFacetMat = new THREE.MeshPhysicalMaterial({
    color: 0x6b6156,
    emissive: 0x22160c,
    roughness: 0.22,
    metalness: 0.45,
    clearcoat: 0.85,
    clearcoatRoughness: 0.2,
    flatShading: true,
    fog: false,
  });
  const astrophageMat = new THREE.MeshBasicMaterial({
    color: 0xff6b2b,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });

  // Massive wide trapezoidal/diamond aft Astrophage fuel base (facing -Z rear)
  const blipABaseGeo = new THREE.CylinderGeometry(0.46, 1.12, 1.35, 4);
  blipABaseGeo.rotateY(Math.PI / 4);
  blipABaseGeo.rotateX(Math.PI / 2);
  blipABaseGeo.scale(1.38, 0.72, 1.0);
  const blipABase = new THREE.Mesh(blipABaseGeo, xenoniteDarkMat);
  blipABase.position.z = -1.25;
  blipAGroup.add(blipABase);

  // Heavy structural xenonite truss rods connecting aft base to diamond midsection
  const strutGeo = new THREE.BoxGeometry(0.11, 0.11, 1.38);
  [
    [-0.38, 0.22, -0.1, -0.18],
    [0.38, 0.22, -0.1, 0.18],
    [-0.38, -0.22, 0.1, -0.18],
    [0.38, -0.22, 0.1, 0.18],
  ].forEach(([sx, sy, rx, ry]) => {
    const strut = new THREE.Mesh(strutGeo, xenoniteDarkMat);
    strut.position.set(sx, sy, -0.05);
    strut.rotation.set(rx, ry, 0);
    blipAGroup.add(strut);
  });

  // Faceted diamond / octahedral midsection (Eridian crew habitat)
  const blipAMidGeo = new THREE.OctahedronGeometry(0.72, 0);
  blipAMidGeo.scale(1.18, 0.78, 1.35);
  const blipAMid = new THREE.Mesh(blipAMidGeo, xenoniteFacetMat);
  blipAMid.position.z = 0.78;
  blipAGroup.add(blipAMid);

  // Narrow angular forward stalk + sharp pyramid nose cone pointing along +Z
  const stalkGeo = new THREE.BoxGeometry(0.18, 0.16, 0.95);
  const stalk = new THREE.Mesh(stalkGeo, xenoniteDarkMat);
  stalk.position.z = 1.75;
  blipAGroup.add(stalk);

  const noseGeo = new THREE.ConeGeometry(0.44, 0.92, 4);
  noseGeo.rotateY(Math.PI / 4);
  noseGeo.rotateX(Math.PI / 2);
  noseGeo.scale(1.1, 0.75, 1.0);
  const nose = new THREE.Mesh(noseGeo, xenoniteFacetMat);
  nose.position.z = 2.48;
  blipAGroup.add(nose);

  // Radial Eridian acoustic / xenonite spine-needle array around midsection & aft hull
  const spineGeo = new THREE.CylinderGeometry(0.008, 0.036, 1.45, 4);
  spineGeo.translate(0, 0.72, 0);
  const spineRings = [
    { z: 0.78, count: 10, scale: 1.0, tiltBack: 0.28 },
    { z: -0.95, count: 8, scale: 1.18, tiltBack: 0.42 },
  ];
  spineRings.forEach((sr, rIdx) => {
    for (let i = 0; i < sr.count; i++) {
      const ang = (i / sr.count) * Math.PI * 2 + rIdx * 0.35;
      const spine = new THREE.Mesh(spineGeo, xenoniteFacetMat);
      spine.position.set(Math.cos(ang) * 0.28, Math.sin(ang) * 0.22, sr.z);
      // Point radially outward + angled geometrically backward like crystalline acoustic needles
      spine.rotation.order = 'ZYX';
      spine.rotation.z = ang - Math.PI / 2;
      spine.rotation.x = -sr.tiltBack;
      const lenScale = sr.scale * (0.78 + ((i * 37) % 10) * 0.045);
      spine.scale.set(1, lenScale, 1);
      blipAGroup.add(spine);
    }
  });

  // Astrophage spin-drive crimson-amber emitters recessed across rear trapezoidal base
  const astroPlumeGeo = new THREE.ConeGeometry(0.24, 1.9, 6, 1, true);
  astroPlumeGeo.rotateX(-Math.PI / 2);
  astroPlumeGeo.translate(0, 0, -0.95);
  const astroPlumes: THREE.Mesh[] = [];
  [-0.58, 0, 0.58].forEach((ax) => {
    const ap = new THREE.Mesh(astroPlumeGeo, astrophageMat);
    ap.position.set(ax, 0, -1.92);
    blipAGroup.add(ap);
    astroPlumes.push(ap);
  });

  const astroGlowTex = createPlanetAtmosphereTexture(maxAnisotropy, [255, 118, 52]);
  const astroGlowMat = new THREE.SpriteMaterial({
    map: astroGlowTex,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const astroGlow = new THREE.Sprite(astroGlowMat);
  astroGlow.position.set(0, 0, -2.05);
  astroGlow.scale.set(3.4, 3.4, 1);
  blipAGroup.add(astroGlow);

  group.add(blipAGroup);
  disposables.push(
    xenoniteDarkMat,
    xenoniteFacetMat,
    astrophageMat,
    blipABaseGeo,
    strutGeo,
    blipAMidGeo,
    stalkGeo,
    noseGeo,
    spineGeo,
    astroPlumeGeo,
    astroGlowTex,
    astroGlowMat
  );

  const blipARoutes: Array<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    lift: THREE.Vector3;
  }> = [
    {
      start: new THREE.Vector3(48, 12, -32),
      end: new THREE.Vector3(-46, 16, -24),
      lift: new THREE.Vector3(0, 5, 8),
    },
    {
      start: new THREE.Vector3(-44, -18, -36),
      end: new THREE.Vector3(44, -8, 28),
      lift: new THREE.Vector3(-8, -4, -10),
    },
  ];

  // 8. Distant Drifting Deep-Space Asteroid Rocks (distributed above & below platform plane)
  const asteroidGeo = new THREE.DodecahedronGeometry(0.32, 0);
  const asteroidMat = new THREE.MeshStandardMaterial({
    color: 0x5c5869,
    roughness: 0.92,
    metalness: 0.14,
    flatShading: true,
  });
  const asteroidOrbitGroup = new THREE.Group();
  const asteroids: Array<{
    mesh: THREE.Mesh;
    radius: number;
    angle: number;
    speed: number;
    y: number;
    spinX: number;
    spinY: number;
  }> = [];

  for (let i = 0; i < 26; i++) {
    const aMesh = new THREE.Mesh(asteroidGeo, asteroidMat);
    const s = 0.45 + Math.random() * 1.15;
    aMesh.scale.set(s * (0.8 + Math.random() * 0.5), s * 0.75, s * (0.8 + Math.random() * 0.5));
    asteroidOrbitGroup.add(aMesh);
    asteroids.push({
      mesh: aMesh,
      radius: 17 + Math.random() * 24,
      angle: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.025,
      y: -14 + Math.random() * 28,
      spinX: (Math.random() - 0.5) * 0.6,
      spinY: (Math.random() - 0.5) * 0.8,
    });
  }
  group.add(asteroidOrbitGroup);
  disposables.push(asteroidGeo, asteroidMat);

  // =========================================================
  // ANIMATION LOOP
  // =========================================================
  const updateSpace = (elapsed: number): void => {
    starMat.uniforms.uTime.value = elapsed;
    starField.rotation.y = elapsed * 0.0045;
    nebulaCluster.rotation.y = elapsed * 0.003;

    // Gentle planet rotation + shepherd moon orbits
    planet.rotation.y = elapsed * 0.04;
    moon.rotation.y = elapsed * 0.025;
    icePlanet.rotation.y = elapsed * 0.03;
    for (let i = 0; i < extraPlanets.length; i++) {
      extraPlanets[i].mesh.rotation.y = elapsed * extraPlanets[i].speed;
    }
    terranMoon.position.set(
      Math.cos(elapsed * 0.32) * 5.1,
      Math.sin(elapsed * 0.32) * 1.1,
      Math.sin(elapsed * 0.32) * 5.1
    );
    miniMoonA.position.set(
      Math.cos(elapsed * 0.22) * 11.2,
      Math.sin(elapsed * 0.22) * 1.4,
      Math.sin(elapsed * 0.22) * 11.2
    );
    miniMoonB.position.set(
      Math.cos(-elapsed * 0.16 + 2.4) * 13.0,
      Math.sin(-elapsed * 0.16 + 2.4) * -2.2,
      Math.sin(-elapsed * 0.16 + 2.4) * 13.0
    );

    // Distant spiral galaxies slowly turning
    for (let i = 0; i < galaxyDisks.length; i++) {
      galaxyDisks[i].disk.rotation.z = elapsed * galaxyDisks[i].speed;
    }

    // Slow drifting asteroid belt
    for (let i = 0; i < asteroids.length; i++) {
      const a = asteroids[i];
      const ang = a.angle + elapsed * a.speed;
      a.mesh.position.set(Math.cos(ang) * a.radius, a.y + Math.sin(elapsed * 0.35 + i) * 0.35, Math.sin(ang) * a.radius);
      a.mesh.rotation.x = elapsed * a.spinX;
      a.mesh.rotation.y = elapsed * a.spinY;
    }

    // Shooting stars streaking across sky arcs on staggered cycles
    for (let i = 0; i < shootingStars.length; i++) {
      const s = shootingStars[i];
      const cyclePos = (elapsed + s.phaseOffset) % s.cycleDuration;
      if (cyclePos <= s.activeDuration) {
        const t = cyclePos / s.activeDuration;
        // Slight ease-out deceleration as meteor enters atmosphere/sky
        const easedT = 1 - Math.pow(1 - t, 1.45);
        evaluateArcPoint(_tmpPos, s.startPos, s.endPos, s.arcLift, easedT);
        evaluateArcPoint(_tmpNext, s.startPos, s.endPos, s.arcLift, Math.min(1, easedT + 0.025));

        s.mesh.visible = true;
        s.mesh.position.copy(_tmpPos);
        s.mesh.lookAt(_tmpNext);

        const lifeEnv = Math.sin(t * Math.PI);
        s.mesh.scale.set(1, 1, s.baseLength * (0.45 + lifeEnv * 0.75));
        s.mat.uniforms.uAlpha.value = Math.pow(lifeEnv, 0.75) * 1.15;
      } else {
        s.mesh.visible = false;
      }
    }

    // Rare Easter Egg: Spaceship flyby (~every 38s, first sighting at ~14s) with warp-jump exit
    const shipCycle = 38.0;
    const shipActive = 7.4;
    const shipTime = elapsed + 24.0;
    const shipPhase = shipTime % shipCycle;
    if (shipPhase <= shipActive) {
      const routeIdx = Math.floor(shipTime / shipCycle) % shipRoutes.length;
      const route = shipRoutes[routeIdx];
      const t = shipPhase / shipActive;
      const warpPhase = Math.max(0, (t - 0.88) / 0.12);
      const flightT = Math.min(1, t + warpPhase * warpPhase * 0.16);

      evaluateArcPoint(_tmpPos, route.start, route.end, route.lift, flightT);
      evaluateArcPoint(_tmpNext, route.start, route.end, route.lift, Math.min(1, flightT + 0.02));

      shipGroup.visible = true;
      shipGroup.position.copy(_tmpPos);
      shipGroup.lookAt(_tmpNext);
      shipGroup.rotateZ(route.bank * Math.sin(t * Math.PI));

      const entryScale = Math.min(1, t / 0.08);
      const warpStretch = 1.0 + warpPhase * warpPhase * 2.6;
      const warpPinch = Math.max(0.05, 1.0 - warpPhase * 0.85);
      shipGroup.scale.set(entryScale * warpPinch, entryScale * warpPinch, entryScale * warpStretch);

      const pulse = 0.88 + 0.24 * Math.sin(elapsed * 34.0);
      for (let p = 0; p < plumes.length; p++) {
        plumes[p].scale.set(1, 1, pulse + warpPhase * 1.4);
      }
      shipGlowMat.opacity = Math.min(1, (0.65 + warpPhase * 0.6) * entryScale * (1 - Math.pow(warpPhase, 3)));
      const glowSize = 2.4 + Math.sin(warpPhase * Math.PI) * 4.5;
      shipGlow.scale.set(glowSize, glowSize, 1);
    } else {
      shipGroup.visible = false;
    }

    // Rare Easter Egg #2: Rocky's Eridian "Blip-A" (Project Hail Mary) gliding majestically (~every 54s, first at ~24s)
    const blipACycle = 54.0;
    const blipAActive = 11.5;
    const blipATime = elapsed + 30.0;
    const blipAPhase = blipATime % blipACycle;
    if (blipAPhase <= blipAActive) {
      const routeIdx = Math.floor(blipATime / blipACycle) % blipARoutes.length;
      const route = blipARoutes[routeIdx];
      const t = blipAPhase / blipAActive;

      evaluateArcPoint(_tmpPos, route.start, route.end, route.lift, t);
      evaluateArcPoint(_tmpNext, route.start, route.end, route.lift, Math.min(1, t + 0.02));

      blipAGroup.visible = true;
      blipAGroup.position.copy(_tmpPos);
      blipAGroup.lookAt(_tmpNext);
      // Eridian ship rolls slowly & steadily along its axis in zero-g
      blipAGroup.rotateZ(elapsed * 0.14);

      const fadeScale = Math.min(1, t / 0.1) * Math.min(1, (1 - t) / 0.1);
      blipAGroup.scale.setScalar(1.38 * (0.25 + 0.75 * fadeScale));

      const astroPulse = 0.85 + 0.2 * Math.sin(elapsed * 18.0);
      for (let a = 0; a < astroPlumes.length; a++) {
        astroPlumes[a].scale.set(1, 1, astroPulse);
      }
      astroGlowMat.opacity = 0.78 * fadeScale;
    } else {
      blipAGroup.visible = false;
    }
  };

  return { group, updateSpace };
}
