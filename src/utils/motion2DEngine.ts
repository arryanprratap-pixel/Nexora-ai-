import { computeLipSyncAperture, resolveTimelineFrame } from './nexoraLogic';
import type { CinemaRenderOptions } from './threeVideoEngine';
import type {
  VideoActorSpec,
  VideoBiome,
  VideoCameraShot,
  VideoFormatType,
  VideoScene,
  VideoStoryboard,
  VideoWeatherType,
} from '../types/nexora';

export interface VideoEngineController {
  resize: () => void;
  setRenderOptions?: (opts: Partial<CinemaRenderOptions>) => void;
  syncTimeline: (storyboard: VideoStoryboard, currentTime: number, playing: boolean) => void;
  captureCompositeFrame: (
    exportCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    storyboard: VideoStoryboard,
    timeSeconds: number
  ) => void;
  dispose: () => void;
}

type Mode2D = Exclude<VideoFormatType, 'auto' | '3d_animation'>;

function easeOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - c, 3);
}

function getBiomePalette2D(biome: VideoBiome, mood: string): {
  skyTop: string;
  skyBottom: string;
  farHill: string;
  nearGround: string;
  accent: string;
} {
  const isNight = mood === 'night_neon' || biome === 'space' || biome === 'cyber_arena';
  switch (biome) {
    case 'city':
      return {
        skyTop: isNight ? '#0B1026' : '#0284C7',
        skyBottom: isNight ? '#1E1B4B' : '#BAE6FD',
        farHill: isNight ? '#1E293B' : '#475569',
        nearGround: '#1E293B',
        accent: isNight ? '#38BDF8' : '#F59E0B',
      };
    case 'ocean':
      return {
        skyTop: '#0369A1',
        skyBottom: '#E0F2FE',
        farHill: '#0EA5E9',
        nearGround: '#FDE68A',
        accent: '#06B6D4',
      };
    case 'desert':
      return {
        skyTop: '#0284C7',
        skyBottom: '#FDE68A',
        farHill: '#D97706',
        nearGround: '#F59E0B',
        accent: '#EA580C',
      };
    case 'classroom':
    case 'indoor_studio':
      return {
        skyTop: '#1E293B',
        skyBottom: '#334155',
        farHill: '#475569',
        nearGround: '#78350F',
        accent: '#38BDF8',
      };
    case 'fantasy_kingdom':
      return {
        skyTop: '#312E81',
        skyBottom: '#C4B5FD',
        farHill: '#4338CA',
        nearGround: '#15803D',
        accent: '#F59E0B',
      };
    case 'mountain':
      return {
        skyTop: '#0369A1',
        skyBottom: '#E0F2FE',
        farHill: '#475569',
        nearGround: '#64748B',
        accent: '#38BDF8',
      };
    case 'cyber_arena':
    case 'space':
      return {
        skyTop: '#050814',
        skyBottom: '#1E1B4B',
        farHill: '#312E81',
        nearGround: '#0F172A',
        accent: '#22D3EE',
      };
    case 'forest':
    default:
      return {
        skyTop: '#0284C7',
        skyBottom: '#BAE6FD',
        farHill: '#15803D',
        nearGround: '#22C55E',
        accent: '#F59E0B',
      };
  }
}

export class Motion2DEngine implements VideoEngineController {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: Mode2D;
  private storyboard: VideoStoryboard | null = null;
  private currentTime = 0;
  private isPlaying = false;
  private frameId = 0;
  private lastClockMs = 0;
  private disposed = false;
  private onTimeAdvance?: (nextTime: number, finished: boolean) => void;
  private renderOptions: CinemaRenderOptions = {
    cameraOverride: 'auto',
    animationIntensity: 'dynamic',
    visualStyle: 'Auto (AI Decides)',
    aspectRatio: '16:9',
    isSpeaking: false,
  };

  constructor(
    container: HTMLElement,
    mode: Mode2D,
    onTimeAdvance?: (nextTime: number, finished: boolean) => void
  ) {
    this.container = container;
    this.mode = mode;
    this.onTimeAdvance = onTimeAdvance;

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.borderRadius = '0.75rem';
    this.canvas.setAttribute('data-testid', 'video-studio-canvas');

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable.');
    this.ctx = ctx;

    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.resize();
  }

