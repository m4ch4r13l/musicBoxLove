import * as THREE from 'three';
import type { SceneEnvironment } from '../types/turntable';
import { buildForestCampEnvironment } from './forestCampEnvironment';
import {
  type BoatPlatformMotion,
  buildOceanDateEnvironment,
} from './oceanDateEnvironment';
import { buildSpaceCosmosEnvironment } from './spaceCosmosEnvironment';
import { buildStudioEnvironment } from './studioEnvironment';
import { buildValleyPicnicEnvironment } from './valleyPicnicEnvironment';

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
    fogDensity: 0.0055,
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
    fogDensity: 0.0068,
    hemiSky: 0xa4cfb8,
    hemiGround: 0x24361e,
    hemiIntensity: 0.94,
    keyColor: 0xffd7a8,
    keyIntensity: 66,
    rimColor: 0x7bc28e,
    rimIntensity: 14,
    exposure: 1.12,
    particleColorA: 0xdaf794,
    particleColorB: 0xffd082,
  },
  ocean: {
    skyTop: 0x16294a,
    skyHorizon: 0xec7636,
    skyBottom: 0x091326,
    skyGlow: 0xffa348,
    sunDir: [0.0, 0.13, -1.0],
    nebulaMode: 0,
    fogColor: 0x241f30,
    fogDensity: 0.0038,
    hemiSky: 0xc4dcfa,
    hemiGround: 0x2a2434,
    hemiIntensity: 0.98,
    keyColor: 0xffcfa0,
    keyIntensity: 68,
    rimColor: 0xff8a4c,
    rimIntensity: 16,
    exposure: 1.08,
    particleColorA: 0xffe6ba,
    particleColorB: 0x9ae2ff,
  },
  space: {
    skyTop: 0x070818,
    skyHorizon: 0x1a1336,
    skyBottom: 0x0a0b1f,
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

export class SceneEnvironmentController {
  private rootGroup: THREE.Group;
  private skyMat: THREE.ShaderMaterial;
  private valleyGrassMat: THREE.ShaderMaterial | null = null;
  private forestFireMat: THREE.ShaderMaterial | null = null;
  private forestFireLight: THREE.PointLight | null = null;
  private oceanMat: THREE.ShaderMaterial | null = null;
  private oceanStarMat: THREE.ShaderMaterial | null = null;
  private oceanPlatformMotion: BoatPlatformMotion | null = null;
  private updateOceanBoat: ((elapsed: number, dt: number) => void) | null = null;
  private updateSpaceCosmos: ((elapsed: number) => void) | null = null;

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

    const skyGeo = new THREE.SphereGeometry(220, 36, 24);
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
        uTwilightSplit: { value: initialEnv === 'ocean' ? 1.0 : 0.0 },
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
        uniform float uTwilightSplit;
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
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);

          vec3 topCol = uTopColor;
          vec3 horizCol = uHorizonColor;
          vec3 botCol = uBottomColor;
          float sunsetWeight = 1.0;

          if (uTwilightSplit > 0.5) {
            vec2 horizDir = normalize(vec2(dir.x, dir.z) + vec2(0.0, 0.0001));
            vec2 sunHoriz = normalize(vec2(uSunDir.x, uSunDir.z));
            float sunFacing = dot(horizDir, sunHoriz);
            sunsetWeight = smoothstep(-0.35, 0.78, sunFacing);

            vec3 nightHoriz = vec3(0.032, 0.055, 0.115);
            vec3 nightTop = vec3(0.012, 0.022, 0.058);
            vec3 duskMid = vec3(0.24, 0.14, 0.25);

            // Smooth twilight transition: vivid sunset orange -> purple-indigo dusk -> dark night
            float duskBand = smoothstep(-0.55, 0.15, sunFacing) * (1.0 - smoothstep(0.15, 0.85, sunFacing));
            horizCol = mix(nightHoriz, uHorizonColor, sunsetWeight);
            horizCol = mix(horizCol, duskMid, duskBand * 0.55);
            topCol = mix(nightTop, uTopColor, sunsetWeight);
            botCol = mix(vec3(0.02, 0.038, 0.085), uBottomColor, sunsetWeight);
          }

          vec3 sky = h >= 0.0
            ? mix(horizCol, topCol, pow(clamp(h, 0.0, 1.0), 0.52))
            : mix(horizCol, botCol, pow(clamp(-h, 0.0, 1.0), 0.45));

          float halo = pow(sunDot, 6.0) * 0.52;
          float horizonBand = exp(-abs(h) * 8.0) * 0.34;
          sky += uGlowColor * (halo + horizonBand * pow(sunDot, 1.3)) * sunsetWeight;

          if (uNebulaMode > 0.5) {
            float n1 = noise3(dir * 3.1);
            float n2 = noise3(dir * 6.4 + 4.1);
            float n3 = noise3(dir * 12.5 - 2.3);
            float band = exp(-abs(dir.y * 0.78 + dir.x * 0.44 - 0.12) * 3.6);
            float neb = smoothstep(0.32, 0.85, n1 * 0.58 + n2 * 0.28 + n3 * 0.14) * band;
            float darkRift = smoothstep(0.48, 0.78, n2) * exp(-abs(dir.y * 0.8 + dir.x * 0.45 - 0.1) * 10.5);
            // Omnidirectional faint cosmic gas wisps so both upper and lower cosmos feel deep
            float ambientGas = smoothstep(0.42, 0.88, noise3(dir * 2.3 + vec3(1.7, -2.4, 0.8)));
            sky += vec3(0.11, 0.09, 0.24) * ambientGas * 0.55;
            sky += vec3(0.38, 0.18, 0.56) * neb * 0.62;
            sky += vec3(0.14, 0.36, 0.64) * (n2 * band) * 0.38;
            sky += vec3(0.55, 0.24, 0.38) * smoothstep(0.52, 0.88, n3 * n1 * 1.8) * band * 0.42;
            sky *= 1.0 - darkRift * 0.45;
          } else if (h > 0.03) {
            // Sunlit clouds on the sunset side, subtle dark silhouettes on the night side
            float c1 = noise3(vec3(dir.x * 4.2, dir.y * 10.0, dir.z * 4.2));
            float c2 = noise3(vec3(dir.x * 8.5 + 3.0, dir.y * 16.0, dir.z * 8.5));
            float cloud = smoothstep(0.56, 0.82, c1 * 0.68 + c2 * 0.32) * smoothstep(0.03, 0.28, h);
            vec3 warmCloud = mix(uHorizonColor * 1.08, uGlowColor, 0.35 + sunDot * 0.45);
            vec3 nightCloud = vec3(0.045, 0.068, 0.13);
            vec3 cloudCol = mix(nightCloud, warmCloud, sunsetWeight);
            sky = mix(sky, cloudCol, cloud * (0.14 + 0.22 * sunsetWeight));
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
    this.skyMat.uniforms.uTwilightSplit.value = env === 'ocean' ? 1.0 : 0.0;

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

  public getPlatformMotion(): BoatPlatformMotion | null {
    return this.currentEnv === 'ocean' ? this.oceanPlatformMotion : null;
  }

  public update(elapsed: number, dt = 0.016): void {
    if (this.currentEnv === 'valley' && this.valleyGrassMat) {
      this.valleyGrassMat.uniforms.uTime.value = elapsed;
    } else if (this.currentEnv === 'forest') {
      if (this.forestFireMat) {
        this.forestFireMat.uniforms.uTime.value = elapsed;
      }
      if (this.forestFireLight) {
        this.forestFireLight.intensity =
          70 + Math.sin(elapsed * 8.4) * 7.5 + Math.cos(elapsed * 14.2) * 4.2;
      }
    } else if (this.currentEnv === 'ocean') {
      if (this.oceanMat) {
        this.oceanMat.uniforms.uTime.value = elapsed;
      }
      if (this.oceanStarMat) {
        this.oceanStarMat.uniforms.uTime.value = elapsed;
      }
      if (this.updateOceanBoat) {
        this.updateOceanBoat(elapsed, dt);
      }
    } else if (this.currentEnv === 'space') {
      if (this.updateSpaceCosmos) {
        this.updateSpaceCosmos(elapsed);
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
    const { group, grassMat } = buildValleyPicnicEnvironment(
      this.maxAnisotropy,
      this.disposables
    );
    this.valleyGrassMat = grassMat;
    return group;
  }

  private buildForestGroup(): THREE.Group {
    const { group, fireMat, fireLight } = buildForestCampEnvironment(
      this.maxAnisotropy,
      this.disposables
    );
    this.forestFireMat = fireMat;
    this.forestFireLight = fireLight;
    return group;
  }

  private buildOceanGroup(): THREE.Group {
    const { group, oceanMat, starMat, platformMotion, updateBoatMotion } =
      buildOceanDateEnvironment(this.maxAnisotropy, this.disposables);
    this.oceanMat = oceanMat;
    this.oceanStarMat = starMat;
    this.oceanPlatformMotion = platformMotion;
    this.updateOceanBoat = updateBoatMotion;
    return group;
  }

  private buildSpaceGroup(): THREE.Group {
    const { group, updateSpace } = buildSpaceCosmosEnvironment(
      this.maxAnisotropy,
      this.disposables
    );
    this.updateSpaceCosmos = updateSpace;
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
