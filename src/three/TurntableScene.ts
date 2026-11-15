import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { CameraPreset, PlinthFinish, RpmMode, VinylDisc } from '../types/turntable';
import { sanitizeColor } from '../utils/configCodec';
import {
  createContactShadowTexture,
  createStrobeRimTexture,
  createTabletopTexture,
  createVinylGroovesTextures,
  createWoodTextures,
  LabelTextureController,
  paintWoodCanvas,
} from './proceduralTextures';

export interface TurntableSceneCallbacks {
  onTogglePlay: () => void;
  onToggleRpm: () => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [0.2, 5.1, 6.4], target: [0, 0.55, 0] },
  needle: { pos: [2.45, 2.2, 2.85], target: [0.48, 0.98, 0.68] },
  label: { pos: [-0.45, 3.6, 2.3], target: [-0.45, 0.88, 0.05] },
  top: { pos: [0, 7.6, 0.6], target: [0, 0.55, 0] },
};

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

// Pre-allocated helpers to keep render loop allocation-free
const _pointer = new THREE.Vector2();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

export class TurntableScene {
  private container: HTMLElement;
  private callbacks: TurntableSceneCallbacks;
  private isSoftwareGl: boolean;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Dynamic state
  private isPlaying = false;
  private rpm: RpmMode = 33;
  private dustCoverOpen = true;
  private platterSpeed = 0;
  private targetArmYaw = 0.02;
  private targetArmPitch = -0.025;
  private discLiftOffset = 0;
  private discLiftPhase: 'idle' | 'lifting' | 'dropping' = 'idle';
  private pendingDisc: VinylDisc | null = null;
  private currentDisc: VinylDisc | null = null;

  private activeCameraTransition = false;
  private activePreset: CameraPreset = 'overview';

  // Scene references for animation & updates
  private platterGroup: THREE.Group;
  private discGroup: THREE.Group;
  private tonearmArm: THREE.Group;
  private cueLeverMesh: THREE.Mesh;
  private dustCoverPivot: THREE.Group;
  private rpmSwitchMesh: THREE.Mesh;
  private startButtonMesh: THREE.Mesh;
  private ledMat: THREE.MeshStandardMaterial;
  private strobeLightMat: THREE.MeshStandardMaterial;
  private vinylMat: THREE.MeshPhysicalMaterial;
  private woodMat: THREE.MeshStandardMaterial;
  private woodTextureCanvas: HTMLCanvasElement;
  private woodMap: THREE.CanvasTexture;
  private labelController: LabelTextureController;
  private ambientParticles: THREE.Points;

  // Raycast targets
  private playHitTargets: THREE.Object3D[] = [];
  private rpmHitTargets: THREE.Object3D[] = [];
  private allHitTargets: THREE.Object3D[] = [];
  private pointerDownPos = { x: 0, y: 0 };
  private lastHoverRaycast = 0;

  // Disposable resource tracking
  private disposables: { dispose: () => void }[] = [];

