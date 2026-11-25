import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Film,
  Loader2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  generateVeoVideo,
  generateVideoStoryboard,
  synthesizeSpeech,
} from '../utils/apiClient';
import {
  calculateAudioStagePercent,
  formatDurationMMSS,
  inferVideoFormatFromText,
  resolveExportDimensions,
  resolveTimelineFrame,
  sanitizeGeneratedScenes,
  validateVideoStoryboardQuality,
} from '../utils/nexoraLogic';
import { Motion2DEngine, type VideoEngineController } from '../utils/motion2DEngine';
import { ProceduralAudioEngine } from '../utils/proceduralAudioEngine';
import { ThreeVideoEngine } from '../utils/threeVideoEngine';
import type {
  AppLanguage,
  TtsProvider,
  VideoAnimationIntensity,
  VideoAspectRatio,
  VideoCameraOverride,
  VideoEngineMode,
  VideoFormatType,
  VideoFps,
  VideoResolution,
  VideoScene,
  VideoStoryboard,
  VideoVisualStyle,
  VoiceName,
} from '../types/nexora';

interface VideoStudioViewProps {
  language: AppLanguage;
  voiceName: VoiceName;
  ttsProvider?: TtsProvider;
  elevenLabsVoiceId?: string;
}

const VIDEO_TYPES: Array<{ id: VideoFormatType; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: '3d_animation', label: '3D Animated' },
  { id: '2d_motion', label: '2D Motion' },
  { id: 'whiteboard_explainer', label: 'Explainer' },
  { id: 'cinematic_story', label: 'Story' },
];

const DURATION_OPTIONS = [
  { label: '30 sec', seconds: 30 },
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
];

const VEO_DURATION_OPTIONS = [
  { label: '5 sec', seconds: 5 },
  { label: '8 sec', seconds: 8 },
  { label: '12 sec', seconds: 12 },
  { label: '15 sec', seconds: 15 },
];

const STYLES: VideoVisualStyle[] = [
  'Auto (AI Decides)',
  'Realistic 3D',
  'Cinematic 3D',
  '3D Cartoon / Pixar',
  'Anime 3D',
  'Educational 3D',
  'Gaming & Action',
  'Storybook 3D',
  'Space & Cosmos',
];

const CAMERA_OPTIONS: Array<{ value: VideoCameraOverride; label: string }> = [
  { value: 'auto', label: 'Auto Director' },
  { value: 'dolly-in', label: 'Dolly Push-In' },
  { value: 'tracking', label: 'Tracking Follow' },
  { value: 'orbit', label: '360 Orbit' },
  { value: 'low-angle', label: 'Low-Angle Hero' },
  { value: 'aerial', label: 'Aerial Flyover' },
  { value: 'first-person', label: 'First-Person POV' },
  { value: 'handheld', label: 'Handheld Action' },
  { value: 'zoom-sweep', label: 'Zoom Sweep' },
];

const INTENSITY_OPTIONS: Array<{ id: VideoAnimationIntensity; label: string }> = [
  { id: 'subtle', label: 'Subtle' },
  { id: 'dynamic', label: 'Dynamic' },
  { id: 'cinematic', label: 'Cinematic' },
];

