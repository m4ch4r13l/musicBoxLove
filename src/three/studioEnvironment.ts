import * as THREE from 'three';
import { buildPhotoFrameProp } from './photoFrameProp';

type Disposable = { dispose: () => void };

function createStudioWoodTexture(
  maxAnisotropy: number,
  baseHex: string,
  grainAlpha = 0.2,
  repeatX = 2,
  repeatY = 2
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

    for (let i = 0; i < 240; i++) {
      const y = (i / 240) * size + (Math.random() - 0.5) * 3;
      const dark = i % 3 !== 0;
      ctx.strokeStyle = dark
        ? `rgba(20, 10, 5, ${grainAlpha})`
        : `rgba(210, 165, 118, ${grainAlpha * 0.55})`;
      ctx.lineWidth = 1 + Math.random() * 2.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        size * 0.33,
        y + (Math.random() - 0.5) * 8,
        size * 0.66,
        y + (Math.random() - 0.5) * 8,
        size,
        y + (Math.random() - 0.5) * 4
      );
      ctx.stroke();

      bCtx.strokeStyle = dark ? 'rgba(45,45,45,0.4)' : 'rgba(205,205,205,0.3)';
      bCtx.lineWidth = 1.5;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(size, y);
      bCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatX, repeatY);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createHardwoodFloorTexture(maxAnisotropy: number): {
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
    ctx.fillStyle = '#3c2618';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#888888';
    bCtx.fillRect(0, 0, size, size);

    const rows = 8;
    const rowH = size / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      const offset = (r % 2) * (size * 0.5);
      for (let c = -1; c < 2; c++) {
        const x = c * (size * 0.5) + offset;
        const shade = ((r * 7 + c * 13) % 5) * 4 - 8;
        ctx.fillStyle = `rgb(${76 + shade}, ${50 + Math.round(shade * 0.7)}, ${33 + Math.round(shade * 0.5)})`;
        ctx.fillRect(x + 2, y + 2, size * 0.5 - 4, rowH - 4);

        ctx.strokeStyle = 'rgba(20, 10, 5, 0.22)';
        for (let g = 0; g < 14; g++) {
          const gy = y + 4 + Math.random() * (rowH - 8);
          ctx.beginPath();
          ctx.moveTo(x + 3, gy);
          ctx.lineTo(x + size * 0.5 - 3, gy);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#1c110a';
      ctx.fillRect(0, y, size, 2.5);
      bCtx.fillStyle = '#262626';
      bCtx.fillRect(0, y, size, 2.5);
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(11, 11);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(11, 11);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createStudioRugTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#38221d';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#9b6442';
    ctx.lineWidth = 18;
    ctx.strokeRect(26, 26, size - 52, size - 52);
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 4;
    ctx.strokeRect(46, 46, size - 92, size - 92);

    ctx.strokeStyle = 'rgba(224, 174, 122, 0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const inset = 84 + i * 38;
      ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
    }

    for (let i = 0; i < 3200; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,230,200,0.035)' : 'rgba(15,8,6,0.08)';
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createAlbumArtTexture(
  maxAnisotropy: number,
  bgHex: string,
  accentHex: string,
  variant: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, bgHex);
    grad.addColorStop(1, '#120e0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = accentHex;
    if (variant % 3 === 0) {
      ctx.beginPath();
      ctx.arc(128, 124, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#181210';
      ctx.fillRect(42, 134, 172, 68);
    } else if (variant % 3 === 1) {
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = 0.25 + i * 0.1;
        ctx.fillRect(36, 44 + i * 24, 184, 12);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.moveTo(128, 38);
      ctx.lineTo(212, 198);
      ctx.lineTo(44, 198);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,244,230,0.7)';
    ctx.fillRect(34, 214, 92, 6);
    ctx.fillStyle = 'rgba(255,244,230,0.35)';
    ctx.fillRect(34, 226, 62, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSunburstTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, 12, size * 0.5, size * 0.5, size * 0.55);
    grad.addColorStop(0, '#f2ab46');
    grad.addColorStop(0.5, '#c4511c');
    grad.addColorStop(0.88, '#381208');
    grad.addColorStop(1, '#1a0804');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createAmpGrilleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#241e18';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 6) {
      ctx.fillStyle = y % 12 === 0 ? 'rgba(182, 148, 102, 0.36)' : 'rgba(85, 68, 48, 0.25)';
      ctx.fillRect(0, y, size, 2);
    }
    for (let x = 0; x < size; x += 6) {
      ctx.fillStyle = 'rgba(218, 185, 134, 0.24)';
      ctx.fillRect(x, 0, 2, size);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createVuMeterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f2d39c';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#2d1c12';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 118, 86, Math.PI * 1.18, Math.PI * 1.72);
    ctx.stroke();

    ctx.strokeStyle = '#c43b28';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(128, 118, 86, Math.PI * 1.72, Math.PI * 1.84);
    ctx.stroke();

    ctx.strokeStyle = '#18100c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(128, 118);
    ctx.lineTo(176, 44);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// True 1:1 scale relative to turntable (1 unit ≈ 10 cm, vinyl record = 3.1 units / 30 cm)
function buildStudioMonitorSpeaker(disposables: Disposable[]): THREE.Group {
  const speaker = new THREE.Group();

  const cabMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b1a,
    roughness: 0.62,
    metalness: 0.08,
  });
  const baffleMat = new THREE.MeshStandardMaterial({
    color: 0x131111,
    roughness: 0.42,
    metalness: 0.14,
  });
  const foamPadMat = new THREE.MeshStandardMaterial({
    color: 0x111010,
    roughness: 0.94,
    metalness: 0.0,
  });
  const kevlarMat = new THREE.MeshStandardMaterial({
    color: 0xe3a832,
    roughness: 0.48,
    metalness: 0.12,
  });
  const surroundMat = new THREE.MeshStandardMaterial({
    color: 0x0b0a0a,
    roughness: 0.75,
    metalness: 0.05,
  });
  const brassRingMat = new THREE.MeshStandardMaterial({
    color: 0x4b4642,
    roughness: 0.28,
    metalness: 0.85,
  });
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xffa742,
    emissive: 0xff8a1c,
    emissiveIntensity: 1.8,
  });

  // Acoustic isolation wedge pad (grounded at y = 0, ~24cm W x 35cm H x 26cm D)
  const padGeo = new THREE.BoxGeometry(2.45, 0.2, 2.55);
  const pad = new THREE.Mesh(padGeo, foamPadMat);
  pad.position.y = 0.1;
  pad.castShadow = true;
  speaker.add(pad);

  const cabGeo = new THREE.BoxGeometry(2.35, 3.35, 2.45);
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.y = 1.875;
  cab.castShadow = true;
  cab.receiveShadow = true;
  speaker.add(cab);

  const baffleGeo = new THREE.BoxGeometry(2.18, 3.16, 0.12);
  const baffle = new THREE.Mesh(baffleGeo, baffleMat);
  baffle.position.set(0, 1.875, 1.24);
  speaker.add(baffle);

  const conePts = [
    new THREE.Vector2(0.16, 0.06),
    new THREE.Vector2(0.66, -0.11),
    new THREE.Vector2(0.74, 0.0),
  ];
  const wooferGeo = new THREE.LatheGeometry(conePts, 32);
  wooferGeo.rotateX(Math.PI / 2);
  const woofer = new THREE.Mesh(wooferGeo, kevlarMat);
  woofer.position.set(0, 1.44, 1.31);
  speaker.add(woofer);

  const surroundGeo = new THREE.TorusGeometry(0.73, 0.068, 12, 32);
  const surround = new THREE.Mesh(surroundGeo, surroundMat);
  surround.position.set(0, 1.44, 1.32);
  speaker.add(surround);

  const dustCapGeo = new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  dustCapGeo.rotateX(Math.PI / 2);
  const dustCap = new THREE.Mesh(dustCapGeo, surroundMat);
  dustCap.position.set(0, 1.44, 1.28);
  speaker.add(dustCap);

  const tweeterRingGeo = new THREE.TorusGeometry(0.28, 0.055, 10, 24);
  const tweeterRing = new THREE.Mesh(tweeterRingGeo, brassRingMat);
  tweeterRing.position.set(0, 2.74, 1.32);
  speaker.add(tweeterRing);

  const tweeterDomeGeo = new THREE.SphereGeometry(0.135, 16, 12);
  const tweeterDome = new THREE.Mesh(tweeterDomeGeo, surroundMat);
  tweeterDome.position.set(0, 2.74, 1.3);
  speaker.add(tweeterDome);

  const portGeo = new THREE.BoxGeometry(1.25, 0.14, 0.08);
  const port = new THREE.Mesh(portGeo, surroundMat);
  port.position.set(0, 0.54, 1.29);
  speaker.add(port);

  const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 2.24, 1.32);
  speaker.add(led);

  disposables.push(
    cabMat,
    baffleMat,
    foamPadMat,
    kevlarMat,
    surroundMat,
    brassRingMat,
    ledMat,
    padGeo,
    cabGeo,
    baffleGeo,
    wooferGeo,
    surroundGeo,
    dustCapGeo,
    tweeterRingGeo,
    tweeterDomeGeo,
    portGeo,
    ledGeo
  );
  return speaker;
}

