import type { VideoBiome, VideoMood, VideoScene, VideoStoryboard, VideoWeatherType } from '../types/nexora';

interface MoodScaleConfig {
  chords: number[][];
  waveType: OscillatorType;
  cutoffHz: number;
  beatSec: number;
  padGain: number;
}

function getMoodScale(mood: VideoMood, biome: VideoBiome): MoodScaleConfig {
  if (biome === 'cyber_arena' || biome === 'space' || mood === 'night_neon') {
    return {
      chords: [
        [130.81, 196.0, 246.94, 293.66], // Csus2/Cmaj9
        [110.0, 164.81, 220.0, 261.63],  // Am7
        [87.31, 130.81, 196.0, 246.94],  // Fmaj9
        [98.0, 146.83, 196.0, 233.08],   // Gm7
      ],
      waveType: 'sawtooth',
      cutoffHz: 680,
      beatSec: 2.0,
      padGain: 0.045,
    };
  }
  if (mood === 'stormy' || mood === 'dramatic') {
    return {
      chords: [
        [146.83, 174.61, 220.0, 261.63], // Dm7
        [116.54, 174.61, 220.0, 293.66], // Bbmaj7
        [98.0, 146.83, 174.61, 233.08],  // Gm7
        [110.0, 164.81, 220.0, 277.18],  // A7sus
      ],
      waveType: 'triangle',
      cutoffHz: 750,
      beatSec: 2.2,
      padGain: 0.06,
    };
  }
  if (biome === 'fantasy_kingdom' || mood === 'golden_hour') {
    return {
      chords: [
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [196.0, 246.94, 293.66, 369.99], // G6(#11)
        [164.81, 196.0, 246.94, 293.66], // Em7
        [146.83, 220.0, 261.63, 329.63], // Dm9
      ],
      waveType: 'sine',
      cutoffHz: 1100,
      beatSec: 2.5,
      padGain: 0.065,
    };
  }
  // Daylight / cozy / forest / classroom warm hopeful major progression
  return {
    chords: [
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [196.0, 246.94, 293.66, 349.23], // G7
    ],
    waveType: 'triangle',
    cutoffHz: 950,
    beatSec: 2.4,
    padGain: 0.055,
  };
}

function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.floor(sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Soft pink-filtered noise for organic wind/rain/ocean texture
    b0 = 0.997 * b0 + white * 0.029;
    b1 = 0.985 * b1 + white * 0.032;
    b2 = 0.95 * b2 + white * 0.048;
    data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.04) * 1.8));
  }
  return buffer;
}

