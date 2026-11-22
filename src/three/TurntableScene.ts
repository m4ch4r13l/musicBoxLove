import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { AudioReactiveLevels } from '../audio/vinylAudioEngine';
import type {
  CameraPreset,
  PlinthFinish,
  RpmMode,
  SceneEnvironment,
  VinylDisc,
} from '../types/turntable';
import { sanitizeColor } from '../utils/configCodec';
import {
  createContactShadowTexture,
  createStrobeRimTexture,
  createVinylGroovesTextures,
  createWoodTextures,
  LabelTextureController,
  paintWoodCanvas,
} from './proceduralTextures';
import {
  type EnvironmentStyle,
  SceneEnvironmentController,
} from './sceneEnvironments';

export interface TurntableSceneCallbacks {
  onTogglePlay: () => void;
  onToggleRpm: () => void;
  onCueReady?: () => void;
  onRestartLift?: () => void;
  getAudioLevels?: () => AudioReactiveLevels;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

const ARM_REST_YAW = 0.02;
const ARM_REST_PITCH = -0.025;
const ARM_LIFT_PITCH = -0.14;
const ARM_PLAY_PITCH = 0.008;
const ARM_OUTER_YAW = -0.38;
const ARM_INNER_YAW = -0.76;

type ArmPhase =
  | 'parked'
  | 'cue_lift'
  | 'cue_swing'
  | 'cue_drop'
  | 'tracking'
  | 'reposition_lift'
  | 'reposition_swing'
  | 'reposition_drop'
  | 'park_lift'
  | 'park_swing'
  | 'park_drop';

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [0.2, 6.2, 7.8], target: [0, 0.55, 0] },
  needle: { pos: [2.45, 2.2, 2.85], target: [0.55, 0.98, 0.72] },
  label: { pos: [-0.45, 3.6, 2.3], target: [-0.45, 0.88, 0.05] },
  top: { pos: [0, 9.2, 0.7], target: [0, 0.55, 0] },
  cinematic: { pos: [-3.8, 4.6, 8.2], target: [0, 0.65, 0] },
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
const _zoomOffset = new THREE.Vector3();

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
  private dustCoverOpen = false;
  private platterSpeed = 0;
  private armPhase: ArmPhase = 'parked';
  private cueToken = 0;
  private pendingCueToken = 0;
  private targetArmYaw = ARM_REST_YAW;
  private targetArmPitch = ARM_REST_PITCH;
  private externalProgress = -1;
  private synthProgress = 0;
  private discLiftOffset = 0;
  private discLiftPhase: 'idle' | 'lifting' | 'dropping' = 'idle';
  private discSwapWaitingForPark = false;
  private pendingDisc: VinylDisc | null = null;
  private currentDisc: VinylDisc | null = null;

  private activeCameraTransition = false;
  private activePreset: CameraPreset = 'overview';
  private targetZoomDistance: number | null = null;
  private cinematicActive = false;
  private cinematicTime = 0;
  private cinematicZoomScale = 1;
  private currentCinematicZoom = 1;
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist = 0;
  private wasPinching = false;
  private lastPinchEndMs = 0;

  // Scene references for animation & updates
  private turntableGroup: THREE.Group;
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
  private particleMat: THREE.ShaderMaterial;
  private particlePlayingMix = 0;
  private particleRotationY = 0;
  private particleFlightTime = 0;
  private particleMotionPulse = 0;
  private envController: SceneEnvironmentController;
  private sceneFog: THREE.FogExp2;
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.SpotLight;
  private rimLight: THREE.PointLight;

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
    const aspect = width / Math.max(height, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x100c0a);
    this.sceneFog = new THREE.FogExp2(0x87997a, 0.008);
    this.scene.fog = this.sceneFog;

    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
    const portraitScale = this.getPortraitDistanceScale(aspect);
    this.camera.position.set(
      CAMERA_PRESETS.overview.pos[0] * portraitScale,
      CAMERA_PRESETS.overview.pos[1] * portraitScale,
      CAMERA_PRESETS.overview.pos[2] * portraitScale
    );

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
    this.renderer.toneMappingExposure = 1.08;
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
    this.controls.minDistance = 2.4;
    this.controls.maxDistance = 44;
    this.controls.zoomSpeed = 1.4;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minPolarAngle = 0.08;
    this.controls.target.set(...CAMERA_PRESETS.overview.target);
    this.controls.addEventListener('start', () => {
      this.activeCameraTransition = false;
      this.targetZoomDistance = null;
    });

    // Lighting rig: Warm Key + Cool Hemisphere Fill + Warm Rim
    this.hemiLight = new THREE.HemisphereLight(0xd6e9ff, 0x4b6930, 1.05);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.SpotLight(0xffe4bd, 68, 28, Math.PI / 4, 0.55, 1.8);
    this.keyLight.position.set(4.5, 8.2, 4.8);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.PointLight(0xf4b672, 13, 16, 1.5);
    this.rimLight.position.set(-4.6, 3.2, -3.8);
    this.scene.add(this.rimLight);

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // Dynamic 3D Scenario Environments (default: valley with grass)
    this.envController = new SceneEnvironmentController(this.scene, maxAnisotropy, 'valley');
    const initialEnvStyle = this.envController.setEnvironment('valley');

    // =========================================================
    // TURNTABLE COMPOSITE GROUP
    // =========================================================
    this.turntableGroup = new THREE.Group();
    const turntable = this.turntableGroup;
    this.scene.add(turntable);

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
    turntable.add(contactShadow);
    this.disposables.push(shadowTex, shadowGeo, shadowMat);

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
    this.dustCoverPivot.rotation.x = 0; // Start closed on load before opening smoothly

    this.disposables.push(hingeGeo, acrylicMat, coverGeo);

    // 9. Audio-Reactive Warm Dust Motes (blink & pulse to the music rhythm)
    const particlesCount = 190;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particlesCount * 3);
    const pPhase = new Float32Array(particlesCount);
    const pBand = new Float32Array(particlesCount);
    const pScale = new Float32Array(particlesCount);

    for (let i = 0; i < particlesCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.8 + Math.random() * 6.2;
      pPos[i * 3] = Math.cos(angle) * radius;
      pPos[i * 3 + 1] = Math.random() * 5.2 + 0.35;
      pPos[i * 3 + 2] = Math.sin(angle) * radius;
      pPhase[i] = Math.random() * Math.PI * 2;
      pBand[i] = i % 3 === 0 ? 0.0 : i % 3 === 1 ? 0.5 : 1.0;
      pScale[i] = 0.55 + Math.random() * 0.7;
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhase, 1));
    pGeo.setAttribute('aBand', new THREE.BufferAttribute(pBand, 1));
    pGeo.setAttribute('aScale', new THREE.BufferAttribute(pScale, 1));

    this.particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFlightTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uPulse: { value: 0 },
        uMotionPulse: { value: 0 },
        uPlaying: { value: 0 },
        uColorA: { value: new THREE.Color(initialEnvStyle.particleColorA) },
        uColorB: { value: new THREE.Color(initialEnvStyle.particleColorB) },
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aBand;
        attribute float aScale;

        uniform float uTime;
        uniform float uFlightTime;
        uniform float uPixelRatio;
        uniform float uBass;
        uniform float uMid;
        uniform float uHigh;
        uniform float uPulse;
        uniform float uMotionPulse;
        uniform float uPlaying;

        varying float vAlpha;
        varying float vHeat;

        void main() {
          float bandEnergy = aBand < 0.25 ? uBass : (aBand < 0.75 ? uMid : uHigh);
          float fireflyBreath = 0.5 + 0.5 * sin(uTime * 1.15 + aPhase);
          float beatWeight = aBand < 0.25 ? 1.05 : (aBand < 0.75 ? 0.8 : 0.55);
          // Organic variation (0.68..1.0) keeps firefly depth while ensuring all react on the beat
          float swarmDepth = 0.68 + 0.32 * sin(uTime * 0.85 + aPhase * 1.3);
          float audioDrive = clamp((bandEnergy * 0.85 + uPulse * beatWeight * 0.95) * swarmDepth, 0.0, 1.3);
          float activity = mix(0.24 * fireflyBreath, audioDrive, uPlaying);

          // Individual 3D Lissajous wandering flight driven by monotonic uFlightTime (never whips on play/pause)
          float bandSpeed = 1.0 + aBand * 0.14;
          vec3 pos = position;
          pos.x += sin(uFlightTime * bandSpeed + aPhase * 1.7) * 0.44
                 + cos(uFlightTime * 0.52 + aPhase * 3.1) * 0.22;
          pos.y += sin(uFlightTime * (bandSpeed * 1.22) + aPhase * 2.3) * 0.34
                 + cos(uFlightTime * 0.61 + aPhase * 1.1) * 0.14;
          pos.z += cos(uFlightTime * (bandSpeed * 0.92) + aPhase * 2.9) * 0.44
                 + sin(uFlightTime * 0.46 + aPhase * 1.9) * 0.22;

          // Gentle inertia-damped float & outward breath (rhythm snaps go into glow, not erratic spatial jerks)
          pos.y += uMotionPulse * 0.095 * beatWeight * uPlaying;
          pos.xz *= 1.0 + uMotionPulse * 0.018 * beatWeight * uPlaying;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float baseSize = mix(7.0, 8.6, uPlaying) + activity * 13.5;
          float dist = max(-mvPosition.z, 1.2);
          gl_PointSize = clamp(aScale * baseSize * uPixelRatio * (4.3 / dist), 1.8, 20.5);

          vAlpha = clamp(mix(0.16 + 0.20 * fireflyBreath, 0.18 + activity * 0.66, uPlaying), 0.08, 0.90);
          vHeat = clamp(bandEnergy * 0.52 + uPulse * 0.84, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vAlpha;
        varying float vHeat;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;

          float halo = smoothstep(0.5, 0.04, d);
          float innerCore = smoothstep(0.22, 0.0, d);
          float glow = pow(halo, 1.85) + innerCore * 0.55;
          vec3 warmCore = mix(uColorA, vec3(1.0, 0.96, 0.85), innerCore * (0.45 + vHeat * 0.4));
          vec3 color = mix(warmCore, uColorB, vHeat * halo * 0.85);

          gl_FragColor = vec4(color, clamp(glow * vAlpha, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.ambientParticles = new THREE.Points(pGeo, this.particleMat);
    this.scene.add(this.ambientParticles);
    this.disposables.push(pGeo, this.particleMat);
    this.applyEnvironmentStyle(initialEnvStyle);

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

    dom.addEventListener('wheel', this.handleWheel, { passive: false, capture: true });
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('pointercancel', this.handlePointerCancel);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
    window.addEventListener('resize', this.handleResize);
  }

  private getPinchDistance(): number {
    if (this.activePointers.size < 2) return 0;
    const iter = this.activePointers.values();
    const p1 = iter.next().value;
    const p2 = iter.next().value;
    if (!p1 || !p2) return 0;
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  private handleWheel = (e: WheelEvent): void => {
    if (!this.cinematicActive) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const factor = Math.exp(e.deltaY * 0.0011);
    this.cinematicZoomScale = THREE.MathUtils.clamp(
      this.cinematicZoomScale * factor,
      0.32,
      4.2
    );
  };

  private handlePointerDown = (e: PointerEvent): void => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.activePointers.size === 1) {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    } else if (this.activePointers.size === 2) {
      this.wasPinching = true;
      this.lastPinchDist = this.getPinchDistance();
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const tracked = this.activePointers.get(e.pointerId);
    if (tracked) {
      tracked.x = e.clientX;
      tracked.y = e.clientY;
    }

    if (this.cinematicActive) {
      if (this.activePointers.size === 2) {
        const dist = this.getPinchDistance();
        if (this.lastPinchDist > 4 && dist > 4) {
          const ratio = this.lastPinchDist / dist;
          this.cinematicZoomScale = THREE.MathUtils.clamp(
            this.cinematicZoomScale * ratio,
            0.32,
            4.2
          );
        }
        this.lastPinchDist = dist;
        return;
      }

      if (
        tracked &&
        this.activePointers.size === 1 &&
        !this.wasPinching &&
        performance.now() - this.lastPinchEndMs > 250
      ) {
        const dragDist = Math.hypot(
          e.clientX - this.pointerDownPos.x,
          e.clientY - this.pointerDownPos.y
        );
        if (dragDist > 14) {
          this.cinematicActive = false;
          this.controls.enabled = true;
          this.controls.update();
        }
      }
    }

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

  private handlePointerCancel = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
    if (this.wasPinching && this.activePointers.size < 2) {
      this.lastPinchEndMs = performance.now();
      this.lastPinchDist = 0;
      if (this.activePointers.size === 0) {
        this.wasPinching = false;
      }
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    const wasPinchGesture = this.wasPinching;
    this.activePointers.delete(e.pointerId);
    if (this.wasPinching && this.activePointers.size < 2) {
      this.lastPinchEndMs = performance.now();
      this.lastPinchDist = 0;
      if (this.activePointers.size === 0) {
        this.wasPinching = false;
      }
    }
    if (wasPinchGesture) return;

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

  private getPortraitDistanceScale(aspect: number): number {
    return aspect < 1 ? Math.min(2.65, 1.18 / Math.max(aspect, 0.42)) : 1;
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(this.container.clientHeight || window.innerHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.particleMat.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
  };

  public setDisc(disc: VinylDisc, animateSwap = true): void {
    const hadDisc = this.currentDisc !== null;
    const isDifferent = !this.currentDisc || this.currentDisc.id !== disc.id;
    this.currentDisc = disc;

    if (isDifferent) {
      this.synthProgress = 0;
      this.externalProgress = 0;
    }

    if (animateSwap && hadDisc && isDifferent) {
      this.pendingDisc = disc;
      if (this.armPhase !== 'parked') {
        this.discSwapWaitingForPark = true;
        if (
          this.armPhase !== 'park_lift' &&
          this.armPhase !== 'park_swing' &&
          this.armPhase !== 'park_drop'
        ) {
          this.armPhase = 'park_lift';
        }
      } else {
        this.discSwapWaitingForPark = false;
        this.discLiftPhase = 'lifting';
      }
    } else if (!this.discSwapWaitingForPark && this.discLiftPhase === 'idle') {
      this.applyDiscVisuals(disc);
    } else if (this.pendingDisc) {
      this.pendingDisc = disc;
    }
  }

  private applyDiscVisuals(disc: VinylDisc): void {
    this.vinylMat.color.set(sanitizeColor(disc.vinylColor, '#141414'));
    this.labelController.update(disc, this.rpm);
  }

  public setPlaybackProgress(progress: number): void {
    if (progress >= 0 && Number.isFinite(progress)) {
      this.externalProgress = THREE.MathUtils.clamp(progress, 0, 1);
    } else {
      this.externalProgress = -1;
    }
  }

  public setPlaying(playing: boolean): void {
    if (this.isPlaying === playing) return;
    this.isPlaying = playing;

    if (playing) {
      this.ledMat.emissiveIntensity = 2.6;
      this.strobeLightMat.emissiveIntensity = 2.4;
      this.cueToken++;
      this.pendingCueToken = this.cueToken;
      if (!this.discSwapWaitingForPark && this.discLiftPhase === 'idle') {
        this.armPhase = 'cue_lift';
      }
    } else {
      this.ledMat.emissiveIntensity = 0.25;
      this.strobeLightMat.emissiveIntensity = 0.2;
      this.pendingCueToken = 0;
      if (this.armPhase !== 'parked') {
        this.armPhase = 'park_lift';
      }
    }
  }

  public triggerRestartCue(): void {
    this.synthProgress = 0;
    this.externalProgress = 0;
    if (!this.isPlaying) return;
    this.cueToken++;
    this.pendingCueToken = this.cueToken;
    if (this.discSwapWaitingForPark || this.discLiftPhase !== 'idle') {
      return;
    }
    this.armPhase = 'reposition_lift';
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

  public setEnvironment(environment: SceneEnvironment): void {
    const style = this.envController.setEnvironment(environment);
    if (environment !== 'ocean') {
      this.turntableGroup.position.set(0, 0, 0);
      this.turntableGroup.quaternion.identity();
    }
    this.controls.maxDistance =
      environment === 'studio' ? 17.5 : environment === 'forest' ? 40 : 44;
    this.controls.maxPolarAngle =
      environment === 'space' ? Math.PI * 0.88 : Math.PI * 0.46;
    if (this.targetZoomDistance !== null) {
      this.targetZoomDistance = Math.min(this.targetZoomDistance, this.controls.maxDistance);
    }
    this.applyEnvironmentStyle(style);
  }

  public setFramePhoto(photoUrl: string): void {
    this.envController.setFramePhoto(photoUrl);
  }

  private applyEnvironmentStyle(style: EnvironmentStyle): void {
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(style.fogColor);
    }
    this.sceneFog.color.setHex(style.fogColor);
    this.sceneFog.density = style.fogDensity;
    this.hemiLight.color.setHex(style.hemiSky);
    this.hemiLight.groundColor.setHex(style.hemiGround);
    this.hemiLight.intensity = style.hemiIntensity;
    this.keyLight.color.setHex(style.keyColor);
    this.keyLight.intensity = style.keyIntensity;
    this.rimLight.color.setHex(style.rimColor);
    this.rimLight.intensity = style.rimIntensity;
    this.renderer.toneMappingExposure = style.exposure;
    this.particleMat.uniforms.uColorA.value.setHex(style.particleColorA);
    this.particleMat.uniforms.uColorB.value.setHex(style.particleColorB);
  }

  public setDustCoverOpen(open: boolean): void {
    this.dustCoverOpen = open;
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.activePreset = preset;
    this.targetZoomDistance = null;
    if (preset === 'cinematic') {
      this.cinematicActive = true;
      this.cinematicTime = 0;
      this.cinematicZoomScale = 1;
      this.currentCinematicZoom = 1;
      this.activeCameraTransition = false;
      this.controls.enabled = false;
    } else {
      this.cinematicActive = false;
      this.controls.enabled = true;
      this.activeCameraTransition = true;
    }
  }

  public zoomBy(multiplier: number): void {
    if (this.cinematicActive) {
      this.cinematicZoomScale = THREE.MathUtils.clamp(
        this.cinematicZoomScale * multiplier,
        0.32,
        4.2
      );
      return;
    }
    this.activeCameraTransition = false;
    const currentDist =
      this.targetZoomDistance ?? this.camera.position.distanceTo(this.controls.target);
    this.targetZoomDistance = THREE.MathUtils.clamp(
      currentDist * multiplier,
      this.controls.minDistance,
      this.controls.maxDistance
    );
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

    // 1. Platter inertia (33.3 RPM vs 45 RPM) — pause drive cleanly during disc swap
    const isSwappingDisc = this.discSwapWaitingForPark || this.discLiftPhase !== 'idle';
    const targetSpeed = this.isPlaying && !isSwappingDisc ? (this.rpm === 45 ? 3.25 : 2.35) : 0;
    this.platterSpeed = THREE.MathUtils.damp(this.platterSpeed, targetSpeed, 3.2, dt);
    this.platterGroup.rotation.y -= this.platterSpeed * dt;

    // 2. Disc swap lift & drop transition (starts only after tonearm is parked)
    if (this.discSwapWaitingForPark && this.armPhase === 'parked') {
      this.discSwapWaitingForPark = false;
      this.discLiftPhase = 'lifting';
    }

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
        if (this.isPlaying && this.armPhase === 'parked') {
          if (this.pendingCueToken === 0) {
            this.cueToken++;
            this.pendingCueToken = this.cueToken;
          }
          this.armPhase = 'cue_lift';
        }
      }
    }
    this.discGroup.position.y = this.discLiftOffset;

    // 3. Tonearm, cue lever & plinth tactile switches
    let targetCueZ = 0.52;
    let yawDamp = 6.5;
    let pitchDamp = 9.0;

    switch (this.armPhase) {
      case 'parked': {
        this.targetArmYaw = ARM_REST_YAW;
        this.targetArmPitch = ARM_REST_PITCH;
        targetCueZ = 0.52;
        break;
      }
      case 'cue_lift': {
        this.targetArmYaw = this.tonearmArm.rotation.y;
        this.targetArmPitch = ARM_LIFT_PITCH;
        targetCueZ = 0.52;
        pitchDamp = 12.0;
        if (this.tonearmArm.rotation.x <= ARM_LIFT_PITCH + 0.018) {
          this.armPhase = 'cue_swing';
        }
        break;
      }
      case 'cue_swing': {
        const trackProgress =
          this.externalProgress >= 0 ? this.externalProgress : this.synthProgress;
        this.targetArmYaw = THREE.MathUtils.lerp(ARM_OUTER_YAW, ARM_INNER_YAW, trackProgress);
        this.targetArmPitch = ARM_LIFT_PITCH;
        targetCueZ = 0.52;
        yawDamp = 6.8;
        if (Math.abs(this.tonearmArm.rotation.y - this.targetArmYaw) < 0.012) {
          this.armPhase = 'cue_drop';
        }
        break;
      }
      case 'cue_drop': {
        const trackProgress =
          this.externalProgress >= 0 ? this.externalProgress : this.synthProgress;
        this.targetArmYaw = THREE.MathUtils.lerp(ARM_OUTER_YAW, ARM_INNER_YAW, trackProgress);
        this.targetArmPitch = ARM_PLAY_PITCH;
        targetCueZ = 0.08;
        pitchDamp = 9.0;
        if (this.tonearmArm.rotation.x >= ARM_PLAY_PITCH - 0.006) {
          this.tonearmArm.rotation.x = ARM_PLAY_PITCH;
          this.armPhase = 'tracking';
          if (this.pendingCueToken !== 0 && this.pendingCueToken === this.cueToken) {
            this.pendingCueToken = 0;
            this.callbacks.onCueReady?.();
          }
        }
        break;
      }
      case 'tracking': {
        if (this.externalProgress < 0) {
          this.synthProgress += dt / 90;
          if (this.synthProgress >= 1) {
            this.synthProgress = 0;
            this.cueToken++;
            this.pendingCueToken = this.cueToken;
            this.armPhase = 'reposition_lift';
            this.callbacks.onRestartLift?.();
            this.targetArmYaw = this.tonearmArm.rotation.y;
            this.targetArmPitch = ARM_LIFT_PITCH;
            targetCueZ = 0.52;
            break;
          }
        }
        const trackProgress =
          this.externalProgress >= 0 ? this.externalProgress : this.synthProgress;
        this.targetArmYaw = THREE.MathUtils.lerp(ARM_OUTER_YAW, ARM_INNER_YAW, trackProgress);
        this.targetArmPitch = ARM_PLAY_PITCH;
        targetCueZ = 0.08;
        yawDamp = 5.5;
        pitchDamp = 8.0;
        break;
      }
      case 'reposition_lift': {
        this.targetArmYaw = this.tonearmArm.rotation.y;
        this.targetArmPitch = ARM_LIFT_PITCH;
        targetCueZ = 0.52;
        pitchDamp = 12.0;
        if (this.tonearmArm.rotation.x <= ARM_LIFT_PITCH + 0.018) {
          this.armPhase = 'reposition_swing';
        }
        break;
      }
      case 'reposition_swing': {
        this.targetArmYaw = ARM_OUTER_YAW;
        this.targetArmPitch = ARM_LIFT_PITCH;
        targetCueZ = 0.52;
        yawDamp = 6.8;
        if (Math.abs(this.tonearmArm.rotation.y - ARM_OUTER_YAW) < 0.012) {
          this.armPhase = 'reposition_drop';
        }
        break;
      }
      case 'reposition_drop': {
        this.targetArmYaw = ARM_OUTER_YAW;
        this.targetArmPitch = ARM_PLAY_PITCH;
        targetCueZ = 0.08;
        pitchDamp = 9.0;
        if (this.tonearmArm.rotation.x >= ARM_PLAY_PITCH - 0.006) {
          this.tonearmArm.rotation.x = ARM_PLAY_PITCH;
          this.armPhase = 'tracking';
          if (this.pendingCueToken !== 0 && this.pendingCueToken === this.cueToken) {
            this.pendingCueToken = 0;
            this.callbacks.onCueReady?.();
          }
        }
        break;
      }
      case 'park_lift': {
        this.targetArmYaw = this.tonearmArm.rotation.y;
        this.targetArmPitch = ARM_LIFT_PITCH;
        targetCueZ = 0.52;
        pitchDamp = 12.0;
        if (this.tonearmArm.rotation.x <= ARM_LIFT_PITCH + 0.018) {
          this.armPhase = 'park_swing';
        }
        break;
      }
      case 'park_swing': {
        this.targetArmYaw = ARM_REST_YAW;
        this.targetArmPitch = ARM_LIFT_PITCH;
        targetCueZ = 0.52;
        yawDamp = 6.8;
        if (Math.abs(this.tonearmArm.rotation.y - ARM_REST_YAW) < 0.014) {
          this.armPhase = 'park_drop';
        }
        break;
      }
      case 'park_drop': {
        this.targetArmYaw = ARM_REST_YAW;
        this.targetArmPitch = ARM_REST_PITCH;
        targetCueZ = 0.52;
        pitchDamp = 9.0;
        if (Math.abs(this.tonearmArm.rotation.x - ARM_REST_PITCH) < 0.004) {
          this.tonearmArm.rotation.x = ARM_REST_PITCH;
          this.armPhase = 'parked';
        }
        break;
      }
    }

    this.tonearmArm.rotation.y = THREE.MathUtils.damp(
      this.tonearmArm.rotation.y,
      this.targetArmYaw,
      yawDamp,
      dt
    );
    this.tonearmArm.rotation.x = THREE.MathUtils.damp(
      this.tonearmArm.rotation.x,
      this.targetArmPitch,
      pitchDamp,
      dt
    );
    if (this.armPhase === 'tracking' && this.platterSpeed > 1.6) {
      this.tonearmArm.rotation.y += Math.sin(elapsed * 2.6) * 0.0004;
    }

    this.cueLeverMesh.rotation.z = THREE.MathUtils.damp(
      this.cueLeverMesh.rotation.z,
      targetCueZ,
      9,
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
      4.0,
      dt
    );

    // 5. Scripted camera preset & cinematic choreography (stops on arrival or user drag)
    if (this.cinematicActive) {
      this.cinematicTime += dt;
      const scale = this.getPortraitDistanceScale(this.camera.aspect);
      const cycle = this.cinematicTime % 32;

      if (cycle < 9) {
        // Shot 1: Sweeping wide arc across turntable and surrounding environment
        const p = cycle / 9;
        const angle = THREE.MathUtils.lerp(-0.45, 0.95, p);
        const radius = (8.6 + Math.sin(p * Math.PI) * 1.4) * scale;
        _targetCamPos.set(
          Math.sin(angle) * radius,
          (4.6 - Math.sin(p * Math.PI) * 1.3) * Math.min(scale, 2.0),
          Math.cos(angle) * radius
        );
        _targetLookAt.set(0, 0.65, 0);
      } else if (cycle < 17) {
        // Shot 2: Intimate low-angle tracking along tonearm & stylus
        const p = (cycle - 9) / 8;
        const angle = THREE.MathUtils.lerp(0.65, 1.38, p);
        const radius = 3.55 * Math.min(scale, 1.55);
        _targetCamPos.set(
          0.4 + Math.sin(angle) * radius,
          1.75 + Math.sin(p * Math.PI) * 0.45,
          0.5 + Math.cos(angle) * radius
        );
        _targetLookAt.set(0.45, 0.94, 0.55);
      } else if (cycle < 25) {
        // Shot 3: Elevated drift across spinning vinyl label & strobe platter
        const p = (cycle - 17) / 8;
        const angle = THREE.MathUtils.lerp(2.25, 3.65, p);
        const radius = 4.2 * Math.min(scale, 1.65);
        _targetCamPos.set(
          -0.4 + Math.sin(angle) * radius,
          3.4 + Math.cos(p * Math.PI) * 0.55,
          0.1 + Math.cos(angle) * radius
        );
        _targetLookAt.set(-0.42, 0.88, 0.06);
      } else {
        // Shot 4: Hero pull-back framing turntable silhouette against the horizon
        const p = (cycle - 25) / 7;
        const angle = THREE.MathUtils.lerp(-0.95, -0.35, p);
        const radius = THREE.MathUtils.lerp(7.2, 10.2, p) * scale;
        _targetCamPos.set(
          Math.sin(angle) * radius,
          THREE.MathUtils.lerp(2.4, 5.4, p) * Math.min(scale, 2.0),
          Math.cos(angle) * radius
        );
        _targetLookAt.set(0, 0.65, -0.2);
      }

      this.currentCinematicZoom = THREE.MathUtils.damp(
        this.currentCinematicZoom,
        this.cinematicZoomScale,
        8,
        dt
      );
      _zoomOffset
        .subVectors(_targetCamPos, _targetLookAt)
        .multiplyScalar(this.currentCinematicZoom);
      _targetCamPos.copy(_targetLookAt).add(_zoomOffset);
      _targetCamPos.y = Math.max(_targetCamPos.y, 0.42);

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _targetCamPos.x, 3.0, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _targetCamPos.y, 3.0, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _targetCamPos.z, 3.0, dt);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, _targetLookAt.x, 2.8, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, _targetLookAt.y, 2.8, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, _targetLookAt.z, 2.8, dt);
      this.camera.lookAt(this.controls.target);
    } else if (this.activeCameraTransition) {
      const preset = CAMERA_PRESETS[this.activePreset];
      const scale =
        this.activePreset === 'overview' || this.activePreset === 'top'
          ? this.getPortraitDistanceScale(this.camera.aspect)
          : 1;
      _targetCamPos.set(
        preset.pos[0] * scale,
        preset.pos[1] * scale,
        preset.pos[2] * scale
      );
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
    } else if (this.targetZoomDistance !== null) {
      _zoomOffset.subVectors(this.camera.position, this.controls.target);
      const currentDist = _zoomOffset.length();
      if (currentDist > 0.0001) {
        const nextDist = THREE.MathUtils.damp(currentDist, this.targetZoomDistance, 9, dt);
        _zoomOffset.multiplyScalar(nextDist / currentDist);
        this.camera.position.copy(this.controls.target).add(_zoomOffset);
        if (Math.abs(nextDist - this.targetZoomDistance) < 0.02) {
          this.targetZoomDistance = null;
        }
      } else {
        this.targetZoomDistance = null;
      }
    }

    // 6. Audio-reactive motes (smooth firefly flight + rhythmic glow on the beat)
    const levels = this.callbacks.getAudioLevels?.();
    const targetMix = levels?.active ? 1 : 0;
    this.particlePlayingMix = THREE.MathUtils.damp(this.particlePlayingMix, targetMix, 3.6, dt);

    const rawPulse = levels?.pulse ?? 0;
    const rawEnergy = ((levels?.bass ?? 0) * 0.55 + rawPulse * 0.75) * this.particlePlayingMix;
    this.particleMotionPulse = THREE.MathUtils.damp(this.particleMotionPulse, rawEnergy, 4.2, dt);

    // Accumulate flight phase monotonically so changing speed on play/pause never jumps phase
    this.particleFlightTime += dt * THREE.MathUtils.lerp(0.36, 0.54, this.particlePlayingMix);

    const uniforms = this.particleMat.uniforms;
    uniforms.uTime.value = elapsed;
    uniforms.uFlightTime.value = this.particleFlightTime;
    uniforms.uBass.value = (levels?.bass ?? 0) * this.particlePlayingMix;
    uniforms.uMid.value = (levels?.mid ?? 0) * this.particlePlayingMix;
    uniforms.uHigh.value = (levels?.high ?? 0) * this.particlePlayingMix;
    uniforms.uPulse.value = rawPulse * this.particlePlayingMix;
    uniforms.uMotionPulse.value = this.particleMotionPulse;
    uniforms.uPlaying.value = this.particlePlayingMix;

    this.particleRotationY +=
      dt * (0.025 + this.particleMotionPulse * 0.048);
    this.ambientParticles.rotation.y = this.particleRotationY;
    this.envController.update(elapsed, dt);

    const platformMotion = this.envController.getPlatformMotion();
    if (platformMotion) {
      this.turntableGroup.position.copy(platformMotion.position);
      this.turntableGroup.quaternion.copy(platformMotion.quaternion);
    } else {
      this.turntableGroup.position.set(0, 0, 0);
      this.turntableGroup.quaternion.identity();
    }

    if (!this.cinematicActive) {
      this.controls.update();
    }
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
    dom.removeEventListener('wheel', this.handleWheel, { capture: true });
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('pointercancel', this.handlePointerCancel);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);
    window.removeEventListener('resize', this.handleResize);

    this.controls.dispose();
    this.envController.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