// 25-key MIDI controller (~46 cm wide x 21 cm deep)
function buildMidiController(disposables: Disposable[]): THREE.Group {
  const midi = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1b191c,
    roughness: 0.42,
    metalness: 0.35,
  });
  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0x5c361e,
    roughness: 0.55,
    metalness: 0.05,
  });
  const whiteKeyMat = new THREE.MeshStandardMaterial({
    color: 0xf4eee4,
    roughness: 0.25,
    metalness: 0.04,
  });
  const blackKeyMat = new THREE.MeshStandardMaterial({
    color: 0x141214,
    roughness: 0.38,
    metalness: 0.12,
  });
  const knobMat = new THREE.MeshStandardMaterial({
    color: 0xc8b9a6,
    roughness: 0.26,
    metalness: 0.82,
  });

  const chassisGeo = new THREE.BoxGeometry(4.5, 0.32, 2.05);
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.position.y = 0.16;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  midi.add(chassis);

  const cheekGeo = new THREE.BoxGeometry(0.16, 0.38, 2.12);
  [-2.32, 2.32].forEach((cx) => {
    const cheek = new THREE.Mesh(cheekGeo, walnutMat);
    cheek.position.set(cx, 0.19, 0);
    cheek.castShadow = true;
    midi.add(cheek);
  });

  const wKeyGeo = new THREE.BoxGeometry(0.23, 0.12, 0.96);
  const wKeys = new THREE.InstancedMesh(wKeyGeo, whiteKeyMat, 15);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 15; i++) {
    dummy.position.set(-1.62 + i * 0.246, 0.34, 0.46);
    dummy.updateMatrix();
    wKeys.setMatrixAt(i, dummy.matrix);
  }
  wKeys.instanceMatrix.needsUpdate = true;
  wKeys.computeBoundingSphere();
  midi.add(wKeys);

  const blackIndices = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12];
  const bKeyGeo = new THREE.BoxGeometry(0.138, 0.14, 0.6);
  const bKeys = new THREE.InstancedMesh(bKeyGeo, blackKeyMat, blackIndices.length);
  blackIndices.forEach((slot, idx) => {
    dummy.position.set(-1.5 + slot * 0.246, 0.39, 0.27);
    dummy.updateMatrix();
    bKeys.setMatrixAt(idx, dummy.matrix);
  });
  bKeys.instanceMatrix.needsUpdate = true;
  bKeys.computeBoundingSphere();
  midi.add(bKeys);

  const padGeo = new THREE.BoxGeometry(0.3, 0.05, 0.3);
  const padColors = [0xff8c42, 0xffb347, 0x52b788, 0xe76f51];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const col = padColors[(r * 4 + c) % padColors.length];
      const pMat = new THREE.MeshStandardMaterial({
        color: 0x262326,
        emissive: col,
        emissiveIntensity: 0.45,
        roughness: 0.55,
      });
      disposables.push(pMat);
      const pad = new THREE.Mesh(padGeo, pMat);
      pad.position.set(-1.62 + c * 0.37, 0.335, -0.68 + r * 0.37);
      midi.add(pad);
    }
  }

  const knobGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.14, 16);
  for (let i = 0; i < 4; i++) {
    const knob = new THREE.Mesh(knobGeo, knobMat);
    knob.position.set(0.25 + i * 0.44, 0.36, -0.5);
    midi.add(knob);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  [-2.06, -1.86].forEach((wx) => {
    const wheel = new THREE.Mesh(wheelGeo, blackKeyMat);
    wheel.position.set(wx, 0.32, 0.4);
    midi.add(wheel);
  });

  disposables.push(
    bodyMat,
    walnutMat,
    whiteKeyMat,
    blackKeyMat,
    knobMat,
    chassisGeo,
    cheekGeo,
    wKeyGeo,
    bKeyGeo,
    padGeo,
    knobGeo,
    wheelGeo
  );
  return midi;
}

// Desktop audio interface (~22 cm wide x 14 cm deep x 5.5 cm tall)
function buildAudioInterface(disposables: Disposable[]): THREE.Group {
  const iface = new THREE.Group();

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x241d1e,
    roughness: 0.34,
    metalness: 0.72,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x111012,
    roughness: 0.32,
    metalness: 0.58,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xd8cfc4,
    roughness: 0.22,
    metalness: 0.9,
  });
  const ledGreenMat = new THREE.MeshStandardMaterial({
    color: 0x6ce89c,
    emissive: 0x3bd479,
    emissiveIntensity: 1.6,
  });
  const ledAmberMat = new THREE.MeshStandardMaterial({
    color: 0xffa742,
    emissive: 0xff7b1c,
    emissiveIntensity: 1.6,
  });

  const bodyGeo = new THREE.BoxGeometry(2.2, 0.54, 1.38);
  const body = new THREE.Mesh(bodyGeo, shellMat);
  body.position.y = 0.27;
  body.castShadow = true;
  iface.add(body);

  const faceGeo = new THREE.BoxGeometry(2.1, 0.44, 0.08);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.set(0, 0.27, 0.69);
  iface.add(face);

  const bigKnobGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.12, 24);
  bigKnobGeo.rotateX(Math.PI / 2);
  const bigKnob = new THREE.Mesh(bigKnobGeo, metalMat);
  bigKnob.position.set(0.68, 0.27, 0.76);
  iface.add(bigKnob);

  const jackGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.06, 16);
  jackGeo.rotateX(Math.PI / 2);
  const smallKnobGeo = new THREE.CylinderGeometry(0.065, 0.072, 0.11, 16);
  smallKnobGeo.rotateX(Math.PI / 2);
  [-0.72, -0.36].forEach((jx) => {
    const jack = new THREE.Mesh(jackGeo, shellMat);
    jack.position.set(jx, 0.25, 0.73);
    iface.add(jack);

    const gKnob = new THREE.Mesh(smallKnobGeo, metalMat);
    gKnob.position.set(jx + 0.42, 0.3, 0.76);
    iface.add(gKnob);
  });

  const ledGeo = new THREE.SphereGeometry(0.032, 8, 8);
  [
    [-0.02, 0.39, ledGreenMat],
    [0.14, 0.39, ledGreenMat],
    [0.3, 0.39, ledAmberMat],
  ].forEach(([lx, ly, mat]) => {
    const led = new THREE.Mesh(ledGeo, mat as THREE.Material);
    led.position.set(lx as number, ly as number, 0.74);
    iface.add(led);
  });

  disposables.push(
    shellMat,
    faceMat,
    metalMat,
    ledGreenMat,
    ledAmberMat,
    bodyGeo,
    faceGeo,
    bigKnobGeo,
    jackGeo,
    smallKnobGeo,
    ledGeo
  );
  return iface;
}

