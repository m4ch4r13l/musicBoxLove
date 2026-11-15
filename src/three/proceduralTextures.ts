import * as THREE from 'three';
import type { PlinthFinish, RpmMode, VinylDisc } from '../types/turntable';
import { sanitizeColor } from '../utils/configCodec';

const FINISH_PALETTES: Record<
  PlinthFinish,
  { base: string; dark: string; highlight: string }
> = {
  walnut: {
    base: '#4e2d18',
    dark: 'rgba(22, 10, 4, 0.32)',
    highlight: 'rgba(130, 78, 42, 0.18)',
  },
  ebony: {
    base: '#1e1b1a',
    dark: 'rgba(8, 7, 7, 0.42)',
    highlight: 'rgba(72, 64, 58, 0.16)',
  },
  oak: {
    base: '#8a6039',
    dark: 'rgba(64, 41, 20, 0.25)',
    highlight: 'rgba(196, 152, 102, 0.22)',
  },
};

export function paintWoodCanvas(
  canvas: HTMLCanvasElement,
  finish: PlinthFinish
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const palette = FINISH_PALETTES[finish];
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 460; i++) {
    ctx.strokeStyle = i % 3 === 0 ? palette.highlight : palette.dark;
    ctx.lineWidth = 0.8 + Math.random() * 2.4;
    ctx.beginPath();
    const y = Math.random() * h;
    const wave1 = (Math.random() - 0.5) * 22;
    const wave2 = (Math.random() - 0.5) * 22;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.33, y + wave1, w * 0.66, y + wave2, w, y);
    ctx.stroke();
  }
}

export function createWoodTextures(
  finish: PlinthFinish,
  maxAnisotropy: number
): {
  canvas: HTMLCanvasElement;
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  paintWoodCanvas(canvas, finish);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d');
  if (rCtx) {
    rCtx.fillStyle = '#7c7c7c';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 320; i++) {
      rCtx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
      rCtx.lineWidth = 1 + Math.random() * 2;
      rCtx.beginPath();
      const y = Math.random() * 512;
      rCtx.moveTo(0, y);
      rCtx.lineTo(512, y + (Math.random() - 0.5) * 10);
      rCtx.stroke();
    }
  }
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { canvas, map, roughnessMap };
}

export function createVinylGroovesTextures(maxAnisotropy: number): {
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;

  if (rCtx && bCtx) {
    // Base glossy black vinyl
    rCtx.fillStyle = '#383838';
    rCtx.fillRect(0, 0, size, size);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    // Subtle anisotropic sheen wedge simulation
    for (let a = 0; a < 2; a++) {
      const grad = rCtx.createConicGradient(a * Math.PI, cx, cy);
      grad.addColorStop(0, 'rgba(255,255,255,0.16)');
      grad.addColorStop(0.12, 'rgba(255,255,255,0.02)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.16)');
      grad.addColorStop(0.62, 'rgba(255,255,255,0.02)');
      grad.addColorStop(1, 'rgba(255,255,255,0.16)');
      rCtx.fillStyle = grad;
      rCtx.beginPath();
      rCtx.arc(cx, cy, size * 0.49, 0, Math.PI * 2);
      rCtx.fill();
    }

    // Concentric grooves with silent track separator bands
    const innerR = size * 0.185;
    const outerR = size * 0.482;
    for (let r = innerR; r < outerR; r += 1.65) {
      const norm = (r - innerR) / (outerR - innerR);
      // Track silent gaps around 0.28, 0.56, 0.82
      const isTrackGap =
        Math.abs(norm - 0.28) < 0.015 ||
        Math.abs(norm - 0.56) < 0.015 ||
        Math.abs(norm - 0.82) < 0.012 ||
        norm < 0.045;

      if (isTrackGap) {
        rCtx.strokeStyle = 'rgba(20, 20, 20, 0.45)';
        rCtx.lineWidth = 1.4;
        rCtx.beginPath();
        rCtx.arc(cx, cy, r, 0, Math.PI * 2);
        rCtx.stroke();
        continue;
      }

      const bright = (Math.floor(r) % 3 === 0);
      rCtx.strokeStyle = bright ? 'rgba(225,225,225,0.22)' : 'rgba(20,20,20,0.32)';
      rCtx.lineWidth = 0.85;
      rCtx.beginPath();
      rCtx.arc(cx, cy, r, 0, Math.PI * 2);
      rCtx.stroke();

      bCtx.strokeStyle = bright ? 'rgba(210,210,210,0.45)' : 'rgba(55,55,55,0.45)';
      bCtx.lineWidth = 0.85;
      bCtx.beginPath();
      bCtx.arc(cx, cy, r, 0, Math.PI * 2);
      bCtx.stroke();
    }
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;

  return { roughnessMap, bumpMap };
}

export function createStrobeRimTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#8b857e';
    ctx.fillRect(0, 0, 1024, 64);

    // Three rows of precision machined strobe dots
    ctx.fillStyle = '#25211e';
    const cols = 96;
    for (let i = 0; i < cols; i++) {
      const x = (i / cols) * 1024;
      ctx.beginPath();
      ctx.arc(x + 5, 18, 2.2, 0, Math.PI * 2);
      ctx.arc(x + 5, 32, 3.1, 0, Math.PI * 2);
      ctx.arc(x + 5, 46, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createTabletopTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#171210';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 232, 210, 0.018)' : 'rgba(0, 0, 0, 0.14)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 126);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export class LabelTextureController {
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D | null;

  constructor(maxAnisotropy: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;
  }

  public update(disc: VinylDisc, rpm: RpmMode): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const labelColor = sanitizeColor(disc.labelColor, '#d97742');
    ctx.clearRect(0, 0, 512, 512);

    // Base label paper
    ctx.fillStyle = labelColor;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle paper grain rings
    ctx.strokeStyle = 'rgba(28, 19, 13, 0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(256, 256, 232, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 256, 214, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(28, 19, 13, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(256, 256, 118, 0, Math.PI * 2);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#1b120c';
    ctx.font = '600 25px Georgia, serif';
    ctx.textAlign = 'center';
    const shortTitle = String(disc.title || 'Nuestro Disco').slice(0, 24);
    ctx.fillText(shortTitle, 256, 156);

    // Artist
    ctx.font = '500 17px sans-serif';
    ctx.fillStyle = 'rgba(27, 18, 12, 0.78)';
    const shortArtist = String(disc.artist || 'Edición Especial').slice(0, 26);
    ctx.fillText(shortArtist, 256, 186);

    // Side & RPM badge
    ctx.font = '600 14px sans-serif';
    ctx.fillStyle = 'rgba(27, 18, 12, 0.72)';
    ctx.fillText(`LADO A  ·  ${rpm} RPM`, 256, 336);

    // Date
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillStyle = 'rgba(27, 18, 12, 0.85)';
    const shortDate = String(disc.date || 'Para Ti').slice(0, 26);
    ctx.fillText(shortDate, 256, 368);

    // Spindle cutout ring
    ctx.fillStyle = '#100c0a';
    ctx.beginPath();
    ctx.arc(256, 256, 22, 0, Math.PI * 2);
    ctx.fill();

    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.texture.dispose();
  }
}
