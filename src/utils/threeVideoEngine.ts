import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  computeLipSyncAperture,
  groundHeightAt,
  interpolateActorTransform,
  resolveCameraTransform,
  resolveTimelineFrame,
} from './nexoraLogic';
import type {
  VideoActorSpec,
  VideoAnimationIntensity,
  VideoAspectRatio,
  VideoBiome,
  VideoCameraOverride,
  VideoCameraShot,
  VideoMood,
  VideoPropSpec,
  VideoScene,
  VideoStoryboard,
  VideoVisualStyle,
  VideoWeatherType,
} from '../types/nexora';

export interface CinemaRenderOptions {
  cameraOverride: VideoCameraOverride;
  animationIntensity: VideoAnimationIntensity;
  visualStyle: VideoVisualStyle;
  aspectRatio: VideoAspectRatio;
  isSpeaking: boolean;
}

// Reusable scratch math objects (zero GC inside animation loop)
const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _dummy = new THREE.Object3D();

export interface ActorRig {
  spec: VideoActorSpec;
  group: THREE.Group;
  shadow: THREE.Mesh;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  head?: THREE.Object3D;
  mouth?: THREE.Object3D;
  eyeL?: THREE.Object3D;
  eyeR?: THREE.Object3D;
  browL?: THREE.Object3D;
  browR?: THREE.Object3D;
  chassis?: THREE.Object3D;
  staffOrb?: THREE.Object3D;
  tail?: THREE.Object3D;
  leftWing?: THREE.Object3D;
  rightWing?: THREE.Object3D;
  wheels?: THREE.Object3D[];
  rotors?: THREE.Object3D[];
  extraLegs?: THREE.Object3D[];
  flame?: THREE.Object3D;
}

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

interface PaletteConfig {
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  groundBase: string;
  groundDetail: string;
}

function getBiomeMoodPalette(biome: VideoBiome, mood: VideoMood): PaletteConfig {
  const isNight = mood === 'night_neon' || biome === 'space' || biome === 'cyber_arena';
  const isGolden = mood === 'golden_hour';
  const isStorm = mood === 'stormy';
  const isCozy = mood === 'cozy';

  if (biome === 'space') {
    return {
      skyTop: '#040711',
      skyHorizon: '#162044',
      fogColor: '#0A1026',
      fogDensity: 0.015,
      sunColor: 0xfff1d6,
      sunIntensity: 2.2,
      hemiSky: 0x60a5fa,
      hemiGround: 0x1e1b4b,
      hemiIntensity: 0.75,
      groundBase: '#1E293B',
      groundDetail: '#334155',
    };
  }

  if (biome === 'cyber_arena') {
    return {
      skyTop: '#08051A',
      skyHorizon: '#2E1065',
      fogColor: '#190B3B',
      fogDensity: 0.02,
      sunColor: 0x38bdf8,
      sunIntensity: 1.9,
      hemiSky: 0xa855f7,
      hemiGround: 0x0f172a,
      hemiIntensity: 0.85,
      groundBase: '#0F172A',
      groundDetail: '#22D3EE',
    };
  }

  if (biome === 'classroom' || biome === 'indoor_studio') {
    return {
      skyTop: isNight ? '#1E1B4B' : '#E0F2FE',
      skyHorizon: isNight ? '#312E81' : '#FEF3C7',
      fogColor: isNight ? '#1E1B4B' : '#E2E8F0',
      fogDensity: 0.014,
      sunColor: isCozy ? 0xffedd5 : 0xffffff,
      sunIntensity: 1.85,
      hemiSky: 0xf8fafc,
      hemiGround: 0x78350f,
      hemiIntensity: 1.05,
      groundBase: biome === 'classroom' ? '#B47B48' : '#1E293B',
      groundDetail: biome === 'classroom' ? '#9A6334' : '#334155',
    };
  }

  if (biome === 'desert') {
    return {
      skyTop: isNight ? '#0F172A' : '#38BDF8',
      skyHorizon: isGolden ? '#FDBA74' : '#FEF08A',
      fogColor: isGolden ? '#FDBA74' : '#FDE68A',
      fogDensity: 0.0105,
      sunColor: 0xfff3c4,
      sunIntensity: 2.4,
      hemiSky: 0x7dd3fc,
      hemiGround: 0xd97706,
      hemiIntensity: 0.9,
      groundBase: '#EAB308',
      groundDetail: '#D97706',
    };
  }

  if (biome === 'ocean') {
    return {
      skyTop: isStorm ? '#334155' : '#0284C7',
      skyHorizon: isGolden ? '#FDBA74' : '#BAE6FD',
      fogColor: isStorm ? '#64748B' : '#BAE6FD',
      fogDensity: 0.01,
      sunColor: 0xfff7ed,
      sunIntensity: 2.3,
      hemiSky: 0x7dd3fc,
      hemiGround: 0x0ea5e9,
      hemiIntensity: 0.95,
      groundBase: '#FDE68A',
      groundDetail: '#F59E0B',
    };
  }

  if (biome === 'mountain') {
    return {
      skyTop: isNight ? '#0F172A' : '#38BDF8',
      skyHorizon: isGolden ? '#FDE68A' : '#E0F2FE',
      fogColor: isNight ? '#1E293B' : '#CBD5E1',
      fogDensity: 0.011,
      sunColor: 0xfff8e7,
      sunIntensity: 2.2,
      hemiSky: 0xbae6fd,
      hemiGround: 0x475569,
      hemiIntensity: 0.9,
      groundBase: '#64748B',
      groundDetail: '#E2E8F0',
    };
  }

  if (biome === 'city') {
    return {
      skyTop: isNight ? '#090D16' : isGolden ? '#1D4ED8' : '#0EA5E9',
      skyHorizon: isNight ? '#1E1B4B' : isGolden ? '#FDBA74' : '#BAE6FD',
      fogColor: isNight ? '#1E1B4B' : isGolden ? '#FDBA74' : '#CBD5E1',
      fogDensity: 0.0105,
      sunColor: isNight ? 0x93c5fd : isGolden ? 0xffedd5 : 0xfffbeb,
      sunIntensity: isNight ? 1.5 : 2.3,
      hemiSky: isNight ? 0x6366f1 : 0x93c5fd,
      hemiGround: 0x334155,
      hemiIntensity: isNight ? 0.85 : 0.95,
      groundBase: '#334155',
      groundDetail: '#FACC15',
    };
  }

  if (biome === 'fantasy_kingdom') {
    return {
      skyTop: isNight ? '#1E1B4B' : '#4F46E5',
      skyHorizon: isGolden ? '#FDE047' : '#C4B5FD',
      fogColor: isNight ? '#312E81' : '#DDD6FE',
      fogDensity: 0.0105,
      sunColor: 0xfef3c7,
      sunIntensity: 2.15,
      hemiSky: 0xc4b5fd,
      hemiGround: 0x15803d,
      hemiIntensity: 0.95,
      groundBase: '#16A34A',
      groundDetail: '#86EFAC',
    };
  }

  // forest / park / sunny meadow default
  return {
    skyTop: isNight ? '#0F172A' : isStorm ? '#475569' : '#0284C7',
    skyHorizon: isNight ? '#1E293B' : isGolden ? '#FED7AA' : '#BAE6FD',
    fogColor: isNight ? '#1E293B' : isGolden ? '#FDE68A' : '#E0F2FE',
    fogDensity: 0.0095,
    sunColor: isGolden ? 0xffd8a8 : 0xfffbeb,
    sunIntensity: isNight ? 1.4 : 2.35,
    hemiSky: isNight ? 0x60a5fa : 0x87ceeb,
    hemiGround: 0x3f6212,
    hemiIntensity: 0.95,
    groundBase: '#22C55E',
    groundDetail: '#15803D',
  };
}