// Desktop condenser mic + boom arm (~36 cm tall)
function buildCondenserMicStand(disposables: Disposable[]): THREE.Group {
  const mic = new THREE.Group();

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x181718,
    roughness: 0.68,
    metalness: 0.45,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe6dfd6,
    roughness: 0.18,
    metalness: 0.94,
  });
  const brassMeshMat = new THREE.MeshStandardMaterial({
    color: 0xd9a85e,
    roughness: 0.34,
    metalness: 0.85,
  });
  const popMat = new THREE.MeshStandardMaterial({
    color: 0x151415,
    roughness: 0.88,
    metalness: 0.08,
    transparent: true,
    opacity: 0.86,
  });

  const baseGeo = new THREE.CylinderGeometry(0.68, 0.76, 0.16, 24);
  const base = new THREE.Mesh(baseGeo, ironMat);
  base.position.y = 0.08;
  base.castShadow = true;
  mic.add(base);

  const shaftGeo = new THREE.CylinderGeometry(0.075, 0.09, 2.55, 14);
  const shaft = new THREE.Mesh(shaftGeo, ironMat);
  shaft.position.y = 1.38;
  mic.add(shaft);

  const clutchGeo = new THREE.SphereGeometry(0.13, 12, 12);
  const clutch = new THREE.Mesh(clutchGeo, brassMeshMat);
  clutch.position.y = 2.66;
  mic.add(clutch);

  const boomGroup = new THREE.Group();
  boomGroup.position.set(0, 2.66, 0);
  boomGroup.rotation.z = -0.58;
  boomGroup.rotation.y = 0.35;
  mic.add(boomGroup);

  const boomGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.35, 12);
  const boom = new THREE.Mesh(boomGeo, chromeMat);
  boom.rotation.z = Math.PI / 2;
  boom.position.x = 0.72;
  boomGroup.add(boom);

  const micAssembly = new THREE.Group();
  micAssembly.position.set(1.85, -0.15, 0);
  micAssembly.rotation.z = 0.58;
  boomGroup.add(micAssembly);

  const bodyGeo = new THREE.CylinderGeometry(0.16, 0.15, 0.64, 18);
  const body = new THREE.Mesh(bodyGeo, ironMat);
  micAssembly.add(body);

  const capsuleGeo = new THREE.CylinderGeometry(0.15, 0.16, 0.34, 18);
  const capsule = new THREE.Mesh(capsuleGeo, brassMeshMat);
  capsule.position.y = 0.46;
  micAssembly.add(capsule);

  const domeGeo = new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const dome = new THREE.Mesh(domeGeo, brassMeshMat);
  dome.position.y = 0.63;
  micAssembly.add(dome);

  const shockGeo = new THREE.TorusGeometry(0.26, 0.032, 8, 24);
  shockGeo.rotateX(Math.PI / 2);
  const shock = new THREE.Mesh(shockGeo, ironMat);
  shock.position.y = -0.08;
  micAssembly.add(shock);

  const popRingGeo = new THREE.TorusGeometry(0.4, 0.03, 8, 24);
  const popRing = new THREE.Mesh(popRingGeo, ironMat);
  popRing.position.set(0.4, 0.38, 0.32);
  popRing.rotation.y = -0.55;
  micAssembly.add(popRing);

  const popDiscGeo = new THREE.CircleGeometry(0.385, 24);
  const popDisc = new THREE.Mesh(popDiscGeo, popMat);
  popDisc.position.copy(popRing.position);
  popDisc.rotation.copy(popRing.rotation);
  micAssembly.add(popDisc);

  disposables.push(
    ironMat,
    chromeMat,
    brassMeshMat,
    popMat,
    baseGeo,
    shaftGeo,
    clutchGeo,
    boomGeo,
    bodyGeo,
    capsuleGeo,
    domeGeo,
    shockGeo,
    popRingGeo,
    popDiscGeo
  );
  return mic;
}

// Over-ear studio headphones on stand (~26 cm tall, 10 cm earcups)
function buildHeadphonesOnStand(disposables: Disposable[]): THREE.Group {
  const group = new THREE.Group();

  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0x62391f,
    roughness: 0.44,
    metalness: 0.05,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xdba95e,
    roughness: 0.24,
    metalness: 0.88,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x1a1514,
    roughness: 0.66,
    metalness: 0.06,
  });

  const baseGeo = new THREE.CylinderGeometry(0.62, 0.68, 0.14, 24);
  const base = new THREE.Mesh(baseGeo, walnutMat);
  base.position.y = 0.07;
  base.castShadow = true;
  group.add(base);

  const stemGeo = new THREE.CylinderGeometry(0.06, 0.075, 2.25, 14);
  const stem = new THREE.Mesh(stemGeo, brassMat);
  stem.position.y = 1.24;
  group.add(stem);

  const hangerGeo = new THREE.BoxGeometry(0.5, 0.1, 0.36);
  const hanger = new THREE.Mesh(hangerGeo, walnutMat);
  hanger.position.y = 2.38;
  group.add(hanger);

  const bandGeo = new THREE.TorusGeometry(0.64, 0.088, 12, 28, Math.PI);
  const band = new THREE.Mesh(bandGeo, leatherMat);
  band.position.set(0, 1.84, 0);
  group.add(band);

  const cupGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.18, 22);
  cupGeo.rotateZ(Math.PI / 2);
  const padGeo = new THREE.TorusGeometry(0.33, 0.105, 10, 22);
  padGeo.rotateY(Math.PI / 2);

  [-1, 1].forEach((side) => {
    const cup = new THREE.Mesh(cupGeo, walnutMat);
    cup.position.set(side * 0.64, 1.44, 0);
    cup.castShadow = true;
    group.add(cup);

    const pad = new THREE.Mesh(padGeo, leatherMat);
    pad.position.set(side * 0.51, 1.44, 0);
    group.add(pad);

    const cap = new THREE.Mesh(cupGeo, brassMat);
    cap.scale.set(0.35, 0.72, 0.72);
    cap.position.set(side * 0.73, 1.44, 0);
    group.add(cap);
  });

  disposables.push(
    walnutMat,
    brassMat,
    leatherMat,
    baseGeo,
    stemGeo,
    hangerGeo,
    bandGeo,
    cupGeo,
    padGeo
  );
  return group;
}

// Wooden crate holding full-size 12-inch vinyl LP sleeves (3.2 x 3.2 units!)
function buildVinylCrate(maxAnisotropy: number, disposables: Disposable[]): THREE.Group {
  const crate = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6f4324,
    roughness: 0.68,
    metalness: 0.04,
  });
  const baseGeo = new THREE.BoxGeometry(3.65, 0.14, 3.2);
  const base = new THREE.Mesh(baseGeo, woodMat);
  base.position.y = 0.07;
  crate.add(base);

  const slatSideGeo = new THREE.BoxGeometry(3.65, 0.34, 0.11);
  const slatEndGeo = new THREE.BoxGeometry(0.11, 0.34, 3.2);
  for (let row = 0; row < 3; row++) {
    const y = 0.38 + row * 0.52;
    [-1.54, 1.54].forEach((z) => {
      const s = new THREE.Mesh(slatSideGeo, woodMat);
      s.position.set(0, y, z);
      s.castShadow = true;
      crate.add(s);
    });
    [-1.77, 1.77].forEach((x) => {
      const e = new THREE.Mesh(slatEndGeo, woodMat);
      e.position.set(x, y, 0);
      e.castShadow = true;
      crate.add(e);
    });
  }

  const sleeveColors = [
    ['#d96b43', '#ffe3b8'],
    ['#2a4d69', '#e8a87c'],
    ['#4f2d4c', '#f4c095'],
    ['#2e5a44', '#f2d388'],
    ['#8f3b2e', '#f7ede2'],
    ['#1d2d44', '#748cab'],
    ['#6b4226', '#e8c599'],
  ];
  const sleeveGeo = new THREE.BoxGeometry(3.15, 3.15, 0.09);
  sleeveColors.forEach(([bg, ac], idx) => {
    const tex = createAlbumArtTexture(maxAnisotropy, bg, ac, idx);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.62,
      metalness: 0.04,
    });
    disposables.push(tex, mat);
    const sleeve = new THREE.Mesh(sleeveGeo, mat);
    sleeve.position.set(idx % 2 === 0 ? -0.06 : 0.06, 1.72, -1.0 + idx * 0.33);
    sleeve.rotation.x = -0.14 + idx * 0.025;
    sleeve.castShadow = true;
    crate.add(sleeve);
  });

  disposables.push(woodMat, baseGeo, slatSideGeo, slatEndGeo, sleeveGeo);
  return crate;
}