  public setRenderOptions(opts: Partial<CinemaRenderOptions>) {
    this.renderOptions = { ...this.renderOptions, ...opts };
    if (!this.isPlaying && this.storyboard && !this.disposed) {
      this.renderAt(this.storyboard, this.currentTime);
    }
  }

  public setMode(mode: Mode2D) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (!this.isPlaying && this.storyboard) {
      this.renderAt(this.storyboard, this.currentTime);
    }
  }

  public resize() {
    if (this.disposed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, this.container.clientWidth || 960);
    const h = Math.max(180, this.container.clientHeight || 540);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    if (this.storyboard && !this.isPlaying) {
      this.renderAt(this.storyboard, this.currentTime);
    }
  }

  public syncTimeline(storyboard: VideoStoryboard, currentTime: number, playing: boolean) {
    if (this.disposed) return;
    const wasPlaying = this.isPlaying;
    const storyboardChanged = this.storyboard?.id !== storyboard.id;
    const jumped = Math.abs(currentTime - this.currentTime) >= 0.35;

    this.storyboard = storyboard;
    this.isPlaying = playing;

    if (!playing || !wasPlaying || storyboardChanged || jumped) {
      this.currentTime = currentTime;
      this.renderAt(storyboard, currentTime);
    }

    if (playing && !wasPlaying) {
      cancelAnimationFrame(this.frameId);
      this.lastClockMs = performance.now();
      this.frameId = requestAnimationFrame(this.tick);
    } else if (!playing && wasPlaying) {
      cancelAnimationFrame(this.frameId);
    }
  }

  public captureCompositeFrame(
    exportCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    storyboard: VideoStoryboard,
    timeSeconds: number
  ) {
    this.drawSceneToContext(exportCtx, width, height, storyboard, timeSeconds, true);
  }

  private tick = (now: number) => {
    if (this.disposed || !this.isPlaying || !this.storyboard) return;
    const dt = Math.min(0.1, Math.max(0.005, (now - this.lastClockMs) / 1000));
    this.lastClockMs = now;

    let nextTime = this.currentTime + dt;
    let finished = false;
    if (nextTime >= this.storyboard.totalDurationSeconds) {
      nextTime = this.storyboard.totalDurationSeconds;
      this.isPlaying = false;
      finished = true;
    }
    this.currentTime = nextTime;
    this.renderAt(this.storyboard, nextTime);
    this.onTimeAdvance?.(nextTime, finished);

    if (!finished && this.isPlaying) {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private renderAt(storyboard: VideoStoryboard, timeSeconds: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    this.ctx.save();
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawSceneToContext(this.ctx, w, h, storyboard, timeSeconds, false);
    this.ctx.restore();
  }

  private drawSceneToContext(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    storyboard: VideoStoryboard,
    timeSeconds: number,
    burnOverlays: boolean
  ) {
    const frame = resolveTimelineFrame(storyboard, timeSeconds);
    if (!frame) return;
    const { scene, sceneProgress } = frame;

    if (this.mode === 'whiteboard_explainer') {
      this.drawWhiteboardExplainer(ctx, w, h, scene, sceneProgress, timeSeconds);
    } else if (this.mode === 'cinematic_story') {
      this.drawCinematicStory(ctx, w, h, scene, sceneProgress, timeSeconds);
    } else {
      this.drawMotionGraphics2D(ctx, w, h, scene, sceneProgress, timeSeconds);
    }

    if (burnOverlays) {
      ctx.save();
      ctx.fillStyle = 'rgba(9, 13, 22, 0.78)';
      ctx.beginPath();
      ctx.roundRect(22, 20, Math.min(w - 44, 420), 38, 10);
      ctx.fill();
      ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(scene.title, 36, 44);

      const subText = scene.subtitle || scene.narration;
      if (subText) {
        ctx.fillStyle = 'rgba(9, 13, 22, 0.84)';
        ctx.beginPath();
        ctx.roundRect(36, h - 74, w - 72, 48, 12);
        ctx.fill();
        ctx.font = '500 15px "DM Sans", sans-serif';
        ctx.fillStyle = '#F1F5F9';
        ctx.textAlign = 'center';
        ctx.fillText(subText.slice(0, 86), w / 2, h - 44);
      }
      ctx.restore();
    }
  }

  private drawActor2D(
    ctx: CanvasRenderingContext2D,
    actor: VideoActorSpec,
    x: number,
    y: number,
    scale: number,
    elapsed: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Ground contact shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 26, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (actor.role === 'car') {
      // Sleek 2D vector sports car
      ctx.fillStyle = actor.color || '#EF4444';
      ctx.beginPath();
      ctx.roundRect(-42, -6, 84, 24, 8);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(-22, -6);
      ctx.lineTo(-10, -24);
      ctx.lineTo(18, -24);
      ctx.lineTo(30, -6);
      ctx.closePath();
      ctx.fill();
      // Windows
      ctx.fillStyle = '#BAE6FD';
      ctx.beginPath();
      ctx.moveTo(-16, -8);
      ctx.lineTo(-7, -20);
      ctx.lineTo(15, -20);
      ctx.lineTo(23, -8);
      ctx.closePath();
      ctx.fill();
      // Headlight & taillight
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(36, 0, 6, 8);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-42, 0, 5, 8);
      // Spinning wheels
      for (const wx of [-24, 24]) {
        ctx.save();
        ctx.translate(wx, 18);
        ctx.rotate(elapsed * 9);
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = actor.accentColor || '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.stroke();
        ctx.restore();
      }
    } else if (actor.role === 'drone' || actor.role === 'bird' || actor.role === 'dragon') {
      const hover = Math.sin(elapsed * 4.5) * 8;
      ctx.translate(0, -32 + hover);
      const wing = Math.sin(elapsed * 10) * 14;
      ctx.strokeStyle = actor.accentColor || '#F59E0B';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-28, -wing);
      ctx.lineTo(0, 0);
      ctx.lineTo(28, -wing);
      ctx.stroke();
      ctx.fillStyle = actor.color || '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(7, -2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (actor.role === 'cat' || actor.role === 'dog') {
      const bounce = Math.abs(Math.sin(elapsed * 6)) * 5;
      ctx.translate(0, -bounce);
      ctx.fillStyle = actor.color || '#D97706';
      ctx.beginPath();
      ctx.roundRect(-22, -6, 42, 22, 10);
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.arc(18, -10, 13, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.fillStyle = actor.accentColor || '#FDE68A';
      ctx.beginPath();
      ctx.moveTo(12, -20);
      ctx.lineTo(16, -31);
      ctx.lineTo(22, -20);
      ctx.fill();
      // Legs
      const swing = Math.sin(elapsed * 8) * 6;
      ctx.strokeStyle = actor.color || '#D97706';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, 14);
      ctx.lineTo(-14 + swing, 25);
      ctx.moveTo(12, 14);
      ctx.lineTo(12 - swing, 25);
      ctx.stroke();
    } else {
      // Stylized vector character (human / student / wizard / robot) with blinking + lip sync
      const stride = Math.sin(elapsed * 6) * 8;
      const bob = Math.abs(Math.sin(elapsed * 6)) * 4;
      ctx.translate(0, -bob);

      // Legs
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, 4);
      ctx.lineTo(-7 + stride, 24);
      ctx.moveTo(7, 4);
      ctx.lineTo(7 - stride, 24);
      ctx.stroke();

      // Torso
      ctx.fillStyle = actor.color || '#2563EB';
      ctx.beginPath();
      ctx.roundRect(-14, -22, 28, 30, 8);
      ctx.fill();

      // Accent scarf / visor detail
      ctx.fillStyle = actor.accentColor || '#F59E0B';
      ctx.fillRect(-12, -16, 24, 6);

      // Head
      ctx.fillStyle = actor.role === 'robot' ? actor.color : '#FCD5B5';
      ctx.beginPath();
      ctx.arc(0, -36, 13, 0, Math.PI * 2);
      ctx.fill();

      const speaking = this.renderOptions.isSpeaking || actor.action === 'talk';
      const aperture = computeLipSyncAperture(
        elapsed,
        speaking,
        this.renderOptions.animationIntensity
      );

      if (actor.role === 'wizard') {
        ctx.fillStyle = actor.color || '#7C3AED';
        ctx.beginPath();
        ctx.moveTo(-16, -44);
        ctx.lineTo(0, -68);
        ctx.lineTo(16, -44);
        ctx.closePath();
        ctx.fill();
      }

      if (actor.role === 'robot') {
        ctx.fillStyle = '#22D3EE';
        ctx.fillRect(-8, -40, 16, 4.5);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-5, -31, 10, 1.5 + aperture * 3.5);
      } else {
        const blinking = elapsed % 3.4 > 3.24;
        ctx.fillStyle = '#0F172A';
        if (blinking) {
          ctx.fillRect(1, -38, 5, 1.5);
        } else {
          ctx.beginPath();
          ctx.arc(4, -38, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Lip-synced mouth ellipse
        ctx.fillStyle = '#991B1B';
        ctx.beginPath();
        ctx.ellipse(3, -30, 3.8, 1.0 + aperture * 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Waving / swinging arm
      ctx.strokeStyle = actor.color || '#2563EB';
      ctx.lineWidth = 5;
      ctx.beginPath();
      const armWave = actor.action === 'wave' ? -24 + Math.sin(elapsed * 8) * 10 : stride * 0.8;
      ctx.moveTo(12, -16);
      ctx.lineTo(24, -10 + armWave * 0.4);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawWeatherOverlay2D(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    weather: VideoWeatherType | undefined,
    elapsed: number
  ) {
    if (!weather || weather === 'clear') return;
    ctx.save();
    if (weather === 'rain') {
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.55)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 42; i++) {
        const rx = ((i * 67 + elapsed * 140) % (w + 60)) - 30;
        const ry = ((i * 89 + elapsed * 520) % (h + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + 16);
        ctx.stroke();
      }
    } else if (weather === 'snow') {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 83 + Math.sin(elapsed * 1.4 + i) * 28) % w + w) % w;
        const sy = (i * 59 + elapsed * 75) % h;
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + (i % 2.5), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === 'embers') {
      for (let i = 0; i < 28; i++) {
        const px = ((i * 89 + Math.sin(elapsed * 2 + i) * 24) % w + w) % w;
        const py = h - ((i * 53 + elapsed * 70) % h);
        ctx.fillStyle = `rgba(251, 146, 60, ${0.4 + 0.4 * Math.sin(elapsed * 4 + i)})`;
        ctx.beginPath();
        ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === 'wind') {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const wx = ((i * 140 + elapsed * 260) % (w + 120)) - 80;
        const wy = h * 0.2 + ((i * 67) % (h * 0.55));
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 55, wy + Math.sin(elapsed * 5 + i) * 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawMotionGraphics2D(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scene: VideoScene,
    sceneProgress: number,
    elapsed: number
  ) {
    const pal = getBiomePalette2D(scene.biome, scene.mood);
    const shot: VideoCameraShot =
      this.renderOptions.cameraOverride !== 'auto'
        ? this.renderOptions.cameraOverride
        : scene.cameraShot || 'tracking';
    const handheldShake =
      shot === 'handheld' ? Math.sin(elapsed * 8.5) * 4 : 0;

    ctx.save();
    ctx.translate(handheldShake, handheldShake * 0.6);

    // 1. Multi-stop Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.72);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-10, -10, w + 20, h + 20);

    // Sun / Glow Orb
    ctx.save();
    const sunX = w * (0.76 - sceneProgress * 0.14);
    const sunY = h * (0.22 + Math.sin(sceneProgress * Math.PI) * 0.04);
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 95);
    sunGlow.addColorStop(0, 'rgba(255, 248, 220, 0.95)');
    sunGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.35)');
    sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Parallax Distant Layer (Hills or City Skyline)
    const pan = elapsed * 42 + sceneProgress * 80;
    if (scene.biome === 'city' || scene.biome === 'cyber_arena') {
      ctx.fillStyle = pal.farHill;
      const bCount = 14;
      for (let i = 0; i < bCount; i++) {
        const bw = w / 10;
        const bh = 90 + ((i * 57) % 130);
        const bx = (((i * (bw * 0.95) - pan * 0.4) % (w + bw * 2)) + (w + bw * 2)) % (w + bw * 2) - bw;
        const by = h * 0.68 - bh;
        ctx.fillRect(bx, by, bw - 8, bh);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.32)';
        for (let wy = by + 14; wy < h * 0.65; wy += 20) {
          ctx.fillRect(bx + 10, wy, bw - 28, 7);
        }
        ctx.fillStyle = pal.farHill;
      }
    } else {
      ctx.fillStyle = pal.farHill;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.68);
      for (let x = 0; x <= w + 40; x += 40) {
        const y = h * 0.56 + Math.sin((x + pan * 0.5) * 0.012) * 28 + Math.cos((x + pan * 0.5) * 0.006) * 16;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Foreground Ground / Animated Ocean Waves / Moving Road Markings
    ctx.fillStyle = pal.nearGround;
    ctx.fillRect(0, h * 0.66, w, h * 0.34);

    if (scene.biome === 'city') {
      ctx.fillStyle = '#FACC15';
      for (let x = -((elapsed * 160) % 80); x < w; x += 80) {
        ctx.fillRect(x, h * 0.77, 42, 6);
      }
    } else if (scene.biome === 'ocean') {
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.8);
      for (let x = 0; x <= w; x += 24) {
        ctx.lineTo(x, h * 0.66 + Math.sin(x * 0.035 + elapsed * 3.2) * 5);
      }
      ctx.lineTo(w, h * 0.8);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Continuously drifting Clouds
    for (let i = 0; i < 4; i++) {
      const cx = (((i * 260 - elapsed * 24 + w * 1.5) % (w + 180)) + (w + 180)) % (w + 180) - 90;
      const cy = h * (0.16 + (i % 2) * 0.08);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.arc(cx + 18, cy - 6, 24, 0, Math.PI * 2);
      ctx.arc(cx + 38, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Animated 2D Actors gliding continuously across scene
    const groundBaseline = h * 0.72;
    (scene.actors || []).forEach((actor, idx) => {
      const startX = w * 0.16 + ((actor.startPos?.[0] ?? 0) / 14) * (w * 0.35);
      const endX = w * 0.16 + ((actor.endPos?.[0] ?? 4) / 14) * (w * 0.35) + w * 0.28;
      const smooth = sceneProgress * sceneProgress * (3 - 2 * sceneProgress);
      const ax = Math.max(w * 0.1, Math.min(w * 0.9, startX + (endX - startX) * smooth));
      const ay = groundBaseline + idx * 14;
      this.drawActor2D(ctx, actor, ax, ay, Math.min(w / 720, 1.2) * (actor.scale || 1), elapsed);
    });

    // Weather particles overlay
    this.drawWeatherOverlay2D(ctx, w, h, scene.weather, elapsed);

    // 6. Kinetic Motion Callout Cards (top-right keyPoints)
    const points =
      scene.keyPoints && scene.keyPoints.length > 0
        ? scene.keyPoints
        : [scene.title, scene.subtitle || 'Visual key highlight'];
    points.slice(0, 2).forEach((kp, idx) => {
      const enter = Math.max(0.88 - idx * 0.1, easeOutCubic((sceneProgress + 0.12 - idx * 0.08) / 0.28));
      ctx.save();
      ctx.globalAlpha = enter;
      const cardW = Math.min(w * 0.42, 310);
      const cardX = w - cardW - 22 + (1 - enter) * 24;
      const cardY = 64 + idx * 50;
      ctx.fillStyle = 'rgba(9, 13, 22, 0.8)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, 40, 10);
      ctx.fill();
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cardX + 10, cardY + 10);
      ctx.lineTo(cardX + 10, cardY + 30);
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(kp.slice(0, 42), cardX + 22, cardY + 25);
      ctx.restore();
    });

    ctx.restore();
  }

  private drawWhiteboardExplainer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scene: VideoScene,
    sceneProgress: number,
    elapsed: number
  ) {
    // Warm crisp whiteboard surface with subtle drafting grid
    ctx.fillStyle = '#FAF8F3';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Sketchpad inner frame
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);

    // Progressive hand-drawn heading & marker underline
    const titleReveal = 0.35 + 0.65 * easeOutCubic(sceneProgress / 0.25);
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.font = `700 ${Math.max(16, Math.round(w * 0.025))}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(scene.title, 36, 86);

    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(36, 97);
    ctx.lineTo(36 + Math.min(w * 0.45, 340) * titleReveal, 97);
    ctx.stroke();
    ctx.restore();

    // Left Sketch Illustration Card (always crisp and visible, animates subtle scale/actor motion)
    const boxW = Math.min(w * 0.4, 340);
    const boxH = Math.min(h * 0.5, 240);
    const boxX = 36;
    const boxY = Math.max(114, h * 0.23);

    ctx.save();
    ctx.fillStyle = '#EFF6FF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    ctx.fill();
    ctx.stroke();

    // Blueprint label inside top of sketch card
    ctx.fillStyle = '#1D4ED8';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(`VISUAL DIAGRAM · ${scene.biome.replace('_', ' ').toUpperCase()}`, boxX + 16, boxY + 24);

    // Draw lively vector sketch inside the diagram board
    const mainActor = scene.actors?.[0];
    if (mainActor) {
      this.drawActor2D(
        ctx,
        mainActor,
        boxX + boxW * 0.5,
        boxY + boxH * 0.6,
        Math.min(boxW / 235, 1.18),
        elapsed
      );
    }

    // Animated hand-drawn connecting arrow to key concepts
    const arrowProgress = Math.max(0.45, easeOutCubic((sceneProgress + 0.1) / 0.35));
    const startAx = boxX + boxW + 10;
    const endAx = boxX + boxW + 44 * arrowProgress;
    const midAy = boxY + boxH * 0.48;
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(startAx, midAy);
    ctx.lineTo(endAx, midAy);
    ctx.stroke();
    if (arrowProgress > 0.4) {
      ctx.beginPath();
      ctx.moveTo(endAx - 8, midAy - 7);
      ctx.lineTo(endAx, midAy);
      ctx.lineTo(endAx - 8, midAy + 7);
      ctx.stroke();
    }
    ctx.restore();

    // Right Progressive Numbered Key Concept Notes (all steps readable immediately, active step highlighted)
    const points =
      scene.keyPoints && scene.keyPoints.length > 0
        ? scene.keyPoints
        : [scene.narration.slice(0, 56), 'Visual step breakdown'];
    const notesX = boxX + boxW + 58;
    const notesW = Math.max(160, w - notesX - 36);
    const activeIdx = Math.min(points.slice(0, 3).length - 1, Math.floor(sceneProgress * 3));

    points.slice(0, 3).forEach((pt, idx) => {
      const isFocused = idx === activeIdx;
      const stepIn = Math.max(idx <= activeIdx ? 1 : 0.72, easeOutCubic((sceneProgress + 0.1 - idx * 0.18) / 0.25));
      const ny = boxY + idx * Math.min(76, boxH / 3 + 8);
      ctx.save();
      ctx.globalAlpha = stepIn;

      ctx.fillStyle = isFocused ? '#FFFFFF' : '#F8FAFC';
      ctx.strokeStyle = isFocused ? '#2563EB' : '#CBD5E1';
      ctx.lineWidth = isFocused ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(notesX, ny, notesW, 56, 12);
      ctx.fill();
      ctx.stroke();

      // Number circle
      ctx.fillStyle = isFocused ? '#2563EB' : '#64748B';
      ctx.beginPath();
      ctx.arc(notesX + 24, ny + 28, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1), notesX + 24, ny + 32);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = '600 13px "DM Sans", sans-serif';
      ctx.fillText(pt.slice(0, Math.max(22, Math.floor(notesW / 8))), notesX + 46, ny + 32);
      ctx.restore();
    });
  }

  private drawCinematicStory(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scene: VideoScene,
    sceneProgress: number,
    elapsed: number
  ) {
    const pal = getBiomePalette2D(scene.biome, scene.mood);
    const trackingPan = elapsed * 55 + sceneProgress * 120;
    const shot: VideoCameraShot =
      this.renderOptions.cameraOverride !== 'auto'
        ? this.renderOptions.cameraOverride
        : scene.cameraShot || 'tracking';
    const camShakeX = shot === 'handheld' ? Math.sin(elapsed * 7.8) * 5 : 0;
    const camShakeY = shot === 'handheld' ? Math.cos(elapsed * 6.4) * 3.5 : 0;

    ctx.save();
    ctx.translate(camShakeX, camShakeY);

    // 1. Dynamic atmospheric twilight / golden gradient backdrop
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#090D16');
    grad.addColorStop(0.55, pal.skyTop);
    grad.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    // 2. Slowly drifting volumetric light shafts & high clouds
    for (let c = 0; c < 4; c++) {
      const cx = (((c * 280 - trackingPan * 0.18 + w * 1.5) % (w + 220)) + (w + 220)) % (w + 220) - 110;
      const cy = h * (0.2 + (c % 2) * 0.08);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.arc(cx + 24, cy - 6, 30, 0, Math.PI * 2);
      ctx.arc(cx + 50, cy, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    for (let s = 0; s < 3; s++) {
      const drift = Math.sin(elapsed * 0.5 + s) * 28;
      const beamGrad = ctx.createLinearGradient(w * (0.2 + s * 0.25) + drift, 0, w * (0.45 + s * 0.2), h);
      beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.16)');
      beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(w * (0.15 + s * 0.24) + drift, 0);
      ctx.lineTo(w * (0.28 + s * 0.24) + drift, 0);
      ctx.lineTo(w * (0.58 + s * 0.2), h);
      ctx.lineTo(w * (0.36 + s * 0.2), h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 3. Far Parallax Ridge Layer (drifts at 0.3x tracking speed)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.52)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    for (let x = 0; x <= w + 40; x += 36) {
      ctx.lineTo(x, h * 0.58 + Math.sin((x + trackingPan * 0.3) * 0.013 + 1.2) * 32);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // 4. Midground Silhouette Tree/City Layer (drifts at 0.65x speed)
    ctx.fillStyle = 'rgba(11, 17, 32, 0.75)';
    for (let t = 0; t < 11; t++) {
      const tx = (((t * 110 - trackingPan * 0.65) % (w + 140)) + (w + 140)) % (w + 140) - 70;
      const th = 44 + (t % 3) * 18;
      ctx.beginPath();
      ctx.moveTo(tx, h * 0.72);
      ctx.lineTo(tx + 18, h * 0.72 - th);
      ctx.lineTo(tx + 36, h * 0.72);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Foreground ground & moving road/water highlights
    ctx.fillStyle = '#0B1120';
    ctx.fillRect(-20, h * 0.72, w + 40, h * 0.32);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 2;
    for (let m = 0; m < 8; m++) {
      const mx = (((m * 160 - trackingPan) % (w + 160)) + (w + 160)) % (w + 160) - 80;
      ctx.beginPath();
      ctx.moveTo(mx, h * 0.79 + (m % 2) * 12);
      ctx.lineTo(mx + 46, h * 0.79 + (m % 2) * 12);
      ctx.stroke();
    }

    // 6. Moving Hero Actor(s) with true walk/run/drive/fly animation across the stage
    (scene.actors || []).forEach((actor, idx) => {
      const startX = w * 0.18 + idx * (w * 0.16);
      const endX = w * 0.68 + idx * (w * 0.14);
      const smooth = sceneProgress * sceneProgress * (3 - 2 * sceneProgress);
      const ax = Math.max(w * 0.1, Math.min(w * 0.9, startX + (endX - startX) * smooth));
      this.drawActor2D(ctx, actor, ax, h * 0.7, Math.min(w / 680, 1.25), elapsed);
    });

    // 7. Weather & atmospheric particle layer
    this.drawWeatherOverlay2D(ctx, w, h, scene.weather || 'embers', elapsed);

    ctx.restore();

    // True 2.39:1 Widescreen Cinema Letterbox Bars
    const barH = Math.max(22, Math.round(h * 0.09));
    ctx.fillStyle = '#04060A';
    ctx.fillRect(0, 0, w, barH);
    ctx.fillRect(0, h - barH, w, barH);
  }

  public dispose() {
    this.disposed = true;
    this.isPlaying = false;
    cancelAnimationFrame(this.frameId);
    if (this.canvas.parentElement === this.container) {
      this.container.removeChild(this.canvas);
    }
  }
}