function createProceduralGroundTexture(
  biome: VideoBiome,
  palette: PaletteConfig,
  maxAniso: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = palette.groundBase;
  ctx.fillRect(0, 0, 512, 512);

  if (biome === 'city') {
    // Sidewalks + central asphalt avenue + crisp dashed yellow markings
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 512, 120);
    ctx.fillRect(0, 392, 512, 120);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 120, 512, 272);
    ctx.fillStyle = '#FACC15';
    for (let x = 16; x < 512; x += 64) {
      ctx.fillRect(x, 250, 36, 12);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, 126, 512, 6);
    ctx.fillRect(0, 380, 512, 6);
  } else if (biome === 'cyber_arena') {
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  } else if (biome === 'classroom' || biome === 'indoor_studio') {
    ctx.strokeStyle = palette.groundDetail;
    ctx.lineWidth = 3;
    for (let y = 0; y < 512; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    for (let row = 0; row < 12; row++) {
      const xOffset = (row % 2) * 64;
      for (let x = xOffset; x < 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, row * 42);
        ctx.lineTo(x, (row + 1) * 42);
        ctx.stroke();
      }
    }
  } else {
    // Organic speckled grass/sand/stone micro-detail
    for (let i = 0; i < 650; i++) {
      const rx = (i * 197) % 512;
      const ry = (i * 313) % 512;
      const w = 6 + (i % 14);
      const h = 4 + (i % 8);
      ctx.fillStyle = i % 2 === 0 ? palette.groundDetail : 'rgba(255,255,255,0.12)';
      ctx.globalAlpha = 0.28;
      ctx.fillRect(rx, ry, w, h);
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(biome === 'city' ? 6 : 10, biome === 'city' ? 1 : 10);
  tex.anisotropy = maxAniso;
  return tex;
}

function createSkyDomeTexture(topHex: string, horizonHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topHex);
  grad.addColorStop(0.58, horizonHex);
  grad.addColorStop(1, horizonHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function buildActorGroup(spec: VideoActorSpec, shadowTex: THREE.CanvasTexture): ActorRig {
  const group = new THREE.Group();
  const primaryMat = new THREE.MeshStandardMaterial({
    color: spec.color || '#2563EB',
    roughness: 0.48,
    metalness: spec.role === 'robot' || spec.role === 'car' || spec.role === 'rocket' ? 0.65 : 0.12,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor || '#F59E0B',
    roughness: 0.25,
    metalness: 0.45,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#FCD5B5',
    roughness: 0.65,
    metalness: 0.0,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.72,
    metalness: 0.2,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#38BDF8',
    emissive: spec.accentColor || '#38BDF8',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  const rig: ActorRig = { spec, group, shadow: new THREE.Mesh() };

  if (spec.role === 'car') {
    // 12-part sleek aerodynamic sports car (ExtrudeGeometry body, taillights, headlights, wing, mirrors, wheels)
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 18);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.26, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.2, metalness: 0.85 });

    const wheels: THREE.Object3D[] = [];
    const wheelOffsets: Array<[number, number, number]> = [
      [-0.76, 0.32, 0.92],
      [0.76, 0.32, 0.92],
      [-0.76, 0.32, -0.92],
      [0.76, 0.32, -0.92],
    ];
    for (const [wx, wy, wz] of wheelOffsets) {
      const wg = new THREE.Group();
      wg.position.set(wx, wy, wz);
      const tire = new THREE.Mesh(wheelGeo, darkMat);
      const rim = new THREE.Mesh(rimGeo, hubMat);
      tire.castShadow = true;
      wg.add(tire, rim);
      group.add(wg);
      wheels.push(wg);
    }

    // Contoured side silhouette (z along X in 2D shape -> rotated to +Z forward)
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-1.42, 0.32);
    bodyShape.lineTo(1.45, 0.32);
    bodyShape.lineTo(1.42, 0.62);
    bodyShape.lineTo(0.85, 0.78);
    bodyShape.lineTo(0.38, 1.14);
    bodyShape.lineTo(-0.52, 1.14);
    bodyShape.lineTo(-1.18, 0.84);
    bodyShape.lineTo(-1.44, 0.72);
    bodyShape.closePath();

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 1.36,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    bodyGeo.translate(0, 0, -0.68);
    bodyGeo.rotateY(-Math.PI / 2);
    const chassis = new THREE.Mesh(bodyGeo, primaryMat);
    chassis.castShadow = true;

    const glassMatCar = new THREE.MeshStandardMaterial({
      color: '#0F172A',
      roughness: 0.1,
      metalness: 0.85,
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.3, 1.18), glassMatCar);
    windshield.position.set(0, 0.96, -0.04);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 2.35), accentMat);
    stripe.position.set(0, 0.8, 0.25);

    const strutGeo = new THREE.BoxGeometry(0.08, 0.24, 0.14);
    const strutL = new THREE.Mesh(strutGeo, darkMat);
    strutL.position.set(-0.48, 0.94, -1.26);
    const strutR = strutL.clone();
    strutR.position.x = 0.48;
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.3), darkMat);
    spoiler.position.set(0, 1.08, -1.3);

    const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.08), glowMat);
    headlightL.position.set(-0.46, 0.56, 1.44);
    const headlightR = headlightL.clone();
    headlightR.position.x = 0.46;

    const tailMat = new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#EF4444',
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.08), tailMat);
    tailL.position.set(-0.45, 0.62, -1.45);
    const tailR = tailL.clone();
    tailR.position.x = 0.45;

    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.14);
    const mirrorL = new THREE.Mesh(mirrorGeo, primaryMat);
    mirrorL.position.set(-0.8, 0.86, 0.38);
    const mirrorR = mirrorL.clone();
    mirrorR.position.x = 0.8;

    const chassisPivot = new THREE.Group();
    chassisPivot.add(
      chassis,
      windshield,
      stripe,
      strutL,
      strutR,
      spoiler,
      headlightL,
      headlightR,
      tailL,
      tailR,
      mirrorL,
      mirrorR
    );
    group.add(chassisPivot);
    rig.chassis = chassisPivot;
    rig.wheels = wheels;
  } else if (spec.role === 'drone') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), primaryMat);
    body.scale.set(1.2, 0.55, 1.2);
    body.position.y = 0.5;
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.15, 12), glowMat);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(0, 0.44, 0.45);
    group.add(body, eye);

    const rotors: THREE.Object3D[] = [];
    const armAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    for (const ang of armAngles) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.95), darkMat);
      arm.position.set(Math.cos(ang) * 0.42, 0.54, Math.sin(ang) * 0.42);
      arm.rotation.y = -ang + Math.PI / 2;
      group.add(arm);

      const rotorPivot = new THREE.Group();
      rotorPivot.position.set(Math.cos(ang) * 0.85, 0.62, Math.sin(ang) * 0.85);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 0.09), accentMat);
      rotorPivot.add(blade);
      group.add(rotorPivot);
      rotors.push(rotorPivot);
    }
    rig.rotors = rotors;
  } else if (spec.role === 'rocket') {
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 1.65, 16), primaryMat);
    hull.position.y = 1.0;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.65, 16), accentMat);
    nose.position.y = 2.15;
    const windowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), glowMat);
    windowMesh.position.set(0, 1.25, 0.34);

    const finGeo = new THREE.BoxGeometry(0.08, 0.55, 0.45);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.position.set(Math.cos(a) * 0.45, 0.4, Math.sin(a) * 0.45);
      fin.rotation.y = -a;
      group.add(fin);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.75, 12),
      new THREE.MeshBasicMaterial({ color: '#F59E0B' })
    );
    flame.rotation.x = Math.PI;
    flame.position.y = -0.15;
    group.add(hull, nose, windowMesh, flame);
    rig.flame = flame;
  } else if (spec.role === 'cat' || spec.role === 'dog') {
    const isCat = spec.role === 'cat';
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.96), primaryMat);
    torso.position.set(0, 0.55, 0);
    torso.castShadow = true;

    const head = new THREE.Group();
    head.position.set(0, 0.88, 0.48);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), primaryMat);
    const snout = new THREE.Mesh(
      new THREE.BoxGeometry(isCat ? 0.18 : 0.24, 0.16, 0.22),
      accentMat
    );
    snout.position.set(0, -0.06, 0.28);
    const earGeo = isCat ? new THREE.ConeGeometry(0.11, 0.24, 8) : new THREE.BoxGeometry(0.12, 0.26, 0.1);
    const earL = new THREE.Mesh(earGeo, accentMat);
    earL.position.set(-0.18, 0.28, 0);
    const earR = earL.clone();
    earR.position.x = 0.18;
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, darkMat);
    eyeL.position.set(-0.12, 0.06, 0.28);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    head.add(skull, snout, earL, earR, eyeL, eyeR);

    const tail = new THREE.Group();
    tail.position.set(0, 0.65, -0.46);
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8), accentMat);
    tailMesh.rotation.x = -Math.PI / 3;
    tailMesh.position.set(0, 0.15, -0.18);
    tail.add(tailMesh);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.4, 8);
    const legOffsets: Array<[number, number]> = [
      [-0.18, 0.34],
      [0.18, 0.34],
      [-0.18, -0.34],
      [0.18, -0.34],
    ];
    const extraLegs: THREE.Object3D[] = [];
    for (const [lx, lz] of legOffsets) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.4, lz);
      const lm = new THREE.Mesh(legGeo, primaryMat);
      lm.position.y = -0.2;
      lm.castShadow = true;
      lp.add(lm);
      group.add(lp);
      extraLegs.push(lp);
    }

    group.add(torso, head, tail);
    rig.head = head;
    rig.tail = tail;
    rig.extraLegs = extraLegs;
  } else if (spec.role === 'bird' || spec.role === 'dragon') {
    const isDragon = spec.role === 'dragon';
    const bodyScale = isDragon ? 1.35 : 0.75;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.38 * bodyScale, 14, 12), primaryMat);
    body.scale.set(0.9, 0.85, 1.5);
    body.position.y = 0.55;

    const head = new THREE.Group();
    head.position.set(0, 0.75, 0.55 * bodyScale);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24 * bodyScale, 12, 12), primaryMat);
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.11 * bodyScale, 0.32 * bodyScale, 8),
      accentMat
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.02, 0.25 * bodyScale);
    head.add(headMesh, beak);

    const leftWing = new THREE.Group();
    leftWing.position.set(-0.28 * bodyScale, 0.62, 0.05);
    const lwMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.95 * bodyScale, 0.06, 0.48 * bodyScale),
      accentMat
    );
    lwMesh.position.x = -0.48 * bodyScale;
    leftWing.add(lwMesh);

    const rightWing = new THREE.Group();
    rightWing.position.set(0.28 * bodyScale, 0.62, 0.05);
    const rwMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.95 * bodyScale, 0.06, 0.48 * bodyScale),
      accentMat
    );
    rwMesh.position.x = 0.48 * bodyScale;
    rightWing.add(rwMesh);

    const tail = new THREE.Group();
    tail.position.set(0, 0.54, -0.6 * bodyScale);
    const tailCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.14 * bodyScale, 0.7 * bodyScale, 8),
      primaryMat
    );
    tailCone.rotation.x = -Math.PI / 2;
    tailCone.position.z = -0.3 * bodyScale;
    tail.add(tailCone);

    group.add(body, head, leftWing, rightWing, tail);
    rig.head = head;
    rig.leftWing = leftWing;
    rig.rightWing = rightWing;
    rig.tail = tail;
  } else {
    // Articulated Human / Student / Wizard / Robot (8-11 distinct parts!)
    const isRobot = spec.role === 'robot';
    const isWizard = spec.role === 'wizard';
    const isStudent = spec.role === 'student';

    // Left & Right Legs pivoted at hips (y = 0.78)
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.66, 10);
    const shoeGeo = new THREE.BoxGeometry(0.24, 0.14, 0.34);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.18, 0.78, 0);
    const llMesh = new THREE.Mesh(legGeo, darkMat);
    llMesh.position.y = -0.35;
    llMesh.castShadow = true;
    const lShoe = new THREE.Mesh(shoeGeo, accentMat);
    lShoe.position.set(0, -0.71, 0.05);
    leftLeg.add(llMesh, lShoe);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.18, 0.78, 0);
    const rlMesh = new THREE.Mesh(legGeo, darkMat);
    rlMesh.position.y = -0.35;
    rlMesh.castShadow = true;
    const rShoe = new THREE.Mesh(shoeGeo, accentMat);
    rShoe.position.set(0, -0.71, 0.05);
    rightLeg.add(rlMesh, rShoe);

    // Torso + chest accent / backpack
    const torso = new THREE.Mesh(
      isWizard
        ? new THREE.CylinderGeometry(0.26, 0.42, 0.85, 12)
        : new THREE.BoxGeometry(0.58, 0.72, 0.34),
      primaryMat
    );
    torso.position.set(0, 1.16, 0);
    torso.castShadow = true;

    const chestBadge = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.2, 0.06),
      isRobot ? glowMat : accentMat
    );
    chestBadge.position.set(0, 1.24, 0.18);

    if (isStudent) {
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.22), accentMat);
      backpack.position.set(0, 1.18, -0.25);
      group.add(backpack);
    }

    // Left & Right Arms pivoted at shoulders (y = 1.44)
    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.58, 10);
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.38, 1.44, 0);
    const laMesh = new THREE.Mesh(armGeo, primaryMat);
    laMesh.position.y = -0.26;
    laMesh.castShadow = true;
    leftArm.add(laMesh);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.38, 1.44, 0);
    const raMesh = new THREE.Mesh(armGeo, primaryMat);
    raMesh.position.y = -0.26;
    raMesh.castShadow = true;
    rightArm.add(raMesh);

    if (isWizard) {
      // Glowing magic staff attached to right hand
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.45, 8), darkMat);
      staff.position.set(0, -0.3, 0.25);
      staff.rotation.x = Math.PI / 3;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), glowMat);
      orb.position.set(0, 0.15, 0.86);
      rightArm.add(staff, orb);
      rig.staffOrb = orb;
    }

    // Head + expressive eyes, brows, and lip-sync jaw/mouth
    const head = new THREE.Group();
    head.position.set(0, 1.72, 0);
    const skull = new THREE.Mesh(
      isRobot ? new THREE.BoxGeometry(0.46, 0.42, 0.42) : new THREE.SphereGeometry(0.27, 16, 14),
      isRobot ? primaryMat : skinMat
    );
    skull.castShadow = true;
    head.add(skull);

    if (isRobot) {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.08), glowMat);
      visor.position.set(0, 0.04, 0.2);
      const voiceBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.06), glowMat);
      voiceBar.position.set(0, -0.11, 0.21);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), accentMat);
      antenna.position.set(0, 0.32, 0);
      head.add(visor, voiceBar, antenna);
      rig.mouth = voiceBar;
    } else {
      const eyeGeo = new THREE.SphereGeometry(0.042, 8, 8);
      const eyeL = new THREE.Mesh(eyeGeo, darkMat);
      eyeL.position.set(-0.09, 0.04, 0.24);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.09;

      const browGeo = new THREE.BoxGeometry(0.09, 0.024, 0.03);
      const browL = new THREE.Mesh(browGeo, darkMat);
      browL.position.set(-0.09, 0.11, 0.25);
      const browR = browL.clone();
      browR.position.x = 0.09;

      const mouthMat = new THREE.MeshStandardMaterial({ color: '#991B1B', roughness: 0.45 });
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.04), mouthMat);
      mouth.position.set(0, -0.09, 0.245);

      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), darkMat);
      hair.position.y = 0.02;
      head.add(eyeL, eyeR, browL, browR, mouth, hair);
      rig.eyeL = eyeL;
      rig.eyeR = eyeR;
      rig.browL = browL;
      rig.browR = browR;
      rig.mouth = mouth;

      if (isWizard) {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), accentMat);
        brim.position.y = 0.22;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.56, 16), primaryMat);
        cone.position.y = 0.5;
        head.add(brim, cone);
      }
    }

    group.add(leftLeg, rightLeg, torso, chestBadge, leftArm, rightArm, head);
    rig.leftLeg = leftLeg;
    rig.rightLeg = rightLeg;
    rig.leftArm = leftArm;
    rig.rightArm = rightArm;
    rig.head = head;
  }

  group.scale.setScalar(spec.scale || 1);

  // Soft radial contact shadow disc grounded flush on floor
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.85 * (spec.scale || 1), 20),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  rig.shadow = shadow;
  return rig;
}