function getAmbientFilterSpec(
  biome: VideoBiome,
  weather: VideoWeatherType = 'clear'
): { freq: number; q: number; gain: number; type: BiquadFilterType } {
  if (weather === 'rain') {
    return { type: 'bandpass', freq: 1450, q: 0.65, gain: 0.08 };
  }
  if (biome === 'ocean') {
    return { type: 'lowpass', freq: 520, q: 0.8, gain: 0.09 };
  }
  if (weather === 'wind' || biome === 'mountain' || biome === 'desert') {
    return { type: 'bandpass', freq: 440, q: 1.4, gain: 0.06 };
  }
  if (biome === 'city') {
    return { type: 'lowpass', freq: 260, q: 0.7, gain: 0.045 };
  }
  if (biome === 'classroom' || biome === 'indoor_studio') {
    return { type: 'lowpass', freq: 220, q: 0.5, gain: 0.02 };
  }
  return { type: 'bandpass', freq: 720, q: 0.9, gain: 0.04 };
}

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private stepTimer: number | null = null;
  private chordStep = 0;
  private activeScene: VideoScene | null = null;
  private running = false;
  private lastCueSceneId = '';

  public startLive(scene: VideoScene) {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.activeScene = scene;
    if (this.running) {
      this.updateScene(scene);
      return;
    }
    this.running = true;
    this.chordStep = 0;
    this.lastCueSceneId = scene.id;

    // Continuous ambient environmental bed
    const noiseBuf = createNoiseBuffer(this.ctx, 2.5);
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    const ambGain = this.ctx.createGain();
    const spec = getAmbientFilterSpec(scene.biome, scene.weather);
    filter.type = spec.type;
    filter.frequency.value = spec.freq;
    filter.Q.value = spec.q;
    ambGain.gain.value = spec.gain;

    src.connect(filter);
    filter.connect(ambGain);
    ambGain.connect(this.masterGain!);
    src.start();

    this.ambientSource = src;
    this.ambientFilter = filter;
    this.ambientGain = ambGain;

    const scheduleBeat = () => {
      if (!this.running || !this.ctx || !this.masterGain || !this.activeScene) return;
      const cfg = getMoodScale(this.activeScene.mood, this.activeScene.biome);
      const chord = cfg.chords[this.chordStep % cfg.chords.length];
      this.playChordSlice(this.ctx, this.masterGain, chord, cfg, this.ctx.currentTime, cfg.beatSec);
      this.chordStep += 1;
      this.stepTimer = window.setTimeout(scheduleBeat, Math.round(cfg.beatSec * 820));
    };

    scheduleBeat();
  }

  public updateScene(scene: VideoScene) {
    this.activeScene = scene;
    if (!this.running || !this.ctx || !this.masterGain) return;

    if (this.ambientFilter && this.ambientGain) {
      const spec = getAmbientFilterSpec(scene.biome, scene.weather);
      const now = this.ctx.currentTime;
      this.ambientFilter.type = spec.type;
      this.ambientFilter.frequency.setTargetAtTime(spec.freq, now, 0.25);
      this.ambientGain.gain.setTargetAtTime(spec.gain, now, 0.25);
    }

    if (this.lastCueSceneId !== scene.id) {
      this.lastCueSceneId = scene.id;
      this.playActionCue(this.ctx, this.masterGain, scene, this.ctx.currentTime);
    }
  }

  public stopLive() {
    this.running = false;
    if (this.stepTimer !== null) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    try {
      this.ambientSource?.stop();
    } catch {
      // ignore if already stopped
    }
    this.ambientSource?.disconnect();
    this.ambientFilter?.disconnect();
    this.ambientGain?.disconnect();
    this.ambientSource = null;
    this.ambientFilter = null;
    this.ambientGain = null;
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public dispose() {
    this.stopLive();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }

  private playChordSlice(
    ctx: AudioContext,
    dest: AudioNode,
    chordFreqs: number[],
    cfg: MoodScaleConfig,
    startAt: number,
    duration: number
  ) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cfg.cutoffHz, startAt);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, startAt);
    env.gain.linearRampToValueAtTime(cfg.padGain, startAt + Math.min(0.45, duration * 0.25));
    env.gain.exponentialRampToValueAtTime(0.0008, startAt + duration + 0.15);

    filter.connect(env);
    env.connect(dest);

    for (const freq of chordFreqs) {
      const osc = ctx.createOscillator();
      osc.type = cfg.waveType;
      osc.frequency.setValueAtTime(freq, startAt);
      osc.connect(filter);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.2);
    }

    // Gentle high arpeggio shimmer note
    const arpFreq = chordFreqs[this.chordStep % chordFreqs.length] * 2;
    const arpOsc = ctx.createOscillator();
    const arpEnv = ctx.createGain();
    arpOsc.type = 'sine';
    arpOsc.frequency.setValueAtTime(arpFreq, startAt + 0.15);
    arpEnv.gain.setValueAtTime(0.0001, startAt + 0.15);
    arpEnv.gain.linearRampToValueAtTime(cfg.padGain * 0.45, startAt + 0.28);
    arpEnv.gain.exponentialRampToValueAtTime(0.0005, startAt + duration * 0.85);
    arpOsc.connect(arpEnv);
    arpEnv.connect(dest);
    arpOsc.start(startAt + 0.15);
    arpOsc.stop(startAt + duration);
  }

  private playActionCue(
    ctx: AudioContext,
    dest: AudioNode,
    scene: VideoScene,
    startAt: number
  ) {
    // Soft cinematic scene transition whoosh
    const noiseBuf = createNoiseBuffer(ctx, 0.55);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(280, startAt);
    bp.frequency.exponentialRampToValueAtTime(1400, startAt + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, startAt);
    g.gain.linearRampToValueAtTime(0.06, startAt + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0008, startAt + 0.52);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(startAt);
    src.stop(startAt + 0.54);

    // Optional bright chime for fantasy / cast-spell / achievement
    const hasMagicOrFly = (scene.actors || []).some(
      (a) => a.action === 'cast-spell' || a.action === 'jump'
    );
    if (hasMagicOrFly || scene.biome === 'fantasy_kingdom') {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const t0 = startAt + 0.12 + idx * 0.08;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(0.032, t0 + 0.04);
        env.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.42);
        osc.connect(env);
        env.connect(dest);
        osc.start(t0);
        osc.stop(t0 + 0.45);
      });
    }
  }

  public scheduleExportSoundtrack(
    ctx: AudioContext,
    dest: AudioNode,
    storyboard: VideoStoryboard,
    exportDurationSec: number
  ) {
    const startBase = ctx.currentTime;
    const totalStoryboardSec = Math.max(1, storyboard.totalDurationSeconds);
    const timeScale = exportDurationSec / totalStoryboardSec;

    // Ambient bed across export clip based on first scene
    const firstScene = storyboard.scenes[0];
    if (firstScene) {
      const noiseBuf = createNoiseBuffer(ctx, 2.5);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const spec = getAmbientFilterSpec(firstScene.biome, firstScene.weather);
      const filter = ctx.createBiquadFilter();
      filter.type = spec.type;
      filter.frequency.value = spec.freq;
      const ambGain = ctx.createGain();
      ambGain.gain.value = spec.gain;
      src.connect(filter);
      filter.connect(ambGain);
      ambGain.connect(dest);
      src.start(startBase);
      src.stop(startBase + exportDurationSec + 0.1);
    }

    let cursor = 0;
    let step = 0;
    for (const sc of storyboard.scenes) {
      const scaledDur = Math.max(1.5, sc.durationSeconds * timeScale);
      const cfg = getMoodScale(sc.mood, sc.biome);
      const sceneStart = startBase + cursor;

      this.playActionCue(ctx, dest, sc, sceneStart);

      let local = 0;
      while (local < scaledDur) {
        const beatDur = Math.min(cfg.beatSec, scaledDur - local);
        const chord = cfg.chords[step % cfg.chords.length];
        this.chordStep = step;
        this.playChordSlice(ctx, dest, chord, cfg, sceneStart + local, beatDur);
        local += cfg.beatSec;
        step += 1;
      }

      cursor += scaledDur;
    }
  }
}