// Electric guitar (~10 units / ~1 meter tall)
function buildElectricGuitarWithStand(
  maxAnisotropy: number,
  disposables: Disposable[]
): THREE.Group {
  const group = new THREE.Group();

  const standMat = new THREE.MeshStandardMaterial({
    color: 0x1a191b,
    roughness: 0.52,
    metalness: 0.65,
  });
  const sunburstTex = createSunburstTexture(maxAnisotropy);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: sunburstTex,
    roughness: 0.16,
    metalness: 0.06,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  });
  const pickguardMat = new THREE.MeshStandardMaterial({
    color: 0xf4eadb,
    roughness: 0.3,
    metalness: 0.04,
  });
  const mapleMat = new THREE.MeshStandardMaterial({
    color: 0xdcb47e,
    roughness: 0.42,
    metalness: 0.04,
  });
  const rosewoodMat = new THREE.MeshStandardMaterial({
    color: 0x3b2217,
    roughness: 0.6,
    metalness: 0.04,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xede6dc,
    roughness: 0.16,
    metalness: 0.94,
  });

  const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.6, 10);
  [-1.18, 1.18].forEach((lx) => {
    const fLeg = new THREE.Mesh(legGeo, standMat);
    fLeg.position.set(lx, 1.65, 0.55);
    fLeg.rotation.x = -0.28;
    group.add(fLeg);

    const bLeg = new THREE.Mesh(legGeo, standMat);
    bLeg.position.set(lx, 1.65, -0.75);
    bLeg.rotation.x = 0.34;
    group.add(bLeg);
  });

  const guitar = new THREE.Group();
  guitar.position.set(0, 0.85, 0.18);
  guitar.rotation.x = -0.18;
  group.add(guitar);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(1.42, 0.0, 1.9, 0.88, 1.5, 1.9);
  shape.bezierCurveTo(1.08, 2.65, 1.02, 3.12, 1.36, 3.8);
  shape.bezierCurveTo(1.62, 4.35, 0.88, 4.68, 0.4, 4.08);
  shape.lineTo(0.28, 3.8);
  shape.lineTo(-0.28, 3.8);
  shape.bezierCurveTo(-0.74, 4.9, -1.7, 4.2, -1.22, 3.26);
  shape.bezierCurveTo(-0.88, 2.65, -1.08, 2.3, -1.56, 1.63);
  shape.bezierCurveTo(-1.97, 0.68, -1.36, 0.0, 0, 0);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 3,
  });
  bodyGeo.translate(0, 0, -0.19);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  guitar.add(body);

  const pgGeo = new THREE.BoxGeometry(1.62, 2.3, 0.05);
  const pg = new THREE.Mesh(pgGeo, pickguardMat);
  pg.position.set(0.2, 2.1, 0.27);
  guitar.add(pg);

  const bridgeGeo = new THREE.BoxGeometry(0.82, 0.34, 0.08);
  const bridge = new THREE.Mesh(bridgeGeo, chromeMat);
  bridge.position.set(0, 1.3, 0.32);
  guitar.add(bridge);

  const pickupGeo = new THREE.BoxGeometry(0.75, 0.17, 0.08);
  [1.84, 2.45, 3.06].forEach((py) => {
    const pu = new THREE.Mesh(pickupGeo, pickguardMat);
    pu.position.set(0, py, 0.32);
    pu.rotation.z = py === 1.84 ? -0.15 : 0;
    guitar.add(pu);
  });

  const neckGeo = new THREE.BoxGeometry(0.48, 4.68, 0.18);
  const neck = new THREE.Mesh(neckGeo, mapleMat);
  neck.position.set(0, 5.85, 0.08);
  neck.castShadow = true;
  guitar.add(neck);

  const boardGeo = new THREE.BoxGeometry(0.49, 4.55, 0.055);
  const board = new THREE.Mesh(boardGeo, rosewoodMat);
  board.position.set(0, 5.85, 0.2);
  guitar.add(board);

  const headGeo = new THREE.BoxGeometry(0.68, 1.22, 0.14);
  const head = new THREE.Mesh(headGeo, mapleMat);
  head.position.set(0.06, 8.65, 0.08);
  guitar.add(head);

  const pegGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.2, 8);
  pegGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const peg = new THREE.Mesh(pegGeo, chromeMat);
    peg.position.set(-0.3, 8.22 + i * 0.16, 0.08);
    guitar.add(peg);
  }

  disposables.push(
    standMat,
    sunburstTex,
    bodyMat,
    pickguardMat,
    mapleMat,
    rosewoodMat,
    chromeMat,
    legGeo,
    bodyGeo,
    pgGeo,
    bridgeGeo,
    pickupGeo,
    neckGeo,
    boardGeo,
    headGeo,
    pegGeo
  );
  return group;
}

// Acoustic Dreadnought Guitar (~10.4 units / ~1.04 meters tall)
function buildAcousticGuitarWithStand(
  maxAnisotropy: number,
  disposables: Disposable[]
): THREE.Group {
  const group = new THREE.Group();

  const standMat = new THREE.MeshStandardMaterial({
    color: 0x1a191b,
    roughness: 0.55,
    metalness: 0.65,
  });
  const { map: spruceMap } = createStudioWoodTexture(maxAnisotropy, '#cfa062', 0.12, 1, 1);
  const topMat = new THREE.MeshStandardMaterial({
    map: spruceMap,
    roughness: 0.35,
    metalness: 0.04,
  });
  const mahoganyMat = new THREE.MeshStandardMaterial({
    color: 0x572614,
    roughness: 0.45,
    metalness: 0.04,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a120d,
    roughness: 0.72,
  });
  const rosetteMat = new THREE.MeshStandardMaterial({
    color: 0xe6c79c,
    roughness: 0.4,
  });

  const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 10);
  [-1.2, 1.2].forEach((lx) => {
    const fLeg = new THREE.Mesh(legGeo, standMat);
    fLeg.position.set(lx, 1.6, 0.55);
    fLeg.rotation.x = -0.26;
    group.add(fLeg);

    const bLeg = new THREE.Mesh(legGeo, standMat);
    bLeg.position.set(lx, 1.6, -0.75);
    bLeg.rotation.x = 0.32;
    group.add(bLeg);
  });

  const guitar = new THREE.Group();
  guitar.position.set(0, 0.84, 0.25);
  guitar.rotation.x = -0.17;
  group.add(guitar);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(1.63, 0.0, 2.18, 1.15, 1.77, 2.18);
  shape.bezierCurveTo(1.22, 2.86, 1.22, 3.26, 1.53, 4.0);
  shape.bezierCurveTo(1.7, 4.9, 0.82, 5.3, 0, 5.3);
  shape.bezierCurveTo(-0.82, 5.3, -1.7, 4.9, -1.53, 4.0);
  shape.bezierCurveTo(-1.22, 3.26, -1.22, 2.86, -1.77, 2.18);
  shape.bezierCurveTo(-2.18, 1.15, -1.63, 0.0, 0, 0);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.82,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  bodyGeo.translate(0, 0, -0.41);
  const body = new THREE.Mesh(bodyGeo, [topMat, mahoganyMat]);
  body.castShadow = true;
  guitar.add(body);

  const holeGeo = new THREE.CircleGeometry(0.54, 28);
  const hole = new THREE.Mesh(holeGeo, darkMat);
  hole.position.set(0, 3.2, 0.495);
  guitar.add(hole);

  const rosGeo = new THREE.RingGeometry(0.56, 0.66, 28);
  const ros = new THREE.Mesh(rosGeo, rosetteMat);
  ros.position.set(0, 3.2, 0.5);
  guitar.add(ros);

  const bridgeGeo = new THREE.BoxGeometry(1.15, 0.27, 0.1);
  const bridge = new THREE.Mesh(bridgeGeo, darkMat);
  bridge.position.set(0, 1.5, 0.51);
  guitar.add(bridge);

  const neckGeo = new THREE.BoxGeometry(0.49, 4.2, 0.22);
  const neck = new THREE.Mesh(neckGeo, mahoganyMat);
  neck.position.set(0, 7.05, 0.3);
  guitar.add(neck);

  const boardGeo = new THREE.BoxGeometry(0.5, 5.0, 0.06);
  const board = new THREE.Mesh(boardGeo, darkMat);
  board.position.set(0, 6.6, 0.44);
  guitar.add(board);

  const headGeo = new THREE.BoxGeometry(0.74, 1.15, 0.17);
  const head = new THREE.Mesh(headGeo, mahoganyMat);
  head.position.set(0, 9.55, 0.27);
  guitar.add(head);

  disposables.push(
    standMat,
    spruceMap,
    topMat,
    mahoganyMat,
    darkMat,
    rosetteMat,
    legGeo,
    bodyGeo,
    holeGeo,
    rosGeo,
    bridgeGeo,
    neckGeo,
    boardGeo,
    headGeo
  );
  return group;
}