function buildPropGroup(spec: VideoPropSpec): THREE.Group {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: spec.color || '#16A34A',
    roughness: 0.72,
    metalness: 0.08,
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#78350F', roughness: 0.85, metalness: 0.05 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#64748B', roughness: 0.88, metalness: 0.1 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#BAE6FD', roughness: 0.18, metalness: 0.55 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.3, metalness: 0.75 });

  switch (spec.kind) {
    case 'tree': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.8, 10), woodMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      const canopy1 = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), baseMat);
      canopy1.position.set(0, 2.25, 0);
      canopy1.castShadow = true;
      const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 10), baseMat);
      canopy2.position.set(0.55, 1.9, 0.2);
      const canopy3 = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 10), baseMat);
      canopy3.position.set(-0.5, 2.0, -0.2);
      g.add(trunk, canopy1, canopy2, canopy3);
      break;
    }
    case 'pine': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.3, 10), woodMat);
      trunk.position.y = 0.65;
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.4, 12), baseMat);
      c1.position.y = 1.6;
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.2, 12), baseMat);
      c2.position.y = 2.4;
      const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 12), baseMat);
      c3.position.y = 3.1;
      g.add(trunk, c1, c2, c3);
      break;
    }
    case 'house': {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.32, 2.8), stoneMat);
      plinth.position.y = 0.16;
      const walls = new THREE.Mesh(new THREE.BoxGeometry(2.85, 2.0, 2.45), baseMat);
      walls.position.y = 1.32;
      walls.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.48, 1.45, 4),
        new THREE.MeshStandardMaterial({ color: '#991B1B', roughness: 0.75 })
      );
      roof.position.y = 3.0;
      roof.rotation.y = Math.PI / 4;
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.95, 0.38), stoneMat);
      chimney.position.set(0.75, 3.25, -0.5);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.18, 0.12), woodMat);
      door.position.set(0, 0.91, 1.24);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), goldMat);
      knob.position.set(0.2, 0.88, 1.32);
      const warmWinMat = new THREE.MeshStandardMaterial({
        color: '#FEF08A',
        emissive: '#FDE047',
        emissiveIntensity: 0.55,
        roughness: 0.25,
      });
      const winL = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.1), warmWinMat);
      winL.position.set(-0.8, 1.42, 1.24);
      const winR = winL.clone();
      winR.position.x = 0.8;
      g.add(plinth, walls, roof, chimney, door, knob, winL, winR);
      break;
    }
    case 'building': {
      const h = 5.6;
      // Procedural curtain-wall glass facade texture
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 256;
      bCanvas.height = 512;
      const bCtx = bCanvas.getContext('2d')!;
      bCtx.fillStyle = spec.color || '#1E293B';
      bCtx.fillRect(0, 0, 256, 512);
      for (let row = 0; row < 12; row++) {
        for (let col = 0; col < 6; col++) {
          const lit = (row * 7 + col * 3) % 5 !== 0;
          bCtx.fillStyle = lit ? '#38BDF8' : '#0F172A';
          bCtx.fillRect(14 + col * 39, 18 + row * 40, 26, 26);
        }
      }
      const facadeTex = new THREE.CanvasTexture(bCanvas);
      facadeTex.colorSpace = THREE.SRGBColorSpace;
      const towerMat = new THREE.MeshStandardMaterial({
        map: facadeTex,
        roughness: 0.32,
        metalness: 0.55,
      });

      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.65, h, 2.65), towerMat);
      tower.position.y = h / 2 + 0.4;
      tower.castShadow = true;
      const podium = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.75, 3.15), stoneMat);
      podium.position.y = 0.375;
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.12, 0.75),
        new THREE.MeshStandardMaterial({ color: '#0EA5E9', emissive: '#0284C7', emissiveIntensity: 0.6 })
      );
      canopy.position.set(0, 0.95, 1.65);
      const penthouse = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.5), stoneMat);
      penthouse.position.y = h + 0.65;
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.25, 8), goldMat);
      spire.position.y = h + 1.5;
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#38BDF8', emissiveIntensity: 1.5 })
      );
      beacon.position.y = h + 2.12;
      g.add(podium, canopy, tower, penthouse, spire, beacon);
      break;
    }
    case 'desk': {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 0.95), baseMat);
      top.position.y = 0.82;
      const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8);
      for (const [lx, lz] of [[-0.76, -0.38], [0.76, -0.38], [-0.76, 0.38], [0.76, 0.38]]) {
        const leg = new THREE.Mesh(legGeo, stoneMat);
        leg.position.set(lx, 0.4, lz);
        g.add(leg);
      }
      // Chair seat + backrest
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.56), stoneMat);
      seat.position.set(0, 0.48, 0.68);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.08), stoneMat);
      back.position.set(0, 0.76, 0.94);
      // Monitor & textbook
      const monitor = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.44, 0.06),
        new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#0284C7', emissiveIntensity: 0.45, roughness: 0.2 })
      );
      monitor.position.set(-0.2, 1.14, -0.2);
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.07, 0.32),
        new THREE.MeshStandardMaterial({ color: '#EF4444', roughness: 0.65 })
      );
      book.position.set(0.45, 0.92, 0.12);
      g.add(top, seat, back, monitor, book);
      break;
    }
    case 'bookshelf': {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.55), baseMat);
      frame.position.y = 1.3;
      const rowColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B'];
      for (let r = 0; r < 3; r++) {
        const row = new THREE.Mesh(
          new THREE.BoxGeometry(1.9, 0.38, 0.42),
          new THREE.MeshStandardMaterial({ color: rowColors[r % rowColors.length], roughness: 0.6 })
        );
        row.position.set(0, 0.65 + r * 0.72, 0.08);
        g.add(row);
      }
      g.add(frame);
      break;
    }
    case 'mountain': {
      const mainPeak = new THREE.Mesh(new THREE.ConeGeometry(2.9, 5.2, 7), baseMat);
      mainPeak.position.y = 2.6;
      const snowCap = new THREE.Mesh(
        new THREE.ConeGeometry(1.08, 1.9, 7),
        new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.7 })
      );
      snowCap.position.y = 4.25;
      const sidePeak = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.4, 6), baseMat);
      sidePeak.position.set(1.9, 1.7, 0.6);
      g.add(mainPeak, snowCap, sidePeak);
      break;
    }
    case 'rock': {
      const r1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), baseMat);
      r1.scale.set(1.2, 0.78, 1.0);
      r1.position.y = 0.52;
      const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), stoneMat);
      r2.position.set(0.75, 0.34, 0.3);
      const r3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), baseMat);
      r3.position.set(-0.68, 0.28, -0.2);
      g.add(r1, r2, r3);
      break;
    }
    case 'boat': {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 3.2), baseMat);
      hull.position.y = 0.28;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 2.8), woodMat);
      deck.position.y = 0.58;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), woodMat);
      mast.position.set(0, 1.85, 0.1);
      const sail = new THREE.Mesh(
        new THREE.ConeGeometry(1.0, 1.9, 3),
        new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.6 })
      );
      sail.position.set(0, 1.95, 0.35);
      sail.scale.set(0.12, 1, 1.1);
      g.add(hull, deck, mast, sail);
      break;
    }
    case 'streetlamp': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.4, 10), stoneMat);
      base.position.y = 0.2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.3, 10), stoneMat);
      post.position.y = 1.9;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), stoneMat);
      arm.position.set(0.3, 3.5, 0);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 10, 10),
        new THREE.MeshStandardMaterial({
          color: spec.color || '#FDE047',
          emissive: spec.color || '#FDE047',
          emissiveIntensity: 1.6,
        })
      );
      bulb.position.set(0.58, 3.38, 0);
      g.add(base, post, arm, bulb);
      break;
    }
    case 'portal': {
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.2, 0.65), stoneMat);
      pillarL.position.set(-1.35, 1.6, 0);
      const pillarR = pillarL.clone();
      pillarR.position.x = 1.35;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 0.75), stoneMat);
      lintel.position.y = 3.35;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.14, 12, 24),
        new THREE.MeshStandardMaterial({
          color: spec.color || '#A855F7',
          emissive: spec.color || '#A855F7',
          emissiveIntensity: 1.5,
        })
      );
      ring.position.set(0, 1.75, 0);
      g.add(pillarL, pillarR, lintel, ring);
      break;
    }
    case 'stage': {
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.45, 24), baseMat);
      platform.position.y = 0.22;
      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(3.25, 0.07, 10, 32),
        new THREE.MeshStandardMaterial({ color: '#22D3EE', emissive: '#22D3EE', emissiveIntensity: 1.2 })
      );
      trim.rotation.x = Math.PI / 2;
      trim.position.y = 0.44;
      g.add(platform, trim);
      break;
    }
    case 'chest': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.75), woodMat);
      box.position.y = 0.32;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 10, 1, false, 0, Math.PI), baseMat);
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.64;
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.08), goldMat);
      lock.position.set(0, 0.58, 0.39);
      g.add(box, lid, lock);
      break;
    }
    case 'fountain': {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.65, 0.45, 20), stoneMat);
      basin.position.y = 0.22;
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.08, 20), glassMat);
      water.position.y = 0.44;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.36, 1.25, 12), stoneMat);
      pillar.position.y = 0.95;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.25, 0.28, 16), stoneMat);
      bowl.position.y = 1.55;
      g.add(basin, water, pillar, bowl);
      break;
    }
    case 'goalpost': {
      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 10), baseMat);
      pL.position.set(0, 1.1, -1.6);
      const pR = pL.clone();
      pR.position.z = 1.6;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.3, 10), baseMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(0, 2.2, 0);
      g.add(pL, pR, bar);
      break;
    }
    case 'ball': {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 16, 16),
        new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.4 })
      );
      sphere.position.y = 0.36;
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.04, 8, 16),
        new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.5 })
      );
      stripe.position.y = 0.36;
      g.add(sphere, stripe);
      break;
    }
    case 'flower':
    default: {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.65, 8), new THREE.MeshStandardMaterial({ color: '#16A34A', roughness: 0.7 }));
      stem.position.y = 0.32;
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), goldMat);
      center.position.y = 0.72;
      g.add(stem, center);
      const petalGeo = new THREE.SphereGeometry(0.14, 8, 8);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        const petal = new THREE.Mesh(petalGeo, baseMat);
        petal.scale.set(1.2, 0.5, 0.8);
        petal.position.set(Math.cos(a) * 0.22, 0.7, Math.sin(a) * 0.22);
        g.add(petal);
      }
      break;
    }
  }

  g.scale.setScalar(spec.scale || 1);
  if (spec.rotationY) g.rotation.y = spec.rotationY;
  return g;
}