const BASE_SAMPLE_SCENES: VideoScene[] = [
  {
    id: 's1',
    title: 'Chapter 1: Sunny Meadow Trail',
    narration:
      'As morning sunlight warms Willow Village, an explorer and a playful dog set off along the garden path.',
    subtitle: 'Morning sunlight warms the village trail as the journey begins.',
    keyPoints: ['Sunrise over Willow Village', 'Explorer & pup begin trail'],
    durationSeconds: 30,
    biome: 'forest',
    mood: 'daylight',
    weather: 'wind',
    cameraShot: 'orbit',
    cameraMotion: 'orbit',
    transition: 'crossfade',
    background: {
      topColor: '#0284C7',
      bottomColor: '#BAE6FD',
      accentColor: '#22C55E',
      atmosphere: 'minimal',
    },
    actors: [
      {
        id: 'explorer',
        role: 'human',
        color: '#2563EB',
        accentColor: '#F59E0B',
        action: 'walk',
        expression: 'happy',
        startPos: [-6, 1.2],
        endPos: [5, 0.5],
        scale: 1.08,
      },
      {
        id: 'pup',
        role: 'dog',
        color: '#D97706',
        accentColor: '#FEF3C7',
        action: 'run',
        expression: 'excited',
        startPos: [-4.2, 2.4],
        endPos: [6.4, 1.6],
        scale: 0.95,
      },
    ],
    props: [
      { kind: 'house', x: -6.5, z: -6.2, scale: 1.15, color: '#EA580C' },
      { kind: 'tree', x: 5.5, z: -5.2, scale: 1.25, color: '#16A34A' },
      { kind: 'tree', x: -9, z: 2.2, scale: 1.1, color: '#22C55E' },
      { kind: 'fountain', x: 1.2, z: -4.2, scale: 1.0, color: '#94A3B8' },
      { kind: 'flower', x: -2.4, z: 3.6, scale: 1.1, color: '#EC4899' },
      { kind: 'flower', x: 4.0, z: 3.4, scale: 1.0, color: '#F59E0B' },
    ],
    elements: [],
  },
  {
    id: 's2',
    title: 'Chapter 2: Downtown Avenue Sprint',
    narration:
      'Reaching the bustling city avenue, our explorer speeds forward while a crimson sports car and drone track alongside.',
    subtitle: 'Continuous tracking shot down the sunlit city avenue.',
    keyPoints: ['Continuous urban tracking shot', 'Aerial drone & cruiser in motion'],
    durationSeconds: 30,
    biome: 'city',
    mood: 'daylight',
    weather: 'clear',
    cameraShot: 'tracking',
    cameraMotion: 'pan-right',
    transition: 'crossfade',
    background: {
      topColor: '#0EA5E9',
      bottomColor: '#E0F2FE',
      accentColor: '#EF4444',
      atmosphere: 'minimal',
    },
    actors: [
      {
        id: 'explorer',
        role: 'human',
        color: '#2563EB',
        accentColor: '#F59E0B',
        action: 'run',
        expression: 'focused',
        startPos: [-7, 2.8],
        endPos: [6.5, 2.5],
        scale: 1.08,
      },
      {
        id: 'sports_car',
        role: 'car',
        color: '#EF4444',
        accentColor: '#F8FAFC',
        action: 'drive',
        expression: 'focused',
        startPos: [-10, -0.5],
        endPos: [9.5, -0.5],
        scale: 1.05,
      },
      {
        id: 'city_drone',
        role: 'drone',
        color: '#38BDF8',
        accentColor: '#F59E0B',
        action: 'fly',
        expression: 'neutral',
        startPos: [-8, -2.5],
        endPos: [7.5, -2.0],
        scale: 0.95,
      },
    ],
    props: [
      { kind: 'building', x: -8, z: -7, scale: 1.35, color: '#334155' },
      { kind: 'building', x: 0, z: -8, scale: 1.65, color: '#1E293B' },
      { kind: 'building', x: 8, z: -7, scale: 1.25, color: '#475569' },
      { kind: 'streetlamp', x: -5, z: -3.2, scale: 1.0, color: '#FDE047' },
      { kind: 'streetlamp', x: 5, z: -3.2, scale: 1.0, color: '#FDE047' },
      { kind: 'tree', x: -11.5, z: -4.5, scale: 0.95, color: '#22C55E' },
      { kind: 'tree', x: 11.5, z: -4.5, scale: 0.95, color: '#22C55E' },
    ],
    elements: [],
  },
  {
    id: 's3',
    title: 'Chapter 3: Discovery Workshop',
    narration:
      'Inside a warm classroom studio, our explorer and an AI companion robot collaborate on bold new blueprints.',
    subtitle: 'Inside the workshop, explorer and robot sketch new inventions.',
    keyPoints: ['Explorer & AI robot team up', 'Blueprints sketched on board'],
    durationSeconds: 30,
    biome: 'classroom',
    mood: 'cozy',
    weather: 'clear',
    cameraShot: 'dolly-in',
    cameraMotion: 'pan-left',
    transition: 'wipe',
    background: {
      topColor: '#E0F2FE',
      bottomColor: '#FEF3C7',
      accentColor: '#3B82F6',
      atmosphere: 'minimal',
    },
    actors: [
      {
        id: 'explorer',
        role: 'human',
        color: '#2563EB',
        accentColor: '#F59E0B',
        action: 'wave',
        expression: 'happy',
        startPos: [-3.8, 1.4],
        endPos: [0.6, 1.2],
        scale: 1.08,
      },
      {
        id: 'helper_bot',
        role: 'robot',
        color: '#06B6D4',
        accentColor: '#A855F7',
        action: 'dance',
        expression: 'excited',
        startPos: [3.4, 0.2],
        endPos: [1.0, 1.6],
        scale: 0.95,
      },
    ],
    props: [
      { kind: 'desk', x: -4.0, z: -2.5, scale: 1.0, color: '#B45309' },
      { kind: 'desk', x: 0, z: -2.5, scale: 1.0, color: '#B45309' },
      { kind: 'desk', x: 4.0, z: -2.5, scale: 1.0, color: '#B45309' },
      { kind: 'bookshelf', x: -7.2, z: -5.6, scale: 1.1, color: '#78350F' },
      { kind: 'bookshelf', x: 7.2, z: -5.6, scale: 1.1, color: '#78350F' },
    ],
    elements: [],
  },
  {
    id: 's4',
    title: 'Chapter 4: Golden Valley Finale',
    narration:
      'At sunset over an enchanted valley, our explorer activates the glowing archway while a friendly dragon glides overhead.',
    subtitle: 'At golden sunset, magic lights up the valley sky.',
    keyPoints: ['Archway awakens at dusk', 'Friendly dragon glides overhead'],
    durationSeconds: 30,
    biome: 'fantasy_kingdom',
    mood: 'golden_hour',
    weather: 'embers',
    cameraShot: 'aerial',
    cameraMotion: 'zoom-out',
    transition: 'crossfade',
    background: {
      topColor: '#4F46E5',
      bottomColor: '#FDE047',
      accentColor: '#A855F7',
      atmosphere: 'bokeh',
    },
    actors: [
      {
        id: 'explorer',
        role: 'human',
        color: '#2563EB',
        accentColor: '#F59E0B',
        action: 'jump',
        expression: 'excited',
        startPos: [-4.2, 1.5],
        endPos: [1.6, 0.4],
        scale: 1.08,
      },
      {
        id: 'sky_dragon',
        role: 'dragon',
        color: '#EF4444',
        accentColor: '#F59E0B',
        action: 'fly',
        expression: 'happy',
        startPos: [7.0, -3.5],
        endPos: [-6.0, -2.0],
        scale: 1.12,
      },
    ],
    props: [
      { kind: 'house', x: -7.0, z: -6.0, scale: 1.2, color: '#4338CA' },
      { kind: 'portal', x: 0, z: -6.5, scale: 1.35, color: '#A855F7' },
      { kind: 'tree', x: 7.0, z: -4.0, scale: 1.15, color: '#10B981' },
      { kind: 'chest', x: -2.4, z: 2.6, scale: 0.95, color: '#F59E0B' },
    ],
    elements: [],
  },
];

