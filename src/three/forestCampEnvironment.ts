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

const FLOOR_Y = -7.5;

function forestHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= 23.0) return FLOOR_Y;
  const blend = THREE.MathUtils.smoothstep(r, 23.0, 46.0);
  const roll =
    (fbm2D(x * 0.045 + 4, z * 0.045 + 4, 3) - 0.42) * 4.8 +
    Math.max(0, (r - 36) * 0.14);
  return FLOOR_Y + Math.max(-0.25, roll * blend);
}

function createForestFloorTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
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
        const nx = x / size;
        const ny = y / size;
        const n = fbm2D(nx * 10, ny * 10, 4);
        const fine = valueNoise2D(nx * 64, ny * 64);
        const idx = (y * size + x) * 4;

        const moss = Math.max(0, Math.min(1, n * 1.15));
        d[idx] = Math.round(30 + moss * 34 + fine * 12);
        d[idx + 1] = Math.round(45 + moss * 48 + fine * 14);
        d[idx + 2] = Math.round(23 + moss * 22 + fine * 8);
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

    for (let i = 0; i < 4500; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      ctx.strokeStyle =
        i % 3 === 0 ? 'rgba(115, 82, 48, 0.36)' : 'rgba(42, 74, 34, 0.42)';
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
  map.repeat.set(22, 22);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(22, 22);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createTimberPlankTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 512;
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
    ctx.fillStyle = '#6c492d';
    ctx.fillRect(0, 0, w, h);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, w, h);

    for (let i = 0; i < 420; i++) {
      const y = Math.random() * h;
      const dark = i % 2 === 0;
      ctx.strokeStyle = dark ? 'rgba(34, 20, 10, 0.24)' : 'rgba(154, 114, 78, 0.16)';
      ctx.lineWidth = 1 + Math.random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        w * 0.33,
        y + (Math.random() - 0.5) * 14,
        w * 0.66,
        y + (Math.random() - 0.5) * 14,
        w,
        y + (Math.random() - 0.5) * 6
      );
      ctx.stroke();

      bCtx.strokeStyle = dark ? 'rgba(48, 48, 48, 0.35)' : 'rgba(195, 195, 195, 0.22)';
      bCtx.lineWidth = 1.5;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(w, y);
      bCtx.stroke();
    }

    // Subtle knot rings
    for (let k = 0; k < 5; k++) {
      const kx = 60 + Math.random() * (w - 120);
      const ky = 50 + Math.random() * (h - 100);
      ctx.fillStyle = 'rgba(42, 24, 12, 0.38)';
      ctx.beginPath();
      ctx.ellipse(kx, ky, 14, 6, 0.1, 0, Math.PI * 2);
      ctx.fill();
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

function createPineBarkTextures(maxAnisotropy: number): {
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
    ctx.fillStyle = '#3d281b';
    ctx.fillRect(0, 0, 256, 512);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 256, 512);

    for (let i = 0; i < 420; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 512;
      const len = 24 + Math.random() * 78;
      const dark = i % 3 !== 0;
      ctx.strokeStyle = dark ? 'rgba(20, 12, 7, 0.6)' : 'rgba(98, 70, 50, 0.36)';
      ctx.lineWidth = 1.5 + Math.random() * 3.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 6, y + len);
      ctx.stroke();

      bCtx.strokeStyle = dark ? 'rgba(28, 28, 28, 0.68)' : 'rgba(218, 218, 218, 0.45)';
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
  map.repeat.set(2, 4);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 4);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createPineFoliageTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);

    const branches = 28;
    for (let b = 0; b < branches; b++) {
      const bx = (b / branches) * size;
      const bw = 22 + Math.random() * 12;
      ctx.strokeStyle = '#362719';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, 16);
      ctx.lineTo(bx + (Math.random() - 0.5) * 14, size - 14);
      ctx.stroke();

      for (let y = 20; y < size - 12; y += 3.2) {
        const spread = (y / size) * bw + 8;
        for (let side = -1; side <= 1; side += 2) {
          const tipX = bx + side * (spread * (0.65 + Math.random() * 0.45));
          const tipY = y + 8 + Math.random() * 14;
          const greenVar = Math.floor(Math.random() * 28);
          ctx.strokeStyle =
            y > size * 0.7
              ? `rgb(${32 + greenVar}, ${78 + greenVar}, ${44 + Math.floor(greenVar * 0.6)})`
              : `rgb(${20 + greenVar}, ${56 + greenVar}, ${32 + Math.floor(greenVar * 0.5)})`;
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

function createFernTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const bladeCount = 5;
  const segs = 3;
  const bladeH = 1.85;
  const baseW = 0.34;

  let vertOffset = 0;
  for (let b = 0; b < bladeCount; b++) {
    const yaw = (b / bladeCount) * Math.PI * 2 + (b - 1) * 0.18;
    const tilt = 0.72 + (b % 2) * 0.25;
    const ox = Math.cos(yaw) * 0.14;
    const oz = Math.sin(yaw) * 0.14;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = baseW * Math.sin(Math.max(0.08, t * Math.PI)) * (1 - t * 0.35);
      const y = Math.sin(t * Math.PI * 0.62) * bladeH;
      const curve = t * t * tilt;

      const lx = -w * 0.5;
      const rx = w * 0.5;

      const pxL = ox + lx * cosY - curve * sinY;
      const pzL = oz + lx * sinY + curve * cosY;
      const pxR = ox + rx * cosY - curve * sinY;
      const pzR = oz + rx * sinY + curve * cosY;

      positions.push(pxL, y, pzL, pxR, y, pzR);
      uvs.push(0, t, 1, t);
      normals.push(-sinY, 0.55, cosY, -sinY, 0.55, cosY);
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

// =========================================================
// 1. RUSTIC TIMBER FOREST PICNIC TABLE (1:1 Scale, Top y = -0.002)
// =========================================================
function buildForestPicnicTable(
  maxAnisotropy: number,
  disposables: Disposable[]
): THREE.Group {
  const table = new THREE.Group();
  const { map: woodMap, bumpMap: woodBump } = createTimberPlankTextures(maxAnisotropy);

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodMap,
    bumpMap: woodBump,
    bumpScale: 0.08,
    roughness: 0.84,
    metalness: 0.03,
  });
  const woodDarkMat = new THREE.MeshStandardMaterial({
    map: woodMap,
    bumpMap: woodBump,
    bumpScale: 0.08,
    color: 0xc2b09c,
    roughness: 0.88,
    metalness: 0.03,
  });
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x3b3f44,
    roughness: 0.42,
    metalness: 0.8,
  });

  // Tabletop: 5 thick weathered planks (~185 cm wide x 82 cm deep), top flush at y = -0.002
  const plankGeo = new THREE.BoxGeometry(18.6, 0.36, 1.54);
  const plankZ = [-3.24, -1.62, 0.0, 1.62, 3.24];
  plankZ.forEach((pz, idx) => {
    const plank = new THREE.Mesh(plankGeo, idx % 2 === 0 ? woodMat : woodDarkMat);
    plank.position.set(0, -0.182, pz);
    plank.castShadow = true;
    plank.receiveShadow = true;
    table.add(plank);
  });

  // Under-table cross battens
  const battenGeo = new THREE.BoxGeometry(0.45, 0.45, 7.6);
  [-6.6, 0, 6.6].forEach((bx) => {
    const batten = new THREE.Mesh(battenGeo, woodDarkMat);
    batten.position.set(bx, -0.58, 0);
    table.add(batten);
  });

  // Diagonal bracing struts under center
  const braceGeo = new THREE.BoxGeometry(0.32, 0.32, 6.6);
  [-6.6, 6.6].forEach((bx) => {
    const brace = new THREE.Mesh(braceGeo, woodDarkMat);
    brace.position.set(bx > 0 ? bx - 1.7 : bx + 1.7, -2.1, 0);
    brace.rotation.z = bx > 0 ? 0.56 : -0.56;
    table.add(brace);
  });

  // A-frame legs (from y = -0.38 down to FLOOR_Y = -7.5)
  const legGeo = new THREE.BoxGeometry(0.48, 8.9, 0.88);
  [-6.6, 6.6].forEach((lx) => {
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(legGeo, woodDarkMat);
      leg.position.set(lx, -3.94, side * 3.15);
      leg.rotation.x = side * -0.45;
      leg.castShadow = true;
      leg.receiveShadow = true;
      table.add(leg);
    });
  });

  // Bench support crossbars (sitting at y = -3.35)
  const supportBarGeo = new THREE.BoxGeometry(0.55, 0.58, 15.2);
  [-6.6, 6.6].forEach((lx) => {
    const bar = new THREE.Mesh(supportBarGeo, woodDarkMat);
    bar.position.set(lx, -3.38, 0);
    table.add(bar);
  });

  // Dual wooden benches on front & back sides (seat top at y = -2.74 -> 47.6 cm above forest floor)
  const benchPlankGeo = new THREE.BoxGeometry(18.6, 0.34, 1.42);
  [-6.7, -5.18, 5.18, 6.7].forEach((bz, idx) => {
    const bp = new THREE.Mesh(benchPlankGeo, idx % 2 === 0 ? woodMat : woodDarkMat);
    bp.position.set(0, -2.91, bz);
    bp.castShadow = true;
    bp.receiveShadow = true;
    table.add(bp);
  });

  // Galvanized carriage bolts along bench & leg joints
  const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8);
  [-6.6, 6.6].forEach((lx) => {
    [-6.7, -5.18, 5.18, 6.7].forEach((bz) => {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(lx, -2.72, bz);
      table.add(bolt);
    });
  });

  disposables.push(
    woodMap,
    woodBump,
    woodMat,
    woodDarkMat,
    boltMat,
    plankGeo,
    battenGeo,
    braceGeo,
    legGeo,
    supportBarGeo,
    benchPlankGeo,
    boltGeo
  );
  return table;
}

