import * as THREE from 'three';
import { sanitizeHttpUrl } from '../utils/configCodec';

type Disposable = { dispose: () => void };

const CANVAS_W = 640;
const CANVAS_H = 840;

function createFrameWoodTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  const b = document.createElement('canvas');
  b.width = size;
  b.height = size;
  const bCtx = b.getContext('2d');

  if (ctx && bCtx) {
    ctx.fillStyle = '#5a341e';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 180; i++) {
      const y = (i / 180) * size;
      const isHighlight = i % 3 === 0;
      ctx.strokeStyle = isHighlight
        ? 'rgba(154, 96, 54, 0.24)'
        : 'rgba(26, 12, 5, 0.34)';
      ctx.lineWidth = 0.8 + (i % 4) * 0.45;
      ctx.beginPath();
      ctx.moveTo(0, y);
      const w1 = Math.sin(i * 0.7) * 6;
      const w2 = Math.cos(i * 0.5) * 6;
      ctx.bezierCurveTo(size * 0.33, y + w1, size * 0.66, y + w2, size, y);
      ctx.stroke();

      bCtx.strokeStyle = isHighlight
        ? 'rgba(205, 205, 205, 0.22)'
        : 'rgba(52, 52, 52, 0.26)';
      bCtx.lineWidth = 1.0;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.bezierCurveTo(size * 0.33, y + w1, size * 0.66, y + w2, size, y);
      bCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createFrameShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.56)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

/**
 * Manages the shared CanvasTexture displayed inside the 3D photo frame
 * across all 5 environments so updating the photo updates every scene at once.
 */
export class PhotoFrameTextureController {
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D | null;
  private imageCache = new Map<string, HTMLImageElement>();
  private latestToken = 0;
  private currentUrl = '';

  constructor(maxAnisotropy: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;

    this.drawDefaultArtwork();
  }

  public setPhotoUrl(rawUrl: string): void {
    const safeUrl = sanitizeHttpUrl(rawUrl);
    if (safeUrl === this.currentUrl && safeUrl !== '') {
      const cached = this.imageCache.get(safeUrl);
      if (cached) {
        this.drawPhoto(cached);
        return;
      }
    }
    this.currentUrl = safeUrl;
    const token = ++this.latestToken;

    if (!safeUrl) {
      this.drawDefaultArtwork();
      return;
    }

    const cached = this.imageCache.get(safeUrl);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      this.drawPhoto(cached);
      return;
    }