const SAMPLE_STORYBOARD: VideoStoryboard = (() => {
  const board: VideoStoryboard = {
    id: 'sample_village_adventure',
    title: 'Morning Adventure Across Living Worlds',
    videoType: '3d_animation',
    style: 'Auto (AI Decides)',
    aspectRatio: '16:9',
    totalDurationSeconds: 120,
    createdAt: Date.now(),
    scenes: BASE_SAMPLE_SCENES,
  };
  return {
    ...board,
    qualityReport: validateVideoStoryboardQuality(board),
  };
})();

function getFormatBadgeLabel(type: Exclude<VideoFormatType, 'auto'>): string {
  switch (type) {
    case '3d_animation':
      return '3D Cinema';
    case '2d_motion':
      return '2D Motion';
    case 'whiteboard_explainer':
      return 'Explainer';
    case 'cinematic_story':
      return 'Cinematic';
  }
}

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  language,
  voiceName,
  ttsProvider = 'gemini',
  elevenLabsVoiceId,
}) => {
  const [topic, setTopic] = useState('');
  const [engineMode, setEngineMode] = useState<VideoEngineMode>('nexora_cinema');
  const [videoType, setVideoType] = useState<VideoFormatType>('auto');
  const [durationSeconds, setDurationSeconds] = useState(120);
  const [veoDurationSeconds, setVeoDurationSeconds] = useState(8);
  const [style, setStyle] = useState<VideoVisualStyle>('Realistic 3D');
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [resolution, setResolution] = useState<VideoResolution>('720p');
  const [fps, setFps] = useState<VideoFps>(30);
  const [animationIntensity, setAnimationIntensity] =
    useState<VideoAnimationIntensity>('dynamic');
  const [cameraOverride, setCameraOverride] = useState<VideoCameraOverride>('auto');
  const [enableVoiceover, setEnableVoiceover] = useState(true);
  const [enableMusicAndSfx, setEnableMusicAndSfx] = useState(true);

  const [storyboard, setStoryboard] = useState<VideoStoryboard>(SAMPLE_STORYBOARD);
  const [veoVideoUrl, setVeoVideoUrl] = useState<string | null>(null);
  const [veoMimeType, setVeoMimeType] = useState<string>('video/mp4');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genPercent, setGenPercent] = useState(0);
  const [genStage, setGenStage] = useState('');
  const [genElapsed, setGenElapsed] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportPercent, setExportPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sceneAudioMap, setSceneAudioMap] = useState<Record<string, string>>({});

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VideoEngineController | null>(null);
  const audioEngineRef = useRef<ProceduralAudioEngine | null>(null);
  const lastAudioSceneRef = useRef<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  const ttsQuotaExhaustedRef = useRef(false);
  const veoUrlRef = useRef<string | null>(null);
  const currentTimeRef = useRef(0);
  const storyboardRef = useRef(storyboard);
  const isPlayingRef = useRef(isPlaying);

  currentTimeRef.current = currentTime;
  storyboardRef.current = storyboard;
  isPlayingRef.current = isPlaying;

  const activeEngineType = useMemo<Exclude<VideoFormatType, 'auto'>>(() => {
    if (videoType !== 'auto') return videoType;
    return storyboard.videoType || '3d_animation';
  }, [videoType, storyboard.videoType]);

  const exportDims = useMemo(
    () => resolveExportDimensions(aspectRatio, resolution),
    [aspectRatio, resolution]
  );

  // Lazy-initialize Procedural Audio Engine
  if (!audioEngineRef.current) {
    audioEngineRef.current = new ProceduralAudioEngine();
  }

  // Mount appropriate engine (Three.js 3D vs Motion2D/Whiteboard/Story) cleanly
  useEffect(() => {
    if (veoVideoUrl) {
      engineRef.current?.dispose();
      engineRef.current = null;
      return;
    }
    const mount = canvasMountRef.current;
    if (!mount) return;

    const handleAdvance = (nextTime: number, finished: boolean) => {
      setCurrentTime(nextTime);
      if (finished) {
        setIsPlaying(false);
      }
    };

    const engine: VideoEngineController =
      activeEngineType === '3d_animation'
        ? new ThreeVideoEngine(mount, handleAdvance)
        : new Motion2DEngine(mount, activeEngineType, handleAdvance);

    engineRef.current = engine;
    engine.setRenderOptions?.({
      cameraOverride,
      animationIntensity,
      visualStyle: style,
      aspectRatio,
      isSpeaking: isPlayingRef.current && enableVoiceover,
    });
    engine.syncTimeline(storyboardRef.current, currentTimeRef.current, isPlayingRef.current);

    const ro = new ResizeObserver(() => {
      engine.resize();
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, [activeEngineType, veoVideoUrl]);

  // Keep camera override, animation intensity, style, aspect ratio & lip-sync synchronized
  useEffect(() => {
    engineRef.current?.setRenderOptions?.({
      cameraOverride,
      animationIntensity,
      visualStyle: style,
      aspectRatio,
      isSpeaking: isPlaying && enableVoiceover,
    });
  }, [cameraOverride, animationIntensity, style, aspectRatio, isPlaying, enableVoiceover]);

  useEffect(() => {
    engineRef.current?.resize();
  }, [aspectRatio]);

  useEffect(() => {
    engineRef.current?.syncTimeline(storyboard, currentTime, isPlaying);
  }, [storyboard, currentTime, isPlaying]);

  const activeFrame = resolveTimelineFrame(storyboard, currentTime);

  // Sync Procedural BGM, Ambient Environment Audio & Transition SFX
  useEffect(() => {
    const audioEng = audioEngineRef.current;
    if (!audioEng) return;

    if (!isPlaying || !enableMusicAndSfx || Boolean(veoVideoUrl) || !activeFrame) {
      audioEng.stopLive();
      return;
    }

    audioEng.startLive(activeFrame.scene);
  }, [isPlaying, enableMusicAndSfx, veoVideoUrl, activeFrame?.scene.id]);

  // Sync voiceover audio to scene transitions (with clean Web Speech fallback)
  useEffect(() => {
    if (veoVideoUrl || !isPlaying || !enableVoiceover) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (!enableVoiceover) {
        lastAudioSceneRef.current = null;
      }
      return;
    }

    const frame = resolveTimelineFrame(storyboard, currentTime);
    if (!frame) return;

    const speakFallback = (text: string) => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.0;
        window.speechSynthesis.speak(utter);
      }
    };

    if (lastAudioSceneRef.current !== frame.scene.id) {
      lastAudioSceneRef.current = frame.scene.id;
      const audioSrc = sceneAudioMap[frame.scene.id];
      if (audioSrc) {
        if (activeAudioRef.current) activeAudioRef.current.pause();
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        const audio = new Audio(audioSrc);
        activeAudioRef.current = audio;
        audio.play().catch(() => speakFallback(frame.scene.narration));
      } else if (frame.scene.narration) {
        if (ttsQuotaExhaustedRef.current || storyboard.id.startsWith('sample_')) {
          speakFallback(frame.scene.narration);
        } else {
          synthesizeSpeech({ text: frame.scene.narration, voiceName })
            .then((res) => {
              const src = `data:${res.mimeType};base64,${res.audioBase64}`;
              setSceneAudioMap((prev) => ({ ...prev, [frame.scene.id]: src }));
              if (lastAudioSceneRef.current === frame.scene.id) {
                if (activeAudioRef.current) activeAudioRef.current.pause();
                const audio = new Audio(src);
                activeAudioRef.current = audio;
                audio.play().catch(() => speakFallback(frame.scene.narration));
              }
            })
            .catch((err) => {
              const msg = err instanceof Error ? err.message.toLowerCase() : '';
              if (msg.includes('quota') || msg.includes('429') || msg.includes('limit')) {
                ttsQuotaExhaustedRef.current = true;
              }
              if (lastAudioSceneRef.current === frame.scene.id) {
                speakFallback(frame.scene.narration);
              }
            });
        }
      }
    }
  }, [isPlaying, enableVoiceover, currentTime, storyboard, sceneAudioMap, voiceName, veoVideoUrl]);

  useEffect(() => {
    return () => {
      genAbortRef.current?.abort();
      audioEngineRef.current?.dispose();
      if (veoUrlRef.current) URL.revokeObjectURL(veoUrlRef.current);
      if (activeAudioRef.current) activeAudioRef.current.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const clearVeoClip = () => {
    if (veoUrlRef.current) {
      URL.revokeObjectURL(veoUrlRef.current);
      veoUrlRef.current = null;
    }
    setVeoVideoUrl(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    const MAX_GENERATION_MS = engineMode === 'veo_ai' ? 240_000 : 120_000;
    const startedAt = Date.now();
    const deadline = startedAt + MAX_GENERATION_MS;
    const resolvedType = inferVideoFormatFromText(topic, videoType);

    const controller = new AbortController();
    genAbortRef.current = controller;

    setIsGenerating(true);
    setGenPercent(4);
    setGenElapsed(0);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);

    if (engineMode === 'veo_ai') {
      setGenStage('Sending prompt to Veo Pixel AI (gemini-omni-1.2-flash)...');
      const veoTimer = window.setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
        setGenElapsed(elapsedSec);
        setGenPercent((prev) => (prev < 90 ? Math.min(90, prev + 2) : prev));
        if (Date.now() >= deadline) controller.abort();
      }, 1000);

      try {
        const res = await generateVeoVideo(
          {
            prompt: topic,
            durationSeconds: veoDurationSeconds,
            aspectRatio,
            resolution,
            style,
            cameraOverride,
          },
          controller.signal
        );

        const bin = atob(res.videoBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: res.mimeType || 'video/mp4' });
        const nextUrl = URL.createObjectURL(blob);
        clearVeoClip();
        veoUrlRef.current = nextUrl;
        setVeoMimeType(res.mimeType || 'video/mp4');
        setVeoVideoUrl(nextUrl);
        setGenPercent(100);
        setGenStage('Veo pixel video ready!');
      } catch (err) {
        const msg =
          (err as Error)?.name === 'AbortError'
            ? 'Veo video generation timed out. Please try again.'
            : err instanceof Error
              ? err.message
              : 'Veo pixel video generation failed.';
        setError(msg);
        setGenPercent(0);
        setGenStage('');
      } finally {
        window.clearInterval(veoTimer);
        genAbortRef.current = null;
        setIsGenerating(false);
      }
      return;
    }

    // Real-time NEXORA 3D/2D Cinema Engine generation flow
    clearVeoClip();
    setGenStage(
      resolvedType === 'whiteboard_explainer'
        ? 'Drafting whiteboard explainer diagrams & motion cues...'
        : resolvedType === '2d_motion'
          ? 'Composing 2D parallax motion scenes & callouts...'
          : resolvedType === 'cinematic_story'
            ? 'Staging cinematic lighting, chapters & camera shots...'
            : 'Directing 3D world, articulated actors & camera shots...'
    );

    const progressTimer = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      setGenElapsed(elapsedSec);
      setGenPercent((prev) => (prev < 45 ? Math.min(45, prev + 2) : prev));
      if (Date.now() >= deadline) {
        controller.abort();
      }
    }, 600);

    try {
      const storyboardTimeout = window.setTimeout(() => controller.abort(), 75_000);
      let generated: { title: string; videoType?: VideoFormatType; scenes: VideoScene[] };
      try {
        generated = await generateVideoStoryboard(
          {
            topic,
            durationSeconds,
            videoType: resolvedType,
            style,
            aspectRatio,
            language,
            animationIntensity,
            cameraOverride,
          },
          controller.signal
        );
      } finally {
        window.clearTimeout(storyboardTimeout);
      }

      const normalizedScenes = sanitizeGeneratedScenes(
        generated.scenes || [],
        durationSeconds,
        topic,
        style
      );
      if (normalizedScenes.length === 0) {
        throw new Error('Could not generate scenes for this topic. Please try a clearer prompt.');
      }

      const total = normalizedScenes.reduce((s, sc) => s + sc.durationSeconds, 0);
      const draftBoard: VideoStoryboard = {
        id: `vid_${Date.now()}`,
        title: generated.title || topic.trim(),
        videoType: resolvedType,
        style,
        aspectRatio,
        totalDurationSeconds: total,
        createdAt: Date.now(),
        scenes: normalizedScenes,
      };
      const qualityReport = validateVideoStoryboardQuality(draftBoard);
      const nextBoard: VideoStoryboard = { ...draftBoard, qualityReport };

      setStoryboard(nextBoard);
      setSceneAudioMap({});
      lastAudioSceneRef.current = null;
      setGenPercent(50);

      if (enableVoiceover) {
        const audioResults: Record<string, string> = {};
        for (let i = 0; i < normalizedScenes.length; i++) {
          const remainingMs = deadline - Date.now();
          if (remainingMs <= 4000) {
            break;
          }
          const sc = normalizedScenes[i];
          setGenStage(
            `Synthesizing AI voiceover (Scene ${i + 1} of ${normalizedScenes.length})...`
          );
          try {
            const ttsController = new AbortController();
            const ttsTimer = window.setTimeout(
              () => ttsController.abort(),
              Math.min(20_000, remainingMs - 1000)
            );
            try {
              const res = await synthesizeSpeech(
                {
                  text: sc.narration,
                  voiceName,
                  provider: ttsProvider,
                  elevenLabsVoiceId,
                },
                ttsController.signal
              );
              audioResults[sc.id] = `data:${res.mimeType};base64,${res.audioBase64}`;
            } finally {
              window.clearTimeout(ttsTimer);
            }
          } catch (ttsErr) {
            const ttsMsg = ttsErr instanceof Error ? ttsErr.message.toLowerCase() : '';
            if (
              ttsMsg.includes('quota') ||
              ttsMsg.includes('429') ||
              ttsMsg.includes('limit') ||
              ttsMsg.includes('secrets')
            ) {
              ttsQuotaExhaustedRef.current = true;
              setGenPercent(95);
              break;
            }
          }
          setGenPercent(calculateAudioStagePercent(i + 1, normalizedScenes.length));
        }
        setSceneAudioMap(audioResults);
      } else {
        setGenStage('Running motion QC & building final timeline...');
        setGenPercent(75);
        await new Promise((r) => setTimeout(r, 180));
        setGenPercent(95);
        await new Promise((r) => setTimeout(r, 150));
      }

      setGenStage('Video ready!');
      setGenPercent(100);
      setCurrentTime(0);
      setIsPlaying(true);
    } catch (err) {
      const msg =
        (err as Error)?.name === 'AbortError'
          ? 'Video generation reached the 2-minute limit. Please try a shorter topic or retry.'
          : err instanceof Error
            ? err.message
            : 'Failed to create animated video.';
      setError(msg);
      setGenPercent(0);
      setGenStage('');
    } finally {
      window.clearInterval(progressTimer);
      genAbortRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleDownloadVeoMp4 = () => {
    if (!veoVideoUrl) return;
    const ext = veoMimeType.includes('webm') ? 'webm' : 'mp4';
    const a = document.createElement('a');
    a.href = veoVideoUrl;
    a.download = `${(topic || 'nexora-veo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`;
    a.click();
  };

  const handleExportWebM = async () => {
    if (veoVideoUrl) {
      handleDownloadVeoMp4();
      return;
    }

    const engine = engineRef.current;
    if (!engine || typeof MediaRecorder === 'undefined') {
      setError('Video export via MediaRecorder is not supported in this browser.');
      return;
    }

    setIsExporting(true);
    setExportPercent(0);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportDims.width;
    exportCanvas.height = exportDims.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) {
      setIsExporting(false);
      setError('Could not initialize export buffer.');
      return;
    }

    engine.setRenderOptions?.({
      cameraOverride,
      animationIntensity,
      visualStyle: style,
      aspectRatio,
      isSpeaking: enableVoiceover,
    });

    const canvasStream = exportCanvas.captureStream(fps);
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    const exportDuration = Math.min(storyboard.totalDurationSeconds, 30);
    const totalStoryboardSec = Math.max(1, storyboard.totalDurationSeconds);
    const timeScale = exportDuration / totalStoryboardSec;

    let audioCtx: AudioContext | null = null;
    const shouldIncludeAudio =
      (enableVoiceover && Object.keys(sceneAudioMap).length > 0) || enableMusicAndSfx;

    if (shouldIncludeAudio && typeof AudioContext !== 'undefined') {
      try {
        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        let hasAudioTrack = false;

        if (enableMusicAndSfx && audioEngineRef.current) {
          audioEngineRef.current.scheduleExportSoundtrack(
            audioCtx,
            dest,
            storyboard,
            exportDuration
          );
          hasAudioTrack = true;
        }

        if (enableVoiceover && Object.keys(sceneAudioMap).length > 0) {
          let offset = 0;
          for (const sc of storyboard.scenes) {
            const src = sceneAudioMap[sc.id];
            if (src) {
              try {
                const resp = await fetch(src);
                const arrBuf = await resp.arrayBuffer();
                const decoded = await audioCtx.decodeAudioData(arrBuf);
                const bufferSource = audioCtx.createBufferSource();
                bufferSource.buffer = decoded;
                bufferSource.connect(dest);
                bufferSource.start(audioCtx.currentTime + offset * timeScale);
                hasAudioTrack = true;
              } catch {
                // skip broken audio slice
              }
            }
            offset += sc.durationSeconds;
          }
        }

        if (hasAudioTrack) {
          tracks.push(...dest.stream.getAudioTracks());
        }
      } catch {
        // Video-only WebM fallback if AudioContext fails
      }
    }

    const mixedStream = new MediaStream(tracks);
    const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(mixedStream, { mimeType: preferredMime });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    };

    recorder.onstop = () => {
      mixedStream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${storyboard.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'nexora-video'}-${resolution}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setExportPercent(100);
      setIsExporting(false);
    };

    try {
      recorder.start();
      const totalFrames = Math.max(fps, Math.round(exportDuration * fps));
      const stepSeconds = storyboard.totalDurationSeconds / totalFrames;

      for (let f = 0; f < totalFrames; f++) {
        engine.captureCompositeFrame(
          exportCtx,
          exportDims.width,
          exportDims.height,
          storyboard,
          f * stepSeconds
        );
        if (f % Math.max(4, Math.floor(fps / 5)) === 0 || f === totalFrames - 1) {
          setExportPercent(Math.round(((f + 1) / totalFrames) * 100));
        }
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      recorder.stop();
    } catch (exportErr) {
      mixedStream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
      setIsExporting(false);
      setError(exportErr instanceof Error ? exportErr.message : 'Video export failed.');
    }
  };

  const qcReport = storyboard.qualityReport;
  const activeCameraDisplay =
    cameraOverride !== 'auto'
      ? cameraOverride
      : activeFrame?.scene.cameraShot || 'orbit';

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              AI Video Studio
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Continuous 3D/2D cinematic animation with dynamic cameras, weather physics, lip-sync & optional Veo pixel generation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://labs.google/fx/tools/flow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <span>Open Google Flow</span>
              <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
            </a>
            <button
              type="button"
              onClick={() => {
                clearVeoClip();
                setStoryboard(SAMPLE_STORYBOARD);
                setCurrentTime(0);
                setIsPlaying(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Load Sample Story</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Controls */}
          <form
            onSubmit={handleGenerate}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726] lg:col-span-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Generation Engine
              </label>
              <div
                role="group"
                aria-label="Video engine mode"
                className="mt-1.5 grid grid-cols-2 gap-1.5"
              >
                <button
                  type="button"
                  aria-pressed={engineMode === 'nexora_cinema'}
                  onClick={() => setEngineMode('nexora_cinema')}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    engineMode === 'nexora_cinema'
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`}
                >
                  NEXORA 3D Cinema
                </button>
                <button
                  type="button"
                  aria-pressed={engineMode === 'veo_ai'}
                  onClick={() => setEngineMode('veo_ai')}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    engineMode === 'veo_ai'
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`}
                >
                  Veo Pixel AI
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {engineMode === 'veo_ai'
                  ? 'Uses gemini-omni-1.2-flash (native MP4, requires billing-enabled Gemini API key).'
                  : 'Uses gemini-4-hydrogen story direction + real-time 3D/2D physics & audio.'}
              </p>
            </div>

            <div>
              <label
                htmlFor="video-topic"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Video Topic or Story Script
              </label>
              <textarea
                id="video-topic"
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., A young detective races through rainy neon streets tracking a glowing drone..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {engineMode === 'nexora_cinema' && (
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Video Type
                </label>
                <div
                  role="group"
                  aria-label="Video format type"
                  className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3"
                >
                  {VIDEO_TYPES.map((vt) => {
                    const selected = videoType === vt.id;
                    return (
                      <button
                        key={vt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setVideoType(vt.id);
                          if (vt.id !== 'auto') {
                            setStoryboard((prev) => ({
                              ...prev,
                              videoType: vt.id as Exclude<VideoFormatType, 'auto'>,
                            }));
                          }
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          selected
                            ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-cyan-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        {vt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Video Duration
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(engineMode === 'veo_ai' ? VEO_DURATION_OPTIONS : DURATION_OPTIONS).map((opt) => {
                  const selected =
                    engineMode === 'veo_ai'
                      ? veoDurationSeconds === opt.seconds
                      : durationSeconds === opt.seconds;
                  return (
                    <button
                      key={opt.seconds}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        engineMode === 'veo_ai'
                          ? setVeoDurationSeconds(opt.seconds)
                          : setDurationSeconds(opt.seconds)
                      }
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        selected
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-cyan-300'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="video-style"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Visual Style
                </label>
                <select
                  id="video-style"
                  value={style}
                  onChange={(e) => setStyle(e.target.value as VideoVisualStyle)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  {STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="video-ratio"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Aspect Ratio
                </label>
                <select
                  id="video-ratio"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as VideoAspectRatio)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Vertical</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="video-resolution"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Resolution
                </label>
                <select
                  id="video-resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as VideoResolution)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="540p">540p SD</option>
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="video-fps"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Frame Rate (FPS)
                </label>
                <select
                  id="video-fps"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value) as VideoFps)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value={24}>24 FPS Cinema</option>
                  <option value={30}>30 FPS Smooth</option>
                  <option value={60}>60 FPS Action</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="video-camera"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Camera Movement
                </label>
                <select
                  id="video-camera"
                  value={cameraOverride}
                  onChange={(e) => setCameraOverride(e.target.value as VideoCameraOverride)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  {CAMERA_OPTIONS.map((cam) => (
                    <option key={cam.value} value={cam.value}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Motion Intensity
                </label>
                <div
                  role="group"
                  aria-label="Animation intensity"
                  className="mt-1 grid grid-cols-3 gap-1.5"
                >
                  {INTENSITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={animationIntensity === opt.id}
                      onClick={() => setAnimationIntensity(opt.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        animationIntensity === opt.id
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-cyan-300'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {engineMode === 'nexora_cinema' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Voiceover + Lip-Sync ({ttsProvider === 'elevenlabs' ? 'ElevenLabs' : voiceName})
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnableVoiceover((v) => !v)}
                    aria-label="Toggle AI voiceover"
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      enableVoiceover
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {enableVoiceover ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    BGM, Ambience & SFX
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnableMusicAndSfx((v) => !v)}
                    aria-label="Toggle background music and SFX"
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      enableMusicAndSfx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {enableMusicAndSfx ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            )}

            {(isGenerating || genPercent === 100) && (
              <div
                aria-live="polite"
                className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/90"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {genStage}
                  </span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-cyan-400 tabular-nums shrink-0">
                    {genPercent}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Video generation progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={genPercent}
                  className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${genPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>
                    {enableVoiceover || enableMusicAndSfx ? 'Audio: On' : 'Audio: Off'}
                  </span>
                  <span>
                    {formatDurationMMSS(genElapsed)} / {engineMode === 'veo_ai' ? '04:00' : '02:00'} max
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!topic.trim() || isGenerating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-45"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating ({genPercent}%)...</span>
                </>
              ) : (
                <>
                  <Film className="h-4 w-4" />
                  <span>
                    {engineMode === 'veo_ai' ? 'Generate Veo Video' : 'Generate Video'}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Player & Timeline */}
          <div className="space-y-4 lg:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#090D16] dark:border-slate-800">
              <div className="relative flex items-center justify-center bg-[#060911] p-2">
                {veoVideoUrl ? (
                  <video
                    src={veoVideoUrl}
                    controls
                    autoPlay
                    playsInline
                    className={`rounded-xl bg-black object-contain ${
                      aspectRatio === '16:9'
                        ? 'w-full aspect-video'
                        : aspectRatio === '1:1'
                          ? 'h-[420px] max-w-full aspect-square'
                          : 'h-[420px] max-w-full aspect-[9/16]'
                    }`}
                  />
                ) : (
                  <div
                    ref={canvasMountRef}
                    data-video-type={activeEngineType}
                    data-biome={activeFrame?.scene.biome || 'forest'}
                    data-camera={activeCameraDisplay}
                    data-playing={isPlaying ? 'true' : 'false'}
                    className={`overflow-hidden rounded-xl ${
                      aspectRatio === '16:9'
                        ? 'w-full aspect-video'
                        : aspectRatio === '1:1'
                          ? 'h-[420px] max-w-full aspect-square'
                          : 'h-[420px] max-w-full aspect-[9/16]'
                    }`}
                  />
                )}

                {!veoVideoUrl && activeFrame && !isGenerating && (
                  <>
                    <div className="pointer-events-none absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-[#090D16]/85 px-2.5 py-1 font-display text-xs font-semibold text-white border border-white/10 truncate max-w-[60%]">
                        {activeFrame.scene.title}
                      </span>
                      <span className="rounded-lg bg-[#090D16]/85 px-2.5 py-1 text-[11px] font-medium text-cyan-300 border border-white/10 shrink-0 whitespace-nowrap">
                        {getFormatBadgeLabel(activeEngineType)} · {activeFrame.scene.biome.replace('_', ' ')} · {activeCameraDisplay}
                      </span>
                    </div>

                    {(activeFrame.scene.subtitle || activeFrame.scene.narration) && (
                      <div className="pointer-events-none absolute bottom-3.5 left-4 right-4 flex justify-center">
                        <div className="max-w-2xl rounded-xl bg-[#090D16]/88 px-3.5 py-1.5 text-center text-xs sm:text-sm font-medium text-slate-100 border border-white/10 shadow-md">
                          {activeFrame.scene.subtitle || activeFrame.scene.narration}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {isGenerating && (
                  <div className="absolute inset-2 flex flex-col items-center justify-center rounded-xl bg-[#060911]/90 p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                    <p className="mt-3 font-display text-base font-semibold text-white">
                      {genStage}
                    </p>
                    <div className="mt-3 h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 transition-all duration-300"
                        style={{ width: `${genPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 font-mono text-xs text-cyan-300 tabular-nums">
                      {genPercent}% · {formatDurationMMSS(genElapsed)} /{' '}
                      {engineMode === 'veo_ai' ? '04:00' : '02:00'} max
                    </p>
                  </div>
                )}
              </div>

              {/* Player Controls */}
              <div className="space-y-3 border-t border-slate-800 bg-[#0D1321] p-4 text-slate-200">
                {!veoVideoUrl && (
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={storyboard.totalDurationSeconds}
                      step={0.5}
                      value={currentTime}
                      aria-label="Seek video timeline"
                      onChange={(e) => setCurrentTime(Number(e.target.value))}
                      className="h-1.5 flex-1 accent-cyan-400 cursor-pointer"
                    />
                    <span className="font-mono text-xs tabular-nums text-slate-300 whitespace-nowrap">
                      {formatDurationMMSS(currentTime)} / {formatDurationMMSS(storyboard.totalDurationSeconds)}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {!veoVideoUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !isPlaying &&
                              currentTime >= storyboard.totalDurationSeconds - 0.15
                            ) {
                              setCurrentTime(0);
                            }
                            setIsPlaying((p) => !p);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 whitespace-nowrap"
                        >
                          {isPlaying ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          <span>{isPlaying ? 'Pause' : 'Play'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPlaying(false);
                            setCurrentTime(0);
                          }}
                          aria-label="Restart video"
                          className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnableVoiceover((v) => !v)}
                          aria-label="Mute or unmute narration"
                          title="Narration & Lip-Sync"
                          className={`rounded-xl border p-2 ${
                            enableVoiceover
                              ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                              : 'border-slate-800 text-slate-500 hover:bg-slate-800'
                          }`}
                        >
                          {enableVoiceover ? (
                            <Volume2 className="h-3.5 w-3.5" />
                          ) : (
                            <VolumeX className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnableMusicAndSfx((v) => !v)}
                          aria-label="Mute or unmute music and SFX"
                          title="Music, Ambience & SFX"
                          className={`rounded-xl border p-2 ${
                            enableMusicAndSfx
                              ? 'border-slate-700 text-cyan-300 hover:bg-slate-800'
                              : 'border-slate-800 text-slate-500 hover:bg-slate-800'
                          }`}
                        >
                          <Music className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={clearVeoClip}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Return to 3D Cinema Timeline</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleExportWebM}
                    disabled={isExporting || isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {isExporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {veoVideoUrl
                        ? 'Download Veo Video (.mp4)'
                        : isExporting
                          ? `Rendering ${resolution} (${exportPercent}%)...`
                          : `Export ${resolution} ${fps}fps (.webm)`}
                    </span>
                  </button>
                </div>
                {isExporting && (
                  <div
                    role="progressbar"
                    aria-label="Video export progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={exportPercent}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
                  >
                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all duration-150"
                      style={{ width: `${exportPercent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Scene Timeline Strip */}
            {!veoVideoUrl && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#101726]">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                      {storyboard.title}
                    </h2>
                    {qcReport?.passed && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Motion QC Verified</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {getFormatBadgeLabel(activeEngineType)} · {resolution} {fps}fps · {storyboard.scenes.length} scenes · {formatDurationMMSS(storyboard.totalDurationSeconds)}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {storyboard.scenes.map((scene: VideoScene, idx: number) => {
                    const startOffset = storyboard.scenes
                      .slice(0, idx)
                      .reduce((sum, s) => sum + s.durationSeconds, 0);
                    const isCurrent = activeFrame?.sceneIndex === idx;
                    return (
                      <button
                        key={scene.id}
                        type="button"
                        onClick={() => {
                          setCurrentTime(startOffset + 0.1);
                        }}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          isCurrent
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {scene.title}
                          </span>
                          <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                            {scene.cameraShot} · {scene.durationSeconds}s
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                          {scene.narration}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