// =========================================================
// 2. CAMPING TABLETOP & BENCH PROPS (1:1 Scale)
// =========================================================
function buildTabletopCampProps(disposables: Disposable[]): THREE.Group {
  const props = new THREE.Group();

  // Warm Brass & Glass Camp Lantern (back-left on tabletop, grounded y = 0)
  const lantern = new THREE.Group();
  lantern.position.set(-6.4, 0, -2.15);

  const darkGreenMetal = new THREE.MeshStandardMaterial({
    color: 0x264430,
    roughness: 0.42,
    metalness: 0.55,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9964c,
    roughness: 0.28,
    metalness: 0.85,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff3de,
    roughness: 0.1,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffe09c,
    emissive: 0xffa63d,
    emissiveIntensity: 3.2,
  });

  const lBaseGeo = new THREE.CylinderGeometry(0.84, 0.94, 0.55, 22);
  const lBase = new THREE.Mesh(lBaseGeo, darkGreenMetal);
  lBase.position.y = 0.275;
  lBase.castShadow = true;
  lantern.add(lBase);

  const lGlassGeo = new THREE.CylinderGeometry(0.66, 0.66, 1.45, 22, 1, true);
  const lGlass = new THREE.Mesh(lGlassGeo, glassMat);
  lGlass.position.y = 1.25;
  lGlass.renderOrder = 3;
  lantern.add(lGlass);

  const lHatGeo = new THREE.ConeGeometry(0.95, 0.58, 22);
  const lHat = new THREE.Mesh(lHatGeo, darkGreenMetal);
  lHat.position.y = 2.26;
  lHat.castShadow = true;
  lantern.add(lHat);

  const lCoreGeo = new THREE.SphereGeometry(0.2, 10, 10);
  const lCore = new THREE.Mesh(lCoreGeo, flameMat);
  lCore.position.y = 1.1;
  lantern.add(lCore);

  const lBailGeo = new THREE.TorusGeometry(0.58, 0.04, 8, 20, Math.PI);
  const lBail = new THREE.Mesh(lBailGeo, brassMat);
  lBail.position.y = 2.48;
  lantern.add(lBail);

  const tableLanternGlow = new THREE.PointLight(0xffb45c, 14, 15, 1.5);
  tableLanternGlow.position.set(0, 1.25, 0);
  lantern.add(tableLanternGlow);
  props.add(lantern);

  // Insulated Olive-Green Camp Thermos (~28 cm tall, standing back-left)
  const thermos = new THREE.Group();
  thermos.position.set(-4.6, 0, -2.5);
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xc9cdd1,
    roughness: 0.24,
    metalness: 0.88,
  });
  const tBodyGeo = new THREE.CylinderGeometry(0.46, 0.48, 2.15, 22);
  const tBody = new THREE.Mesh(tBodyGeo, darkGreenMetal);
  tBody.position.y = 1.075;
  tBody.castShadow = true;
  thermos.add(tBody);

  const tShoulderGeo = new THREE.CylinderGeometry(0.32, 0.46, 0.28, 22);
  const tShoulder = new THREE.Mesh(tShoulderGeo, steelMat);
  tShoulder.position.y = 2.28;
  thermos.add(tShoulder);

  const tCapGeo = new THREE.CylinderGeometry(0.35, 0.34, 0.44, 22);
  const tCap = new THREE.Mesh(tCapGeo, steelMat);
  tCap.position.y = 2.64;
  tCap.castShadow = true;
  thermos.add(tCap);
  props.add(thermos);

  // Enamel Camping Mug with Coffee (front-right of turntable)
  const mug = new THREE.Group();
  mug.position.set(4.65, 0, 1.95);
  mug.rotation.y = -0.35;
  const enamelMat = new THREE.MeshStandardMaterial({
    color: 0x9e3226,
    roughness: 0.25,
    metalness: 0.15,
  });
  const coffeeMat = new THREE.MeshStandardMaterial({ color: 0x241309, roughness: 0.16 });
  const mBodyGeo = new THREE.CylinderGeometry(0.45, 0.43, 0.96, 22);
  const mBody = new THREE.Mesh(mBodyGeo, enamelMat);
  mBody.position.y = 0.48;
  mBody.castShadow = true;
  mug.add(mBody);

  const mRimGeo = new THREE.TorusGeometry(0.44, 0.038, 10, 24);
  mRimGeo.rotateX(Math.PI / 2);
  const mRim = new THREE.Mesh(mRimGeo, steelMat);
  mRim.position.y = 0.96;
  mug.add(mRim);

  const mHandleGeo = new THREE.TorusGeometry(0.24, 0.055, 8, 16, Math.PI);
  const mHandle = new THREE.Mesh(mHandleGeo, enamelMat);
  mHandle.position.set(0.43, 0.48, 0);
  mHandle.rotation.z = -Math.PI / 2;
  mug.add(mHandle);

  const mCoffeeGeo = new THREE.CircleGeometry(0.4, 20);
  mCoffeeGeo.rotateX(-Math.PI / 2);
  const mCoffee = new THREE.Mesh(mCoffeeGeo, coffeeMat);
  mCoffee.position.y = 0.93;
  mug.add(mCoffee);
  props.add(mug);

  // Folded Wool Blanket resting on the back-right corner of the tabletop
  const blanketMat = new THREE.MeshStandardMaterial({ color: 0x8f3e2d, roughness: 0.92 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd4a45a, roughness: 0.9 });
  const foldGeo = new THREE.BoxGeometry(3.4, 0.46, 2.4);
  const blanket = new THREE.Mesh(foldGeo, blanketMat);
  blanket.position.set(6.4, 0.23, -1.9);
  blanket.rotation.y = 0.22;
  blanket.castShadow = true;
  props.add(blanket);

  const stripeGeo = new THREE.BoxGeometry(3.44, 0.48, 0.34);
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.set(6.4, 0.24, -1.9);
  stripe.rotation.y = 0.22;
  props.add(stripe);

  // Canvas & Leather Hiking Backpack resting on the forest floor beside the left bench leg
  const pack = new THREE.Group();
  pack.position.set(-9.4, FLOOR_Y, -3.5);
  pack.rotation.y = 0.65;
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0x5c6945, roughness: 0.9 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4d2a16, roughness: 0.6 });
  const packGeo = new THREE.BoxGeometry(3.2, 4.4, 2.0);
  const pBody = new THREE.Mesh(packGeo, canvasMat);
  pBody.position.y = 2.2;
  pBody.rotation.x = -0.16;
  pack.add(pBody);

  const flapGeo = new THREE.BoxGeometry(3.3, 1.35, 2.15);
  const pFlap = new THREE.Mesh(flapGeo, canvasMat);
  pFlap.position.set(0, 3.85, 0.14);
  pack.add(pFlap);

  const rollGeo = new THREE.CylinderGeometry(0.62, 0.62, 3.6, 14);
  rollGeo.rotateZ(Math.PI / 2);
  const roll = new THREE.Mesh(rollGeo, blanketMat);
  roll.position.set(0, 4.85, -0.1);
  pack.add(roll);

  const strapGeo = new THREE.BoxGeometry(0.28, 2.2, 0.12);
  [-0.9, 0.9].forEach((sx) => {
    const st = new THREE.Mesh(strapGeo, leatherMat);
    st.position.set(sx, 2.75, 1.06);
    pack.add(st);
  });
  props.add(pack);

  disposables.push(
    darkGreenMetal,
    brassMat,
    glassMat,
    flameMat,
    steelMat,
    enamelMat,
    coffeeMat,
    blanketMat,
    stripeMat,
    canvasMat,
    leatherMat,
    lBaseGeo,
    lGlassGeo,
    lHatGeo,
    lCoreGeo,
    lBailGeo,
    tBodyGeo,
    tShoulderGeo,
    tCapGeo,
    mBodyGeo,
    mRimGeo,
    mHandleGeo,
    mCoffeeGeo,
    foldGeo,
    stripeGeo,
    packGeo,
    flapGeo,
    rollGeo,
    strapGeo
  );
  return props;
}