    const img = new Image();
    if (/^https?:\/\//i.test(safeUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      this.imageCache.set(safeUrl, img);
      if (token === this.latestToken) {
        this.drawPhoto(img);
      }
    };
    img.onerror = () => {
      if (token === this.latestToken) {
        this.drawDefaultArtwork();
      }
    };
    img.src = safeUrl;
  }

  private drawPhoto(img: HTMLImageElement): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#1d1612';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Center-crop cover fit so any portrait/square/landscape photo fills cleanly
    const scale = Math.max(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const offsetX = (CANVAS_W - drawW) * 0.5;
    const offsetY = (CANVAS_H - drawH) * 0.5;

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

    // Very subtle photographic inner edge depth so the photo sits recessed behind the mat
    const edgeGrad = ctx.createRadialGradient(
      CANVAS_W * 0.5,
      CANVAS_H * 0.5,
      CANVAS_W * 0.34,
      CANVAS_W * 0.5,
      CANVAS_H * 0.5,
      CANVAS_H * 0.64
    );
    edgeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edgeGrad.addColorStop(1, 'rgba(20, 12, 8, 0.2)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.texture.needsUpdate = true;
  }

  private drawDefaultArtwork(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // Warm archival cream gradient backdrop
    const bg = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    bg.addColorStop(0, '#f4e7d3');
    bg.addColorStop(0.55, '#ead4b8');
    bg.addColorStop(1, '#dcbfa0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle organic paper texture specks
    for (let i = 0; i < 650; i++) {
      const px = ((i * 197) % CANVAS_W);
      const py = ((i * 353) % CANVAS_H);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(110, 74, 44, 0.045)' : 'rgba(255, 252, 245, 0.08)';
      ctx.fillRect(px, py, 2, 2);
    }

    // Fine gold inner hairline frame
    ctx.strokeStyle = 'rgba(156, 102, 54, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(34, 34, CANVAS_W - 68, CANVAS_H - 68);
    ctx.strokeStyle = 'rgba(156, 102, 54, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(46, 46, CANVAS_W - 92, CANVAS_H - 92);

    // Soft sunset glow circle behind minimalist romantic vinyl + heart motif
    const cx = CANVAS_W * 0.5;
    const cy = CANVAS_H * 0.43;
    const glow = ctx.createRadialGradient(cx, cy, 24, cx, cy, 190);
    glow.addColorStop(0, 'rgba(232, 159, 101, 0.42)');
    glow.addColorStop(0.65, 'rgba(217, 119, 66, 0.14)');
    glow.addColorStop(1, 'rgba(217, 119, 66, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 190, 0, Math.PI * 2);
    ctx.fill();

    // Stylized minimalist vinyl record emblem
    ctx.fillStyle = '#2c2019';
    ctx.beginPath();
    ctx.arc(cx, cy, 116, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(244, 231, 211, 0.22)';
    ctx.lineWidth = 2;
    [98, 82, 66].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Warm terracotta center label
    ctx.fillStyle = '#d97b48';
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fill();

    // Delicate cream heart inside center label
    ctx.save();
    ctx.translate(cx, cy + 4);
    ctx.fillStyle = '#fdf4e7';
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.bezierCurveTo(-22, -2, -22, -20, -10, -20);
    ctx.bezierCurveTo(-3, -20, 0, -13, 0, -10);
    ctx.bezierCurveTo(0, -13, 3, -20, 10, -20);
    ctx.bezierCurveTo(22, -20, 22, -2, 0, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sparkle accents
    const drawStar = (sx: number, sy: number, r: number) => {
      ctx.fillStyle = 'rgba(168, 104, 52, 0.58)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - r);
      ctx.quadraticCurveTo(sx, sy, sx + r, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy + r);
      ctx.quadraticCurveTo(sx, sy, sx - r, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy - r);
      ctx.closePath();
      ctx.fill();
    };
    drawStar(cx - 148, cy - 110, 14);
    drawStar(cx + 146, cy - 72, 10);
    drawStar(cx + 122, cy + 124, 12);

    // Subtle editorial caption inviting photo customization
    ctx.fillStyle = '#4f3320';
    ctx.font = 'italic 600 36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nuestro Recuerdo', cx, CANVAS_H * 0.74);

    ctx.fillStyle = 'rgba(96, 62, 38, 0.72)';
    ctx.font = '500 20px sans-serif';
    ctx.fillText('Añade tu foto favorita', cx, CANVAS_H * 0.805);

    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.imageCache.clear();
    this.texture.dispose();
  }
}

/**
 * Builds the detailed composite 3D wooden & brass photo frame prop.
 * - When `floating` is false (picnic, bosque, studio, bote): leans back naturally on a hinged easel
 *   kickstand with its base and easel foot seated flush at y = 0.
 * - When `floating` is true (espacio): the exact same frame with the kickstand neatly folded flush
 *   against the backing board, pivoted at its visual center for smooth zero-gravity floating.
 */
export function buildPhotoFrameProp(
  photoTexture: THREE.Texture,
  maxAnisotropy: number,
  disposables: Disposable[],
  options?: { floating?: boolean; scale?: number }
): THREE.Group {
  const floating = Boolean(options?.floating);
  const scale = options?.scale ?? 1.0;

  const root = new THREE.Group();
  const assembly = new THREE.Group();

  // Frame real-world dimensions (1 unit ≈ 10 cm → ~15.8 × 20.0 cm classic 5×7" frame)
  const OUTER_W = 1.58;
  const OUTER_H = 2.0;
  const BORDER = 0.145;
  const INNER_W = OUTER_W - BORDER * 2; // 1.29
  const INNER_H = OUTER_H - BORDER * 2; // 1.71
  const FRAME_DEPTH = 0.11;

  const PHOTO_W = 1.04;
  const PHOTO_H = 1.365; // Matches 640 x 840 canvas aspect ratio cleanly

  const { map: woodMap, bumpMap: woodBump } = createFrameWoodTextures(maxAnisotropy);
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodMap,
    bumpMap: woodBump,
    bumpScale: 0.018,
    roughness: 0.44,
    metalness: 0.06,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a85e,
    roughness: 0.26,
    metalness: 0.86,
  });
  const matBoardMat = new THREE.MeshStandardMaterial({
    color: 0xf4ede1,
    roughness: 0.88,
    metalness: 0.0,
  });
  const backBoardMat = new THREE.MeshStandardMaterial({
    color: 0x241914,
    roughness: 0.82,
    metalness: 0.04,
  });
  const photoMat = new THREE.MeshStandardMaterial({
    map: photoTexture,
    roughness: 0.52,
    metalness: 0.02,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.07,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  });

  // 1. Beveled wooden outer frame molding (extruded rectangle with rectangular cutout)
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-OUTER_W / 2, -OUTER_H / 2);
  frameShape.lineTo(OUTER_W / 2, -OUTER_H / 2);
  frameShape.lineTo(OUTER_W / 2, OUTER_H / 2);
  frameShape.lineTo(-OUTER_W / 2, OUTER_H / 2);
  frameShape.closePath();

  const frameHole = new THREE.Path();
  frameHole.moveTo(-INNER_W / 2, -INNER_H / 2);
  frameHole.lineTo(-INNER_W / 2, INNER_H / 2);
  frameHole.lineTo(INNER_W / 2, INNER_H / 2);
  frameHole.lineTo(INNER_W / 2, -INNER_H / 2);
  frameHole.closePath();
  frameShape.holes.push(frameHole);

  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: FRAME_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.022,
    bevelSegments: 3,
  });
  frameGeo.translate(0, 0, -FRAME_DEPTH / 2);
  // Normalize UVs so wood grain wraps cleanly across frame rails
  const fUv = frameGeo.attributes.uv;
  for (let i = 0; i < fUv.count; i++) {
    fUv.setXY(i, fUv.getX(i) * 0.65, fUv.getY(i) * 0.65);
  }
  fUv.needsUpdate = true;

  const frameMesh = new THREE.Mesh(frameGeo, woodMat);
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  assembly.add(frameMesh);

  // 2. Brushed brass inner fillet border along the wood aperture
  const filletOuterW = INNER_W + 0.015;
  const filletOuterH = INNER_H + 0.015;
  const filletInnerW = INNER_W - 0.036;
  const filletInnerH = INNER_H - 0.036;

  const filletShape = new THREE.Shape();
  filletShape.moveTo(-filletOuterW / 2, -filletOuterH / 2);
  filletShape.lineTo(filletOuterW / 2, -filletOuterH / 2);
  filletShape.lineTo(filletOuterW / 2, filletOuterH / 2);
  filletShape.lineTo(-filletOuterW / 2, filletOuterH / 2);
  filletShape.closePath();

  const filletHole = new THREE.Path();
  filletHole.moveTo(-filletInnerW / 2, -filletInnerH / 2);
  filletHole.lineTo(-filletInnerW / 2, filletInnerH / 2);
  filletHole.lineTo(filletInnerW / 2, filletInnerH / 2);
  filletHole.lineTo(filletInnerW / 2, -filletInnerH / 2);
  filletHole.closePath();
  filletShape.holes.push(filletHole);

  const filletGeo = new THREE.ExtrudeGeometry(filletShape, {
    depth: 0.024,
    bevelEnabled: false,
  });
  const filletMesh = new THREE.Mesh(filletGeo, brassMat);
  filletMesh.position.z = 0.032;
  assembly.add(filletMesh);

  // 3. Archival cream passe-partout mat board (3D cutout around the photo opening)
  const matShape = new THREE.Shape();
  matShape.moveTo(-INNER_W / 2 - 0.01, -INNER_H / 2 - 0.01);
  matShape.lineTo(INNER_W / 2 + 0.01, -INNER_H / 2 - 0.01);
  matShape.lineTo(INNER_W / 2 + 0.01, INNER_H / 2 + 0.01);
  matShape.lineTo(-INNER_W / 2 - 0.01, INNER_H / 2 + 0.01);
  matShape.closePath();

  const matHole = new THREE.Path();
  matHole.moveTo(-PHOTO_W / 2, -PHOTO_H / 2);
  matHole.lineTo(-PHOTO_W / 2, PHOTO_H / 2);
  matHole.lineTo(PHOTO_W / 2, PHOTO_H / 2);
  matHole.lineTo(PHOTO_W / 2, -PHOTO_H / 2);
  matHole.closePath();
  matShape.holes.push(matHole);

  const matGeo = new THREE.ExtrudeGeometry(matShape, {
    depth: 0.016,
    bevelEnabled: false,
  });
  const matMesh = new THREE.Mesh(matGeo, matBoardMat);
  matMesh.position.z = 0.008;
  assembly.add(matMesh);

  // 4. Photo surface seated cleanly behind the mat aperture (zero Z-fighting)
  const photoGeo = new THREE.PlaneGeometry(PHOTO_W + 0.02, PHOTO_H + 0.02);
  const photoMesh = new THREE.Mesh(photoGeo, photoMat);
  photoMesh.position.z = 0.004;
  assembly.add(photoMesh);

  // 5. Clear protective glass glaze slightly in front of the mat
  const glassGeo = new THREE.PlaneGeometry(INNER_W - 0.02, INNER_H - 0.02);
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.z = 0.038;
  glassMesh.renderOrder = 3;
  assembly.add(glassMesh);

  // 6. Dark velvet/wood backing board + 4 brass corner turn-buttons on rear
  const backGeo = new THREE.BoxGeometry(INNER_W + 0.06, INNER_H + 0.06, 0.04);
  const backMesh = new THREE.Mesh(backGeo, backBoardMat);
  backMesh.position.z = -0.044;
  assembly.add(backMesh);

  const clipGeo = new THREE.BoxGeometry(0.11, 0.035, 0.014);
  [
    [-0.56, 0.72],
    [0.56, 0.72],
    [-0.56, -0.72],
    [0.56, -0.72],
  ].forEach(([cx, cy]) => {
    const clip = new THREE.Mesh(clipGeo, brassMat);
    clip.position.set(cx, cy, -0.068);
    assembly.add(clip);
  });

  // Brass wall-hang D-ring detail on top back
  const hangRingGeo = new THREE.TorusGeometry(0.055, 0.011, 6, 14);
  const hangRing = new THREE.Mesh(hangRingGeo, brassMat);
  hangRing.position.set(0, 0.78, -0.072);
  assembly.add(hangRing);

  // 7. Hinged easel kickstand leg (extended when standing, neatly folded flat when floating in space)
  const hingeY = floating ? 0.04 : -0.12;
  const legLen = floating ? 0.84 : 1.04;
  const legShape = new THREE.Shape();
  legShape.moveTo(-0.18, 0);
  legShape.lineTo(0.18, 0);
  legShape.lineTo(0.11, -legLen);
  legShape.lineTo(-0.11, -legLen);
  legShape.closePath();

  const legGeo = new THREE.ExtrudeGeometry(legShape, {
    depth: 0.032,
    bevelEnabled: false,
  });
  legGeo.translate(0, 0, -0.032);

  const easelPivot = new THREE.Group();
  easelPivot.position.set(0, hingeY, -0.064);
  const easelMesh = new THREE.Mesh(legGeo, backBoardMat);
  easelMesh.castShadow = !floating;
  easelPivot.add(easelMesh);

  const hingePinGeo = new THREE.BoxGeometry(0.28, 0.045, 0.025);
  const hingePin = new THREE.Mesh(hingePinGeo, brassMat);
  hingePin.position.set(0, 0, -0.01);
  easelPivot.add(hingePin);
  assembly.add(easelPivot);

  if (floating) {
    // Fold kickstand flush against back panel; pivot at visual center for smooth zero-g float
    easelPivot.rotation.x = 0.015;
    root.add(assembly);
  } else {
    // Lean frame back naturally (~13.5°) and extend easel leg so both bottom lip & foot meet y = 0
    const tiltRad = 0.24;
    assembly.rotation.x = -tiltRad;

    // Lowest point of the tilted beveled outer frame (bottom-back corner)
    const halfH = OUTER_H * 0.5 + 0.022;
    const halfD = FRAME_DEPTH * 0.5 + 0.026;
    const minY = -halfH * Math.cos(tiltRad) - halfD * Math.sin(tiltRad);
    assembly.position.y = -minY;

    // Solve easel angle so the easel leg tip touches y = 0 precisely
    const hingeWorldY =
      assembly.position.y + hingeY * Math.cos(tiltRad) + -0.064 * Math.sin(tiltRad);
    const desiredCos = THREE.MathUtils.clamp(hingeWorldY / legLen, 0.35, 0.96);
    const legWorldAngleFromDown = Math.acos(desiredCos);
    easelPivot.rotation.x = legWorldAngleFromDown + tiltRad;

    root.add(assembly);

    // Subtle grounding contact shadow under frame & easel foot
    const shadowTex = createFrameShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1.95, 1.45);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, 0.004, -0.26);
    root.add(shadowPlane);
    disposables.push(shadowTex, shadowGeo, shadowMat);
  }

  root.scale.setScalar(scale);

  disposables.push(
    woodMap,
    woodBump,
    woodMat,
    brassMat,
    matBoardMat,
    backBoardMat,
    photoMat,
    glassMat,
    frameGeo,
    filletGeo,
    matGeo,
    photoGeo,
    glassGeo,
    backGeo,
    clipGeo,
    hangRingGeo,
    legGeo,
    hingePinGeo
  );

  return root;
}