export class ThreeVideoEngine {
  private container: HTMLElement;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private worldGroup: THREE.Group;
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private shadowTex: THREE.CanvasTexture;
  private skyMesh: THREE.Mesh;
  private waterMesh: THREE.Mesh | null = null;
  private particlesMesh: THREE.InstancedMesh | null = null;
  private particleSeeds: Array<{ x: number; y: number; z: number; speed: number; phase: number }> = [];
  private cloudGroups: Array<{ group: THREE.Group; speed: number; radius: number; angle: number; baseY: number }> = [];
  private swayProps: Array<{ group: THREE.Object3D; kind: VideoPropSpec['kind']; baseY: number; phase: number }> = [];
  private fireFlames: THREE.Object3D[] = [];
  private baseSunIntensity = 2.2;
  private baseSunColor = 0xfffbeb;
  private activeActors: ActorRig[] = [];
  private activeSceneId = '';
  private activeBiome: VideoBiome = 'forest';
  private activeMood: VideoMood = 'daylight';
  private activeWeather: VideoWeatherType = 'clear';
  private camPos = new THREE.Vector3(0, 5.5, 13.5);
  private camLook = new THREE.Vector3(0, 1.2, 0);
  private renderOptions: CinemaRenderOptions = {
    cameraOverride: 'auto',
    animationIntensity: 'dynamic',
    visualStyle: 'Auto (AI Decides)',
    aspectRatio: '16:9',
    isSpeaking: false,
  };

  private rafId = 0;
  private timerId = 0;
  private disposed = false;
  private renderBusy = false;
  private renderDirty = false;
  private isPlaying = false;
  private lastClockMs = 0;
  private storyboard: VideoStoryboard | null = null;
  private currentTime = 0;
  private onTimeAdvance?: (nextTime: number, finished: boolean) => void;