// Vintage tube guitar combo amp (~60 cm W x 54 cm H x 30 cm D)
function buildTubeGuitarAmp(maxAnisotropy: number, disposables: Disposable[]): THREE.Group {
  const amp = new THREE.Group();

  const tolexMat = new THREE.MeshStandardMaterial({
    color: 0x3b2a1e,
    roughness: 0.72,
    metalness: 0.06,
  });
  const grilleTex = createAmpGrilleTexture(maxAnisotropy);
  const grilleMat = new THREE.MeshStandardMaterial({
    map: grilleTex,
    roughness: 0.85,
    metalness: 0.04,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a85e,
    roughness: 0.25,
    metalness: 0.88,
  });
  const jewelMat = new THREE.MeshStandardMaterial({
    color: 0xff6238,
    emissive: 0xff4514,
    emissiveIntensity: 2.2,
  });

  const cabGeo = new THREE.BoxGeometry(6.0, 5.4, 2.95);
  const cab = new THREE.Mesh(cabGeo, tolexMat);
  cab.position.y = 2.7;
  cab.castShadow = true;
  cab.receiveShadow = true;
  amp.add(cab);

  const grilleGeo = new THREE.BoxGeometry(5.4, 3.85, 0.12);
  const grille = new THREE.Mesh(grilleGeo, grilleMat);
  grille.position.set(0, 2.42, 1.46);
  amp.add(grille);

  const plateGeo = new THREE.BoxGeometry(5.4, 0.82, 0.12);
  const plate = new THREE.Mesh(plateGeo, brassMat);
  plate.position.set(0, 4.78, 1.46);
  amp.add(plate);

  const knobGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.13, 12);
  knobGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const k = new THREE.Mesh(knobGeo, tolexMat);
    k.position.set(-1.85 + i * 0.68, 4.78, 1.56);
    amp.add(k);
  }

  const jewelGeo = new THREE.SphereGeometry(0.095, 12, 12);
  const jewel = new THREE.Mesh(jewelGeo, jewelMat);
  jewel.position.set(2.15, 4.78, 1.56);
  amp.add(jewel);

  const handleGeo = new THREE.TorusGeometry(0.6, 0.08, 8, 16, Math.PI);
  const handle = new THREE.Mesh(handleGeo, tolexMat);
  handle.position.set(0, 5.4, 0);
  amp.add(handle);

  disposables.push(
    tolexMat,
    grilleTex,
    grilleMat,
    brassMat,
    jewelMat,
    cabGeo,
    grilleGeo,
    plateGeo,
    knobGeo,
    jewelGeo,
    handleGeo
  );
  return amp;
}

// Stage Digital Piano (~125 cm wide x 34 cm deep, keybed at ~76 cm above floor)
function buildStagePianoOnStand(disposables: Disposable[]): THREE.Group {
  const piano = new THREE.Group();

  const standMat = new THREE.MeshStandardMaterial({
    color: 0x1e1e22,
    roughness: 0.48,
    metalness: 0.7,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x222024,
    roughness: 0.36,
    metalness: 0.45,
  });
  const woodEndMat = new THREE.MeshStandardMaterial({
    color: 0x6b3a22,
    roughness: 0.46,
    metalness: 0.05,
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf7f2e8, roughness: 0.24 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x151416, roughness: 0.35 });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x102833,
    emissive: 0x29a8d4,
    emissiveIntensity: 0.85,
  });

  const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 8.2, 12);
  [-4.4, 4.4].forEach((lx) => {
    const legA = new THREE.Mesh(legGeo, standMat);
    legA.position.set(lx, 3.45, 0);
    legA.rotation.x = 0.56;
    piano.add(legA);

    const legB = new THREE.Mesh(legGeo, standMat);
    legB.position.set(lx, 3.45, 0);
    legB.rotation.x = -0.56;
    piano.add(legB);
  });

  const crossbarGeo = new THREE.CylinderGeometry(0.11, 0.11, 9.2, 12);
  crossbarGeo.rotateZ(Math.PI / 2);
  const crossbar = new THREE.Mesh(crossbarGeo, standMat);
  crossbar.position.y = 3.45;
  piano.add(crossbar);

  const chassisGeo = new THREE.BoxGeometry(12.2, 0.84, 3.36);
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.position.set(0, 7.25, 0);
  chassis.castShadow = true;
  piano.add(chassis);

  const endGeo = new THREE.BoxGeometry(0.35, 0.96, 3.48);
  [-6.22, 6.22].forEach((ex) => {
    const end = new THREE.Mesh(endGeo, woodEndMat);
    end.position.set(ex, 7.28, 0);
    piano.add(end);
  });

  const wGeo = new THREE.BoxGeometry(0.28, 0.18, 1.68);
  const wMesh = new THREE.InstancedMesh(wGeo, whiteMat, 35);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 35; i++) {
    dummy.position.set(-5.3 + i * 0.31, 7.72, 0.72);
    dummy.updateMatrix();
    wMesh.setMatrixAt(i, dummy.matrix);
  }
  wMesh.instanceMatrix.needsUpdate = true;
  wMesh.computeBoundingSphere();
  piano.add(wMesh);

  const bGeo = new THREE.BoxGeometry(0.17, 0.2, 1.05);
  const blackCount = 25;
  const bMesh = new THREE.InstancedMesh(bGeo, blackMat, blackCount);
  let bi = 0;
  for (let oct = 0; oct < 5; oct++) {
    [0, 1, 3, 4, 5].forEach((offset) => {
      if (bi >= blackCount) return;
      const slot = oct * 7 + offset;
      dummy.position.set(-5.14 + slot * 0.31, 7.8, 0.38);
      dummy.updateMatrix();
      bMesh.setMatrixAt(bi++, dummy.matrix);
    });
  }
  bMesh.instanceMatrix.needsUpdate = true;
  bMesh.computeBoundingSphere();
  piano.add(bMesh);

  const screenGeo = new THREE.BoxGeometry(1.12, 0.08, 0.48);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(-0.7, 7.71, -0.88);
  piano.add(screen);

  disposables.push(
    standMat,
    bodyMat,
    woodEndMat,
    whiteMat,
    blackMat,
    screenMat,
    legGeo,
    crossbarGeo,
    chassisGeo,
    endGeo,
    wGeo,
    bGeo,
    screenGeo
  );
  return piano;
}

