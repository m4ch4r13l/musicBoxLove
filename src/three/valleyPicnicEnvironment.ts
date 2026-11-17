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

export function valleyHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= 13.5) return -0.065;
  const blend = THREE.MathUtils.smoothstep(r, 13.5, 29.0);
  const roll =
    Math.sin(x * 0.065) * Math.cos(z * 0.055) * 2.2 +
    (fbm2D(x * 0.032 + 10, z * 0.032 + 10, 3) - 0.45) * 5.2 +
    Math.max(0, (r - 28) * 0.14);
  return THREE.MathUtils.lerp(-0.065, Math.max(-0.22, roll), blend);
}

function createMeadowTerrainTextures(maxAnisotropy: number): {
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

        const lush = Math.max(0, Math.min(1, n * 1.2));
        d[idx] = Math.round(46 + lush * 46 + fine * 14);
        d[idx + 1] = Math.round(78 + lush * 64 + fine * 18);
        d[idx + 2] = Math.round(28 + lush * 24 + fine * 8);
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

    for (let i = 0; i < 4200; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      ctx.strokeStyle =
        i % 2 === 0 ? 'rgba(134, 178, 66, 0.34)' : 'rgba(38, 68, 22, 0.36)';
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

function createPicnicBlanketTextures(maxAnisotropy: number): {
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
    // Warm cream woven cotton base
    ctx.fillStyle = '#f2e6d3';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    // Classic terracotta-coral gingham weave stripes (horizontal + vertical)
    const step = 64;
    ctx.fillStyle = 'rgba(196, 86, 58, 0.42)';
    for (let x = 0; x < size; x += step) {
      ctx.fillRect(x, 0, step * 0.48, size);
    }
    for (let y = 0; y < size; y += step) {
      ctx.fillRect(0, y, size, step * 0.48);
    }

    // Fine sage accent pinstripes
    ctx.fillStyle = 'rgba(92, 118, 76, 0.28)';
    for (let x = 0; x < size; x += step) {
      ctx.fillRect(x + step * 0.72, 0, 4, size);
    }
    for (let y = 0; y < size; y += step) {
      ctx.fillRect(0, y + step * 0.72, size, 4);
    }

    // Subtle linen weave texture
    for (let y = 0; y < size; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(60,30,15,0.04)';
      ctx.fillRect(0, y, size, 1);
      bCtx.fillStyle = y % 6 === 0 ? '#969696' : '#6c6c6c';
      bCtx.fillRect(0, y, size, 1);
    }
    for (let x = 0; x < size; x += 3) {
      bCtx.fillStyle = x % 6 === 0 ? 'rgba(200,200,200,0.28)' : 'rgba(60,60,60,0.28)';
      bCtx.fillRect(x, 0, 1, size);
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.5, 3);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.5, 3);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createWickerTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bCtx = bump.getContext('2d');

  if (ctx && bCtx) {
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#707070';
    bCtx.fillRect(0, 0, size, size);

    const cell = 16;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const horiz = ((x / cell + y / cell) & 1) === 0;
        ctx.fillStyle = horiz ? '#a87444' : '#7a4f29';
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        bCtx.fillStyle = horiz ? '#d0d0d0' : '#4a4a4a';
        bCtx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 2);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createMeadowGrassTuftGeometry(): THREE.BufferGeometry {
  // 3-blade crossed tuft scaled to realistic meadow grass (~6-10 cm tall, fine slender blades)
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const bladeCount = 3;
  const segs = 3;
  const bladeH = 0.62;
  const baseW = 0.048;

  let vertOffset = 0;
  for (let b = 0; b < bladeCount; b++) {
    const yaw = (b / bladeCount) * Math.PI * 2 + (b - 1) * 0.24;
    const tilt = 0.18 + b * 0.06;
    const ox = Math.cos(yaw) * 0.045;
    const oz = Math.sin(yaw) * 0.045;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = baseW * (1 - t * 0.92);
      const y = t * bladeH;
      const curve = t * t * tilt;

      const lx = -w * 0.5;
      const rx = w * 0.5;

      const pxL = ox + lx * cosY - curve * sinY;
      const pzL = oz + lx * sinY + curve * cosY;
      const pxR = ox + rx * cosY - curve * sinY;
      const pzR = oz + rx * sinY + curve * cosY;

      positions.push(pxL, y, pzL, pxR, y, pzR);
      uvs.push(0, t, 1, t);
      normals.push(-sinY, 0.45, cosY, -sinY, 0.45, cosY);
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

// Picnic Basket (1:1 scale ~44 cm W x 30 cm D x 25 cm H)
function buildPicnicBasket(
  maxAnisotropy: number,
  blanketMap: THREE.CanvasTexture,
  disposables: Disposable[]
): THREE.Group {
  const basket = new THREE.Group();
  const { map: wickerMap, bumpMap: wickerBump } = createWickerTextures(maxAnisotropy);

  const wickerMat = new THREE.MeshStandardMaterial({
    map: wickerMap,
    bumpMap: wickerBump,
    bumpScale: 0.06,
    roughness: 0.82,
    metalness: 0.04,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x522a16,
    roughness: 0.52,
    metalness: 0.08,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a85e,
    roughness: 0.28,
    metalness: 0.86,
  });
  const linerMat = new THREE.MeshStandardMaterial({
    map: blanketMap,
    roughness: 0.88,
  });

  // Main tapered woven basket body (grounded at y = 0)
  const bodyGeo = new THREE.BoxGeometry(4.4, 2.2, 3.0);
  const body = new THREE.Mesh(bodyGeo, wickerMat);
  body.position.y = 1.1;
  body.castShadow = true;
  body.receiveShadow = true;
  basket.add(body);

  // Braided top rim collar
  const rimGeo = new THREE.BoxGeometry(4.62, 0.24, 3.22);
  const rim = new THREE.Mesh(rimGeo, wickerMat);
  rim.position.y = 2.18;
  rim.castShadow = true;
  basket.add(rim);

  // Checkered cloth lining peeking over the rim
  const linerGeo = new THREE.BoxGeometry(4.32, 0.16, 2.92);
  const liner = new THREE.Mesh(linerGeo, linerMat);
  liner.position.y = 2.24;
  basket.add(liner);

  // Twin hinged wicker lids (one closed, one propped slightly ajar)
  const lidGeo = new THREE.BoxGeometry(2.26, 0.16, 3.12);
  const leftLid = new THREE.Mesh(lidGeo, wickerMat);
  leftLid.position.set(-1.14, 2.34, 0);
  leftLid.castShadow = true;
  basket.add(leftLid);

  const rightLid = new THREE.Mesh(lidGeo, wickerMat);
  rightLid.position.set(1.06, 2.58, 0);
  rightLid.rotation.z = 0.22;
  rightLid.castShadow = true;
  basket.add(rightLid);

  // Leather straps & brass buckles
  const strapGeo = new THREE.BoxGeometry(0.24, 1.5, 0.08);
  [-1.2, 1.2].forEach((sx) => {
    const strap = new THREE.Mesh(strapGeo, leatherMat);
    strap.position.set(sx, 1.55, 1.52);
    basket.add(strap);
  });

  const buckleGeo = new THREE.BoxGeometry(0.3, 0.22, 0.12);
  [-1.2, 1.2].forEach((sx) => {
    const buckle = new THREE.Mesh(buckleGeo, brassMat);
    buckle.position.set(sx, 1.4, 1.54);
    basket.add(buckle);
  });

  // Arched carry handle
  const handleGeo = new THREE.TorusGeometry(1.55, 0.11, 10, 28, Math.PI);
  handleGeo.rotateY(Math.PI / 2);
  const handle = new THREE.Mesh(handleGeo, wickerMat);
  handle.position.y = 2.22;
  handle.castShadow = true;
  basket.add(handle);

  disposables.push(
    wickerMap,
    wickerBump,
    wickerMat,
    leatherMat,
    brassMat,
    linerMat,
    bodyGeo,
    rimGeo,
    linerGeo,
    lidGeo,
    strapGeo,
    buckleGeo,
    handleGeo
  );
  return basket;
}

// Glass Lemonade Carafe + Two Glasses + Sliced Lemon (1:1 scale ~24 cm tall carafe)
function buildLemonadeSet(disposables: Disposable[]): THREE.Group {
  const group = new THREE.Group();

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.02,
    transparent: true,
    opacity: 0.42,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const juiceMat = new THREE.MeshStandardMaterial({
    color: 0xffd257,
    emissive: 0x7a5108,
    emissiveIntensity: 0.22,
    roughness: 0.15,
    transparent: true,
    opacity: 0.85,
  });
  const corkMat = new THREE.MeshStandardMaterial({
    color: 0xb88652,
    roughness: 0.9,
  });
  const lemonMat = new THREE.MeshStandardMaterial({
    color: 0xf7d038,
    roughness: 0.5,
  });

  // Carafe body (LatheGeometry, grounded y = 0)
  const carafePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.55, 0.0),
    new THREE.Vector2(0.66, 0.95),
    new THREE.Vector2(0.32, 1.75),
    new THREE.Vector2(0.38, 2.35),
  ];
  const carafeGeo = new THREE.LatheGeometry(carafePts, 28);
  const carafe = new THREE.Mesh(carafeGeo, glassMat);
  carafe.renderOrder = 3;
  group.add(carafe);

  const liquidPts = [
    new THREE.Vector2(0.0, 0.06),
    new THREE.Vector2(0.49, 0.06),
    new THREE.Vector2(0.59, 0.92),
    new THREE.Vector2(0.36, 1.48),
    new THREE.Vector2(0.0, 1.48),
  ];
  const liquidGeo = new THREE.LatheGeometry(liquidPts, 24);
  const liquid = new THREE.Mesh(liquidGeo, juiceMat);
  group.add(liquid);

  const corkGeo = new THREE.CylinderGeometry(0.33, 0.26, 0.34, 18);
  const cork = new THREE.Mesh(corkGeo, corkMat);
  cork.position.y = 2.42;
  group.add(cork);

  // Two drinking glasses beside the carafe
  const tumblerGeo = new THREE.CylinderGeometry(0.36, 0.3, 0.98, 22, 1, true);
  const tumblerJuiceGeo = new THREE.CylinderGeometry(0.31, 0.27, 0.68, 20);
  const lemonSliceGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16);

  [
    [1.15, 0.42],
    [0.52, 1.28],
  ].forEach(([gx, gz]) => {
    const tJuice = new THREE.Mesh(tumblerJuiceGeo, juiceMat);
    tJuice.position.set(gx, 0.38, gz);
    group.add(tJuice);

    const tGlass = new THREE.Mesh(tumblerGeo, glassMat);
    tGlass.position.set(gx, 0.49, gz);
    tGlass.renderOrder = 3;
    group.add(tGlass);

    const slice = new THREE.Mesh(lemonSliceGeo, lemonMat);
    slice.position.set(gx + 0.28, 0.92, gz);
    slice.rotation.z = 0.65;
    group.add(slice);
  });

  disposables.push(
    glassMat,
    juiceMat,
    corkMat,
    lemonMat,
    carafeGeo,
    liquidGeo,
    corkGeo,
    tumblerGeo,
    tumblerJuiceGeo,
    lemonSliceGeo
  );
  return group;
}

// Wooden Charcuterie Board with Artisan Bread, Cheese, Fruit & Ceramic Plates
function buildPicnicSpread(disposables: Disposable[]): THREE.Group {
  const spread = new THREE.Group();

  const boardMat = new THREE.MeshStandardMaterial({
    color: 0x7d4c2a,
    roughness: 0.54,
    metalness: 0.04,
  });
  const crustMat = new THREE.MeshStandardMaterial({
    color: 0xc9823c,
    roughness: 0.78,
  });
  const cheeseMat = new THREE.MeshStandardMaterial({
    color: 0xf4cf6a,
    roughness: 0.56,
  });
  const ceramicMat = new THREE.MeshStandardMaterial({
    color: 0xf7f1e6,
    roughness: 0.22,
    metalness: 0.04,
  });
  const berryMat = new THREE.MeshStandardMaterial({
    color: 0xc93138,
    roughness: 0.45,
  });
  const grapeMat = new THREE.MeshStandardMaterial({
    color: 0x5c2d5e,
    roughness: 0.38,
  });

  // Oval/rounded wooden serving board (grounded y = 0, ~38 cm x 24 cm)
  const boardGeo = new THREE.BoxGeometry(3.8, 0.14, 2.5);
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = 0.07;
  board.castShadow = true;
  board.receiveShadow = true;
  spread.add(board);

  // Artisan bread baguette
  const breadGeo = new THREE.CapsuleGeometry(0.32, 1.55, 8, 16);
  breadGeo.rotateZ(Math.PI / 2);
  const bread = new THREE.Mesh(breadGeo, crustMat);
  bread.position.set(-0.55, 0.4, -0.45);
  bread.rotation.y = 0.24;
  bread.castShadow = true;
  spread.add(bread);

  // Cheese wedge
  const cheeseShape = new THREE.Shape();
  cheeseShape.moveTo(0, 0);
  cheeseShape.lineTo(1.05, 0.28);
  cheeseShape.lineTo(1.05, -0.28);
  cheeseShape.closePath();
  const cheeseGeo = new THREE.ExtrudeGeometry(cheeseShape, {
    depth: 0.46,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  cheeseGeo.rotateX(-Math.PI / 2);
  const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
  cheese.position.set(0.45, 0.17, 0.35);
  cheese.rotation.y = -0.35;
  cheese.castShadow = true;
  spread.add(cheese);

  // Strawberries & grapes cluster
  const fruitGeo = new THREE.SphereGeometry(0.14, 10, 10);
  [
    [-0.9, 0.27, 0.55, berryMat],
    [-0.65, 0.27, 0.72, berryMat],
    [-0.45, 0.27, 0.48, berryMat],
    [0.95, 0.26, -0.58, grapeMat],
    [1.16, 0.26, -0.45, grapeMat],
    [0.78, 0.26, -0.42, grapeMat],
    [1.0, 0.42, -0.46, grapeMat],
  ].forEach(([fx, fy, fz, mat]) => {
    const f = new THREE.Mesh(fruitGeo, mat as THREE.Material);
    f.position.set(fx as number, fy as number, fz as number);
    spread.add(f);
  });

  // Two stacked ceramic plates beside the board
  const plateGeo = new THREE.CylinderGeometry(1.1, 0.82, 0.14, 28);
  const p1 = new THREE.Mesh(plateGeo, ceramicMat);
  p1.position.set(-2.6, 0.07, 1.35);
  p1.castShadow = true;
  spread.add(p1);

  const p2 = new THREE.Mesh(plateGeo, ceramicMat);
  p2.position.set(-2.5, 0.2, 1.42);
  p2.scale.setScalar(0.92);
  p2.castShadow = true;
  spread.add(p2);

  disposables.push(
    boardMat,
    crustMat,
    cheeseMat,
    ceramicMat,
    berryMat,
    grapeMat,
    boardGeo,
    breadGeo,
    cheeseGeo,
    fruitGeo,
    plateGeo
  );
  return spread;
}

// Cozy Linen Cushion / Throw Pillow (~42 cm x 42 cm x 12 cm)
function buildPicnicPillow(colorHex: number, disposables: Disposable[]): THREE.Group {
  const group = new THREE.Group();
  const pillowMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const geo = new THREE.SphereGeometry(2.15, 22, 16);
  geo.scale(1.0, 0.34, 0.92);
  const mesh = new THREE.Mesh(geo, pillowMat);
  mesh.position.y = 0.56;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  disposables.push(pillowMat, geo);
  return group;
}

// Woven Straw Sun Hat (~38 cm diameter brim)
function buildStrawSunHat(disposables: Disposable[]): THREE.Group {
  const hat = new THREE.Group();
  const strawMat = new THREE.MeshStandardMaterial({
    color: 0xdfb97a,
    roughness: 0.86,
    metalness: 0.02,
  });
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xb84c35,
    roughness: 0.62,
  });

  const profile = [
    new THREE.Vector2(1.9, 0.04),
    new THREE.Vector2(1.45, 0.14),
    new THREE.Vector2(0.98, 0.06),
    new THREE.Vector2(0.92, 0.95),
    new THREE.Vector2(0.65, 1.12),
    new THREE.Vector2(0.0, 1.14),
  ];
  const hatGeo = new THREE.LatheGeometry(profile, 32);
  const mesh = new THREE.Mesh(hatGeo, strawMat);
  mesh.castShadow = true;
  hat.add(mesh);

  const ribbonGeo = new THREE.CylinderGeometry(0.95, 0.97, 0.2, 32, 1, true);
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.position.y = 0.22;
  hat.add(ribbon);

  disposables.push(strawMat, ribbonMat, hatGeo, ribbonGeo);
  return hat;
}

// Warm Brass & Glass Picnic Lantern (~28 cm tall)
function buildPicnicLantern(disposables: Disposable[]): THREE.Group {
  const lantern = new THREE.Group();
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb88442,
    roughness: 0.32,
    metalness: 0.84,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff5e4,
    roughness: 0.12,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffdf99,
    emissive: 0xffa03b,
    emissiveIntensity: 3.0,
  });

  const baseGeo = new THREE.CylinderGeometry(0.76, 0.86, 0.32, 20);
  const base = new THREE.Mesh(baseGeo, brassMat);
  base.position.y = 0.16;
  base.castShadow = true;
  lantern.add(base);

  const glassGeo = new THREE.CylinderGeometry(0.66, 0.66, 1.55, 20, 1, true);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.y = 1.08;
  glass.renderOrder = 3;
  lantern.add(glass);

  const capGeo = new THREE.ConeGeometry(0.88, 0.62, 20);
  const cap = new THREE.Mesh(capGeo, brassMat);
  cap.position.y = 2.15;
  cap.castShadow = true;
  lantern.add(cap);

  const strutGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = new THREE.Mesh(strutGeo, brassMat);
    strut.position.set(Math.cos(a) * 0.72, 1.08, Math.sin(a) * 0.72);
    lantern.add(strut);
  }

  const bulbGeo = new THREE.SphereGeometry(0.22, 12, 12);
  const bulb = new THREE.Mesh(bulbGeo, flameMat);
  bulb.position.y = 0.95;
  lantern.add(bulb);

  const bailGeo = new THREE.TorusGeometry(0.55, 0.04, 8, 20, Math.PI);
  const bail = new THREE.Mesh(bailGeo, brassMat);
  bail.position.y = 2.38;
  lantern.add(bail);

  disposables.push(
    brassMat,
    glassMat,
    flameMat,
    baseGeo,
    glassGeo,
    capGeo,
    strutGeo,
    bulbGeo,
    bailGeo
  );
  return lantern;
}

function createOakBarkTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 256;
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
    ctx.fillStyle = '#4e3929';
    ctx.fillRect(0, 0, w, h);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, w, h);

    // Subtle vertical tonal bands + lichen variation
    for (let x = 0; x < w; x += 6) {
      const shade = Math.sin(x * 0.19) * 10 + (Math.random() - 0.5) * 14;
      ctx.fillStyle = `rgb(${Math.round(76 + shade)}, ${Math.round(56 + shade * 0.8)}, ${Math.round(41 + shade * 0.6)})`;
      ctx.fillRect(x, 0, 6, h);
    }

    // Deep oak bark fissures & raised ridges
    for (let i = 0; i < 480; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 28 + Math.random() * 88;
      const sway = (Math.random() - 0.5) * 9;
      const isFissure = i % 3 !== 0;

      ctx.strokeStyle = isFissure ? 'rgba(26, 17, 11, 0.65)' : 'rgba(116, 92, 70, 0.36)';
      ctx.lineWidth = isFissure ? 1.5 + Math.random() * 3.2 : 1.2 + Math.random() * 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway * 0.6, y + len * 0.5, x + sway, y + len);
      ctx.stroke();

      bCtx.strokeStyle = isFissure ? 'rgba(20, 20, 20, 0.75)' : 'rgba(225, 225, 225, 0.45)';
      bCtx.lineWidth = isFissure ? 2 + Math.random() * 3.5 : 1.5 + Math.random() * 2.2;
      bCtx.beginPath();
      bCtx.moveTo(x, y);
      bCtx.quadraticCurveTo(x + sway * 0.6, y + len * 0.5, x + sway, y + len);
      bCtx.stroke();
    }

    // Subtle weathered moss / lichen spots on bark
    for (let i = 0; i < 42; i++) {
      const lx = Math.random() * w;
      const ly = Math.random() * h;
      const lr = 4 + Math.random() * 10;
      ctx.fillStyle = 'rgba(88, 104, 62, 0.24)';
      ctx.beginPath();
      ctx.ellipse(lx, ly, lr * 0.7, lr * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 3);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 3);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createOakLeafClusterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, size, size);

    // Fine branching twigs radiating from center-bottom
    ctx.strokeStyle = '#3f2e1e';
    ctx.lineCap = 'round';
    for (let t = 0; t < 10; t++) {
      const ang = -Math.PI / 2 + (t - 4.5) * 0.34 + (Math.random() - 0.5) * 0.18;
      const len = 110 + Math.random() * 110;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.68);
      ctx.quadraticCurveTo(
        size * 0.5 + Math.cos(ang) * len * 0.55,
        size * 0.62 + Math.sin(ang) * len * 0.55,
        size * 0.5 + Math.cos(ang) * len,
        size * 0.58 + Math.sin(ang) * len
      );
      ctx.stroke();
    }

    const drawOakLeaf = (
      cx: number,
      cy: number,
      angle: number,
      len: number,
      wid: number,
      fill: string,
      vein: string
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Lobed oak-leaf silhouette
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(wid * 0.55, -len * 0.18, wid * 0.95, -len * 0.28, wid * 0.72, -len * 0.42);
      ctx.bezierCurveTo(wid * 1.05, -len * 0.54, wid * 0.85, -len * 0.72, wid * 0.46, -len * 0.82);
      ctx.bezierCurveTo(wid * 0.38, -len * 0.94, wid * 0.14, -len, 0, -len);
      ctx.bezierCurveTo(-wid * 0.14, -len, -wid * 0.38, -len * 0.94, -wid * 0.46, -len * 0.82);
      ctx.bezierCurveTo(-wid * 0.85, -len * 0.72, -wid * 1.05, -len * 0.54, -wid * 0.72, -len * 0.42);
      ctx.bezierCurveTo(-wid * 0.95, -len * 0.28, -wid * 0.55, -len * 0.18, 0, 0);
      ctx.closePath();
      ctx.fill();

      // Subtle leaf midrib vein
      ctx.strokeStyle = vein;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(0, -len * 0.86);
      ctx.stroke();

      ctx.restore();
    };

    const leafPalette = [
      ['#264419', 'rgba(92,130,58,0.4)'],
      ['#345c22', 'rgba(116,158,72,0.45)'],
      ['#427029', 'rgba(136,178,86,0.45)'],
      ['#558732', 'rgba(162,202,98,0.5)'],
      ['#6a9b3c', 'rgba(188,220,115,0.5)'],
    ];

    // Dense natural spray of 74 overlapping leaves leaving organic gaps around perimeter
    for (let i = 0; i < 74; i++) {
      const layer = i / 74;
      const dist = Math.pow(Math.random(), 0.65) * 182;
      const ang = Math.random() * Math.PI * 2;
      const lx = size * 0.5 + Math.cos(ang) * dist;
      const ly = size * 0.52 + Math.sin(ang) * dist * 0.88;
      const leafDir = ang + Math.PI * 0.5 + (Math.random() - 0.5) * 0.9;
      const leafLen = 46 + Math.random() * 34;
      const leafWid = leafLen * (0.48 + Math.random() * 0.16);
      const palIdx = Math.min(
        leafPalette.length - 1,
        Math.floor(layer * 3.4 + Math.random() * 1.9)
      );
      const [fill, vein] = leafPalette[palIdx];
      drawOakLeaf(lx, ly, leafDir, leafLen, leafWid, fill, vein);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTreeGroundShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(18, 28, 12, 0.44)');
    grad.addColorStop(0.52, 'rgba(22, 34, 14, 0.24)');
    grad.addColorStop(1, 'rgba(22, 34, 14, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

function createOrganicOakTrunkGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(1.0, 2.5, 22, 16, 12);
  geo.translate(0, 11, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const t = Math.max(0, Math.min(1, y / 22));
    const ang = Math.atan2(z, x);

    // Flared root buttresses near the ground
    if (y < 4.8) {
      const rootFactor = Math.pow(1 - y / 4.8, 2.1);
      const flare = 1 + rootFactor * (0.45 + 0.32 * Math.sin(ang * 5.0 + 0.4));
      x *= flare;
      z *= flare;
    }

    // Subtle organic oak curve & bark irregularity
    const bendX = Math.sin(t * Math.PI * 0.95) * 0.72;
    const bendZ = Math.sin(t * Math.PI * 1.35) * 0.44;
    const knurl = 1 + 0.06 * Math.sin(ang * 4.0 + y * 0.45);
    pos.setXYZ(i, x * knurl + bendX, y, z * knurl + bendZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function createCurvedBranchGeometry(
  length: number,
  rTop: number,
  rBot: number
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(rTop, rBot, length, 10, 7);
  geo.translate(0, length * 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = Math.max(0, Math.min(1, y / length));
    // Gentle upward/crooked oak bough sweep
    const crookX = Math.sin(t * Math.PI * 0.9) * (length * 0.09);
    const crookZ = Math.cos(t * Math.PI * 1.1 - 0.5) * (length * 0.04);
    pos.setXYZ(i, x + crookX, y, z + crookZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function createLeafRosetteGeometry(): THREE.BufferGeometry {
  // 3 intersecting slightly-domed leaf cards so foliage looks rich and volumetric from every angle
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const planes = 3;
  const size = 8.4;
  let vOffset = 0;

  for (let p = 0; p < planes; p++) {
    const yaw = (p / planes) * Math.PI;
    const tilt = (p - 1) * 0.24;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ'));

    const cols = 2;
    const rows = 2;
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const ly = (v - 0.45) * size;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const lx = (u - 0.5) * size;
        // Slight outward dome curvature so edges catch sunlight naturally
        const edgeDist = Math.hypot(u - 0.5, v - 0.5);
        const lz = (0.35 - edgeDist * edgeDist) * 1.8;

        const pt = new THREE.Vector3(lx, ly, lz).applyQuaternion(q);
        const n = new THREE.Vector3(0, 0.35, 1).normalize().applyQuaternion(q);
        positions.push(pt.x, pt.y, pt.z);
        normals.push(n.x, n.y, n.z);
        uvs.push(u, v);
      }
    }

    const stride = cols + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = vOffset + r * stride + c;
        const b = a + 1;
        const d = a + stride;
        const e = d + 1;
        indices.push(a, b, d, b, e, d);
      }
    }
    vOffset += (rows + 1) * stride;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Sunlit Realistic Meadow Oak Trees (~4.5 m to 7.2 m tall with furrowed bark, roots, boughs & leaf cards)
function buildMeadowTrees(
  maxAnisotropy: number,
  timeUniform: { value: number },
  disposables: Disposable[]
): THREE.Group {
  const treesGroup = new THREE.Group();

  const { map: barkMap, bumpMap: barkBump } = createOakBarkTextures(maxAnisotropy);
  const leafTex = createOakLeafClusterTexture(maxAnisotropy);
  const treeShadowTex = createTreeGroundShadowTexture();

  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkMap,
    bumpMap: barkBump,
    bumpScale: 0.24,
    roughness: 0.94,
    metalness: 0.02,
  });

  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.84,
    metalness: 0.02,
  });
  leafMat.customProgramCacheKey = () => 'valley-oak-leaves-v1';
  leafMat.onBeforeCompile = (shader) => {
    shader.uniforms.uLeafTime = timeUniform;
    shader.vertexShader = 'uniform float uLeafTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec3 transformed = vec3( position );
      #ifdef USE_INSTANCING
        float leafPhase = instanceMatrix[3][0] * 0.17 + instanceMatrix[3][2] * 0.19;
        float leafSway = sin(uLeafTime * 1.45 + leafPhase) * 0.22
                       + cos(uLeafTime * 2.55 + leafPhase * 1.6) * 0.09;
        float leafMask = clamp(uv.y, 0.0, 1.0);
        transformed.x += leafSway * leafMask;
        transformed.z += leafSway * 0.65 * leafMask;
      #endif
      `
    );
  };

  const shadowDiscMat = new THREE.MeshBasicMaterial({
    map: treeShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });

  const trunkGeo = createOrganicOakTrunkGeometry();
  const primaryLimbGeo = createCurvedBranchGeometry(14.5, 0.42, 0.95);
  const subBranchGeo = createCurvedBranchGeometry(8.5, 0.22, 0.46);
  const shadowDiscGeo = new THREE.CircleGeometry(15.5, 24);
  shadowDiscGeo.rotateX(-Math.PI / 2);
  const rosetteGeo = createLeafRosetteGeometry();

  // Kept in -Z / ±X meadow hills so OrbitControls (maxDistance = 55) never clips into a foreground tree
  const treeSpots: [number, number, number, number][] = [
    [-38, -36, 1.14, 0.4],
    [-18, -46, 1.28, 1.2],
    [14, -44, 1.22, 2.1],
    [36, -34, 1.12, 0.9],
    [-48, -14, 1.08, 1.7],
    [46, -12, 1.18, 2.8],
    [-54, 6, 1.0, 0.6],
    [52, 5, 1.05, 2.4],
    [-4, -56, 1.32, 1.5],
    [-28, -54, 0.95, 2.9],
    [30, -52, 0.98, 0.2],
  ];

  // 5 spreading main boughs per oak + 4 secondary limbs
  const primaryBoughs: [number, number, number][] = [
    [0.15, -0.68, 17.5],
    [1.45, -0.62, 18.8],
    [2.72, -0.7, 17.8],
    [3.95, -0.56, 19.4],
    [5.22, -0.66, 18.2],
  ];

  const crownClusters: [number, number, number, number][] = [
    [0, 35.5, 0, 10.5],
    [9.2, 29.0, 2.2, 8.2],
    [-8.8, 30.2, -2.5, 8.4],
    [2.2, 29.8, 8.8, 8.0],
    [-3.0, 31.0, -8.5, 8.0],
    [0.6, 40.5, 0.4, 7.2],
  ];

  const rosettesPerTree = 96;
  const totalRosettes = treeSpots.length * rosettesPerTree;
  const foliageMesh = new THREE.InstancedMesh(rosetteGeo, leafMat, totalRosettes);

  const dummy = new THREE.Object3D();
  const upVec = new THREE.Vector3(0, 1, 0);
  const slopeNormal = new THREE.Vector3();
  const localPos = new THREE.Vector3();
  const worldPos = new THREE.Vector3();
  const treeQuat = new THREE.Quaternion();
  const treeEuler = new THREE.Euler();
  const leafColor = new THREE.Color();

  let rIdx = 0;

  treeSpots.forEach(([tx, tz, sc, yaw], tIdx) => {
    const ty = valleyHeightAt(tx, tz);
    const tree = new THREE.Group();
    tree.position.set(tx, ty - 0.85, tz);
    tree.rotation.y = yaw;
    tree.scale.setScalar(sc);

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    tree.add(trunk);

    primaryBoughs.forEach(([rotY, tiltZ, ly], bIdx) => {
      const bough = new THREE.Mesh(primaryLimbGeo, trunkMat);
      bough.position.set(0.45, ly, 0.25);
      bough.rotation.set(0, rotY, tiltZ);
      tree.add(bough);

      if (bIdx < 4) {
        const sub = new THREE.Mesh(subBranchGeo, trunkMat);
        sub.position.set(
          Math.cos(rotY) * 4.8,
          ly + 5.8,
          -Math.sin(rotY) * 4.8
        );
        sub.rotation.set(0, rotY + (bIdx % 2 === 0 ? 0.55 : -0.55), tiltZ * 0.72);
        tree.add(sub);
      }
    });

    treesGroup.add(tree);

    // Slope-hugging dappled shadow disc on the hillside
    const hx = valleyHeightAt(tx + 1.5, tz) - valleyHeightAt(tx - 1.5, tz);
    const hz = valleyHeightAt(tx, tz + 1.5) - valleyHeightAt(tx, tz - 1.5);
    slopeNormal.set(-hx, 3.0, -hz).normalize();
    const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
    shadowDisc.position.set(tx, ty + 0.05, tz);
    shadowDisc.quaternion.setFromUnitVectors(upVec, slopeNormal);
    shadowDisc.scale.setScalar(sc);
    treesGroup.add(shadowDisc);

    // Populate instanced oak-leaf rosettes in organic sunlit clusters around this tree's crown
    treeEuler.set(0, yaw, 0);
    treeQuat.setFromEuler(treeEuler);

    for (let i = 0; i < rosettesPerTree; i++) {
      const cluster = crownClusters[(i + tIdx) % crownClusters.length];
      const [cx, cy, cz, rad] = cluster;

      // Random spherical offset inside cloud cluster
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2 * Math.PI;
      const phi = Math.acos(2 * v - 1);
      const distFactor = Math.pow(Math.random(), 0.55);
      const ox = Math.sin(phi) * Math.cos(theta) * rad * distFactor;
      const oy = Math.cos(phi) * rad * 0.68 * distFactor;
      const oz = Math.sin(phi) * Math.sin(theta) * rad * distFactor;

      localPos.set(cx + ox, cy + oy, cz + oz).multiplyScalar(sc).applyQuaternion(treeQuat);
      worldPos.set(tx + localPos.x, ty - 0.85 + localPos.y, tz + localPos.z);

      dummy.position.copy(worldPos);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.55,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.55
      );
      const rs = sc * (0.76 + Math.random() * 0.54);
      dummy.scale.setScalar(rs);
      dummy.updateMatrix();
      foliageMesh.setMatrixAt(rIdx, dummy.matrix);

      // Height & outward-radius ambient occlusion + warm sunlit crown highlights
      const heightRatio = THREE.MathUtils.clamp((cy + oy - 22) / 22, 0, 1);
      const outerRatio = THREE.MathUtils.clamp(distFactor, 0, 1);
      const lightMix = heightRatio * 0.65 + outerRatio * 0.35;
      const tintR = THREE.MathUtils.lerp(0.46, 1.06, lightMix) + (Math.random() - 0.5) * 0.08;
      const tintG = THREE.MathUtils.lerp(0.56, 1.02, lightMix) + (Math.random() - 0.5) * 0.06;
      const tintB = THREE.MathUtils.lerp(0.44, 0.78, lightMix);
      leafColor.setRGB(tintR, tintG, tintB);
      foliageMesh.setColorAt(rIdx, leafColor);

      rIdx++;
    }
  });

  foliageMesh.instanceMatrix.needsUpdate = true;
  if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
  foliageMesh.computeBoundingSphere();
  treesGroup.add(foliageMesh);

  disposables.push(
    barkMap,
    barkBump,
    leafTex,
    treeShadowTex,
    trunkMat,
    leafMat,
    shadowDiscMat,
    trunkGeo,
    primaryLimbGeo,
    subBranchGeo,
    shadowDiscGeo,
    rosetteGeo
  );
  return treesGroup;
}

export function buildValleyPicnicEnvironment(
  maxAnisotropy: number,
  disposables: Disposable[]
): { group: THREE.Group; grassMat: THREE.ShaderMaterial } {
  const group = new THREE.Group();

  // =========================================================
  // 1. ROLLING MEADOW TERRAIN + HORIZON RIDGE
  // =========================================================
  const { map: grassTex, bumpMap: grassBump } = createMeadowTerrainTextures(maxAnisotropy);
  const terrainGeo = new THREE.PlaneGeometry(180, 180, 116, 116);
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
    bumpScale: 0.1,
    roughness: 0.94,
    metalness: 0.02,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // Distant sculpted mountain ridge framing the valley horizon
  const ridgeGeo = new THREE.CylinderGeometry(72, 84, 15, 72, 6, true);
  const rPos = ridgeGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const y = rPos.getY(i);
    if (y > 0) {
      const x = rPos.getX(i);
      const z = rPos.getZ(i);
      const angle = Math.atan2(z, x);
      const peak =
        Math.sin(angle * 5.0) * 4.2 +
        Math.cos(angle * 11.0 + 1.4) * 2.4 +
        fbm2D(Math.cos(angle) * 3 + 5, Math.sin(angle) * 3 + 5, 3) * 5.6;
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
  ridges.position.y = -2.0;
  group.add(ridges);

  // =========================================================
  // 2. WOVEN PICNIC BLANKET & 1:1 SCALE PICNIC PROPS
  // =========================================================
  const { map: blanketMap, bumpMap: blanketBump } = createPicnicBlanketTextures(maxAnisotropy);
  const blanketGeo = new THREE.BoxGeometry(19.5, 0.08, 16.5);
  const blanketMat = new THREE.MeshStandardMaterial({
    map: blanketMap,
    bumpMap: blanketBump,
    bumpScale: 0.03,
    roughness: 0.9,
    metalness: 0.02,
  });
  // Top face sits flush at y = -0.002 so turntable (y = 0) & contact shadow (y = 0.006) never z-fight
  const blanket = new THREE.Mesh(blanketGeo, blanketMat);
  blanket.position.set(0, -0.042, 0.25);
  blanket.receiveShadow = true;
  group.add(blanket);

  // Subtle cream woven fringe border along front & back blanket edges
  const fringeGeo = new THREE.BoxGeometry(19.6, 0.04, 0.22);
  const fringeMat = new THREE.MeshStandardMaterial({ color: 0xf0e4cf, roughness: 0.95 });
  [-8.05, 8.55].forEach((fz) => {
    const fringe = new THREE.Mesh(fringeGeo, fringeMat);
    fringe.position.set(0, -0.048, fz);
    group.add(fringe);
  });

  // Picnic Basket (top-left of blanket)
  const basket = buildPicnicBasket(maxAnisotropy, blanketMap, disposables);
  basket.position.set(-6.4, 0, -3.6);
  basket.rotation.y = 0.46;
  group.add(basket);

  // Lemonade Carafe & Glasses (front-left of blanket)
  const lemonade = buildLemonadeSet(disposables);
  lemonade.position.set(-5.3, 0, 2.3);
  lemonade.rotation.y = 0.35;
  group.add(lemonade);

  // Wooden Charcuterie Board, Bread, Cheese, Fruit & Plates (right of blanket)
  const spread = buildPicnicSpread(disposables);
  spread.position.set(5.9, 0, 1.3);
  spread.rotation.y = -0.34;
  group.add(spread);

  // Cozy Linen Throw Pillows (back corners of blanket)
  const pillowLeft = buildPicnicPillow(0xc96b4b, disposables);
  pillowLeft.position.set(-6.2, 0, -5.8);
  pillowLeft.rotation.y = 0.3;
  group.add(pillowLeft);

  const pillowRight = buildPicnicPillow(0x6f8760, disposables);
  pillowRight.position.set(6.0, 0, -5.3);
  pillowRight.rotation.y = -0.25;
  group.add(pillowRight);

  // Brass Picnic Lantern (back-left near pillow)
  const lantern = buildPicnicLantern(disposables);
  lantern.position.set(-3.8, 0, -5.4);
  group.add(lantern);

  const lanternGlow = new THREE.PointLight(0xffb563, 12, 16, 1.5);
  lanternGlow.position.set(-3.8, 1.2, -5.4);
  group.add(lanternGlow);

  // Woven Straw Sun Hat resting near right corner of blanket
  const sunHat = buildStrawSunHat(disposables);
  sunHat.position.set(6.8, 0, -2.6);
  sunHat.rotation.z = -0.08;
  group.add(sunHat);

  // =========================================================
  // 3. FULL-AREA WIND-SWAYING MEADOW GRASS (1:1 Scale ~6-11 cm)
  // =========================================================
  const tuftGeo = createMeadowGrassTuftGeometry();
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uRootColor: { value: new THREE.Color(0x1b3312) },
      uMidColor: { value: new THREE.Color(0x467628) },
      uTipColor: { value: new THREE.Color(0x94c24c) },
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
        float gust = sin(uTime * 1.75 + worldBase.x * 0.28 + worldBase.z * 0.22)
                   + 0.45 * sin(uTime * 3.1 + worldBase.x * 0.62 - worldBase.z * 0.46);
        pos.x += gust * 0.13 * bendMask;
        pos.z += gust * 0.07 * bendMask;
        pos.y -= abs(gust) * 0.022 * bendMask;

        vec4 wp = modelMatrix * instanceMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        vShade = 0.84 + 0.24 * sin(worldBase.x * 0.4 + worldBase.z * 0.5);
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
        float fogFactor = smoothstep(32.0, 72.0, dist);
        col = mix(col, uFogColor, fogFactor * 0.72);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const isInsideBlanket = (x: number, z: number) =>
    Math.abs(x) < 10.15 && z > -8.4 && z < 8.95;

  const tuftCount = 12500;
  const grassMesh = new THREE.InstancedMesh(tuftGeo, grassMat, tuftCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  while (placed < tuftCount && attempts < tuftCount * 3) {
    attempts++;
    const a = Math.random() * Math.PI * 2;
    const isNearZone = placed < 4000;
    const r = isNearZone
      ? 8.3 + Math.random() * 14.5
      : 14.0 + Math.pow(Math.random(), 0.76) * 52.0;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (isInsideBlanket(x, z)) continue;

    const y = valleyHeightAt(x, z);
    dummy.position.set(x, y - 0.03, z);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);

    // Subtle distance compensation so far meadow stays grassy without oversized giant blades
    const distBoost = 1.0 + THREE.MathUtils.smoothstep(r, 22.0, 62.0) * 0.42;
    const s = (0.72 + Math.random() * 0.58) * distBoost;
    dummy.scale.set(s, s * (0.85 + Math.random() * 0.55), s);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  grassMesh.count = placed;
  grassMesh.instanceMatrix.needsUpdate = true;
  grassMesh.computeBoundingSphere();
  group.add(grassMesh);

  // =========================================================
  // 4. DELICATE WILDFLOWERS ACROSS THE MEADOW (1:1 Scale)
  // =========================================================
  const stemGeo = new THREE.CylinderGeometry(0.011, 0.015, 0.82, 5);
  stemGeo.translate(0, 0.41, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3b6924, roughness: 0.88 });

  // Variety A: Daisies, Buttercups & Poppies (~2-3.5 cm delicate heads)
  const petalRingGeo = new THREE.DodecahedronGeometry(0.105, 0);
  petalRingGeo.scale(1.18, 0.28, 1.18);
  const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.0 });
  const centerGeo = new THREE.SphereGeometry(0.042, 8, 8);
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xffc633, roughness: 0.55 });

  // Variety B: Slender Lavender & Wild Bluebell Spikes (~12-18 cm tall)
  const spikeGeo = new THREE.ConeGeometry(0.065, 0.38, 7);
  spikeGeo.translate(0, 0.19, 0);
  const spikeMat = new THREE.MeshStandardMaterial({ roughness: 0.68, metalness: 0.0 });

  const blossomCount = 1150;
  const bStems = new THREE.InstancedMesh(stemGeo, stemMat, blossomCount);
  const bPetals = new THREE.InstancedMesh(petalRingGeo, petalMat, blossomCount);
  const bCenters = new THREE.InstancedMesh(centerGeo, centerMat, blossomCount);

  const spikeCount = 460;
  const sStems = new THREE.InstancedMesh(stemGeo, stemMat, spikeCount);
  const sHeads = new THREE.InstancedMesh(spikeGeo, spikeMat, spikeCount);

  const fCol = new THREE.Color();
  const blossomPalette = [0xfff8e6, 0xffd15c, 0xff9f8e, 0xf7b8d4, 0xffe494];
  const spikePalette = [0x9f7aea, 0xb794f4, 0x7f9cf5, 0xc3a6ff];

  let fPlaced = 0;
  let fAttempts = 0;
  while (fPlaced < blossomCount && fAttempts < blossomCount * 4) {
    fAttempts++;
    const clusterAngle = Math.random() * Math.PI * 2;
    const clusterR =
      fPlaced < 420 ? 8.6 + Math.random() * 14.0 : 14.0 + Math.pow(Math.random(), 0.82) * 42.0;
    const cx = Math.cos(clusterAngle) * clusterR;
    const cz = Math.sin(clusterAngle) * clusterR;

    const clusterSize = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < clusterSize && fPlaced < blossomCount; k++) {
      const x = cx + (Math.random() - 0.5) * 1.6;
      const z = cz + (Math.random() - 0.5) * 1.6;
      if (isInsideBlanket(x, z)) continue;

      const y = valleyHeightAt(x, z);
      const fs =
        (0.72 + Math.random() * 0.52) *
        (1.0 + THREE.MathUtils.smoothstep(clusterR, 22, 56) * 0.28);
      const tiltX = (Math.random() - 0.5) * 0.2;
      const tiltZ = (Math.random() - 0.5) * 0.2;

      dummy.position.set(x, y - 0.02, z);
      dummy.rotation.set(tiltX, Math.random() * Math.PI * 2, tiltZ);
      dummy.scale.set(fs, fs, fs);
      dummy.updateMatrix();
      bStems.setMatrixAt(fPlaced, dummy.matrix);

      dummy.position.set(x + tiltZ * 0.22, y + 0.79 * fs, z + tiltX * 0.22);
      dummy.scale.set(fs, fs, fs);
      dummy.updateMatrix();
      bPetals.setMatrixAt(fPlaced, dummy.matrix);
      bPetals.setColorAt(fPlaced, fCol.setHex(blossomPalette[fPlaced % blossomPalette.length]));

      dummy.position.set(x + tiltZ * 0.22, y + 0.82 * fs, z + tiltX * 0.22);
      dummy.updateMatrix();
      bCenters.setMatrixAt(fPlaced, dummy.matrix);

      fPlaced++;
    }
  }
  bStems.count = fPlaced;
  bPetals.count = fPlaced;
  bCenters.count = fPlaced;
  bStems.instanceMatrix.needsUpdate = true;
  bPetals.instanceMatrix.needsUpdate = true;
  bCenters.instanceMatrix.needsUpdate = true;
  if (bPetals.instanceColor) bPetals.instanceColor.needsUpdate = true;
  bStems.computeBoundingSphere();
  bPetals.computeBoundingSphere();
  bCenters.computeBoundingSphere();
  group.add(bStems, bPetals, bCenters);

  let sPlaced = 0;
  let sAttempts = 0;
  while (sPlaced < spikeCount && sAttempts < spikeCount * 4) {
    sAttempts++;
    const a = Math.random() * Math.PI * 2;
    const r = sPlaced < 160 ? 9.0 + Math.random() * 14.0 : 15.0 + Math.random() * 40.0;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (isInsideBlanket(x, z)) continue;

    const y = valleyHeightAt(x, z);
    const fs =
      (0.85 + Math.random() * 0.5) * (1.0 + THREE.MathUtils.smoothstep(r, 22, 56) * 0.28);
    const tx = (Math.random() - 0.5) * 0.16;
    const tz = (Math.random() - 0.5) * 0.16;

    dummy.position.set(x, y - 0.02, z);
    dummy.rotation.set(tx, Math.random() * Math.PI * 2, tz);
    dummy.scale.set(fs, fs * 1.25, fs);
    dummy.updateMatrix();
    sStems.setMatrixAt(sPlaced, dummy.matrix);

    dummy.position.set(x, y + 0.96 * fs, z);
    dummy.scale.set(fs, fs, fs);
    dummy.updateMatrix();
    sHeads.setMatrixAt(sPlaced, dummy.matrix);
    sHeads.setColorAt(sPlaced, fCol.setHex(spikePalette[sPlaced % spikePalette.length]));
    sPlaced++;
  }
  sStems.count = sPlaced;
  sHeads.count = sPlaced;
  sStems.instanceMatrix.needsUpdate = true;
  sHeads.instanceMatrix.needsUpdate = true;
  if (sHeads.instanceColor) sHeads.instanceColor.needsUpdate = true;
  sStems.computeBoundingSphere();
  sHeads.computeBoundingSphere();
  group.add(sStems, sHeads);

  // Sunlit oak trees in the surrounding meadow hills
  group.add(buildMeadowTrees(maxAnisotropy, grassMat.uniforms.uTime, disposables));

  disposables.push(
    grassTex,
    grassBump,
    terrainGeo,
    terrainMat,
    ridgeGeo,
    ridgeMat,
    blanketMap,
    blanketBump,
    blanketGeo,
    blanketMat,
    fringeGeo,
    fringeMat,
    tuftGeo,
    grassMat,
    stemGeo,
    stemMat,
    petalRingGeo,
    petalMat,
    centerGeo,
    centerMat,
    spikeGeo,
    spikeMat
  );

  return { group, grassMat };
}