// =========================================================
// 3. CAMPFIRE WITH STONE RING, LOGS, ANIMATED FLAMES & SEATING LOGS
// =========================================================
function buildCampfireSite(
  maxAnisotropy: number,
  disposables: Disposable[]
): { group: THREE.Group; fireMat: THREE.ShaderMaterial; fireLight: THREE.PointLight } {
  const site = new THREE.Group();
  const { map: barkMap, bumpMap: barkBump } = createPineBarkTextures(maxAnisotropy);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x626668,
    roughness: 0.92,
    metalness: 0.04,
  });
  const charMat = new THREE.MeshStandardMaterial({
    color: 0x1b1513,
    roughness: 0.98,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0x3b1206,
    emissive: 0xff4b12,
    emissiveIntensity: 2.8,
    roughness: 0.8,
  });
  const logMat = new THREE.MeshStandardMaterial({
    map: barkMap,
    bumpMap: barkBump,
    bumpScale: 0.14,
    roughness: 0.92,
  });

  // River-stone fire ring (14 stones in ~48 cm radius ring)
  const stoneGeo = new THREE.DodecahedronGeometry(0.65, 1);
  const stoneCount = 14;
  for (let i = 0; i < stoneCount; i++) {
    const a = (i / stoneCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    const r = 2.35 + (Math.random() - 0.5) * 0.18;
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.position.set(Math.cos(a) * r, 0.34, Math.sin(a) * r);
    stone.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    stone.scale.set(
      0.95 + Math.random() * 0.4,
      0.62 + Math.random() * 0.25,
      0.85 + Math.random() * 0.35
    );
    site.add(stone);
  }

  // Charred ash bed & glowing ember chunks
  const ashGeo = new THREE.CylinderGeometry(2.1, 2.2, 0.12, 22);
  const ash = new THREE.Mesh(ashGeo, charMat);
  ash.position.y = 0.06;
  site.add(ash);

  const coalGeo = new THREE.DodecahedronGeometry(0.24, 0);
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 1.35;
    const coal = new THREE.Mesh(coalGeo, emberMat);
    coal.position.set(Math.cos(a) * r, 0.16, Math.sin(a) * r);
    coal.scale.set(1.2, 0.55, 1.0);
    site.add(coal);
  }

  // 5 teepee firewood logs with charred tips
  const firewoodGeo = new THREE.CylinderGeometry(0.24, 0.3, 3.3, 10);
  firewoodGeo.translate(0, 1.65, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.2;
    const log = new THREE.Mesh(firewoodGeo, logMat);
    log.position.set(Math.cos(a) * 1.45, 0.08, Math.sin(a) * 1.45);
    log.rotation.set(0, -a, 0.72);
    site.add(log);
  }

  // Animated multi-tongue flickering campfire flames
  const flameGeo = new THREE.ConeGeometry(1.1, 2.9, 14, 6, true);
  flameGeo.translate(0, 1.45, 0);
  const fireMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vHeight;
      void main() {
        vUv = uv;
        vHeight = clamp(position.y / 2.9, 0.0, 1.0);
        vec3 pos = position;
        float sway = sin(uTime * 6.5 + pos.y * 2.4 + pos.x * 1.8) * 0.28 * vHeight;
        float swayZ = cos(uTime * 5.2 + pos.y * 2.1 - pos.z * 1.6) * 0.24 * vHeight;
        pos.x += sway;
        pos.z += swayZ;
        pos.y += sin(uTime * 9.0 + pos.x * 3.0) * 0.12 * vHeight;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vHeight;
      void main() {
        float flicker = 0.78 + 0.22 * sin(uTime * 11.0 + vUv.x * 12.0 - vHeight * 8.0);
        float tongue = sin(vUv.x * 18.84 + uTime * 3.5) * 0.5 + 0.5;
        float alpha = (1.0 - smoothstep(0.25, 1.0, vHeight)) * (0.45 + tongue * 0.55) * flicker;
        vec3 baseCol = vec3(1.0, 0.92, 0.55);
        vec3 midCol = vec3(1.0, 0.46, 0.08);
        vec3 tipCol = vec3(0.85, 0.16, 0.03);
        vec3 col = mix(baseCol, midCol, smoothstep(0.0, 0.45, vHeight));
        col = mix(col, tipCol, smoothstep(0.45, 0.95, vHeight));
        gl_FragColor = vec4(col, alpha * 0.88);
      }
    `,
  });

  const outerFlame = new THREE.Mesh(flameGeo, fireMat);
  outerFlame.position.y = 0.2;
  site.add(outerFlame);

  const innerFlame = new THREE.Mesh(flameGeo, fireMat);
  innerFlame.position.y = 0.25;
  innerFlame.scale.set(0.62, 0.78, 0.62);
  innerFlame.rotation.y = 1.4;
  site.add(innerFlame);

  // Warm flickering firelight (non-shadow PointLight)
  const fireLight = new THREE.PointLight(0xff7d2b, 72, 42, 1.35);
  fireLight.position.set(0, 2.3, 0);
  site.add(fireLight);

  // Two rustic split-log camp seats curving around the campfire
  const seatLogGeo = new THREE.CylinderGeometry(0.92, 0.98, 9.2, 12);
  seatLogGeo.rotateZ(Math.PI / 2);
  const chockGeo = new THREE.CylinderGeometry(0.65, 0.72, 1.2, 10);

  const seatConfigs: [number, number, number][] = [
    [-4.8, 3.6, 0.95],
    [0.5, -5.6, 0.12],
  ];
  seatConfigs.forEach(([sx, sz, ry]) => {
    const seatGroup = new THREE.Group();
    seatGroup.position.set(sx, 0, sz);
    seatGroup.rotation.y = ry;

    const sLog = new THREE.Mesh(seatLogGeo, logMat);
    sLog.position.y = 1.55;
    seatGroup.add(sLog);

    [-3.1, 3.1].forEach((cx) => {
      const chock = new THREE.Mesh(chockGeo, logMat);
      chock.position.set(cx, 0.6, 0);
      seatGroup.add(chock);
    });

    site.add(seatGroup);
  });

  disposables.push(
    barkMap,
    barkBump,
    stoneMat,
    charMat,
    emberMat,
    logMat,
    stoneGeo,
    ashGeo,
    coalGeo,
    firewoodGeo,
    flameGeo,
    fireMat,
    seatLogGeo,
    chockGeo
  );
  return { group: site, fireMat, fireLight };
}

// =========================================================
// 4. REAL-SCALE CAMPING TENT (~2.2 m L x 1.5 m W x 1.35 m H)
// =========================================================
function buildCampingTent(disposables: Disposable[]): THREE.Group {
  const tent = new THREE.Group();

  const innerCanvasMat = new THREE.MeshStandardMaterial({
    color: 0xd99b43,
    roughness: 0.86,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const rainflyMat = new THREE.MeshStandardMaterial({
    color: 0x35593f,
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x222624,
    roughness: 0.92,
  });
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d32,
    roughness: 0.35,
    metalness: 0.75,
  });
  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x733224,
    roughness: 0.9,
  });
  const pillowMat = new THREE.MeshStandardMaterial({
    color: 0xdfd3be,
    roughness: 0.88,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xc2b290,
    roughness: 0.85,
  });

  // Hollow A-frame/ridge dome shell extruded along Z (20.5 units long = 2.05 m)
  const tentShape = new THREE.Shape();
  tentShape.moveTo(-7.2, 0);
  tentShape.quadraticCurveTo(-6.2, 7.2, 0, 12.6);
  tentShape.quadraticCurveTo(6.2, 7.2, 7.2, 0);
  tentShape.lineTo(6.95, 0);
  tentShape.quadraticCurveTo(5.98, 7.0, 0, 12.32);
  tentShape.quadraticCurveTo(-5.98, 7.0, -6.95, 0);
  tentShape.closePath();

  const shellGeo = new THREE.ExtrudeGeometry(tentShape, {
    depth: 20.5,
    bevelEnabled: false,
    curveSegments: 14,
  });
  shellGeo.translate(0, 0, -10.25);
  const shell = new THREE.Mesh(shellGeo, innerCanvasMat);
  tent.add(shell);

  // Solid back canvas wall panel closing the rear of the tent
  const backPanelShape = new THREE.Shape();
  backPanelShape.moveTo(-7.05, 0);
  backPanelShape.quadraticCurveTo(-6.05, 7.05, 0, 12.4);
  backPanelShape.quadraticCurveTo(6.05, 7.05, 7.05, 0);
  backPanelShape.closePath();
  const backGeo = new THREE.ShapeGeometry(backPanelShape, 14);
  const backWall = new THREE.Mesh(backGeo, innerCanvasMat);
  backWall.position.z = -10.2;
  tent.add(backWall);

  // Dark waterproof bathtub groundsheet
  const tubGeo = new THREE.BoxGeometry(14.1, 0.34, 20.4);
  const tub = new THREE.Mesh(tubGeo, floorMat);
  tub.position.y = 0.17;
  tent.add(tub);

  // Forest-green rainfly draped over upper ridge
  const flyShape = new THREE.Shape();
  flyShape.moveTo(-7.65, 3.2);
  flyShape.quadraticCurveTo(-5.8, 9.2, 0, 13.15);
  flyShape.quadraticCurveTo(5.8, 9.2, 7.65, 3.2);
  flyShape.quadraticCurveTo(5.5, 8.6, 0, 12.65);
  flyShape.quadraticCurveTo(-5.5, 8.6, -7.65, 3.2);

  const flyGeo = new THREE.ExtrudeGeometry(flyShape, {
    depth: 21.8,
    bevelEnabled: false,
    curveSegments: 14,
  });
  flyGeo.translate(0, 0, -10.9);
  const fly = new THREE.Mesh(flyGeo, rainflyMat);
  tent.add(fly);

  // Rolled-back front canvas doorway flaps (+Z side) framing the warm lit interior
  const flapGeo = new THREE.CylinderGeometry(0.45, 0.55, 11.2, 10);
  [-1, 1].forEach((side) => {
    const flap = new THREE.Mesh(flapGeo, rainflyMat);
    flap.position.set(side * 3.85, 5.4, 10.22);
    flap.rotation.z = side * 0.45;
    tent.add(flap);
  });

  // Cozy sleeping bag & pillow visible inside open doorway + warm interior tent light
  const bagGeo = new THREE.BoxGeometry(4.8, 0.72, 10.5);
  const sleepingBag = new THREE.Mesh(bagGeo, interiorMat);
  sleepingBag.position.set(-0.4, 0.62, 5.2);
  tent.add(sleepingBag);

  const pillowGeo = new THREE.BoxGeometry(2.8, 0.55, 1.8);
  const pillow = new THREE.Mesh(pillowGeo, pillowMat);
  pillow.position.set(-0.4, 1.08, 8.8);
  tent.add(pillow);

  const tentGlowBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe4aa,
    emissive: 0xffad42,
    emissiveIntensity: 2.6,
  });
  const bulbGeo = new THREE.SphereGeometry(0.28, 10, 10);
  const bulb = new THREE.Mesh(bulbGeo, tentGlowBulbMat);
  bulb.position.set(0, 8.8, 7.2);
  tent.add(bulb);

  const tentLight = new THREE.PointLight(0xffac4b, 38, 26, 1.4);
  tentLight.position.set(0, 7.6, 8.2);
  tent.add(tentLight);

  // Curved arched tent poles at front & back
  const polePts = [
    new THREE.Vector3(-7.4, 0, 0),
    new THREE.Vector3(-5.8, 7.8, 0),
    new THREE.Vector3(0, 13.0, 0),
    new THREE.Vector3(5.8, 7.8, 0),
    new THREE.Vector3(7.4, 0, 0),
  ];
  const poleCurve = new THREE.CatmullRomCurve3(polePts);
  const poleGeo = new THREE.TubeGeometry(poleCurve, 24, 0.14, 8, false);
  [-10.1, 10.1].forEach((pz) => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.z = pz;
    tent.add(pole);
  });

  // Tension guy-lines & stakes
  const ropeGeo = new THREE.CylinderGeometry(0.035, 0.035, 6.2, 6);
  const stakeGeo = new THREE.CylinderGeometry(0.08, 0.05, 0.9, 6);
  [
    [-7.5, 4.2, -7.2, -9.8, -7.8, -0.58],
    [7.5, 4.2, -7.2, 9.8, -7.8, 0.58],
    [-7.5, 4.2, 7.2, -9.8, 7.8, -0.58],
    [7.5, 4.2, 7.2, 9.8, 7.8, 0.58],
  ].forEach(([rx, ry, rz, sx, sz, tiltZ]) => {
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set((rx + sx) * 0.5, ry * 0.5, (rz + sz) * 0.5);
    rope.rotation.z = tiltZ;
    tent.add(rope);

    const stake = new THREE.Mesh(stakeGeo, poleMat);
    stake.position.set(sx, 0.32, sz);
    stake.rotation.z = -tiltZ * 0.4;
    tent.add(stake);
  });

  disposables.push(
    innerCanvasMat,
    rainflyMat,
    floorMat,
    poleMat,
    interiorMat,
    pillowMat,
    ropeMat,
    tentGlowBulbMat,
    shellGeo,
    backGeo,
    tubGeo,
    flyGeo,
    flapGeo,
    bagGeo,
    pillowGeo,
    bulbGeo,
    poleGeo,
    ropeGeo,
    stakeGeo
  );
  return tent;
}

// =========================================================
// MAIN FOREST CAMPSITE ENVIRONMENT BUILDER
// =========================================================
export function buildForestCampEnvironment(
  maxAnisotropy: number,
  disposables: Disposable[]
): { group: THREE.Group; fireMat: THREE.ShaderMaterial; fireLight: THREE.PointLight } {
  const group = new THREE.Group();

  // 1. Sculpted mossy pine-needle forest terrain (clearing flat at FLOOR_Y = -7.5)
  const { map: mossTex, bumpMap: mossBump } = createForestFloorTextures(maxAnisotropy);
  const floorGeo = new THREE.PlaneGeometry(230, 230, 108, 108);
  floorGeo.rotateX(-Math.PI / 2);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, forestHeightAt(x, z));
  }
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshStandardMaterial({
    map: mossTex,
    bumpMap: mossBump,
    bumpScale: 0.12,
    roughness: 0.95,
    metalness: 0.02,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  group.add(floor);

  // 2. Rustic timber picnic table under the turntable (top flush at y = -0.002)
  group.add(buildForestPicnicTable(maxAnisotropy, disposables));

  // 3. Cozy camp props on the picnic table & ground
  group.add(buildTabletopCampProps(disposables));

  // 4. Crackling campfire + stone ring + log seating (left-back clearing)
  const { group: campfire, fireMat, fireLight } = buildCampfireSite(
    maxAnisotropy,
    disposables
  );
  campfire.position.set(-13.8, FLOOR_Y, -14.2);
  campfire.rotation.y = 0.4;
  group.add(campfire);

  // 5. Expedition camping tent facing the fire & picnic table (right-back clearing)
  const tent = buildCampingTent(disposables);
  tent.position.set(14.8, FLOOR_Y, -16.8);
  tent.rotation.y = -0.58;
  group.add(tent);

  // 6. True 1:1 scale towering pine forest (~5.5 m to 10 m tall = 55 to 100 units!)
  const { map: barkMap, bumpMap: barkBump } = createPineBarkTextures(maxAnisotropy);
  const barkMat = new THREE.MeshStandardMaterial({
    map: barkMap,
    bumpMap: barkBump,
    bumpScale: 0.16,
    roughness: 0.94,
  });

  const pineNeedleTex = createPineFoliageTexture(maxAnisotropy);
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
      const droop = Math.sin(ang * 5.0 + yOffset) * 1.1;
      bp.setY(i, by + droop * (1 - Math.max(0, (by - yOffset) / height)));
    }
    geo.computeVertexNormals();
    return geo;
  };

  // Base pine tree ~62 units (6.2 m) tall before scale (0.88..1.55 -> 5.5 m to 9.6 m tall!)
  const trunkGeo = new THREE.CylinderGeometry(0.75, 2.15, 44, 12);
  trunkGeo.translate(0, 22, 0);
  const layer1Geo = createDeformedBoughLayer(13.2, 17.5, 23.5);
  const layer2Geo = createDeformedBoughLayer(11.4, 16.0, 31.0);
  const layer3Geo = createDeformedBoughLayer(9.4, 14.5, 38.2);
  const layer4Geo = createDeformedBoughLayer(7.2, 13.0, 45.0);
  const layer5Geo = createDeformedBoughLayer(4.8, 11.5, 51.2);
  const layer6Geo = createDeformedBoughLayer(2.6, 9.2, 56.8);

  const treeCount = 96;
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, treeCount);
  const l1 = new THREE.InstancedMesh(layer1Geo, boughMat, treeCount);
  const l2 = new THREE.InstancedMesh(layer2Geo, boughMat, treeCount);
  const l3 = new THREE.InstancedMesh(layer3Geo, boughMat, treeCount);
  const l4 = new THREE.InstancedMesh(layer4Geo, boughMat, treeCount);
  const l5 = new THREE.InstancedMesh(layer5Geo, boughMat, treeCount);
  const l6 = new THREE.InstancedMesh(layer6Geo, boughMat, treeCount);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
    // Keep pines strictly outside max camera zoom sphere (maxDistance = 40) so boughs never occlude view
    const minRadius = Math.sin(a) > 0.1 ? 68.0 : 63.0;
    const r = minRadius + Math.random() * 28.0;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = forestHeightAt(x, z);
    const s = 0.88 + Math.random() * 0.64;

    dummy.position.set(x, y - 0.6, z);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.scale.set(s, s * (0.95 + Math.random() * 0.35), s);
    dummy.updateMatrix();

    trunks.setMatrixAt(i, dummy.matrix);
    l1.setMatrixAt(i, dummy.matrix);
    l2.setMatrixAt(i, dummy.matrix);
    l3.setMatrixAt(i, dummy.matrix);
    l4.setMatrixAt(i, dummy.matrix);
    l5.setMatrixAt(i, dummy.matrix);
    l6.setMatrixAt(i, dummy.matrix);
  }
  [trunks, l1, l2, l3, l4, l5, l6].forEach((m) => {
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    group.add(m);
  });

  // 7. Woodland understory ferns & mossy boulders around the clearing
  const fernGeo = createFernTuftGeometry();
  const fernMat = new THREE.MeshStandardMaterial({
    color: 0x335d29,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });
  const fernCount = 340;
  const ferns = new THREE.InstancedMesh(fernGeo, fernMat, fernCount);
  let fPlaced = 0;
  let fAttempts = 0;
  while (fPlaced < fernCount && fAttempts < fernCount * 4) {
    fAttempts++;
    const a = Math.random() * Math.PI * 2;
    const r = 13.0 + Math.random() * 52.0;
    const fx = Math.cos(a) * r;
    const fz = Math.sin(a) * r;
    // Keep ferns out of picnic table, campfire ring, and tent footprint
    if (Math.abs(fx) < 12 && Math.abs(fz) < 9) continue;
    if (Math.hypot(fx + 13.8, fz + 14.2) < 8.5) continue;
    if (Math.hypot(fx - 14.8, fz + 16.8) < 12.5) continue;

    const fy = forestHeightAt(fx, fz);
    dummy.position.set(fx, fy - 0.05, fz);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    const fs = 0.85 + Math.random() * 0.9;
    dummy.scale.set(fs * 1.15, fs * 0.9, fs * 1.15);
    dummy.updateMatrix();
    ferns.setMatrixAt(fPlaced, dummy.matrix);
    fPlaced++;
  }
  ferns.count = fPlaced;
  ferns.instanceMatrix.needsUpdate = true;
  ferns.computeBoundingSphere();
  group.add(ferns);

  const rockGeo = new THREE.DodecahedronGeometry(1.8, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x525754,
    roughness: 0.94,
    metalness: 0.03,
  });
  const rockCount = 26;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  for (let i = 0; i < rockCount; i++) {
    const a = (i / rockCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const r = 26.0 + Math.random() * 34.0;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    const ry = forestHeightAt(rx, rz);
    dummy.position.set(rx, ry + 0.35, rz);
    dummy.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2);
    const rs = 0.75 + Math.random() * 1.3;
    dummy.scale.set(rs * 1.35, rs * 0.68, rs * 1.15);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.computeBoundingSphere();
  group.add(rocks);

  // 8. Soft volumetric sunlight shafts slanting down through the tall pine canopy
  const rayGeo = new THREE.CylinderGeometry(1.6, 8.2, 48, 16, 1, true);
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xffe0ad,
    transparent: true,
    opacity: 0.038,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  [
    [-10, 14, -18],
    [12, 15, -20],
    [-18, 13, -6],
  ].forEach(([rx, ry, rz]) => {
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.position.set(rx, ry, rz);
    ray.rotation.set(0.28, 0, -0.34);
    group.add(ray);
  });

  disposables.push(
    mossTex,
    mossBump,
    floorGeo,
    floorMat,
    barkMap,
    barkBump,
    barkMat,
    pineNeedleTex,
    boughMat,
    trunkGeo,
    layer1Geo,
    layer2Geo,
    layer3Geo,
    layer4Geo,
    layer5Geo,
    layer6Geo,
    fernGeo,
    fernMat,
    rockGeo,
    rockMat,
    rayGeo,
    rayMat
  );

  return { group, fireMat, fireLight };
}