  constructor(container: HTMLElement, onTimeAdvance?: (nextTime: number, finished: boolean) => void) {
    this.container = container;
    this.onTimeAdvance = onTimeAdvance;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(320, container.clientWidth || 960);
    const height = Math.max(180, container.clientHeight || 540);
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.borderRadius = '0.75rem';
    this.renderer.domElement.setAttribute('data-testid', 'video-studio-canvas');

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.2, 200);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3f6212, 0.95);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    this.keyLight.position.set(12, 18, 10);
    if (!this.isSoftwareGl) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.camera.near = 1;
      this.keyLight.shadow.camera.far = 60;
      const d = 18;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyLight);

    this.skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(88, 20, 14),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false })
    );
    this.scene.add(this.skyMesh);

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.shadowTex = createContactShadowTexture();
  }

  public getCanvasElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public setRenderOptions(opts: Partial<CinemaRenderOptions>) {
    this.renderOptions = { ...this.renderOptions, ...opts };
    if (this.renderOptions.visualStyle === 'Cinematic 3D') {
      this.renderer.toneMappingExposure = 1.04;
    } else if (this.renderOptions.visualStyle === 'Realistic 3D') {
      this.renderer.toneMappingExposure = 1.18;
    } else {
      this.renderer.toneMappingExposure = 1.12;
    }
    if (!this.isPlaying && this.storyboard && !this.disposed) {
      const frame = resolveTimelineFrame(this.storyboard, this.currentTime);
      if (frame) {
        this.updateSceneKinematics(
          frame.scene,
          frame.sceneProgress,
          this.currentTime,
          0.033,
          opts.cameraOverride !== undefined
        );
        this.requestRender();
      }
    }
  }

  public resize() {
    if (this.disposed) return;
    const width = Math.max(320, this.container.clientWidth || 960);
    const height = Math.max(180, this.container.clientHeight || 540);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (!this.isPlaying) {
      this.requestRender();
    }
  }

  public syncTimeline(storyboard: VideoStoryboard, currentTime: number, playing: boolean) {
    if (this.disposed) return;
    const wasPlaying = this.isPlaying;
    const storyboardChanged = this.storyboard?.id !== storyboard.id;
    const jumped = Math.abs(currentTime - this.currentTime) >= 0.35;
    const prevSceneId = this.activeSceneId;

    this.storyboard = storyboard;
    this.isPlaying = playing;

    if (!playing || !wasPlaying || storyboardChanged || jumped) {
      this.currentTime = currentTime;
      const frame = resolveTimelineFrame(storyboard, currentTime);
      if (frame) {
        this.ensureSceneWorld(frame.scene);
        const sceneChanged = this.activeSceneId !== prevSceneId;
        this.updateSceneKinematics(
          frame.scene,
          frame.sceneProgress,
          currentTime,
          0.033,
          storyboardChanged || jumped || sceneChanged
        );
      }
    }

    if (playing && !wasPlaying) {
      this.cancelPendingFrames();
      this.lastClockMs = performance.now();
      this.loopTick();
    } else if (!playing) {
      if (wasPlaying || storyboardChanged || jumped || this.activeSceneId !== prevSceneId) {
        this.cancelPendingFrames();
        this.renderBusy = false;
        this.renderDirty = false;
      }
      this.requestRender();
    }
  }

  public renderFrameAtTime(storyboard: VideoStoryboard, timeSeconds: number) {
    if (this.disposed) return;
    this.storyboard = storyboard;
    this.currentTime = timeSeconds;
    const frame = resolveTimelineFrame(storyboard, timeSeconds);
    if (frame) {
      this.ensureSceneWorld(frame.scene);
      this.updateSceneKinematics(frame.scene, frame.sceneProgress, timeSeconds, 0.033, true);
    }
    this.renderer.render(this.scene, this.camera);
  }

  public captureCompositeFrame(
    exportCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    storyboard: VideoStoryboard,
    timeSeconds: number
  ) {
    this.renderFrameAtTime(storyboard, timeSeconds);
    exportCtx.clearRect(0, 0, width, height);
    exportCtx.drawImage(this.renderer.domElement, 0, 0, width, height);

    const frame = resolveTimelineFrame(storyboard, timeSeconds);
    if (!frame) return;

    // Scene chapter badge + subtitle bar burned into WebM frame
    exportCtx.save();
    exportCtx.fillStyle = 'rgba(9, 13, 22, 0.72)';
    exportCtx.beginPath();
    exportCtx.roundRect(22, 20, Math.min(width - 44, 420), 38, 10);
    exportCtx.fill();
    exportCtx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    exportCtx.fillStyle = '#F8FAFC';
    exportCtx.fillText(frame.scene.title, 36, 44);

    const subText = frame.scene.subtitle || frame.scene.narration;
    if (subText) {
      exportCtx.fillStyle = 'rgba(9, 13, 22, 0.8)';
      exportCtx.beginPath();
      exportCtx.roundRect(36, height - 78, width - 72, 52, 12);
      exportCtx.fill();
      exportCtx.font = '500 16px "DM Sans", sans-serif';
      exportCtx.fillStyle = '#F1F5F9';
      exportCtx.textAlign = 'center';
      exportCtx.fillText(subText.slice(0, 88), width / 2, height - 46);
    }
    exportCtx.restore();
  }

  private cancelPendingFrames() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = 0;
    }
  }

  private afterDraw(cb: () => void, cooldownMs = 80) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.timerId = window.setTimeout(cb, cooldownMs);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.timerId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        if (cooldownMs <= 0) {
          cb();
        } else {
          this.timerId = window.setTimeout(cb, cooldownMs);
        }
      }
    };
    this.timerId = window.setTimeout(poll, 5);
  }

  private requestRender() {
    if (this.disposed) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.rafId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.rafId = 0;
      this.renderDirty = false;
      this.renderer.render(this.scene, this.camera);
      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty && !this.disposed && !this.isPlaying) {
          this.requestRender();
        }
      };
      if (this.isSoftwareGl) this.afterDraw(done, 0);
      else done();
    });
  }

  private loopTick = () => {
    if (this.disposed || !this.isPlaying || !this.storyboard) return;
    const now = performance.now();
    const dt = Math.min(0.12, Math.max(0.005, (now - this.lastClockMs) / 1000));
    this.lastClockMs = now;

    let nextTime = this.currentTime + dt;
    let finished = false;
    if (nextTime >= this.storyboard.totalDurationSeconds) {
      nextTime = this.storyboard.totalDurationSeconds;
      this.isPlaying = false;
      finished = true;
    }
    this.currentTime = nextTime;

    const prevSceneId = this.activeSceneId;
    const frame = resolveTimelineFrame(this.storyboard, nextTime);
    if (frame) {
      this.ensureSceneWorld(frame.scene);
      this.updateSceneKinematics(
        frame.scene,
        frame.sceneProgress,
        nextTime,
        dt,
        this.activeSceneId !== prevSceneId
      );
    }

    this.renderer.render(this.scene, this.camera);
    this.onTimeAdvance?.(nextTime, finished);

    if (!finished && this.isPlaying) {
      if (this.isSoftwareGl) {
        this.afterDraw(this.loopTick, 80);
      } else {
        this.rafId = requestAnimationFrame(this.loopTick);
      }
    }
  };

  private disposeWorldGroup() {
    this.worldGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          const std = m as THREE.MeshStandardMaterial;
          std.map?.dispose();
          m.dispose();
        }
      }
    });
    this.worldGroup.clear();
    this.activeActors = [];
    this.cloudGroups = [];
    this.swayProps = [];
    this.fireFlames = [];
    this.waterMesh = null;
    this.particlesMesh = null;
    this.particleSeeds = [];
  }

  private ensureSceneWorld(sceneSpec: VideoScene) {
    const weather = sceneSpec.weather || 'clear';
    const key = `${sceneSpec.id}_${sceneSpec.biome}_${sceneSpec.mood}_${weather}`;
    if (this.activeSceneId === key) return;
    this.activeSceneId = key;
    this.activeBiome = sceneSpec.biome;
    this.activeMood = sceneSpec.mood;
    this.activeWeather = weather;

    this.disposeWorldGroup();

    const palette = getBiomeMoodPalette(sceneSpec.biome, sceneSpec.mood);
    this.scene.background = new THREE.Color(palette.fogColor);
    this.scene.fog = new THREE.FogExp2(palette.fogColor, palette.fogDensity);

    const skyMat = this.skyMesh.material as THREE.MeshBasicMaterial;
    skyMat.map?.dispose();
    skyMat.map = createSkyDomeTexture(palette.skyTop, palette.skyHorizon);
    skyMat.needsUpdate = true;

    this.hemiLight.color.setHex(palette.hemiSky);
    this.hemiLight.groundColor.setHex(palette.hemiGround);
    this.hemiLight.intensity = palette.hemiIntensity;
    this.keyLight.color.setHex(palette.sunColor);
    this.keyLight.intensity = palette.sunIntensity;
    this.baseSunIntensity = palette.sunIntensity;
    this.baseSunColor = palette.sunColor;

    // Ground terrain mesh displaced using shared groundHeightAt(biome, x, z)
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const groundTex = createProceduralGroundTexture(sceneSpec.biome, palette, maxAniso);
    const groundGeo = new THREE.PlaneGeometry(86, 86, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      posAttr.setY(i, groundHeightAt(sceneSpec.biome, x, z));
    }
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: groundTex,
      roughness: 0.85,
      metalness: sceneSpec.biome === 'cyber_arena' ? 0.35 : 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    this.worldGroup.add(groundMesh);

    // Single central contoured stone pathway in forest / fantasy_kingdom worlds (no tiled stripes)
    if (sceneSpec.biome === 'forest' || sceneSpec.biome === 'fantasy_kingdom') {
      const pathCanvas = document.createElement('canvas');
      pathCanvas.width = 256;
      pathCanvas.height = 128;
      const pCtx = pathCanvas.getContext('2d')!;
      pCtx.fillStyle = '#C7B28F';
      pCtx.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 42; i++) {
        pCtx.fillStyle = i % 2 === 0 ? '#B59E7A' : '#D6C4A3';
        pCtx.beginPath();
        pCtx.ellipse((i * 47) % 246 + 5, (i * 29) % 108 + 10, 14 + (i % 8), 8 + (i % 5), 0.15, 0, Math.PI * 2);
        pCtx.fill();
      }
      const pathTex = new THREE.CanvasTexture(pathCanvas);
      pathTex.colorSpace = THREE.SRGBColorSpace;
      pathTex.wrapS = THREE.RepeatWrapping;
      pathTex.wrapT = THREE.ClampToEdgeWrapping;
      pathTex.repeat.set(6, 1);

      const pathGeo = new THREE.PlaneGeometry(28, 2.7, 28, 4);
      pathGeo.rotateX(-Math.PI / 2);
      const pathPos = pathGeo.attributes.position;
      for (let i = 0; i < pathPos.count; i++) {
        const px = pathPos.getX(i);
        const pz = pathPos.getZ(i) + 0.35;
        pathPos.setZ(i, pz);
        pathPos.setY(i, groundHeightAt(sceneSpec.biome, px, pz) + 0.035);
      }
      pathGeo.computeVertexNormals();
      const pathMesh = new THREE.Mesh(
        pathGeo,
        new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.9, metalness: 0.02 })
      );
      pathMesh.receiveShadow = true;
      this.worldGroup.add(pathMesh);
    }

    if (sceneSpec.biome === 'ocean') {
      const waterGeo = new THREE.PlaneGeometry(86, 86, 16, 16);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMat = new THREE.MeshStandardMaterial({
        color: '#0284C7',
        roughness: 0.14,
        metalness: 0.55,
        transparent: true,
        opacity: 0.86,
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.position.y = -0.25;
      this.worldGroup.add(water);
      this.waterMesh = water;
    }

    // Indoor room architecture ONLY for classroom / indoor_studio (open front for camera clarity!)
    if (sceneSpec.biome === 'classroom' || sceneSpec.biome === 'indoor_studio') {
      const wallColor = sceneSpec.biome === 'classroom' ? '#F1F5F9' : '#1E293B';
      const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.82 });
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(22, 7.5, 0.5), wallMat);
      backWall.position.set(0, 3.75, -7.5);
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 16), wallMat);
      leftWall.position.set(-11, 3.75, 0);
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 16), wallMat);
      rightWall.position.set(11, 3.75, 0);
      this.worldGroup.add(backWall, leftWall, rightWall);

      if (sceneSpec.biome === 'classroom') {
        const boardCanvas = document.createElement('canvas');
        boardCanvas.width = 512;
        boardCanvas.height = 200;
        const bc = boardCanvas.getContext('2d')!;
        bc.fillStyle = '#14532D';
        bc.fillRect(0, 0, 512, 200);
        bc.strokeStyle = '#92400E';
        bc.lineWidth = 14;
        bc.strokeRect(0, 0, 512, 200);
        bc.fillStyle = '#F8FAFC';
        bc.font = 'bold 26px sans-serif';
        bc.fillText(sceneSpec.title.slice(0, 30), 28, 52);
        bc.strokeStyle = '#38BDF8';
        bc.lineWidth = 3;
        bc.beginPath();
        bc.moveTo(40, 155);
        bc.quadraticCurveTo(130, 80, 220, 145);
        bc.stroke();
        bc.strokeStyle = '#FDE047';
        bc.beginPath();
        bc.moveTo(280, 150);
        bc.lineTo(360, 88);
        bc.lineTo(420, 150);
        bc.closePath();
        bc.stroke();

        const boardTex = new THREE.CanvasTexture(boardCanvas);
        boardTex.colorSpace = THREE.SRGBColorSpace;
        const board = new THREE.Mesh(
          new THREE.BoxGeometry(6.8, 2.5, 0.14),
          new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.65 })
        );
        board.position.set(0, 2.8, -7.18);
        this.worldGroup.add(board);
      } else {
        const studioScreen = new THREE.Mesh(
          new THREE.BoxGeometry(6.4, 2.6, 0.16),
          new THREE.MeshStandardMaterial({
            color: '#0EA5E9',
            emissive: '#2563EB',
            emissiveIntensity: 0.9,
            roughness: 0.2,
          })
        );
        studioScreen.position.set(0, 2.9, -7.16);
        this.worldGroup.add(studioScreen);
      }
    }

    // Natural distant perimeter ring for outdoor worlds (forest evergreens with trunks or mountain peaks)
    if (sceneSpec.biome === 'forest' || sceneSpec.biome === 'fantasy_kingdom' || sceneSpec.biome === 'mountain') {
      const ringCount = 26;
      const isMount = sceneSpec.biome === 'mountain';
      const coneGeo = new THREE.ConeGeometry(isMount ? 1.8 : 1.4, isMount ? 4.8 : 3.9, 8);
      const coneMat = new THREE.MeshStandardMaterial({
        color: isMount ? '#475569' : '#166534',
        roughness: 0.85,
      });
      const grove = new THREE.InstancedMesh(coneGeo, coneMat, ringCount);

      let trunks: THREE.InstancedMesh | null = null;
      if (!isMount) {
        trunks = new THREE.InstancedMesh(
          new THREE.CylinderGeometry(0.24, 0.34, 1.8, 8),
          new THREE.MeshStandardMaterial({ color: '#78350F', roughness: 0.88 }),
          ringCount
        );
      }

      for (let i = 0; i < ringCount; i++) {
        const ang = (i / ringCount) * Math.PI * 2;
        const rad = 18 + (i % 4) * 3.2;
        const px = Math.cos(ang) * rad;
        const pz = Math.sin(ang) * rad;
        const gy = groundHeightAt(sceneSpec.biome, px, pz);
        const s = 0.85 + (i % 3) * 0.25;
        if (trunks) {
          _dummy.position.set(px, gy + 0.9 * s, pz);
          _dummy.scale.set(s, s, s);
          _dummy.updateMatrix();
          trunks.setMatrixAt(i, _dummy.matrix);
        }
        _dummy.position.set(px, gy + (isMount ? 2.1 * s : 2.9 * s), pz);
        _dummy.scale.set(s, s * 1.15, s);
        _dummy.updateMatrix();
        grove.setMatrixAt(i, _dummy.matrix);
      }
      grove.computeBoundingSphere();
      if (trunks) {
        trunks.computeBoundingSphere();
        this.worldGroup.add(trunks);
      }
      this.worldGroup.add(grove);
    }

    // Outdoor volumetric drifting 3D cloud clusters (forest, city, ocean, desert, mountain, fantasy)
    if (
      sceneSpec.biome !== 'classroom' &&
      sceneSpec.biome !== 'indoor_studio' &&
      sceneSpec.biome !== 'space'
    ) {
      const cloudMat = new THREE.MeshStandardMaterial({
        color: sceneSpec.mood === 'stormy' ? '#94A3B8' : sceneSpec.mood === 'golden_hour' ? '#FED7AA' : '#F8FAFC',
        roughness: 0.92,
        metalness: 0.0,
      });
      const puffGeo = new THREE.SphereGeometry(1.1, 10, 8);
      for (let c = 0; c < 6; c++) {
        const cg = new THREE.Group();
        const p1 = new THREE.Mesh(puffGeo, cloudMat);
        const p2 = new THREE.Mesh(puffGeo, cloudMat);
        p2.scale.set(0.85, 0.8, 0.85);
        p2.position.set(1.15, -0.15, 0.15);
        const p3 = new THREE.Mesh(puffGeo, cloudMat);
        p3.scale.set(0.75, 0.72, 0.75);
        p3.position.set(-1.1, -0.18, -0.1);
        cg.add(p1, p2, p3);
        const ang = (c / 6) * Math.PI * 2;
        const rad = 22 + (c % 2) * 8;
        const baseY = 12.5 + (c % 3) * 2.2;
        cg.scale.set(1.5 + (c % 2) * 0.4, 0.75, 1.0);
        cg.position.set(Math.cos(ang) * rad, baseY, Math.sin(ang) * rad);
        this.worldGroup.add(cg);
        this.cloudGroups.push({
          group: cg,
          speed: 0.035 + (c % 3) * 0.012,
          radius: rad,
          angle: ang,
          baseY,
        });
      }
    }

    // Scene Props anchored flush to groundHeightAt (keep tall props behind camera corridor!)
    for (let pIdx = 0; pIdx < (sceneSpec.props || []).length; pIdx++) {
      const propSpec = sceneSpec.props[pIdx];
      const isTall =
        propSpec.kind === 'tree' ||
        propSpec.kind === 'house' ||
        propSpec.kind === 'building' ||
        propSpec.kind === 'portal' ||
        propSpec.kind === 'bookshelf' ||
        propSpec.kind === 'mountain';
      const safeZ =
        isTall && propSpec.z > 2.2 && Math.abs(propSpec.x) < 12
          ? -Math.max(3.5, Math.min(12, Math.abs(propSpec.z)))
          : propSpec.z;
      const propGroup = buildPropGroup(propSpec);
      const gy = groundHeightAt(sceneSpec.biome, propSpec.x, safeZ);
      propGroup.position.set(propSpec.x, gy, safeZ);
      this.worldGroup.add(propGroup);
      if (
        propSpec.kind === 'tree' ||
        propSpec.kind === 'pine' ||
        propSpec.kind === 'flower' ||
        propSpec.kind === 'boat' ||
        propSpec.kind === 'ball'
      ) {
        this.swayProps.push({
          group: propGroup,
          kind: propSpec.kind,
          baseY: gy,
          phase: pIdx * 1.15,
        });
      }
    }

    // Add flickering fire/smoke accent prop when weather === 'embers'
    if (weather === 'embers') {
      const campGroup = new THREE.Group();
      const logMat = new THREE.MeshStandardMaterial({ color: '#451A03', roughness: 0.9 });
      for (let l = 0; l < 3; l++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.1, 8), logMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (l * Math.PI) / 3;
        log.position.y = 0.1;
        campGroup.add(log);
      }
      const flameMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.95, 10),
        new THREE.MeshBasicMaterial({ color: '#F97316' })
      );
      flameMesh.position.y = 0.55;
      const innerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.62, 8),
        new THREE.MeshBasicMaterial({ color: '#FDE047' })
      );
      innerFlame.position.y = 0.45;
      campGroup.add(flameMesh, innerFlame);
      const fx = -5.0;
      const fz = -2.2;
      campGroup.position.set(fx, groundHeightAt(sceneSpec.biome, fx, fz), fz);
      this.worldGroup.add(campGroup);
      this.fireFlames.push(flameMesh, innerFlame);
    }

    // Scene Actors (Composite articulated 3D characters + contact shadows)
    this.activeActors = [];
    for (const actorSpec of sceneSpec.actors || []) {
      const rig = buildActorGroup(actorSpec, this.shadowTex);
      this.worldGroup.add(rig.group);
      this.worldGroup.add(rig.shadow);
      this.activeActors.push(rig);
    }

    // Weather & Atmospheric InstancedMesh particles (rain streaks, snow, rising embers, wind leaves, fireflies)
    const isRain = weather === 'rain';
    const isEmbers = weather === 'embers';
    const isSnow = weather === 'snow';
    const isWind = weather === 'wind';
    const pCount = isRain ? 64 : isEmbers || isSnow || isWind ? 44 : 30;

    const pColor = isRain
      ? '#93C5FD'
      : isEmbers
        ? '#FB923C'
        : isSnow
          ? '#F8FAFC'
          : isWind
            ? '#FDE68A'
            : sceneSpec.biome === 'space'
              ? '#E2E8F0'
              : sceneSpec.biome === 'cyber_arena'
                ? '#22D3EE'
                : '#FDE047';
    const pGeo = isRain
      ? new THREE.BoxGeometry(0.035, 0.65, 0.035)
      : isWind
        ? new THREE.BoxGeometry(0.24, 0.05, 0.14)
        : new THREE.SphereGeometry(sceneSpec.biome === 'space' ? 0.14 : 0.1, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: pColor });
    const inst = new THREE.InstancedMesh(pGeo, pMat, pCount);
    inst.frustumCulled = false;
    this.particleSeeds = [];
    for (let i = 0; i < pCount; i++) {
      this.particleSeeds.push({
        x: Math.sin(i * 1.7) * 15,
        y: 0.6 + (i % 9) * 1.1,
        z: Math.cos(i * 2.3) * 12,
        speed: isRain ? 6.5 + (i % 5) * 1.1 : 0.55 + (i % 5) * 0.25,
        phase: i * 0.65,
      });
    }
    this.worldGroup.add(inst);
    this.particlesMesh = inst;

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private updateSceneKinematics(
    sceneSpec: VideoScene,
    sceneProgress: number,
    elapsedSeconds: number,
    dt: number,
    snapCamera = false
  ) {
    const intensity = this.renderOptions.animationIntensity;
    const speedMult = intensity === 'subtle' ? 0.72 : intensity === 'cinematic' ? 1.25 : 1.0;

    // 1. Animate all 3D actors along their paths + facial expressions + lip sync + physics motion
    let heroFocusX = 0;
    let heroFocusY = 1.1;
    let heroFocusZ = 0;
    let heroYaw = 0;

    for (let i = 0; i < this.activeActors.length; i++) {
      const rig = this.activeActors[i];
      const tr = interpolateActorTransform(
        rig.spec,
        sceneProgress,
        this.activeBiome,
        elapsedSeconds * speedMult
      );
      rig.group.position.set(tr.x, tr.y, tr.z);
      rig.group.rotation.y = tr.yaw;

      const groundY = groundHeightAt(this.activeBiome, tr.x, tr.z);
      rig.shadow.position.set(tr.x, groundY + 0.02, tr.z);

      if (i === 0) {
        heroFocusX = tr.x;
        heroFocusY = tr.y + 1.1;
        heroFocusZ = tr.z;
        heroYaw = tr.yaw;
      }

      const action = rig.spec.action;
      const cycle = elapsedSeconds * speedMult * (action === 'run' ? 8.5 : action === 'dance' ? 6.0 : 4.2);

      // Physics jump squash & stretch
      if (action === 'jump') {
        const bounce = Math.abs(Math.sin(elapsedSeconds * 3.8 * speedMult));
        const stretch = 1 + (bounce - 0.5) * 0.08;
        rig.group.scale.set(
          (rig.spec.scale || 1) / Math.sqrt(stretch),
          (rig.spec.scale || 1) * stretch,
          (rig.spec.scale || 1) / Math.sqrt(stretch)
        );
      }

      if (rig.leftLeg && rig.rightLeg) {
        if (action === 'walk' || action === 'run' || action === 'dance') {
          const amp = (action === 'run' ? 0.68 : 0.42) * Math.min(1.2, speedMult);
          rig.leftLeg.rotation.x = Math.sin(cycle) * amp;
          rig.rightLeg.rotation.x = -Math.sin(cycle) * amp;
        } else {
          rig.leftLeg.rotation.x = 0;
          rig.rightLeg.rotation.x = 0;
        }
      }

      if (rig.leftArm && rig.rightArm) {
        if (action === 'wave') {
          rig.leftArm.rotation.x = Math.sin(cycle * 0.5) * 0.15;
          rig.rightArm.rotation.z = -2.2 + Math.sin(elapsedSeconds * 7) * 0.35;
        } else if (action === 'cast-spell') {
          rig.rightArm.rotation.x = -1.4 + Math.sin(elapsedSeconds * 5) * 0.25;
          rig.leftArm.rotation.x = -0.6;
        } else if (action === 'dance') {
          rig.leftArm.rotation.z = 0.8 + Math.sin(cycle) * 0.5;
          rig.rightArm.rotation.z = -0.8 - Math.sin(cycle) * 0.5;
        } else if (action === 'walk' || action === 'run') {
          const amp = (action === 'run' ? 0.72 : 0.42) * Math.min(1.2, speedMult);
          rig.leftArm.rotation.x = -Math.sin(cycle) * amp;
          rig.rightArm.rotation.x = Math.sin(cycle) * amp;
          rig.rightArm.rotation.z = 0;
        } else {
          rig.leftArm.rotation.x = Math.sin(elapsedSeconds * 2) * 0.12;
          rig.rightArm.rotation.x = -Math.sin(elapsedSeconds * 2) * 0.12;
          rig.rightArm.rotation.z = 0;
        }
      }

      // Expressive head + blinking + eyebrows + lip synchronization
      if (rig.head) {
        rig.head.rotation.y = Math.sin(elapsedSeconds * 1.8 + i) * 0.18;
        const speaking = i === 0 && (this.renderOptions.isSpeaking || action === 'talk');
        const aperture = computeLipSyncAperture(elapsedSeconds, speaking, intensity);
        if (rig.mouth) {
          rig.mouth.scale.y = 0.4 + aperture * 1.85;
          rig.mouth.scale.x = 1.0 - aperture * 0.12;
        }
        if (speaking) {
          rig.head.rotation.x = -0.04 + Math.sin(elapsedSeconds * 6.2) * 0.05;
        }
        // Natural eye blinking
        if (rig.eyeL && rig.eyeR) {
          const blinkCycle = (elapsedSeconds + i * 1.3) % 3.4;
          const eyeScaleY = blinkCycle > 3.25 ? 0.15 : 1.0;
          rig.eyeL.scale.y = eyeScaleY;
          rig.eyeR.scale.y = eyeScaleY;
        }
        // Brow emotion cues
        if (rig.browL && rig.browR) {
          const expr = rig.spec.expression || 'happy';
          if (expr === 'focused') {
            rig.browL.rotation.z = -0.18;
            rig.browR.rotation.z = 0.18;
          } else if (expr === 'surprised' || expr === 'excited') {
            rig.browL.position.y = 0.135;
            rig.browR.position.y = 0.135;
            rig.browL.rotation.z = 0.12;
            rig.browR.rotation.z = -0.12;
          } else {
            rig.browL.position.y = 0.115;
            rig.browR.position.y = 0.115;
            rig.browL.rotation.z = 0.08;
            rig.browR.rotation.z = -0.08;
          }
        }
      }

      if (rig.chassis) {
        // Car suspension bounce & aerodynamic lean
        rig.chassis.position.y = Math.sin(elapsedSeconds * 14) * 0.025 * speedMult;
        rig.chassis.rotation.x = -0.025 * speedMult;
      }
      if (rig.staffOrb) {
        rig.staffOrb.scale.setScalar(1 + Math.sin(elapsedSeconds * 7) * 0.25);
      }
      if (rig.tail) {
        rig.tail.rotation.y = Math.sin(elapsedSeconds * 6.5 + i) * 0.45;
      }
      if (rig.extraLegs) {
        for (let l = 0; l < rig.extraLegs.length; l++) {
          const dir = l % 2 === 0 ? 1 : -1;
          rig.extraLegs[l].rotation.x = Math.sin(cycle * 1.2) * 0.45 * dir;
        }
      }
      if (rig.leftWing && rig.rightWing) {
        const flap = Math.sin(elapsedSeconds * 8.0 + i) * 0.65;
        rig.leftWing.rotation.z = flap;
        rig.rightWing.rotation.z = -flap;
      }
      if (rig.wheels) {
        for (const w of rig.wheels) {
          w.rotation.x = elapsedSeconds * 10.5 * speedMult;
        }
      }
      if (rig.rotors) {
        for (const r of rig.rotors) {
          r.rotation.y = elapsedSeconds * 19.0 * speedMult;
        }
      }
      if (rig.flame) {
        const flicker = 0.85 + Math.sin(elapsedSeconds * 22) * 0.28;
        rig.flame.scale.set(1, flicker, 1);
      }
    }

    // 2. Ocean waves vertex undulation & drifting 3D clouds
    if (this.waterMesh) {
      const posAttr = this.waterMesh.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const wx = posAttr.getX(i);
        const wz = posAttr.getZ(i);
        const waveY =
          Math.sin(wx * 0.35 + elapsedSeconds * 2.1) * 0.16 +
          Math.cos(wz * 0.3 + elapsedSeconds * 1.6) * 0.12;
        posAttr.setY(i, waveY);
      }
      posAttr.needsUpdate = true;
      this.waterMesh.position.y = -0.22;
    }

    for (const cl of this.cloudGroups) {
      const ang = cl.angle + elapsedSeconds * cl.speed * speedMult;
      cl.group.position.set(
        Math.cos(ang) * cl.radius,
        cl.baseY + Math.sin(elapsedSeconds * 0.5 + cl.angle) * 0.35,
        Math.sin(ang) * cl.radius
      );
      cl.group.rotation.y = -ang;
    }

    // 3. Wind sway on trees/flowers + water bob on boats + rolling balls + fire flicker
    const windStrength = this.activeWeather === 'wind' || this.activeWeather === 'rain' ? 2.1 : 1.0;
    for (const sp of this.swayProps) {
      if (sp.kind === 'boat') {
        sp.group.position.y = sp.baseY + Math.sin(elapsedSeconds * 2.0 + sp.phase) * 0.14;
        sp.group.rotation.z = Math.sin(elapsedSeconds * 1.6 + sp.phase) * 0.07;
      } else if (sp.kind === 'ball') {
        sp.group.position.y = sp.baseY + Math.abs(Math.sin(elapsedSeconds * 3.0 + sp.phase)) * 0.28;
        sp.group.rotation.x = elapsedSeconds * 2.4;
      } else {
        sp.group.rotation.z = Math.sin(elapsedSeconds * 1.9 + sp.phase) * 0.038 * windStrength * speedMult;
      }
    }

    for (let f = 0; f < this.fireFlames.length; f++) {
      const fl = this.fireFlames[f];
      fl.scale.set(
        1 + Math.sin(elapsedSeconds * 14 + f) * 0.12,
        0.82 + Math.sin(elapsedSeconds * 19 + f * 2) * 0.28,
        1 + Math.cos(elapsedSeconds * 16 + f) * 0.12
      );
    }

    // 4. Dynamic sun angle progression & storm lightning modulation
    const sunOrbit = -0.35 + sceneProgress * 0.7;
    this.keyLight.position.set(
      Math.cos(sunOrbit) * 16,
      15 + Math.sin(sceneProgress * Math.PI) * 4,
      Math.sin(sunOrbit) * 14 + 8
    );
    if (this.activeMood === 'stormy') {
      const flash = Math.sin(elapsedSeconds * 3.7) > 0.96 ? 1.85 : 0;
      this.keyLight.intensity = this.baseSunIntensity + flash;
    } else {
      this.keyLight.intensity = this.baseSunIntensity + Math.sin(sceneProgress * Math.PI) * 0.18;
    }
    this.keyLight.color.setHex(this.baseSunColor);

    // 5. Weather particles (rain streaks, snow fall, rising embers, wind gusts, fireflies)
    if (this.particlesMesh) {
      for (let i = 0; i < this.particleSeeds.length; i++) {
        const s = this.particleSeeds[i];
        if (this.activeWeather === 'rain') {
          const py = 10 - ((elapsedSeconds * s.speed * speedMult + s.phase * 2) % 10.5);
          const px = s.x + Math.sin(elapsedSeconds + s.phase) * 0.4;
          _dummy.position.set(px, py, s.z);
          _dummy.rotation.set(0, 0, -0.14);
          _dummy.scale.set(1, 1.15, 1);
        } else if (this.activeWeather === 'embers') {
          const py = 0.4 + ((elapsedSeconds * s.speed * 1.8 * speedMult + s.phase) % 8.5);
          _dummy.position.set(
            s.x + Math.sin(elapsedSeconds * 2 + s.phase) * 0.9,
            py,
            s.z + Math.cos(elapsedSeconds * 1.5 + s.phase) * 0.6
          );
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.setScalar(0.65 + 0.4 * Math.sin(elapsedSeconds * 5 + s.phase));
        } else if (this.activeWeather === 'snow') {
          const py = 9.5 - ((elapsedSeconds * s.speed * 1.4 * speedMult + s.phase) % 9.5);
          _dummy.position.set(
            s.x + Math.sin(elapsedSeconds * 1.2 + s.phase) * 1.2,
            py,
            s.z + Math.cos(elapsedSeconds + s.phase) * 0.7
          );
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.setScalar(0.9);
        } else if (this.activeWeather === 'wind') {
          const px = -14 + ((elapsedSeconds * s.speed * 5.2 * speedMult + s.phase * 4) % 28);
          _dummy.position.set(
            px,
            s.y + Math.sin(elapsedSeconds * 3 + s.phase) * 0.5,
            s.z
          );
          _dummy.rotation.set(elapsedSeconds * 2, elapsedSeconds * 3, 0);
          _dummy.scale.setScalar(0.85);
        } else {
          _dummy.position.set(
            s.x + Math.sin(elapsedSeconds * s.speed + s.phase) * 0.85,
            s.y + Math.cos(elapsedSeconds * s.speed * 1.3 + s.phase) * 0.55,
            s.z
          );
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.setScalar(0.8 + 0.35 * Math.sin(elapsedSeconds * 2 + s.phase));
        }
        _dummy.updateMatrix();
        this.particlesMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.particlesMesh.instanceMatrix.needsUpdate = true;
    }

    // 6. Smooth exponential camera cinematography honoring user cameraOverride or scene.cameraShot
    const chosenShot: VideoCameraShot =
      this.renderOptions.cameraOverride !== 'auto'
        ? this.renderOptions.cameraOverride
        : sceneSpec.cameraShot || 'orbit';

    const camGoal = resolveCameraTransform(
      chosenShot,
      sceneProgress,
      elapsedSeconds,
      { x: heroFocusX, y: Math.max(0, heroFocusY - 1.1), z: heroFocusZ, yaw: heroYaw },
      intensity,
      this.renderOptions.aspectRatio
    );

    _camGoal.set(camGoal.camX, camGoal.camY, camGoal.camZ);
    _lookGoal.set(camGoal.lookX, camGoal.lookY, camGoal.lookZ);

    if (Math.abs(this.camera.fov - camGoal.fov) > 0.25) {
      this.camera.fov = camGoal.fov;
      this.camera.updateProjectionMatrix();
    }

    const alpha = 1 - Math.exp(-4.8 * Math.max(0.016, dt));
    if (snapCamera) {
      this.camPos.copy(_camGoal);
      this.camLook.copy(_lookGoal);
    } else if (dt >= 0.03) {
      this.camPos.lerp(_camGoal, Math.min(1, alpha * 3));
      this.camLook.lerp(_lookGoal, Math.min(1, alpha * 3));
    } else {
      this.camPos.lerp(_camGoal, alpha);
      this.camLook.lerp(_lookGoal, alpha);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (camGoal.rollZ) {
      this.camera.rotation.z += camGoal.rollZ;
    }
  }

  public dispose() {
    this.disposed = true;
    this.isPlaying = false;
    this.cancelPendingFrames();
    this.disposeWorldGroup();
    this.shadowTex.dispose();
    const skyMat = this.skyMesh.material as THREE.MeshBasicMaterial;
    skyMat.map?.dispose();
    skyMat.dispose();
    this.skyMesh.geometry.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