// Architect desk lamp (~48 cm tall)
function buildStudioDeskLamp(disposables: Disposable[]): THREE.Group {
  const lamp = new THREE.Group();

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a85e,
    roughness: 0.26,
    metalness: 0.88,
  });
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x1b2b24,
    roughness: 0.36,
    metalness: 0.42,
    side: THREE.DoubleSide,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: 0xffb866,
    emissiveIntensity: 2.8,
  });

  const baseGeo = new THREE.CylinderGeometry(0.78, 0.88, 0.2, 24);
  const base = new THREE.Mesh(baseGeo, brassMat);
  base.position.y = 0.1;
  base.castShadow = true;
  lamp.add(base);

  const arm1Geo = new THREE.CylinderGeometry(0.08, 0.09, 3.2, 12);
  const arm1 = new THREE.Mesh(arm1Geo, brassMat);
  arm1.position.set(-0.24, 1.65, -0.14);
  arm1.rotation.z = 0.18;
  lamp.add(arm1);

  const jointGeo = new THREE.SphereGeometry(0.14, 12, 12);
  const joint = new THREE.Mesh(jointGeo, brassMat);
  joint.position.set(-0.54, 3.2, -0.14);
  lamp.add(joint);

  const arm2Geo = new THREE.CylinderGeometry(0.068, 0.075, 2.75, 12);
  const arm2 = new THREE.Mesh(arm2Geo, brassMat);
  arm2.position.set(0.58, 4.05, 0.28);
  arm2.rotation.z = -0.92;
  arm2.rotation.y = -0.35;
  lamp.add(arm2);

  const shadeGeo = new THREE.ConeGeometry(0.84, 1.02, 24, 1, true);
  const shade = new THREE.Mesh(shadeGeo, shadeMat);
  shade.position.set(1.66, 4.55, 0.72);
  shade.rotation.z = -0.45;
  shade.rotation.x = 0.28;
  lamp.add(shade);

  const bulbGeo = new THREE.SphereGeometry(0.25, 12, 12);
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(1.72, 4.32, 0.76);
  lamp.add(bulb);

  disposables.push(
    brassMat,
    shadeMat,
    bulbMat,
    baseGeo,
    arm1Geo,
    jointGeo,
    arm2Geo,
    shadeGeo,
    bulbGeo
  );
  return lamp;
}

// Potted studio floor plant (~1.1 m tall)
function buildPottedStudioPlant(disposables: Disposable[]): THREE.Group {
  const plant = new THREE.Group();

  const potMat = new THREE.MeshStandardMaterial({
    color: 0x9b5539,
    roughness: 0.78,
    metalness: 0.02,
  });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x261a12, roughness: 0.95 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x36592d, roughness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3b6e38,
    roughness: 0.56,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const potGeo = new THREE.CylinderGeometry(1.65, 1.25, 2.8, 20);
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.y = 1.4;
  pot.castShadow = true;
  plant.add(pot);

  const soilGeo = new THREE.CircleGeometry(1.52, 20);
  soilGeo.rotateX(-Math.PI / 2);
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 2.75;
  plant.add(soil);

  const stemGeo = new THREE.CylinderGeometry(0.075, 0.11, 4.4, 8);
  const leafGeo = new THREE.SphereGeometry(0.95, 12, 10);
  leafGeo.scale(0.85, 0.08, 1.35);

  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const h = 4.2 + (i % 3) * 1.35;
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(Math.cos(angle) * 0.52, 2.65 + h * 0.4, Math.sin(angle) * 0.52);
    stem.rotation.set(Math.sin(angle) * 0.28, angle, -Math.cos(angle) * 0.28);
    plant.add(stem);

    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(Math.cos(angle) * 1.52, 3.4 + h * 0.65, Math.sin(angle) * 1.52);
    leaf.rotation.set(0.35, -angle + Math.PI / 2, 0);
    plant.add(leaf);
  }

  disposables.push(potMat, soilMat, stemMat, leafMat, potGeo, soilGeo, stemGeo, leafGeo);
  return plant;
}