  constructor(container: HTMLElement, callbacks: TurntableSceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x100c0a);
    this.scene.fog = new THREE.FogExp2(0x100c0a, 0.042);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 80);
    this.camera.position.set(...CAMERA_PRESETS.overview.pos);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Studio IBL environment map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = envTarget.texture;
    this.disposables.push(envTarget);
    roomEnv.dispose();
    pmrem.dispose();

    // Orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 11.5;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minPolarAngle = 0.08;
    this.controls.target.set(...CAMERA_PRESETS.overview.target);
    this.controls.addEventListener('start', () => {
      this.activeCameraTransition = false;
    });

    // Lighting rig: Warm Key + Cool Hemisphere Fill + Warm Rim
    const hemiLight = new THREE.HemisphereLight(0xcbd8f0, 0x3b2618, 0.65);
    this.scene.add(hemiLight);

    const keyLight = new THREE.SpotLight(0xffd7b0, 62, 26, Math.PI / 4, 0.55, 1.8);
    keyLight.position.set(4.5, 8.2, 4.8);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xe88b5a, 14, 16, 1.5);
    rimLight.position.set(-4.6, 3.2, -3.8);
    this.scene.add(rimLight);

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // Tabletop & Contact Shadow Grounding
    const tabletopTex = createTabletopTexture(maxAnisotropy);
    this.disposables.push(tabletopTex);
    const tabletopGeo = new THREE.CircleGeometry(18, 64);
    const tabletopMat = new THREE.MeshStandardMaterial({
      map: tabletopTex,
      roughness: 0.85,
      metalness: 0.06,
    });
    const tabletop = new THREE.Mesh(tabletopGeo, tabletopMat);
    tabletop.rotation.x = -Math.PI / 2;
    tabletop.position.y = 0;
    tabletop.receiveShadow = true;
    this.scene.add(tabletop);
    this.disposables.push(tabletopGeo, tabletopMat);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(7.2, 5.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.006;
    this.scene.add(contactShadow);
    this.disposables.push(shadowTex, shadowGeo, shadowMat);

    // =========================================================
    // TURNTABLE COMPOSITE GROUP
    // =========================================================
    const turntable = new THREE.Group();
    this.scene.add(turntable);

    // 1. Isolation feet (4x LatheGeometry seated at y=0)
    const footProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.21, 0.04),
      new THREE.Vector2(0.19, 0.11),
      new THREE.Vector2(0.23, 0.14),
      new THREE.Vector2(0.23, 0.18),
      new THREE.Vector2(0, 0.18),
    ];
    const footGeo = new THREE.LatheGeometry(footProfile, 28);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd9a85e,
      metalness: 0.88,
      roughness: 0.24,
    });
    const rubberFootMat = new THREE.MeshStandardMaterial({
      color: 0x1a1715,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.disposables.push(footGeo, brassMat, rubberFootMat);

    [
      [-2.25, -1.72],
      [2.25, -1.72],
      [-2.25, 1.72],
      [2.25, 1.72],
    ].forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(footGeo, brassMat);
      foot.position.set(fx, 0, fz);
      foot.castShadow = true;
      turntable.add(foot);
    });

    // 2. Beveled Wood Plinth (ExtrudeGeometry)
    const { canvas: woodCanvas, map: woodMap, roughnessMap: woodRough } =
      createWoodTextures('walnut', maxAnisotropy);
    this.woodTextureCanvas = woodCanvas;
    this.woodMap = woodMap;
    this.disposables.push(woodMap, woodRough);

    this.woodMat = new THREE.MeshStandardMaterial({
      map: woodMap,
      roughnessMap: woodRough,
      roughness: 0.48,
      metalness: 0.06,
    });
    this.disposables.push(this.woodMat);

    const plinthW = 5.2;
    const plinthD = 4.05;
    const cornerR = 0.18;
    const plinthShape = new THREE.Shape();
    plinthShape.moveTo(-plinthW / 2 + cornerR, -plinthD / 2);
    plinthShape.lineTo(plinthW / 2 - cornerR, -plinthD / 2);
    plinthShape.quadraticCurveTo(plinthW / 2, -plinthD / 2, plinthW / 2, -plinthD / 2 + cornerR);
    plinthShape.lineTo(plinthW / 2, plinthD / 2 - cornerR);
    plinthShape.quadraticCurveTo(plinthW / 2, plinthD / 2, plinthW / 2 - cornerR, plinthD / 2);
    plinthShape.lineTo(-plinthW / 2 + cornerR, plinthD / 2);
    plinthShape.quadraticCurveTo(-plinthW / 2, plinthD / 2, -plinthW / 2, plinthD / 2 - cornerR);
    plinthShape.lineTo(-plinthW / 2, -plinthD / 2 + cornerR);
    plinthShape.quadraticCurveTo(-plinthW / 2, -plinthD / 2, -plinthW / 2 + cornerR, -plinthD / 2);

    const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
      depth: 0.52,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.045,
      bevelSegments: 4,
    });
    plinthGeo.rotateX(-Math.PI / 2);
    // Normalize UVs cleanly for top/sides wood grain
    const plinthMesh = new THREE.Mesh(plinthGeo, this.woodMat);
    plinthMesh.position.y = 0.19;
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    turntable.add(plinthMesh);
    this.disposables.push(plinthGeo);

    // 3. Recessed Anodized Top Deck Plate
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x201c1a,
      roughness: 0.36,
      metalness: 0.72,
    });
    const deckGeo = new THREE.BoxGeometry(4.82, 0.045, 3.68);
    const deckPlate = new THREE.Mesh(deckGeo, deckMat);
    deckPlate.position.y = 0.765;
    deckPlate.receiveShadow = true;
    turntable.add(deckPlate);
    this.disposables.push(deckGeo, deckMat);

    // Brass accent trim strip on front edge
    const trimGeo = new THREE.BoxGeometry(4.84, 0.025, 0.04);
    const trimMesh = new THREE.Mesh(trimGeo, brassMat);
    trimMesh.position.set(0, 0.77, 1.85);
    turntable.add(trimMesh);
    this.disposables.push(trimGeo);

    // 4. Stroboscopic Platter + Slipmat
    this.platterGroup = new THREE.Group();
    this.platterGroup.position.set(-0.48, 0.8, 0.06);
    turntable.add(this.platterGroup);

    const strobeTex = createStrobeRimTexture(maxAnisotropy);
    const aluminumMat = new THREE.MeshPhysicalMaterial({
      color: 0xc8c2ba,
      metalness: 0.9,
      roughness: 0.22,
      clearcoat: 0.2,
    });
    const strobeRimMat = new THREE.MeshStandardMaterial({
      map: strobeTex,
      metalness: 0.85,
      roughness: 0.28,
    });
    const platterBodyGeo = new THREE.CylinderGeometry(1.63, 1.66, 0.14, 72, 1, false);
    const platterMesh = new THREE.Mesh(platterBodyGeo, [
      strobeRimMat,
      aluminumMat,
      aluminumMat,
    ]);
    platterMesh.position.y = 0.07;
    platterMesh.receiveShadow = true;
    platterMesh.castShadow = true;
    this.platterGroup.add(platterMesh);
    this.disposables.push(strobeTex, aluminumMat, strobeRimMat, platterBodyGeo);

    // Felt slipmat
    const slipmatGeo = new THREE.CylinderGeometry(1.53, 1.53, 0.02, 64);
    const slipmatMesh = new THREE.Mesh(slipmatGeo, rubberFootMat);
    slipmatMesh.position.y = 0.15;
    slipmatMesh.receiveShadow = true;
    this.platterGroup.add(slipmatMesh);
    this.disposables.push(slipmatGeo);

    // Brass center spindle + stabilizer collar
    const spindleGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.28, 24);
    const spindleMesh = new THREE.Mesh(spindleGeo, brassMat);
    spindleMesh.position.y = 0.22;
    this.platterGroup.add(spindleMesh);
    this.disposables.push(spindleGeo);

    // 5. Vinyl Disc Group (supports lift & drop disc swap animation)
    this.discGroup = new THREE.Group();
    this.platterGroup.add(this.discGroup);

    const { roughnessMap: grooveRough, bumpMap: grooveBump } =
      createVinylGroovesTextures(maxAnisotropy);
    this.vinylMat = new THREE.MeshPhysicalMaterial({
      color: 0x141414,
      roughnessMap: grooveRough,
      bumpMap: grooveBump,
      bumpScale: 0.008,
      roughness: 0.34,
      metalness: 0.25,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
    });
    const vinylGeo = new THREE.CylinderGeometry(1.55, 1.55, 0.026, 72);
    const vinylMesh = new THREE.Mesh(vinylGeo, this.vinylMat);
    vinylMesh.position.y = 0.175;
    vinylMesh.castShadow = true;
    vinylMesh.receiveShadow = true;
    this.discGroup.add(vinylMesh);

    // Beveled outer vinyl bead
    const rimBeadGeo = new THREE.TorusGeometry(1.545, 0.016, 12, 72);
    rimBeadGeo.rotateX(Math.PI / 2);
    const rimBeadMesh = new THREE.Mesh(rimBeadGeo, this.vinylMat);
    rimBeadMesh.position.y = 0.175;
    this.discGroup.add(rimBeadMesh);

    // Center label
    this.labelController = new LabelTextureController(maxAnisotropy);
    const labelMat = new THREE.MeshStandardMaterial({
      map: this.labelController.texture,
      roughness: 0.7,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const labelGeo = new THREE.CylinderGeometry(0.54, 0.54, 0.03, 56);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = 0.176;
    this.discGroup.add(labelMesh);
    this.disposables.push(
      grooveRough,
      grooveBump,
      this.vinylMat,
      vinylGeo,
      rimBeadGeo,
      this.labelController,
      labelMat,
      labelGeo
    );

    // 6. Articulated S-Shaped Tonearm Assembly
    const tonearmPivot = new THREE.Group();
    tonearmPivot.position.set(1.78, 0.8, -1.16);
    turntable.add(tonearmPivot);

    const gimbalBaseGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.14, 36);
    const gimbalBase = new THREE.Mesh(gimbalBaseGeo, deckMat);
    gimbalBase.position.y = 0.07;
    gimbalBase.castShadow = true;
    tonearmPivot.add(gimbalBase);

    const gimbalRingGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.18, 32);
    const gimbalRing = new THREE.Mesh(gimbalRingGeo, brassMat);
    gimbalRing.position.y = 0.2;
    tonearmPivot.add(gimbalRing);

    // Tonearm rest post (aligned under parked arm outside platter)
    const restPostGeo = new THREE.CylinderGeometry(0.032, 0.04, 0.34, 16);
    const restPost = new THREE.Mesh(restPostGeo, deckMat);
    restPost.position.set(1.82, 0.96, 0.29);
    turntable.add(restPost);

    const restCradleGeo = new THREE.TorusGeometry(0.055, 0.015, 8, 20, Math.PI);
    restCradleGeo.rotateZ(Math.PI);
    const restCradle = new THREE.Mesh(restCradleGeo, brassMat);
    restCradle.position.set(1.82, 1.13, 0.29);
    turntable.add(restCradle);

    // Cueing lever
    const cueLeverGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.24, 12);
    cueLeverGeo.translate(0, 0.12, 0);
    this.cueLeverMesh = new THREE.Mesh(cueLeverGeo, brassMat);
    this.cueLeverMesh.position.set(-0.34, 0.14, 0.12);
    this.cueLeverMesh.rotation.z = 0.45;
    tonearmPivot.add(this.cueLeverMesh);

    this.tonearmArm = new THREE.Group();
    this.tonearmArm.position.y = 0.3;
    this.tonearmArm.rotation.y = this.targetArmYaw;
    this.tonearmArm.rotation.x = this.targetArmPitch;
    tonearmPivot.add(this.tonearmArm);

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf0e9df,
      metalness: 0.94,
      roughness: 0.14,
    });

    // Counterweight + calibrated dial ring
    const cwGeo = new THREE.CylinderGeometry(0.155, 0.155, 0.28, 28);
    cwGeo.rotateX(Math.PI / 2);
    const counterweight = new THREE.Mesh(cwGeo, aluminumMat);
    counterweight.position.set(0, 0.02, -0.36);
    counterweight.castShadow = true;
    this.tonearmArm.add(counterweight);

    const cwDialGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 28);
    cwDialGeo.rotateX(Math.PI / 2);
    const cwDial = new THREE.Mesh(cwDialGeo, brassMat);
    cwDial.position.set(0, 0.02, -0.24);
    this.tonearmArm.add(cwDial);

    // S-curve tonearm tube via CatmullRomCurve3
    const sCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.02, -0.2),
      new THREE.Vector3(0, 0.02, 0.55),
      new THREE.Vector3(0.09, 0.02, 1.15),
      new THREE.Vector3(-0.08, 0.02, 1.75),
      new THREE.Vector3(-0.14, 0.015, 2.08),
    ]);
    const armTubeGeo = new THREE.TubeGeometry(sCurve, 48, 0.03, 14, false);
    const armTube = new THREE.Mesh(armTubeGeo, chromeMat);
    armTube.castShadow = true;
    this.tonearmArm.add(armTube);

    // Headshell + finger lift + cartridge + ruby stylus
    const headshellGroup = new THREE.Group();
    headshellGroup.position.set(-0.14, 0.012, 2.08);
    headshellGroup.rotation.y = -0.26;
    this.tonearmArm.add(headshellGroup);

    const headshellGeo = new THREE.BoxGeometry(0.15, 0.045, 0.32);
    const headshellMesh = new THREE.Mesh(headshellGeo, deckMat);
    headshellMesh.position.set(0, 0, 0.14);
    headshellMesh.castShadow = true;
    headshellGroup.add(headshellMesh);

    const fingerLiftGeo = new THREE.BoxGeometry(0.12, 0.016, 0.024);
    const fingerLift = new THREE.Mesh(fingerLiftGeo, brassMat);
    fingerLift.position.set(0.09, 0.01, 0.16);
    headshellGroup.add(fingerLift);

    const cartGeo = new THREE.BoxGeometry(0.11, 0.075, 0.18);
    const cartMesh = new THREE.Mesh(cartGeo, brassMat);
    cartMesh.position.set(0, -0.05, 0.17);
    headshellGroup.add(cartMesh);

    const stylusGeo = new THREE.ConeGeometry(0.014, 0.055, 10);
    stylusGeo.rotateX(Math.PI * 0.88);
    const stylusMesh = new THREE.Mesh(stylusGeo, chromeMat);
    stylusMesh.position.set(0, -0.09, 0.22);
    headshellGroup.add(stylusMesh);

    this.disposables.push(
      gimbalBaseGeo,
      gimbalRingGeo,
      restPostGeo,
      restCradleGeo,
      cueLeverGeo,
      chromeMat,
      cwGeo,
      cwDialGeo,
      armTubeGeo,
      headshellGeo,
      fingerLiftGeo,
      cartGeo,
      stylusGeo
    );

    // 7. Tactile Plinth Controls (Start/Stop + Strobe LED + 33/45 RPM switch)
    // Start/Stop button front-right
    const btnBezelGeo = new THREE.CylinderGeometry(0.16, 0.17, 0.03, 28);
    const btnBezel = new THREE.Mesh(btnBezelGeo, deckMat);
    btnBezel.position.set(1.92, 0.79, 1.42);
    turntable.add(btnBezel);

    const startBtnGeo = new THREE.CylinderGeometry(0.12, 0.125, 0.055, 28);
    this.startButtonMesh = new THREE.Mesh(startBtnGeo, brassMat);
    this.startButtonMesh.position.set(1.92, 0.815, 1.42);
    turntable.add(this.startButtonMesh);

    // Power/Strobe LED
    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0xffa652,
      emissive: 0xff7b1c,
      emissiveIntensity: 0.25,
      roughness: 0.2,
    });
    const ledGeo = new THREE.SphereGeometry(0.048, 16, 16);
    const powerLed = new THREE.Mesh(ledGeo, this.ledMat);
    powerLed.position.set(1.62, 0.8, 1.42);
    turntable.add(powerLed);

    // Strobe tower illuminating platter dots
    const strobeHousingGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.14, 20);
    const strobeHousing = new THREE.Mesh(strobeHousingGeo, deckMat);
    strobeHousing.position.set(1.08, 0.84, 1.05);
    turntable.add(strobeHousing);

    this.strobeLightMat = new THREE.MeshStandardMaterial({
      color: 0xff9340,
      emissive: 0xff6b12,
      emissiveIntensity: 0.2,
    });
    const strobeBulbGeo = new THREE.SphereGeometry(0.035, 12, 12);
    const strobeBulb = new THREE.Mesh(strobeBulbGeo, this.strobeLightMat);
    strobeBulb.position.set(1.01, 0.88, 0.98);
    turntable.add(strobeBulb);

    // 33 / 45 RPM selector knob/switch
    const rpmBaseGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.035, 24);
    const rpmBase = new THREE.Mesh(rpmBaseGeo, deckMat);
    rpmBase.position.set(1.32, 0.79, 1.42);
    turntable.add(rpmBase);

    const rpmSwitchGeo = new THREE.BoxGeometry(0.06, 0.08, 0.18);
    this.rpmSwitchMesh = new THREE.Mesh(rpmSwitchGeo, brassMat);
    this.rpmSwitchMesh.position.set(1.32, 0.825, 1.42);
    this.rpmSwitchMesh.rotation.y = -0.35;
    turntable.add(this.rpmSwitchMesh);

    this.disposables.push(
      btnBezelGeo,
      startBtnGeo,
      this.ledMat,
      ledGeo,
      strobeHousingGeo,
      this.strobeLightMat,
      strobeBulbGeo,
      rpmBaseGeo,
      rpmSwitchGeo
    );

    // 8. Hinged Acrylic Dust Cover
    this.dustCoverPivot = new THREE.Group();
    this.dustCoverPivot.position.set(0, 0.79, -1.86);
    turntable.add(this.dustCoverPivot);

    // Two rear brass hinges
    const hingeGeo = new THREE.BoxGeometry(0.28, 0.08, 0.09);
    [-1.65, 1.65].forEach((hx) => {
      const hinge = new THREE.Mesh(hingeGeo, brassMat);
      hinge.position.set(hx, 0.02, 0);
      this.dustCoverPivot.add(hinge);
    });

    const acrylicMat = new THREE.MeshPhysicalMaterial({
      color: 0xefe6da,
      roughness: 0.08,
      metalness: 0.02,
      transmission: this.isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: this.isSoftwareGl ? 0.18 : 1,
      ior: 1.49,
      thickness: 0.06,
      clearcoat: 1.0,
      depthWrite: false,
    });
    const coverGeo = new THREE.BoxGeometry(4.84, 0.44, 3.68);
    const coverMesh = new THREE.Mesh(coverGeo, acrylicMat);
    coverMesh.position.set(0, 0.24, 1.84);
    coverMesh.renderOrder = 4;
    this.dustCoverPivot.add(coverMesh);
    this.dustCoverPivot.rotation.x = -0.95; // Initially open to show off vinyl & tonearm

    this.disposables.push(hingeGeo, acrylicMat, coverGeo);

    // 9. Ambient Warm Dust Motes
    const particlesCount = 140;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 12;
      pPos[i * 3 + 1] = Math.random() * 5.2 + 0.3;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffd1a3,
      size: 0.04,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.ambientParticles = new THREE.Points(pGeo, pMat);
    this.scene.add(this.ambientParticles);
    this.disposables.push(pGeo, pMat);

    // Configure raycast target groups
    this.playHitTargets = [this.tonearmArm, vinylMesh, labelMesh, this.startButtonMesh];
    this.rpmHitTargets = [this.rpmSwitchMesh];
    this.allHitTargets = [...this.playHitTargets, ...this.rpmHitTargets];

    // Event bindings
    this.bindEvents();

    // Pre-compile shaders on hardware WebGL
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.tick();
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
    window.addEventListener('resize', this.handleResize);
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverRaycast < 55) return;
    this.lastHoverRaycast = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(_pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.allHitTargets, true);
    this.renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
  };

  private handlePointerUp = (e: PointerEvent): void => {
    const dist = Math.hypot(
      e.clientX - this.pointerDownPos.x,
      e.clientY - this.pointerDownPos.y
    );
    if (dist > 6) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(_pointer, this.camera);
    const rpmHits = this.raycaster.intersectObjects(this.rpmHitTargets, true);
    if (rpmHits.length > 0) {
      this.callbacks.onToggleRpm();
      return;
    }

    const playHits = this.raycaster.intersectObjects(this.playHitTargets, true);
    if (playHits.length > 0) {
      this.callbacks.onTogglePlay();
    }
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost?.();
  };

  private handleContextRestored = (): void => {
    this.callbacks.onContextRestored?.();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public setDisc(disc: VinylDisc, animateSwap = true): void {
    const isDifferent = !this.currentDisc || this.currentDisc.id !== disc.id;
    this.currentDisc = disc;

    if (animateSwap && isDifferent && this.discLiftPhase === 'idle') {
      this.pendingDisc = disc;
      this.discLiftPhase = 'lifting';
    } else {
      this.applyDiscVisuals(disc);
    }
  }

  private applyDiscVisuals(disc: VinylDisc): void {
    this.vinylMat.color.set(sanitizeColor(disc.vinylColor, '#141414'));
    this.labelController.update(disc, this.rpm);
  }

  public setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    if (playing) {
      this.targetArmYaw = -0.56;
      this.targetArmPitch = 0.008;
      this.ledMat.emissiveIntensity = 2.6;
      this.strobeLightMat.emissiveIntensity = 2.4;
    } else {
      this.targetArmYaw = 0.02;
      this.targetArmPitch = -0.025;
      this.ledMat.emissiveIntensity = 0.25;
      this.strobeLightMat.emissiveIntensity = 0.2;
    }
  }

  public setRpm(rpm: RpmMode): void {
    this.rpm = rpm;
    if (this.currentDisc) {
      this.labelController.update(this.currentDisc, rpm);
    }
  }

  public setFinish(finish: PlinthFinish): void {
    paintWoodCanvas(this.woodTextureCanvas, finish);
    this.woodMap.needsUpdate = true;
  }

  public setDustCoverOpen(open: boolean): void {
    this.dustCoverOpen = open;
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.activePreset = preset;
    this.activeCameraTransition = true;
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const dt = Math.min(this.clock.getDelta(), 0.08);
    const elapsed = this.clock.getElapsedTime();

    // 1. Platter inertia (33.3 RPM vs 45 RPM)
    const targetSpeed = this.isPlaying ? (this.rpm === 45 ? 3.25 : 2.35) : 0;
    this.platterSpeed = THREE.MathUtils.damp(this.platterSpeed, targetSpeed, 3.2, dt);
    this.platterGroup.rotation.y -= this.platterSpeed * dt;

    // 2. Disc swap lift & drop transition
    if (this.discLiftPhase === 'lifting') {
      this.discLiftOffset = THREE.MathUtils.damp(this.discLiftOffset, 0.36, 12, dt);
      if (this.discLiftOffset > 0.32) {
        if (this.pendingDisc) {
          this.applyDiscVisuals(this.pendingDisc);
          this.pendingDisc = null;
        }
        this.discLiftPhase = 'dropping';
      }
    } else if (this.discLiftPhase === 'dropping') {
      this.discLiftOffset = THREE.MathUtils.damp(this.discLiftOffset, 0, 10, dt);
      if (this.discLiftOffset < 0.004) {
        this.discLiftOffset = 0;
        this.discLiftPhase = 'idle';
      }
    }
    this.discGroup.position.y = this.discLiftOffset;

    // 3. Tonearm, cue lever & plinth tactile switches
    this.tonearmArm.rotation.y = THREE.MathUtils.damp(
      this.tonearmArm.rotation.y,
      this.targetArmYaw,
      5.5,
      dt
    );
    this.tonearmArm.rotation.x = THREE.MathUtils.damp(
      this.tonearmArm.rotation.x,
      this.targetArmPitch,
      6.5,
      dt
    );
    if (this.isPlaying && this.platterSpeed > 1.6) {
      this.tonearmArm.rotation.y += Math.sin(elapsed * 2.6) * 0.0005;
    }

    const targetCueZ = this.isPlaying ? 0.08 : 0.52;
    this.cueLeverMesh.rotation.z = THREE.MathUtils.damp(
      this.cueLeverMesh.rotation.z,
      targetCueZ,
      8,
      dt
    );

    const targetRpmYaw = this.rpm === 45 ? 0.38 : -0.38;
    this.rpmSwitchMesh.rotation.y = THREE.MathUtils.damp(
      this.rpmSwitchMesh.rotation.y,
      targetRpmYaw,
      10,
      dt
    );

    const targetBtnY = this.isPlaying ? 0.798 : 0.815;
    this.startButtonMesh.position.y = THREE.MathUtils.damp(
      this.startButtonMesh.position.y,
      targetBtnY,
      12,
      dt
    );

    // 4. Hinged dust cover
    const targetCoverAngle = this.dustCoverOpen ? -0.95 : 0;
    this.dustCoverPivot.rotation.x = THREE.MathUtils.damp(
      this.dustCoverPivot.rotation.x,
      targetCoverAngle,
      5,
      dt
    );

    // 5. Scripted camera preset damping (stops on arrival or user drag)
    if (this.activeCameraTransition) {
      const preset = CAMERA_PRESETS[this.activePreset];
      _targetCamPos.set(...preset.pos);
      _targetLookAt.set(...preset.target);

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _targetCamPos.x, 5.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _targetCamPos.y, 5.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _targetCamPos.z, 5.5, dt);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, _targetLookAt.x, 5.5, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, _targetLookAt.y, 5.5, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, _targetLookAt.z, 5.5, dt);

      if (this.camera.position.distanceTo(_targetCamPos) < 0.03) {
        this.activeCameraTransition = false;
      }
    }

    // 6. Ambient motes
    this.ambientParticles.rotation.y = elapsed * 0.025;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);
    window.removeEventListener('resize', this.handleResize);

    this.controls.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