export function buildStudioEnvironment(
  maxAnisotropy: number,
  disposables: Disposable[],
  photoTexture: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();

  // =========================================================
  // 1. REAL-SCALE STUDIO ROOM (1 unit ≈ 10 cm, Floor y = -7.8 / 78cm desk height)
  // =========================================================
  const FLOOR_Y = -7.8;
  const ROOM_W = 54;
  const ROOM_H = 31;
  const BACK_Z = -18.5;
  const FRONT_Z = 34.0;
  const ROOM_D = FRONT_Z - BACK_Z;
  const ROOM_CENTER_Z = (BACK_Z + FRONT_Z) * 0.5;

  const { map: floorMap, bumpMap: floorBump } = createHardwoodFloorTexture(maxAnisotropy);
  const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorMap,
    bumpMap: floorBump,
    bumpScale: 0.08,
    roughness: 0.62,
    metalness: 0.06,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, FLOOR_Y, ROOM_CENTER_Z);
  floor.receiveShadow = true;
  group.add(floor);

  const rugTex = createStudioRugTexture(maxAnisotropy);
  const rugGeo = new THREE.BoxGeometry(34, 0.08, 22);
  const rugMat = new THREE.MeshStandardMaterial({
    map: rugTex,
    roughness: 0.94,
    metalness: 0.02,
  });
  const rug = new THREE.Mesh(rugGeo, rugMat);
  rug.position.set(0, FLOOR_Y + 0.04, -1.6);
  rug.receiveShadow = true;
  group.add(rug);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x26201d,
    roughness: 0.88,
    metalness: 0.04,
  });
  const sideWallMat = new THREE.MeshStandardMaterial({
    color: 0x211b19,
    roughness: 0.9,
    metalness: 0.04,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x161211,
    roughness: 0.92,
    metalness: 0.04,
  });

  const backWallGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_H);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, FLOOR_Y + ROOM_H * 0.5, BACK_Z);
  backWall.receiveShadow = true;
  group.add(backWall);

  const frontWall = new THREE.Mesh(backWallGeo, sideWallMat);
  frontWall.position.set(0, FLOOR_Y + ROOM_H * 0.5, FRONT_Z);
  frontWall.rotation.y = Math.PI;
  group.add(frontWall);

  const sideWallGeo = new THREE.PlaneGeometry(ROOM_D, ROOM_H);
  const leftWall = new THREE.Mesh(sideWallGeo, sideWallMat);
  leftWall.position.set(-ROOM_W * 0.5, FLOOR_Y + ROOM_H * 0.5, ROOM_CENTER_Z);
  leftWall.rotation.y = Math.PI / 2;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, sideWallMat);
  rightWall.position.set(ROOM_W * 0.5, FLOOR_Y + ROOM_H * 0.5, ROOM_CENTER_Z);
  rightWall.rotation.y = -Math.PI / 2;
  group.add(rightWall);

  const ceilingGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  ceilingGeo.rotateX(Math.PI / 2);
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.set(0, FLOOR_Y + ROOM_H, ROOM_CENTER_Z);
  group.add(ceiling);

  const trimMat = new THREE.MeshStandardMaterial({ color: 0x452b1b, roughness: 0.55 });
  const baseBoardGeo = new THREE.BoxGeometry(ROOM_W, 0.9, 0.2);
  const backBase = new THREE.Mesh(baseBoardGeo, trimMat);
  backBase.position.set(0, FLOOR_Y + 0.45, BACK_Z + 0.1);
  group.add(backBase);

  // =========================================================
  // 2. ACOUSTIC SLATS, FOAM PANELS, VINYL ART & NEON WAVEFORM
  // =========================================================
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x131111, roughness: 0.96 });
  const feltGeo = new THREE.BoxGeometry(28.0, 22.0, 0.14);
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.position.set(0, 4.8, BACK_Z + 0.08);
  group.add(felt);

  const { map: slatWoodMap } = createStudioWoodTexture(maxAnisotropy, '#7c4c2a', 0.25, 1, 3);
  const slatMat = new THREE.MeshStandardMaterial({
    map: slatWoodMap,
    roughness: 0.48,
    metalness: 0.05,
  });
  const slatGeo = new THREE.BoxGeometry(0.32, 21.8, 0.24);
  const slatCount = 46;
  const slats = new THREE.InstancedMesh(slatGeo, slatMat, slatCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < slatCount; i++) {
    dummy.position.set(-13.5 + i * 0.6, 4.8, BACK_Z + 0.22);
    dummy.updateMatrix();
    slats.setMatrixAt(i, dummy.matrix);
  }
  slats.instanceMatrix.needsUpdate = true;
  slats.computeBoundingSphere();
  group.add(slats);

  const foamMat = new THREE.MeshStandardMaterial({
    color: 0x1b191c,
    roughness: 0.94,
    metalness: 0.02,
  });
  const foamTileGeo = new THREE.BoxGeometry(2.1, 2.1, 0.34);
  const foamPositions: [number, number, number, number][] = [];
  [-21.2, -18.8, -16.4, 16.4, 18.8, 21.2].forEach((fx) => {
    for (let row = 0; row < 4; row++) {
      foamPositions.push([fx, 1.2 + row * 2.3, BACK_Z + 0.18, 0]);
    }
  });
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      foamPositions.push([-ROOM_W * 0.5 + 0.2, 2.0 + r * 2.3, -12.0 + c * 2.6, Math.PI / 2]);
      foamPositions.push([ROOM_W * 0.5 - 0.2, 2.0 + r * 2.3, -12.0 + c * 2.6, -Math.PI / 2]);
    }
  }
  const foamTiles = new THREE.InstancedMesh(foamTileGeo, foamMat, foamPositions.length);
  foamPositions.forEach(([fx, fy, fz, ry], idx) => {
    dummy.position.set(fx, fy, fz);
    dummy.rotation.set(0, ry, 0);
    dummy.updateMatrix();
    foamTiles.setMatrixAt(idx, dummy.matrix);
  });
  foamTiles.instanceMatrix.needsUpdate = true;
  foamTiles.computeBoundingSphere();
  group.add(foamTiles);

  // Full 12-inch framed album plaques (3.8 x 3.8 units)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x161210,
    roughness: 0.38,
    metalness: 0.35,
  });
  const frameGeo = new THREE.BoxGeometry(3.85, 3.85, 0.16);
  const artGeo = new THREE.PlaneGeometry(3.3, 3.3);
  const wallAlbums: [number, number, string, string, number][] = [
    [-8.6, 5.2, '#d96b43', '#ffe3b8', 0],
    [0.0, 8.2, '#2e5a44', '#f2d388', 1],
    [8.6, 5.2, '#3d3054', '#f4b672', 2],
  ];
  wallAlbums.forEach(([ax, ay, bg, ac, v]) => {
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(ax, ay, BACK_Z + 0.4);
    group.add(frame);

    const artTex = createAlbumArtTexture(maxAnisotropy, bg, ac, v);
    const artMat = new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.5 });
    disposables.push(artTex, artMat);
    const art = new THREE.Mesh(artGeo, artMat);
    art.position.set(ax, ay, BACK_Z + 0.49);
    group.add(art);
  });

  // Warm Neon Studio Waveform Bar
  const neonMat = new THREE.MeshStandardMaterial({
    color: 0xffd2a6,
    emissive: 0xff8542,
    emissiveIntensity: 2.2,
  });
  const neonBarGeo = new THREE.BoxGeometry(0.28, 1.15, 0.14);
  const neonBars = [0.42, 0.72, 1.05, 0.62, 1.25, 0.85, 0.55, 0.96, 0.58, 0.38];
  neonBars.forEach((scaleY, idx) => {
    const bar = new THREE.Mesh(neonBarGeo, neonMat);
    bar.position.set(-2.7 + idx * 0.6, 4.2, BACK_Z + 0.42);
    bar.scale.y = scaleY;
    group.add(bar);
  });

  const trapGeo = new THREE.CylinderGeometry(1.7, 1.7, 23, 6);
  [
    [-ROOM_W * 0.5 + 1.25, FLOOR_Y + 11.5, BACK_Z + 1.25],
    [ROOM_W * 0.5 - 1.25, FLOOR_Y + 11.5, BACK_Z + 1.25],
  ].forEach(([tx, ty, tz]) => {
    const trap = new THREE.Mesh(trapGeo, foamMat);
    trap.position.set(tx, ty, tz);
    trap.rotation.y = Math.PI / 4;
    group.add(trap);
  });

  const cloudGeo = new THREE.BoxGeometry(21, 0.55, 11);
  const cloud = new THREE.Mesh(cloudGeo, foamMat);
  cloud.position.set(0, 21.5, -2.5);
  group.add(cloud);

  // =========================================================
  // 3. REAL-PROPORTION STUDIO DESK (240 cm W x 118 cm D, top at y = -0.002)
  // =========================================================
  const { map: deskWoodMap, bumpMap: deskWoodBump } = createStudioWoodTexture(
    maxAnisotropy,
    '#4b2c1a',
    0.22,
    4,
    2
  );
  const deskMat = new THREE.MeshStandardMaterial({
    map: deskWoodMap,
    bumpMap: deskWoodBump,
    bumpScale: 0.04,
    roughness: 0.42,
    metalness: 0.06,
  });
  const legMetalMat = new THREE.MeshStandardMaterial({
    color: 0x161517,
    roughness: 0.45,
    metalness: 0.72,
  });
  const brassTrimMat = new THREE.MeshStandardMaterial({
    color: 0xd19c54,
    roughness: 0.28,
    metalness: 0.85,
  });

  const deskGeo = new THREE.BoxGeometry(24.0, 0.42, 11.8);
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.position.set(0, -0.212, -1.7);
  desk.receiveShadow = true;
  desk.castShadow = true;
  group.add(desk);

  const deskTrimGeo = new THREE.BoxGeometry(24.06, 0.1, 0.12);
  const deskTrim = new THREE.Mesh(deskTrimGeo, brassTrimMat);
  deskTrim.position.set(0, -0.06, 4.24);
  group.add(deskTrim);

  // Desk legs reaching down to FLOOR_Y = -7.8
  const deskLegGeo = new THREE.BoxGeometry(0.55, 7.42, 0.55);
  [
    [-10.8, -6.6],
    [10.8, -6.6],
    [-10.8, 3.2],
    [10.8, 3.2],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(deskLegGeo, legMetalMat);
    leg.position.set(lx, -4.09, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  // Rear monitor riser bridge (top at y = 0.70, safely behind open dust cover!)
  const riserGeo = new THREE.BoxGeometry(21.6, 0.72, 2.75);
  const riser = new THREE.Mesh(riserGeo, deskMat);
  riser.position.set(0, 0.34, -6.0);
  riser.castShadow = true;
  riser.receiveShadow = true;
  group.add(riser);

  const riserGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffb36b,
    emissive: 0xff8030,
    emissiveIntensity: 1.6,
  });
  const riserGlowGeo = new THREE.BoxGeometry(20.6, 0.07, 0.08);
  const riserGlow = new THREE.Mesh(riserGlowGeo, riserGlowMat);
  riserGlow.position.set(0, 0.04, -4.64);
  group.add(riserGlow);

  // Center analog VU meter / preamp rack unit (48 cm / 19-inch studio rack width!)
  const rackFaceMat = new THREE.MeshStandardMaterial({
    color: 0x18171a,
    roughness: 0.34,
    metalness: 0.72,
  });
  const rackGeo = new THREE.BoxGeometry(5.2, 1.05, 1.75);
  const rack = new THREE.Mesh(rackGeo, rackFaceMat);
  rack.position.set(0, 1.22, -6.0);
  rack.castShadow = true;
  group.add(rack);

  const vuTex = createVuMeterTexture(maxAnisotropy);
  const vuMat = new THREE.MeshStandardMaterial({
    map: vuTex,
    emissive: 0x6b4b24,
    emissiveIntensity: 0.55,
    roughness: 0.35,
  });
  const vuGeo = new THREE.PlaneGeometry(1.15, 0.62);
  [-1.32, 1.32].forEach((vx) => {
    const vu = new THREE.Mesh(vuGeo, vuMat);
    vu.position.set(vx, 1.26, -5.11);
    group.add(vu);
  });

  // =========================================================
  // 4. TRUE-SCALE DESK STUDIO GEAR AROUND TURNTABLE
  // =========================================================
  const leftSpeaker = buildStudioMonitorSpeaker(disposables);
  leftSpeaker.position.set(-6.5, 0.7, -5.9);
  leftSpeaker.rotation.y = 0.38;
  group.add(leftSpeaker);

  const rightSpeaker = buildStudioMonitorSpeaker(disposables);
  rightSpeaker.position.set(6.5, 0.7, -5.9);
  rightSpeaker.rotation.y = -0.38;
  group.add(rightSpeaker);

  const midiController = buildMidiController(disposables);
  midiController.position.set(-6.5, 0, 0.85);
  midiController.rotation.y = 0.25;
  group.add(midiController);

  const audioInterface = buildAudioInterface(disposables);
  audioInterface.position.set(-5.6, 0, -2.1);
  audioInterface.rotation.y = 0.3;
  group.add(audioInterface);

  const condenserMic = buildCondenserMicStand(disposables);
  condenserMic.position.set(-8.6, 0, -3.4);
  condenserMic.rotation.y = -0.25;
  group.add(condenserMic);

  const deskLamp = buildStudioDeskLamp(disposables);
  deskLamp.position.set(-9.7, 0, -5.4);
  deskLamp.rotation.y = -0.42;
  group.add(deskLamp);

  const vinylCrate = buildVinylCrate(maxAnisotropy, disposables);
  vinylCrate.position.set(6.95, 0, -1.65);
  vinylCrate.rotation.y = -0.28;
  group.add(vinylCrate);

  const headphones = buildHeadphonesOnStand(disposables);
  headphones.position.set(5.65, 0, 1.35);
  headphones.rotation.y = -0.46;
  group.add(headphones);

  // Full-size ceramic coffee mug (~9.5 cm wide x 10.5 cm tall) with handle
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xe8ded2, roughness: 0.25 });
  const coffeeMat = new THREE.MeshStandardMaterial({ color: 0x26140a, roughness: 0.15 });
  const mugGeo = new THREE.CylinderGeometry(0.46, 0.42, 1.02, 22);
  const mug = new THREE.Mesh(mugGeo, mugMat);
  mug.position.set(4.65, 0.51, 2.85);
  mug.castShadow = true;
  group.add(mug);

  const mugHandleGeo = new THREE.TorusGeometry(0.24, 0.065, 10, 18, Math.PI);
  const mugHandle = new THREE.Mesh(mugHandleGeo, mugMat);
  mugHandle.position.set(5.05, 0.52, 2.85);
  mugHandle.rotation.z = -Math.PI / 2;
  group.add(mugHandle);

  const coffeeGeo = new THREE.CircleGeometry(0.41, 20);
  coffeeGeo.rotateX(-Math.PI / 2);
  const coffee = new THREE.Mesh(coffeeGeo, coffeeMat);
  coffee.position.set(4.65, 0.99, 2.85);
  group.add(coffee);

  // Wooden photo frame standing on the studio desk beside the turntable
  const photoFrame = buildPhotoFrameProp(photoTexture, maxAnisotropy, disposables);
  photoFrame.position.set(3.85, 0, -2.85);
  photoFrame.rotation.y = -0.4;
  group.add(photoFrame);

  // =========================================================
  // 5. TRUE-SCALE FLOOR INSTRUMENTS & CABINETS (FLOOR_Y = -7.8)
  // =========================================================
  const electricGuitar = buildElectricGuitarWithStand(maxAnisotropy, disposables);
  electricGuitar.position.set(12.2, FLOOR_Y, -10.8);
  electricGuitar.rotation.y = -0.45;
  group.add(electricGuitar);

  const acousticGuitar = buildAcousticGuitarWithStand(maxAnisotropy, disposables);
  acousticGuitar.position.set(-12.2, FLOOR_Y, -11.0);
  acousticGuitar.rotation.y = 0.45;
  group.add(acousticGuitar);

  const guitarAmp = buildTubeGuitarAmp(maxAnisotropy, disposables);
  guitarAmp.position.set(15.4, FLOOR_Y, -6.2);
  guitarAmp.rotation.y = -0.68;
  group.add(guitarAmp);

  const stagePiano = buildStagePianoOnStand(disposables);
  stagePiano.position.set(-15.6, FLOOR_Y, -4.6);
  stagePiano.rotation.y = 0.72;
  group.add(stagePiano);

  const plant = buildPottedStudioPlant(disposables);
  plant.position.set(-19.5, FLOOR_Y, -13.5);
  group.add(plant);

  // Side 2x2 vinyl storage cabinet stocked with full 12-inch LPs (7.8 x 7.8 units!)
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(17.2, FLOOR_Y, -13.2);
  shelfGroup.rotation.y = -0.35;
  group.add(shelfGroup);

  const shelfOuterGeo = new THREE.BoxGeometry(7.8, 0.28, 3.6);
  const shelfSideGeo = new THREE.BoxGeometry(0.28, 7.9, 3.6);
  const shelfDivGeo = new THREE.BoxGeometry(0.22, 7.5, 3.45);
  [0.14, 3.95, 7.76].forEach((sy) => {
    const plank = new THREE.Mesh(shelfOuterGeo, deskMat);
    plank.position.y = sy;
    plank.castShadow = true;
    plank.receiveShadow = true;
    shelfGroup.add(plank);
  });
  [-3.76, 3.76].forEach((sx) => {
    const side = new THREE.Mesh(shelfSideGeo, deskMat);
    side.position.set(sx, 3.95, 0);
    side.castShadow = true;
    shelfGroup.add(side);
  });
  const midDiv = new THREE.Mesh(shelfDivGeo, deskMat);
  midDiv.position.set(0, 3.95, 0);
  shelfGroup.add(midDiv);

  const spineColors = [0xd96b43, 0x3b6e8c, 0xe8b968, 0x744c7a, 0x457b5d, 0xc74b3a, 0xd8c3a5];
  const recordSpineGeo = new THREE.BoxGeometry(0.14, 3.25, 3.2);
  [2.0, 5.8].forEach((cubbyY, rowIdx) => {
    [-1.92, 1.92].forEach((cubbyX, colIdx) => {
      for (let r = 0; r < 11; r++) {
        const mat = new THREE.MeshStandardMaterial({
          color: spineColors[(r + rowIdx * 3 + colIdx * 2) % spineColors.length],
          roughness: 0.65,
        });
        disposables.push(mat);
        const rec = new THREE.Mesh(recordSpineGeo, mat);
        rec.position.set(cubbyX - 1.15 + r * 0.22, cubbyY, 0.08);
        shelfGroup.add(rec);
      }
    });
  });

  // =========================================================
  // 6. COZY NON-SHADOW STUDIO LIGHTS
  // =========================================================
  const lampFill = new THREE.PointLight(0xffc17d, 30, 34, 1.25);
  lampFill.position.set(-7.5, 4.6, -2.6);
  group.add(lampFill);

  const wallWash = new THREE.PointLight(0xff925e, 42, 54, 1.15);
  wallWash.position.set(0.5, 8.5, -13.5);
  group.add(wallWash);

  disposables.push(
    floorMap,
    floorBump,
    floorGeo,
    floorMat,
    rugTex,
    rugGeo,
    rugMat,
    wallMat,
    sideWallMat,
    ceilingMat,
    backWallGeo,
    sideWallGeo,
    ceilingGeo,
    trimMat,
    baseBoardGeo,
    feltMat,
    feltGeo,
    slatWoodMap,
    slatMat,
    slatGeo,
    foamMat,
    foamTileGeo,
    frameMat,
    frameGeo,
    artGeo,
    neonMat,
    neonBarGeo,
    trapGeo,
    cloudGeo,
    deskWoodMap,
    deskWoodBump,
    deskMat,
    legMetalMat,
    brassTrimMat,
    deskGeo,
    deskTrimGeo,
    deskLegGeo,
    riserGeo,
    riserGlowMat,
    riserGlowGeo,
    rackFaceMat,
    rackGeo,
    vuTex,
    vuMat,
    vuGeo,
    mugMat,
    coffeeMat,
    mugGeo,
    mugHandleGeo,
    coffeeGeo,
    shelfOuterGeo,
    shelfSideGeo,
    shelfDivGeo,
    recordSpineGeo
  );

  return group;
}
