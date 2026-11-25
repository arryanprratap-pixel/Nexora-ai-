import type {
  AiModelSpec,
  AppLanguage,
  ChatMessage,
  ChatSession,
  ElevenLabsVoice,
  PhotoRemixRecipe,
  ResponseStyle,
  UserSettings,
  VideoActorAction,
  VideoActorExpression,
  VideoActorRole,
  VideoActorSpec,
  VideoAnimationIntensity,
  VideoAspectRatio,
  VideoBiome,
  VideoCameraShot,
  VideoFormatType,
  VideoMood,
  VideoPropKind,
  VideoPropSpec,
  VideoQualityReport,
  VideoResolution,
  VideoScene,
  VideoStoryboard,
  VideoVisualStyle,
  VideoWeatherType,
  TtsDialogueTurn,
  VoiceName,
} from '../types/nexora';

export const DEFAULT_AVATAR_URL = '/src/assets/images/nexora_user_avatar_1795255250913.jpg';
export const NEXORA_EMBLEM_URL = '/src/assets/images/nexora_core_emblem_1795255251394.jpg';

export const DEFAULT_MODEL_ID = 'gemini-4-hydrogen';

export const AI_MODEL_CATALOG: AiModelSpec[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    provider: 'gemini',
    providerName: 'Google Gemini',
    tagline: 'Fast multimodal reasoning',
    supportsVision: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    provider: 'gemini',
    providerName: 'Google Gemini',
    tagline: 'Ultra-low latency responses',
    supportsVision: true,
  },
  {
    id: 'gpt-4o',
    label: 'ChatGPT GPT-4o',
    provider: 'openai',
    providerName: 'OpenAI ChatGPT',
    tagline: 'Flagship omni model',
    supportsVision: true,
  },
  {
    id: 'gpt-4o-mini',
    label: 'ChatGPT GPT-4o Mini',
    provider: 'openai',
    providerName: 'OpenAI ChatGPT',
    tagline: 'Fast everyday GPT',
    supportsVision: true,
  },
  {
    id: 'o3-mini',
    label: 'OpenAI o3-mini',
    provider: 'openai',
    providerName: 'OpenAI ChatGPT',
    tagline: 'STEM & coding reasoning',
    supportsVision: false,
  },
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    provider: 'anthropic',
    providerName: 'Anthropic Claude',
    tagline: 'Coding & nuanced writing',
    supportsVision: true,
  },
  {
    id: 'claude-3-5-haiku-latest',
    label: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    providerName: 'Anthropic Claude',
    tagline: 'Instant conversational Claude',
    supportsVision: true,
  },
  {
    id: 'deepseek-chat',
    label: 'DeepSeek V3',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    tagline: 'High-efficiency general & code AI',
    supportsVision: false,
  },
  {
    id: 'deepseek-reasoner',
    label: 'DeepSeek R1',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    tagline: 'Deep step-by-step reasoning',
    supportsVision: false,
  },
  {
    id: 'x-ai/grok-3-mini',
    label: 'xAI Grok 3 Mini',
    provider: 'openrouter',
    providerName: 'OpenRouter Hub',
    tagline: 'Grok via OpenRouter',
    supportsVision: false,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Meta Llama 3.3 70B',
    provider: 'openrouter',
    providerName: 'OpenRouter Hub',
    tagline: 'Open-weights Llama via OpenRouter',
    supportsVision: false,
  },
  {
    id: 'mistralai/mistral-large-2411',
    label: 'Mistral Large',
    provider: 'openrouter',
    providerName: 'OpenRouter Hub',
    tagline: 'Mistral flagship via OpenRouter',
    supportsVision: false,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    label: 'Qwen 2.5 72B',
    provider: 'openrouter',
    providerName: 'OpenRouter Hub',
    tagline: 'Alibaba Qwen via OpenRouter',
    supportsVision: false,
  },
];

export function getModelSpec(modelId?: string): AiModelSpec {
  return AI_MODEL_CATALOG.find((m) => m.id === modelId) || AI_MODEL_CATALOG[0];
}

export const ELEVENLABS_PRESET_VOICES: ElevenLabsVoice[] = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'premade', description: 'Warm, calm, expressive narration' },
  { voice_id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew', category: 'premade', description: 'Clear, balanced, well-rounded' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'premade', description: 'Soft, articulate, friendly' },
  { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'premade', description: 'Crisp, upbeat, conversational' },
  { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'premade', description: 'Deep, confident, storytelling' },
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'premade', description: 'Deep, authoritative, cinematic' },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'premade', description: 'Energetic, bold, expressive' },
  { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'premade', description: 'Bright, youthful, clear' },
];

export const DEFAULT_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  language: 'English',
  responseStyle: 'Balanced',
  voiceName: 'Kore',
  ttsProvider: 'gemini',
  elevenLabsVoiceId: DEFAULT_ELEVENLABS_VOICE_ID,
  selectedModelId: DEFAULT_MODEL_ID,
  profile: {
    name: 'Explorer',
    role: 'Creator & Learner',
    avatarUrl: DEFAULT_AVATAR_URL,
  },
};

export function createChatSession(initialTitle = 'New conversation'): ChatSession {
  const now = Date.now();
  return {
    id: `chat_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: initialTitle,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function deriveSessionTitle(prompt: string, fallback = 'New conversation'): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= 46) return cleaned;
  return `${cleaned.slice(0, 43).trimEnd()}...`;
}

export function appendMessageToSession(
  session: ChatSession,
  message: ChatMessage
): ChatSession {
  const isFirstUserMessage =
    session.messages.length === 0 && message.role === 'user';
  return {
    ...session,
    title: isFirstUserMessage ? deriveSessionTitle(message.content) : session.title,
    updatedAt: message.createdAt,
    messages: [...session.messages, message],
  };
}

export function updateLastAssistantMessage(
  session: ChatSession,
  messageId: string,
  content: string,
  isError = false
): ChatSession {
  return {
    ...session,
    updatedAt: Date.now(),
    messages: session.messages.map((m) =>
      m.id === messageId ? { ...m, content, error: isError } : m
    ),
  };
}

export function buildSystemPrompt(
  language: AppLanguage,
  responseStyle: ResponseStyle
): string {
  const languageDirective =
    language === 'Hindi'
      ? 'Respond primarily in clear, natural Hindi (Devanagari script) unless code or technical identifiers require English.'
      : language === 'Hinglish'
        ? 'Respond in natural, friendly Hinglish (Hindi written in Roman script mixed smoothly with English technical terms).'
        : 'Respond in clear, natural English. If the user writes in Hindi or Hinglish, match their language naturally.';

  const styleDirective: Record<ResponseStyle, string> = {
    Balanced: 'Be clear, well-structured, accurate, and approachable.',
    'Simple & Easy':
      'Explain concepts in very simple everyday language with intuitive analogies and step-by-step clarity.',
    'Detailed & Technical':
      'Provide thorough technical depth, edge cases, formulas, and structured breakdowns.',
    Concise: 'Keep explanations crisp, direct, and scannable without fluff.',
    'Friendly Tutor':
      'Act like a patient, encouraging mentor who checks understanding and breaks difficult concepts into small steps.',
  };

  return `You are NEXORA AI, a next-generation intelligent assistant. ${languageDirective} ${styleDirective[responseStyle]} Format responses with clean Markdown and fenced code blocks with language tags when showing code.`;
}

export function normalizeStoryboardDurations(
  scenes: VideoScene[],
  targetTotalSeconds: number
): VideoScene[] {
  if (scenes.length === 0) return [];
  const safeTarget = Math.max(10, targetTotalSeconds);
  const rawTotal = scenes.reduce(
    (sum, s) => sum + (Number.isFinite(s.durationSeconds) && s.durationSeconds > 0 ? s.durationSeconds : 10),
    0
  );
  const factor = safeTarget / rawTotal;
  let accumulated = 0;

  return scenes.map((scene, index) => {
    const base =
      Number.isFinite(scene.durationSeconds) && scene.durationSeconds > 0
        ? scene.durationSeconds
        : 10;
    if (index === scenes.length - 1) {
      const remaining = Math.max(3, Math.round(safeTarget - accumulated));
      return { ...scene, durationSeconds: remaining };
    }
    const scaled = Math.max(3, Math.round(base * factor));
    accumulated += scaled;
    return { ...scene, durationSeconds: scaled };
  });
}

export interface TimelineFrameState {
  sceneIndex: number;
  scene: VideoScene;
  sceneElapsed: number;
  sceneProgress: number; // 0..1
  totalDuration: number;
  globalProgress: number; // 0..1
}

export function resolveTimelineFrame(
  storyboard: VideoStoryboard,
  currentTimeSeconds: number
): TimelineFrameState | null {
  if (!storyboard.scenes.length) return null;

  const totalDuration = storyboard.scenes.reduce(
    (sum, s) => sum + Math.max(1, s.durationSeconds),
    0
  );
  const clamped = Math.max(0, Math.min(currentTimeSeconds, totalDuration));

  let cursor = 0;
  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    const dur = Math.max(1, scene.durationSeconds);
    if (clamped < cursor + dur || i === storyboard.scenes.length - 1) {
      const sceneElapsed = Math.max(0, Math.min(dur, clamped - cursor));
      return {
        sceneIndex: i,
        scene,
        sceneElapsed,
        sceneProgress: Math.min(1, sceneElapsed / dur),
        totalDuration,
        globalProgress: totalDuration > 0 ? clamped / totalDuration : 0,
      };
    }
    cursor += dur;
  }

  return null;
}

export function formatDurationMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function resolveImageExportSize(
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | string
): [number, number] {
  switch (aspectRatio) {
    case '16:9':
      return [1280, 720];
    case '9:16':
      return [720, 1280];
    case '4:3':
      return [1024, 768];
    case '1:1':
    default:
      return [1024, 1024];
  }
}

export function sanitizeSvgMarkup(
  rawSvg: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' = '1:1'
): string {
  const unwrapped = (rawSvg || '')
    .trim()
    .replace(/^```(?:svg|xml|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .trim();

  const svgMatch = unwrapped.match(/<svg[\s\S]*<\/svg>/i);
  const candidate = svgMatch ? svgMatch[0] : unwrapped;

  const withoutScripts = candidate
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');

  if (!withoutScripts.includes('<svg') || !withoutScripts.includes('</svg>')) {
    const [w, h] = resolveImageExportSize(aspectRatio);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#0f172a"/><text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="22">Unable to parse SVG artwork</text></svg>`;
  }

  if (!/viewBox\s*=/i.test(withoutScripts)) {
    const [w, h] = resolveImageExportSize(aspectRatio);
    return withoutScripts.replace(/<svg\b/i, `<svg viewBox="0 0 ${w} ${h}"`);
  }
  return withoutScripts;
}

const VALID_BLEND_MODES = new Set<PhotoRemixRecipe['blendMode']>([
  'screen',
  'overlay',
  'soft-light',
  'color',
  'multiply',
]);

const VALID_PARTICLES = new Set<PhotoRemixRecipe['particleEffect']>([
  'none',
  'rain',
  'neon-sparks',
  'bokeh',
  'sunbeams',
  'grain',
]);

const VALID_EDGE_STYLES = new Set<PhotoRemixRecipe['edgeStyle']>([
  'natural',
  'cyber-scan',
  'comic-ink',
  'dream-glow',
  'film-noir',
]);

function clampNum(val: unknown, fallback: number, min: number, max: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function safeHexColor(val: unknown, fallback: string): string {
  if (typeof val === 'string' && /^#[0-9a-f]{3,8}$/i.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

export function buildDefaultPhotoRemixRecipe(prompt: string, style: string): PhotoRemixRecipe {
  const lower = `${prompt} ${style}`.toLowerCase();
  if (/cyber|neon|night|rain|synth/.test(lower)) {
    return {
      title: prompt.trim().slice(0, 46) || 'Neon Cyber Remix',
      brightness: 1.04,
      contrast: 1.24,
      saturate: 1.45,
      hueRotate: -8,
      sepia: 0,
      bloom: 0.34,
      vignette: 0.45,
      tintTopColor: '#06B6D4',
      tintBottomColor: '#EC4899',
      tintOpacity: 0.28,
      blendMode: 'screen',
      particleEffect: /rain/.test(lower) ? 'rain' : 'neon-sparks',
      edgeStyle: 'cyber-scan',
      palette: ['#06B6D4', '#EC4899', '#6366F1', '#0F172A'],
      artDirectionNotes: 'High-contrast cyan/magenta cyberpunk color grade with atmospheric glow.',
    };
  }
  if (/anime|cel|cartoon|comic/.test(lower)) {
    return {
      title: prompt.trim().slice(0, 46) || 'Anime Cel Remix',
      brightness: 1.08,
      contrast: 1.32,
      saturate: 1.55,
      hueRotate: 4,
      sepia: 0,
      bloom: 0.28,
      vignette: 0.25,
      tintTopColor: '#38BDF8',
      tintBottomColor: '#F472B6',
      tintOpacity: 0.22,
      blendMode: 'soft-light',
      particleEffect: 'bokeh',
      edgeStyle: 'comic-ink',
      palette: ['#38BDF8', '#F472B6', '#FBBF24', '#1E293B'],
      artDirectionNotes: 'Vibrant cel-shaded saturation boost with luminous highlights and dreamy bokeh.',
    };
  }
  if (/noir|vintage|watercolor|sketch|retro/.test(lower)) {
    return {
      title: prompt.trim().slice(0, 46) || 'Editorial Film Remix',
      brightness: 1.02,
      contrast: 1.25,
      saturate: /noir/.test(lower) ? 0.25 : 0.92,
      hueRotate: 0,
      sepia: /noir/.test(lower) ? 0.15 : 0.38,
      bloom: 0.16,
      vignette: 0.55,
      tintTopColor: '#F59E0B',
      tintBottomColor: '#1E293B',
      tintOpacity: 0.24,
      blendMode: 'overlay',
      particleEffect: 'grain',
      edgeStyle: /noir/.test(lower) ? 'film-noir' : 'dream-glow',
      palette: ['#F59E0B', '#D97706', '#475569', '#0F172A'],
      artDirectionNotes: 'Warm analog grain, sculpted shadows, and timeless editorial contrast.',
    };
  }
  return {
    title: prompt.trim().slice(0, 46) || `${style} Photo Remix`,
    brightness: 1.06,
    contrast: 1.18,
    saturate: 1.28,
    hueRotate: 0,
    sepia: 0.05,
    bloom: 0.24,
    vignette: 0.35,
    tintTopColor: '#6366F1',
    tintBottomColor: '#22D3EE',
    tintOpacity: 0.2,
    blendMode: 'soft-light',
    particleEffect: 'sunbeams',
    edgeStyle: 'dream-glow',
    palette: ['#6366F1', '#22D3EE', '#F8FAFC', '#0F172A'],
    artDirectionNotes: 'Balanced studio relighting with subtle bloom, clean contrast, and sunbeam depth.',
  };
}

export function sanitizePhotoRemixRecipe(
  raw: Record<string, unknown> | null | undefined,
  prompt = '',
  style = 'Futuristic Illustration'
): PhotoRemixRecipe {
  const defaults = buildDefaultPhotoRemixRecipe(prompt, style);
  const src = raw && typeof raw === 'object' ? raw : {};

  const blendMode = VALID_BLEND_MODES.has(src.blendMode as PhotoRemixRecipe['blendMode'])
    ? (src.blendMode as PhotoRemixRecipe['blendMode'])
    : defaults.blendMode;
  const particleEffect = VALID_PARTICLES.has(src.particleEffect as PhotoRemixRecipe['particleEffect'])
    ? (src.particleEffect as PhotoRemixRecipe['particleEffect'])
    : defaults.particleEffect;
  const edgeStyle = VALID_EDGE_STYLES.has(src.edgeStyle as PhotoRemixRecipe['edgeStyle'])
    ? (src.edgeStyle as PhotoRemixRecipe['edgeStyle'])
    : defaults.edgeStyle;

  const palette = Array.isArray(src.palette)
    ? src.palette
        .filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim()))
        .slice(0, 6)
    : defaults.palette;

  return {
    title:
      typeof src.title === 'string' && src.title.trim()
        ? src.title.trim().slice(0, 60)
        : defaults.title,
    brightness: clampNum(src.brightness, defaults.brightness, 0.65, 1.45),
    contrast: clampNum(src.contrast, defaults.contrast, 0.75, 1.65),
    saturate: clampNum(src.saturate, defaults.saturate, 0.2, 2.2),
    hueRotate: clampNum(src.hueRotate, defaults.hueRotate, -180, 180),
    sepia: clampNum(src.sepia, defaults.sepia, 0, 0.85),
    bloom: clampNum(src.bloom, defaults.bloom, 0, 0.6),
    vignette: clampNum(src.vignette, defaults.vignette, 0, 0.85),
    tintTopColor: safeHexColor(src.tintTopColor, defaults.tintTopColor),
    tintBottomColor: safeHexColor(src.tintBottomColor, defaults.tintBottomColor),
    tintOpacity: clampNum(src.tintOpacity, defaults.tintOpacity, 0, 0.65),
    blendMode,
    particleEffect,
    edgeStyle,
    palette: palette.length > 0 ? palette : defaults.palette,
    artDirectionNotes:
      typeof src.artDirectionNotes === 'string' && src.artDirectionNotes.trim()
        ? src.artDirectionNotes.trim()
        : defaults.artDirectionNotes,
  };
}

export function formatApiErrorMessage(status: number, rawMessage?: string): string {
  let msg = (rawMessage || '').trim();

  // Unwrap nested JSON error strings returned by @google/genai SDK
  for (let i = 0; i < 3; i++) {
    if (msg.startsWith('{')) {
      try {
        const parsed = JSON.parse(msg) as {
          error?: { message?: string; code?: number; status?: string };
          message?: string;
        };
        const inner = parsed?.error?.message || parsed?.message;
        if (typeof inner === 'string' && inner.trim()) {
          msg = inner.trim();
          continue;
        }
      } catch {
        break;
      }
    }
    break;
  }

  const hasProviderContext =
    /ELEVENLABS|OPENAI|ANTHROPIC|DEEPSEEK|OPENROUTER|Pixel Image AI|Veo Pixel AI/i.test(msg);
  if (hasProviderContext && msg) {
    return msg;
  }

  if (status === 401 || status === 403 || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return 'Gemini API authentication failed. Please verify GEMINI_API_KEY in Settings > Secrets.';
  }
  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'Rate limit or quota reached for the Gemini API key. Please wait a moment and try again.';
  }
  if (status === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
    return 'NEXORA AI is experiencing temporary high demand (503). Please try again in a few seconds.';
  }
  if (status === 404 || msg.includes('NOT_FOUND')) {
    return 'Requested Gemini model was not found. Please check the server model configuration.';
  }
  if (msg) return msg;
  return `Request failed with status ${status}. Please try again.`;
}

/* ==================== 3D VIDEO SITUATIONAL LOGIC & KINEMATICS ==================== */

const VALID_BIOMES = new Set<VideoBiome>([
  'forest',
  'city',
  'ocean',
  'desert',
  'classroom',
  'indoor_studio',
  'mountain',
  'fantasy_kingdom',
  'cyber_arena',
  'space',
]);

const VALID_MOODS = new Set<VideoMood>([
  'daylight',
  'golden_hour',
  'night_neon',
  'stormy',
  'cozy',
  'dramatic',
]);

const VALID_CAMERA_SHOTS = new Set<VideoCameraShot>([
  'dolly-in',
  'tracking',
  'orbit',
  'low-angle',
  'aerial',
  'first-person',
  'handheld',
  'zoom-sweep',
  'establish-orbit',
  'follow-hero',
  'low-angle-push',
  'aerial-flyover',
  'dialogue-pan',
]);

const VALID_WEATHERS = new Set<VideoWeatherType>([
  'clear',
  'rain',
  'snow',
  'embers',
  'wind',
]);

const VALID_EXPRESSIONS = new Set<VideoActorExpression>([
  'neutral',
  'happy',
  'excited',
  'focused',
  'surprised',
]);

const VALID_ROLES = new Set<VideoActorRole>([
  'human',
  'student',
  'wizard',
  'robot',
  'cat',
  'dog',
  'car',
  'drone',
  'bird',
  'dragon',
  'rocket',
]);

const VALID_ACTIONS = new Set<VideoActorAction>([
  'walk',
  'run',
  'jump',
  'fly',
  'drive',
  'cast-spell',
  'dance',
  'wave',
  'talk',
  'idle',
]);

const VALID_PROPS = new Set<VideoPropKind>([
  'tree',
  'pine',
  'house',
  'building',
  'desk',
  'bookshelf',
  'mountain',
  'rock',
  'boat',
  'streetlamp',
  'stage',
  'portal',
  'chest',
  'flower',
  'fountain',
  'goalpost',
  'ball',
]);

export function inferVideoFormatFromText(
  topic: string,
  requestedType?: VideoFormatType | string
): Exclude<VideoFormatType, 'auto'> {
  if (
    requestedType === '3d_animation' ||
    requestedType === '2d_motion' ||
    requestedType === 'whiteboard_explainer' ||
    requestedType === 'cinematic_story'
  ) {
    return requestedType;
  }

  const lower = (topic || '').toLowerCase();
  if (
    /\b(explain|tutorial|how|why|photosynthesis|math|maths|algebra|geometry|physics|chemistry|biology|homework|diagram|lesson|study|step by step)\b/.test(
      lower
    )
  ) {
    return 'whiteboard_explainer';
  }
  if (
    /\b(documentary|history|biography|ancient|empire|war|epic|cinematic|film|mystery|legend)\b/.test(
      lower
    )
  ) {
    return 'cinematic_story';
  }
  if (
    /\b(2d|motion graphics|infographic|marketing|startup|app|software|coding|youtube|facts|top 5|listicle)\b/.test(
      lower
    )
  ) {
    return '2d_motion';
  }
  return '3d_animation';
}

export function inferBiomeFromText(text: string, style?: VideoVisualStyle | string): VideoBiome {
  const lower = (text || '').toLowerCase();
  if (style === 'Space & Cosmos') return 'space';

  if (/\b(space|planet|solar system|astronaut|galaxy|cosmos|nebula|moon|mars|rocket|universe|orbit)\b/.test(lower)) {
    return 'space';
  }
  if (/\b(forest|park|meadow|jungle|garden|village|woods|nature|trees)\b/.test(lower)) {
    return 'forest';
  }
  if (/\b(city|street|road|car|racing|traffic|urban|building|skyscraper|vlog|downtown|bus|highway|taxi|police|chase)\b/.test(lower)) {
    return 'city';
  }
  if (/\b(school|class|classroom|homework|study|math|maths|physics|chemistry|teacher|student|exam|board|desk|lecture|book)\b/.test(lower)) {
    return 'classroom';
  }
  if (/\b(studio|office|coding|programming|python|javascript|ai|youtube|podcast|room|kitchen|living room|stage|concert|music|dance)\b/.test(lower)) {
    return 'indoor_studio';
  }
  if (/\b(ocean|sea|beach|island|boat|ship|water|river|lake|pirate|fish|swim|wave|surf)\b/.test(lower)) {
    return 'ocean';
  }
  if (/\b(desert|sand|dune|camel|pyramid|oasis|canyon|safari)\b/.test(lower)) {
    return 'desert';
  }
  if (/\b(mountain|snow|hill|climb|alps|everest|winter|peak|valley)\b/.test(lower)) {
    return 'mountain';
  }
  if (/\b(dragon|castle|magic|wizard|kingdom|knight|sword|fantasy|fairy|dungeon|portal|spell|enchanted)\b/.test(lower)) {
    return 'fantasy_kingdom';
  }
  if (/\b(cyber|cyberpunk|neon|robot|arena|gaming|esports|mech|futuristic|hologram|virtual|arcade)\b/.test(lower)) {
    return 'cyber_arena';
  }
  // Default grounded outdoor world (park/village/forest) — never space by default!
  return 'forest';
}

export function inferMoodFromText(text: string, biome: VideoBiome): VideoMood {
  const lower = (text || '').toLowerCase();
  if (/\b(night|neon|midnight|dark|cyber|concert|club|spooky|horror|moonlight)\b/.test(lower)) {
    return 'night_neon';
  }
  if (/\b(sunset|golden|sunrise|evening|dusk|warm)\b/.test(lower)) {
    return 'golden_hour';
  }
  if (/\b(storm|rain|thunder|lightning|battle|boss|war)\b/.test(lower)) {
    return 'stormy';
  }
  if (/\b(cozy|study|home|story|warmth|cafe|library)\b/.test(lower)) {
    return 'cozy';
  }
  if (biome === 'cyber_arena' || biome === 'space') return 'night_neon';
  if (biome === 'desert' || biome === 'fantasy_kingdom') return 'golden_hour';
  if (biome === 'classroom' || biome === 'indoor_studio') return 'cozy';
  return 'daylight';
}

export function groundHeightAt(biome: VideoBiome, x: number, z: number): number {
  const distSq = x * x + z * z;
  switch (biome) {
    case 'city':
    case 'classroom':
    case 'indoor_studio':
    case 'cyber_arena':
    case 'space':
      return 0;
    case 'ocean': {
      // Sandy beach island inside radius ~10m slopes smoothly down to water level (-0.45)
      const r = Math.sqrt(distSq);
      if (r < 7.5) return 0.35 - (r / 7.5) * 0.25;
      return Math.max(-0.5, 0.1 - (r - 7.5) * 0.14);
    }
    case 'desert':
      return Math.sin(x * 0.14) * 0.55 + Math.cos(z * 0.11) * 0.45;
    case 'mountain': {
      // Gentle flat central valley with rising outer hills
      const radialLift = Math.max(0, (Math.sqrt(distSq) - 9) * 0.22);
      return radialLift + Math.sin(x * 0.18 + z * 0.12) * 0.32;
    }
    case 'fantasy_kingdom':
    case 'forest':
    default: {
      // Keep central path area gently flat so walking feet align cleanly
      const centerFlatness = Math.min(1, distSq / 64);
      return centerFlatness * (Math.sin(x * 0.16) * 0.32 + Math.cos(z * 0.16) * 0.28);
    }
  }
}

export function interpolateActorTransform(
  actor: VideoActorSpec,
  sceneProgress: number,
  biome: VideoBiome,
  elapsedSeconds: number
): { x: number; y: number; z: number; yaw: number } {
  const t = Math.max(0, Math.min(1, sceneProgress));
  // Smooth ease-in-out curve for natural movement
  const smooth = t * t * (3 - 2 * t);
  const sx = actor.startPos?.[0] ?? -4;
  const sz = actor.startPos?.[1] ?? 0;
  const ex = actor.endPos?.[0] ?? 4;
  const ez = actor.endPos?.[1] ?? 0;

  const x = sx + (ex - sx) * smooth;
  const z = sz + (ez - sz) * smooth;
  const floorY = groundHeightAt(biome, x, z);

  let yOffset = 0;
  if (actor.action === 'fly' || actor.role === 'drone' || actor.role === 'bird' || actor.role === 'dragon' || actor.role === 'rocket') {
    yOffset = 2.4 + Math.sin(elapsedSeconds * 2.4 + x * 0.3) * 0.45;
  } else if (actor.action === 'jump') {
    yOffset = Math.abs(Math.sin(elapsedSeconds * 3.8)) * 1.15;
  } else if (actor.action === 'run') {
    yOffset = Math.abs(Math.sin(elapsedSeconds * 7.5)) * 0.14;
  } else if (actor.action === 'walk') {
    yOffset = Math.abs(Math.sin(elapsedSeconds * 4.5)) * 0.08;
  } else if (actor.action === 'dance') {
    yOffset = Math.abs(Math.sin(elapsedSeconds * 5.2)) * 0.25;
  }

  const dx = ex - sx;
  const dz = ez - sz;
  const yaw = Math.hypot(dx, dz) > 0.15 ? Math.atan2(dx, dz) : 0;

  return { x, y: floorY + yOffset, z, yaw };
}

function buildDefaultActorsForBiome(biome: VideoBiome, topicHint: string): VideoActorSpec[] {
  const lower = topicHint.toLowerCase();
  if (biome === 'city') {
    const isCarPrompt = /\b(car|race|racing|drive|traffic|taxi|bus|road|highway)\b/.test(lower);
    return isCarPrompt
      ? [
          {
            id: 'hero_car',
            role: 'car',
            color: '#EF4444',
            accentColor: '#38BDF8',
            action: 'drive',
            startPos: [-10, 1.4],
            endPos: [10, 1.4],
            scale: 1.05,
            label: 'Hero Vehicle',
          },
          {
            id: 'drone_cam',
            role: 'drone',
            color: '#38BDF8',
            accentColor: '#F59E0B',
            action: 'fly',
            startPos: [-7, -2.5],
            endPos: [7, -2.5],
            scale: 0.9,
          },
        ]
      : [
          {
            id: 'city_walker',
            role: 'human',
            color: '#2563EB',
            accentColor: '#F59E0B',
            action: 'walk',
            startPos: [-5, 3.2],
            endPos: [4.5, 3.2],
            scale: 1.05,
          },
          {
            id: 'cruiser',
            role: 'car',
            color: '#10B981',
            accentColor: '#E2E8F0',
            action: 'drive',
            startPos: [11, -1.2],
            endPos: [-11, -1.2],
            scale: 1.0,
          },
        ];
  }
  if (biome === 'classroom') {
    return [
      {
        id: 'student_1',
        role: 'student',
        color: '#3B82F6',
        accentColor: '#FBBF24',
        action: 'wave',
        startPos: [-2.5, 1.2],
        endPos: [0.5, 1.2],
        scale: 1.05,
      },
      {
        id: 'study_bot',
        role: 'robot',
        color: '#06B6D4',
        accentColor: '#A855F7',
        action: 'talk',
        startPos: [2.8, 0.5],
        endPos: [2.2, 0.5],
        scale: 0.95,
      },
    ];
  }
  if (biome === 'indoor_studio') {
    return [
      {
        id: 'creator_1',
        role: 'human',
        color: '#6366F1',
        accentColor: '#22D3EE',
        action: 'dance',
        startPos: [-2.2, 0.5],
        endPos: [1.8, 0.5],
        scale: 1.05,
      },
      {
        id: 'assistant_bot',
        role: 'robot',
        color: '#38BDF8',
        accentColor: '#F472B6',
        action: 'wave',
        startPos: [3.2, -0.8],
        endPos: [2.4, 0.4],
        scale: 0.9,
      },
    ];
  }
  if (biome === 'fantasy_kingdom') {
    return [
      {
        id: 'wizard_1',
        role: 'wizard',
        color: '#7C3AED',
        accentColor: '#FBBF24',
        action: 'cast-spell',
        startPos: [-3.5, 1],
        endPos: [1.5, 0.5],
        scale: 1.08,
      },
      {
        id: 'dragon_1',
        role: 'dragon',
        color: '#EF4444',
        accentColor: '#F59E0B',
        action: 'fly',
        startPos: [6, -4],
        endPos: [-4, -3],
        scale: 1.1,
      },
    ];
  }
  if (biome === 'cyber_arena') {
    return [
      {
        id: 'cyber_bot',
        role: 'robot',
        color: '#06B6D4',
        accentColor: '#EC4899',
        action: 'run',
        startPos: [-5.5, 1.5],
        endPos: [5, -1.5],
        scale: 1.1,
      },
      {
        id: 'scout_drone',
        role: 'drone',
        color: '#A855F7',
        accentColor: '#22D3EE',
        action: 'fly',
        startPos: [4, -2],
        endPos: [-3, 2],
        scale: 0.95,
      },
    ];
  }
  if (biome === 'ocean') {
    return [
      {
        id: 'island_explorer',
        role: 'human',
        color: '#F97316',
        accentColor: '#38BDF8',
        action: 'walk',
        startPos: [-3.5, 1.5],
        endPos: [2.8, 0.8],
        scale: 1.0,
      },
      {
        id: 'seabird',
        role: 'bird',
        color: '#F8FAFC',
        accentColor: '#F59E0B',
        action: 'fly',
        startPos: [-7, -3],
        endPos: [7, -2],
        scale: 1.0,
      },
    ];
  }
  if (biome === 'space') {
    return [
      {
        id: 'starship',
        role: 'rocket',
        color: '#E2E8F0',
        accentColor: '#38BDF8',
        action: 'fly',
        startPos: [-6, 1],
        endPos: [6, -1],
        scale: 1.1,
      },
      {
        id: 'astro_bot',
        role: 'robot',
        color: '#F59E0B',
        accentColor: '#38BDF8',
        action: 'wave',
        startPos: [0, 2],
        endPos: [2, 2],
        scale: 0.95,
      },
    ];
  }

  // forest / mountain / desert default lively outdoor adventure cast
  const hasCat = /\b(cat|kitten|whisker)\b/.test(lower);
  const hasDog = /\b(dog|puppy)\b/.test(lower);
  const hasFootball = /\b(football|soccer|goal|kick|ball)\b/.test(lower);
  return [
    {
      id: 'hero_explorer',
      role: hasCat ? 'cat' : hasDog ? 'dog' : 'human',
      color: '#2563EB',
      accentColor: '#F59E0B',
      action: hasFootball ? 'run' : 'walk',
      startPos: [-5.5, 1.2],
      endPos: [4.5, 0.5],
      scale: 1.08,
    },
    {
      id: 'companion',
      role: hasCat ? 'bird' : 'dog',
      color: '#F97316',
      accentColor: '#FEF3C7',
      action: hasCat ? 'fly' : 'jump',
      startPos: [-4, 2.6],
      endPos: [5.5, 1.8],
      scale: 0.95,
    },
  ];
}

function buildDefaultPropsForBiome(biome: VideoBiome, topicHint: string): VideoPropSpec[] {
  const lower = topicHint.toLowerCase();
  const hasFootball = /\b(football|soccer|goal|match)\b/.test(lower);

  switch (biome) {
    case 'city':
      return [
        { kind: 'building', x: -8, z: -7, scale: 1.3, color: '#334155' },
        { kind: 'building', x: 0, z: -8, scale: 1.6, color: '#1E293B' },
        { kind: 'building', x: 8, z: -7, scale: 1.2, color: '#475569' },
        { kind: 'streetlamp', x: -5, z: 3.8, scale: 1.0, color: '#FDE047' },
        { kind: 'streetlamp', x: 5, z: 3.8, scale: 1.0, color: '#FDE047' },
        { kind: 'tree', x: -10, z: 5, scale: 0.9, color: '#22C55E' },
      ];
    case 'classroom':
      return [
        { kind: 'desk', x: -4, z: -2.2, scale: 1.0, color: '#B45309' },
        { kind: 'desk', x: 0, z: -2.2, scale: 1.0, color: '#B45309' },
        { kind: 'desk', x: 4, z: -2.2, scale: 1.0, color: '#B45309' },
        { kind: 'bookshelf', x: -7, z: -5.5, scale: 1.1, color: '#78350F' },
        { kind: 'bookshelf', x: 7, z: -5.5, scale: 1.1, color: '#78350F' },
      ];
    case 'indoor_studio':
      return [
        { kind: 'stage', x: 0, z: 0, scale: 1.2, color: '#1E293B' },
        { kind: 'bookshelf', x: -7, z: -5.5, scale: 1.1, color: '#334155' },
        { kind: 'desk', x: 6, z: -4.8, scale: 1.0, color: '#0F172A' },
        { kind: 'streetlamp', x: -5, z: 3.5, scale: 0.9, color: '#22D3EE' },
      ];
    case 'ocean':
      return [
        { kind: 'boat', x: 7, z: -6, scale: 1.15, color: '#DC2626' },
        { kind: 'tree', x: -3.5, z: -3.5, scale: 1.1, color: '#16A34A' },
        { kind: 'rock', x: 4.5, z: 3.5, scale: 1.0, color: '#64748B' },
        { kind: 'chest', x: -1.5, z: -2.2, scale: 0.9, color: '#D97706' },
      ];
    case 'desert':
      return [
        { kind: 'rock', x: -7, z: -5, scale: 1.5, color: '#B45309' },
        { kind: 'rock', x: 8, z: -6, scale: 1.8, color: '#9A3412' },
        { kind: 'mountain', x: 0, z: -14, scale: 1.8, color: '#C2410C' },
        { kind: 'chest', x: 3, z: 2, scale: 0.9, color: '#F59E0B' },
      ];
    case 'mountain':
      return [
        { kind: 'mountain', x: -9, z: -13, scale: 1.9, color: '#475569' },
        { kind: 'mountain', x: 9, z: -14, scale: 2.1, color: '#64748B' },
        { kind: 'pine', x: -6, z: -4, scale: 1.2, color: '#15803D' },
        { kind: 'pine', x: 6.5, z: -3, scale: 1.1, color: '#166534' },
        { kind: 'house', x: 0, z: -6, scale: 1.0, color: '#92400E' },
      ];
    case 'fantasy_kingdom':
      return [
        { kind: 'house', x: -7, z: -6, scale: 1.25, color: '#4338CA' },
        { kind: 'portal', x: 0, z: -6.5, scale: 1.3, color: '#A855F7' },
        { kind: 'tree', x: 7, z: -4, scale: 1.1, color: '#10B981' },
        { kind: 'chest', x: -2.5, z: 2.5, scale: 0.9, color: '#F59E0B' },
      ];
    case 'cyber_arena':
      return [
        { kind: 'stage', x: 0, z: 0, scale: 1.4, color: '#0F172A' },
        { kind: 'portal', x: 0, z: -7, scale: 1.35, color: '#22D3EE' },
        { kind: 'building', x: -9, z: -8, scale: 1.3, color: '#1E1B4B' },
        { kind: 'building', x: 9, z: -8, scale: 1.3, color: '#312E81' },
      ];
    case 'space':
      return [
        { kind: 'rock', x: -7, z: -5, scale: 1.4, color: '#475569' },
        { kind: 'portal', x: 5, z: -6, scale: 1.1, color: '#38BDF8' },
      ];
    case 'forest':
    default:
      return hasFootball
        ? [
            { kind: 'goalpost', x: 7, z: 0, scale: 1.1, color: '#F8FAFC' },
            { kind: 'ball', x: 1.2, z: 0.4, scale: 1.0, color: '#F8FAFC' },
            { kind: 'tree', x: -7, z: -5, scale: 1.2, color: '#16A34A' },
            { kind: 'tree', x: 6, z: -6, scale: 1.15, color: '#22C55E' },
            { kind: 'flower', x: -4, z: 4, scale: 1.0, color: '#F43F5E' },
          ]
        : [
            { kind: 'house', x: -6.5, z: -6, scale: 1.15, color: '#D97706' },
            { kind: 'tree', x: 5.5, z: -5, scale: 1.25, color: '#16A34A' },
            { kind: 'tree', x: -9, z: 2, scale: 1.1, color: '#22C55E' },
            { kind: 'fountain', x: 1.5, z: -4.5, scale: 1.0, color: '#94A3B8' },
            { kind: 'flower', x: -2.5, z: 3.8, scale: 1.1, color: '#EC4899' },
            { kind: 'flower', x: 4.2, z: 3.2, scale: 1.0, color: '#F59E0B' },
          ];
  }
}

const VALID_KINDS = new Set<string>([
  'orb',
  'planet',
  'ring',
  'wave',
  'bars',
  'grid',
  'particle-stream',
  'rocket',
  'atom',
  'tree',
  'building',
  'chart-line',
  'code-card',
  'text-callout',
  'character',
  'heart',
  'star',
  'lightning',
  'trophy',
  'shield',
  'sword',
  'gamepad',
  'camera',
  'music',
  'book',
  'flame',
  'cloud',
  'sun',
  'moon',
  'car',
]);

const KIND_ALIASES: Record<string, VideoScene['elements'][number]['kind']> = {
  fire: 'flame',
  spark: 'lightning',
  bolt: 'lightning',
  energy: 'lightning',
  hero: 'character',
  person: 'character',
  girl: 'character',
  boy: 'character',
  player: 'character',
  avatar: 'character',
  animal: 'character',
  cat: 'character',
  dog: 'character',
  robot: 'character',
  game: 'gamepad',
  controller: 'gamepad',
  console: 'gamepad',
  graph: 'chart-line',
  chart: 'chart-line',
  analytics: 'chart-line',
  city: 'building',
  house: 'building',
  tower: 'building',
  castle: 'building',
  forest: 'tree',
  plant: 'tree',
  leaf: 'tree',
  nature: 'tree',
  love: 'heart',
  health: 'heart',
  song: 'music',
  audio: 'music',
  sound: 'music',
  note: 'music',
  story: 'book',
  education: 'book',
  study: 'book',
  code: 'code-card',
  terminal: 'code-card',
  label: 'text-callout',
  title: 'text-callout',
  banner: 'text-callout',
  badge: 'text-callout',
  vehicle: 'car',
  racing: 'car',
  spaceship: 'rocket',
  ship: 'rocket',
  award: 'trophy',
  win: 'trophy',
  crown: 'trophy',
  weapon: 'sword',
  blade: 'sword',
  armor: 'shield',
  defense: 'shield',
  video: 'camera',
  vlog: 'camera',
  film: 'camera',
  sky: 'cloud',
  weather: 'cloud',
  night: 'moon',
  day: 'sun',
  light: 'sun',
};

function resolveElementKind(rawKind: unknown): VideoScene['elements'][number]['kind'] {
  if (typeof rawKind !== 'string') return 'orb';
  const normalized = rawKind.trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (VALID_KINDS.has(normalized)) {
    return normalized as VideoScene['elements'][number]['kind'];
  }
  for (const [alias, mapped] of Object.entries(KIND_ALIASES)) {
    if (normalized.includes(alias)) return mapped;
  }
  return 'orb';
}

function resolveActorRole(rawRole: unknown): VideoActorRole {
  const norm = String(rawRole || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (VALID_ROLES.has(norm as VideoActorRole)) return norm as VideoActorRole;
  if (norm.includes('wizard') || norm.includes('mage') || norm.includes('magic')) return 'wizard';
  if (norm.includes('student') || norm.includes('boy') || norm.includes('girl') || norm.includes('kid')) return 'student';
  if (norm.includes('bot') || norm.includes('mech') || norm.includes('ai')) return 'robot';
  if (norm.includes('cat') || norm.includes('kitten')) return 'cat';
  if (norm.includes('dog') || norm.includes('puppy') || norm.includes('wolf')) return 'dog';
  if (norm.includes('car') || norm.includes('vehicle') || norm.includes('truck') || norm.includes('bus')) return 'car';
  if (norm.includes('drone') || norm.includes('heli') || norm.includes('quad')) return 'drone';
  if (norm.includes('dragon') || norm.includes('monster')) return 'dragon';
  if (norm.includes('bird') || norm.includes('eagle') || norm.includes('owl')) return 'bird';
  if (norm.includes('rocket') || norm.includes('ship') || norm.includes('ufo')) return 'rocket';
  return 'human';
}

function resolveActorAction(rawAction: unknown, role: VideoActorRole): VideoActorAction {
  const norm = String(rawAction || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (VALID_ACTIONS.has(norm as VideoActorAction)) return norm as VideoActorAction;
  if (role === 'car') return 'drive';
  if (role === 'drone' || role === 'bird' || role === 'dragon' || role === 'rocket') return 'fly';
  if (role === 'wizard') return 'cast-spell';
  return 'walk';
}

function resolvePropKind(rawKind: unknown): VideoPropKind {
  const norm = String(rawKind || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (VALID_PROPS.has(norm as VideoPropKind)) return norm as VideoPropKind;
  if (norm.includes('pine') || norm.includes('evergreen')) return 'pine';
  if (norm.includes('tree') || norm.includes('bush') || norm.includes('palm')) return 'tree';
  if (norm.includes('house') || norm.includes('cottage') || norm.includes('home') || norm.includes('cabin')) return 'house';
  if (norm.includes('build') || norm.includes('tower') || norm.includes('castle') || norm.includes('office')) return 'building';
  if (norm.includes('desk') || norm.includes('table') || norm.includes('chair')) return 'desk';
  if (norm.includes('shelf') || norm.includes('book') || norm.includes('board')) return 'bookshelf';
  if (norm.includes('mount') || norm.includes('hill') || norm.includes('peak')) return 'mountain';
  if (norm.includes('rock') || norm.includes('stone') || norm.includes('boulder')) return 'rock';
  if (norm.includes('boat') || norm.includes('ship') || norm.includes('yacht')) return 'boat';
  if (norm.includes('lamp') || norm.includes('light') || norm.includes('lantern')) return 'streetlamp';
  if (norm.includes('stage') || norm.includes('podium') || norm.includes('platform')) return 'stage';
  if (norm.includes('portal') || norm.includes('arch') || norm.includes('gate')) return 'portal';
  if (norm.includes('chest') || norm.includes('crate') || norm.includes('box')) return 'chest';
  if (norm.includes('flower') || norm.includes('plant')) return 'flower';
  if (norm.includes('fountain') || norm.includes('well')) return 'fountain';
  if (norm.includes('goal')) return 'goalpost';
  if (norm.includes('ball') || norm.includes('soccer') || norm.includes('football')) return 'ball';
  return 'tree';
}

function resolveBiomeValue(rawBiome: unknown, combinedText: string, style?: string): VideoBiome {
  const norm = String(rawBiome || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (VALID_BIOMES.has(norm as VideoBiome)) {
    // Only allow 'space' if user actually asked for space/cosmos OR scene text mentions space
    if (norm === 'space' && style !== 'Space & Cosmos') {
      const inferred = inferBiomeFromText(combinedText, style);
      if (inferred !== 'space') return inferred;
    }
    return norm as VideoBiome;
  }
  return inferBiomeFromText(combinedText, style);
}

const VALID_MOTIONS = new Set([
  'float',
  'orbit',
  'pulse',
  'rise',
  'slide-right',
  'spin',
  'static',
]);

export function extractStoryboardPayload(
  rawText: string,
  fallbackTitle = 'Generated Animated Video'
): { title: string; scenes: Record<string, unknown>[] } {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const tryParse = (str: string): unknown | null => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  let parsed: unknown = tryParse(cleaned);

  if (!parsed) {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    if (firstObj >= 0 && lastObj > firstObj) {
      parsed = tryParse(cleaned.slice(firstObj, lastObj + 1));
    }
  }

  if (!parsed) {
    const firstArr = cleaned.indexOf('[');
    const lastArr = cleaned.lastIndexOf(']');
    if (firstArr >= 0 && lastArr > firstArr) {
      parsed = tryParse(cleaned.slice(firstArr, lastArr + 1));
    }
  }

  // Recover complete scene objects from a truncated JSON stream if needed
  if (!parsed) {
    const scenesKeyIdx = cleaned.indexOf('"scenes"');
    const arrStart = scenesKeyIdx >= 0 ? cleaned.indexOf('[', scenesKeyIdx) : cleaned.indexOf('[');
    if (arrStart >= 0) {
      const fragment = cleaned.slice(arrStart);
      const lastCompleteBrace = fragment.lastIndexOf('}');
      if (lastCompleteBrace > 0) {
        const recoveredArr = tryParse(`${fragment.slice(0, lastCompleteBrace + 1)}]`);
        if (Array.isArray(recoveredArr) && recoveredArr.length > 0) {
          parsed = { title: fallbackTitle, scenes: recoveredArr };
        }
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { title: fallbackTitle, scenes: [] };
  }

  if (Array.isArray(parsed)) {
    return {
      title: fallbackTitle,
      scenes: parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')),
    };
  }

  const obj = parsed as Record<string, unknown>;
  const nestedStoryboard =
    obj.storyboard && typeof obj.storyboard === 'object'
      ? (obj.storyboard as Record<string, unknown>)
      : obj.video && typeof obj.video === 'object'
        ? (obj.video as Record<string, unknown>)
        : null;

  const title =
    (typeof obj.title === 'string' && obj.title.trim()) ||
    (nestedStoryboard && typeof nestedStoryboard.title === 'string' && nestedStoryboard.title.trim()) ||
    fallbackTitle;

  const rawScenesCandidate =
    obj.scenes ??
    obj.chapters ??
    obj.segments ??
    (Array.isArray(obj.storyboard) ? obj.storyboard : undefined) ??
    nestedStoryboard?.scenes ??
    nestedStoryboard?.chapters;

  let sceneList: Record<string, unknown>[] = [];
  if (Array.isArray(rawScenesCandidate)) {
    sceneList = rawScenesCandidate.filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')
    );
  } else if (rawScenesCandidate && typeof rawScenesCandidate === 'object') {
    sceneList = Object.values(rawScenesCandidate).filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')
    );
  }

  return { title, scenes: sceneList };
}

export function sanitizeGeneratedScenes(
  rawScenes: Array<Partial<VideoScene> | Record<string, unknown>>,
  targetTotalSeconds: number,
  topicHint = '',
  style?: string
): VideoScene[] {
  const safeScenes: VideoScene[] = (Array.isArray(rawScenes) ? rawScenes : [])
    .filter((s) => s && typeof s === 'object')
    .map((rawScene, idx) => {
      const s = rawScene as Partial<VideoScene> & Record<string, unknown>;
      const rawTitle = s.title ?? s.name ?? s.heading;
      const title =
        typeof rawTitle === 'string' && rawTitle.trim()
          ? rawTitle.trim()
          : `Scene ${idx + 1}`;

      const rawNarration = s.narration ?? s.voiceover ?? s.script ?? s.description ?? s.text;
      const narration =
        typeof rawNarration === 'string' && rawNarration.trim()
          ? rawNarration.trim()
          : `${title} visual sequence.`;

      const rawSubtitle = s.subtitle ?? s.caption;
      const subtitle =
        typeof rawSubtitle === 'string' && rawSubtitle.trim()
          ? rawSubtitle.trim()
          : narration.slice(0, 90);

      const rawDuration = Number(s.durationSeconds ?? s.duration ?? s.seconds);
      const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 15;

      const sceneText = `${title} ${narration}`;
      const combinedText = `${sceneText} ${topicHint}`;
      const explicitSceneBiome = inferBiomeFromText(sceneText, style);
      const fallbackText = explicitSceneBiome !== 'forest' ? sceneText : combinedText;
      const biome = resolveBiomeValue(s.biome ?? s.setting ?? s.environment, fallbackText, style);

      const rawMood = String(s.mood ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      const mood: VideoMood = VALID_MOODS.has(rawMood as VideoMood)
        ? (rawMood as VideoMood)
        : inferMoodFromText(combinedText, biome);

      const rawShot = String(s.cameraShot ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-');
      const fallbackShots: VideoCameraShot[] = [
        'orbit',
        'tracking',
        'low-angle',
        'aerial',
        'dolly-in',
        'handheld',
        'zoom-sweep',
      ];
      const cameraShot: VideoCameraShot = VALID_CAMERA_SHOTS.has(rawShot as VideoCameraShot)
        ? (rawShot as VideoCameraShot)
        : fallbackShots[idx % fallbackShots.length];

      const rawWeather = String(s.weather ?? '').trim().toLowerCase();
      const weather: VideoWeatherType = VALID_WEATHERS.has(rawWeather as VideoWeatherType)
        ? (rawWeather as VideoWeatherType)
        : inferWeatherFromText(combinedText, biome, mood);

      const bgObj = (s.background && typeof s.background === 'object' ? s.background : {}) as Record<string, unknown>;
      const accentColor =
        typeof bgObj.accentColor === 'string' && bgObj.accentColor.startsWith('#')
          ? bgObj.accentColor
          : '#38BDF8';

      const parsedActors: VideoActorSpec[] = (Array.isArray(s.actors) ? s.actors : [])
        .filter((a) => a && typeof a === 'object')
        .slice(0, 4)
        .map((a, aIdx) => {
          const item = a as unknown as Record<string, unknown>;
          const role = resolveActorRole(item.role ?? item.type ?? item.kind);
          const action = resolveActorAction(item.action ?? item.motion, role);
          const sp = Array.isArray(item.startPos) ? item.startPos : [-4 + aIdx * 3, aIdx * 1.6];
          const ep = Array.isArray(item.endPos) ? item.endPos : [4 - aIdx * 2, aIdx * 1.2];
          let sx = Math.max(-11, Math.min(11, Number(sp[0]) || 0));
          const sz = Math.max(-9, Math.min(9, Number(sp[1]) || 0));
          let ex = Math.max(-11, Math.min(11, Number(ep[0]) || 0));
          const ez = Math.max(-9, Math.min(9, Number(ep[1]) || 0));

          // Ensure continuous visible motion (no frozen actor poses!)
          if (Math.hypot(ex - sx, ez - sz) < 2.2) {
            sx = Math.max(-10, sx - 2.2);
            ex = Math.min(10, ex + 2.4);
          }

          const rawExpr = String(item.expression ?? '').trim().toLowerCase();
          const expression: VideoActorExpression = VALID_EXPRESSIONS.has(rawExpr as VideoActorExpression)
            ? (rawExpr as VideoActorExpression)
            : inferExpressionFromAction(action, mood);

          return {
            id: typeof item.id === 'string' && item.id.trim() ? item.id : `actor_${idx}_${aIdx}`,
            role,
            color: typeof item.color === 'string' && item.color.startsWith('#') ? item.color : '#2563EB',
            accentColor:
              typeof item.accentColor === 'string' && item.accentColor.startsWith('#')
                ? item.accentColor
                : '#F59E0B',
            action,
            expression,
            startPos: [sx, sz],
            endPos: [ex, ez],
            scale: typeof item.scale === 'number' ? Math.max(0.65, Math.min(1.6, item.scale)) : 1.0,
            label: typeof item.label === 'string' ? item.label : undefined,
          };
        });

      const actors = parsedActors.length > 0 ? parsedActors : buildDefaultActorsForBiome(biome, combinedText);

      const parsedProps: VideoPropSpec[] = (Array.isArray(s.props) ? s.props : [])
        .filter((p) => p && typeof p === 'object')
        .slice(0, 12)
        .map((p) => {
          const item = p as unknown as Record<string, unknown>;
          const kind = resolvePropKind(item.kind ?? item.type);
          const xVal = Math.max(-14, Math.min(14, Number(item.x) || 0));
          let zVal = Math.max(-14, Math.min(14, Number(item.z) || 0));
          const isTall =
            kind === 'tree' ||
            kind === 'house' ||
            kind === 'building' ||
            kind === 'portal' ||
            kind === 'bookshelf' ||
            kind === 'mountain';
          if (isTall && zVal > 2.2 && Math.abs(xVal) < 12) {
            zVal = -Math.max(3.5, Math.min(12, Math.abs(zVal)));
          }
          return {
            kind,
            x: xVal,
            z: zVal,
            scale: typeof item.scale === 'number' ? Math.max(0.6, Math.min(2.4, item.scale)) : 1.0,
            color: typeof item.color === 'string' && item.color.startsWith('#') ? item.color : '#16A34A',
            rotationY: typeof item.rotationY === 'number' ? item.rotationY : 0,
          };
        });

      const props = parsedProps.length > 0 ? parsedProps : buildDefaultPropsForBiome(biome, combinedText);

      const parsedElements = (Array.isArray(s.elements) ? s.elements : [])
        .filter((el) => el && typeof el === 'object')
        .map((el) => {
          const item = el as unknown as Record<string, unknown>;
          return {
            kind: resolveElementKind(item.kind ?? item.type),
            x: typeof item.x === 'number' ? Math.max(10, Math.min(90, item.x)) : 50,
            y: typeof item.y === 'number' ? Math.max(15, Math.min(80, item.y)) : 48,
            scale: typeof item.scale === 'number' ? Math.max(0.5, Math.min(2.2, item.scale)) : 1,
            color: typeof item.color === 'string' && item.color.startsWith('#') ? item.color : accentColor,
            motion: (VALID_MOTIONS.has(String(item.motion)) ? item.motion : 'float') as VideoScene['elements'][number]['motion'],
            label: typeof item.label === 'string' ? item.label : undefined,
          };
        });

      const elements: VideoScene['elements'] =
        parsedElements.length > 0
          ? parsedElements
          : [
              { kind: 'character', x: 38, y: 48, scale: 1.2, color: accentColor, motion: 'float' },
              { kind: 'text-callout', x: 66, y: 48, scale: 1.0, color: '#E2E8F0', motion: 'float', label: title.slice(0, 22) },
            ];

      const rawKeyPoints = Array.isArray(s.keyPoints)
        ? s.keyPoints.filter((kp): kp is string => typeof kp === 'string' && kp.trim().length > 0).map((kp) => kp.trim().slice(0, 64))
        : [];
      const keyPoints =
        rawKeyPoints.length > 0
          ? rawKeyPoints.slice(0, 3)
          : narration
              .split(/[.;]+/)
              .map((part) => part.trim())
              .filter((part) => part.length > 4)
              .slice(0, 2)
              .map((part) => (part.length > 52 ? `${part.slice(0, 49).trimEnd()}...` : part));

      return {
        id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `scene_${idx + 1}`,
        title,
        narration,
        subtitle,
        durationSeconds,
        biome,
        mood,
        weather,
        cameraShot,
        cameraMotion:
          s.cameraMotion === 'zoom-in' ||
          s.cameraMotion === 'zoom-out' ||
          s.cameraMotion === 'pan-left' ||
          s.cameraMotion === 'pan-right' ||
          s.cameraMotion === 'orbit'
            ? s.cameraMotion
            : 'orbit',
        transition:
          s.transition === 'crossfade' ||
          s.transition === 'wipe' ||
          s.transition === 'zoom'
            ? s.transition
            : 'crossfade',
        background: {
          topColor: typeof bgObj.topColor === 'string' && bgObj.topColor.startsWith('#') ? bgObj.topColor : '#38BDF8',
          bottomColor: typeof bgObj.bottomColor === 'string' && bgObj.bottomColor.startsWith('#') ? bgObj.bottomColor : '#BAE6FD',
          accentColor,
          atmosphere:
            bgObj.atmosphere === 'stars' ||
            bgObj.atmosphere === 'grid' ||
            bgObj.atmosphere === 'bokeh' ||
            bgObj.atmosphere === 'aurora' ||
            bgObj.atmosphere === 'minimal'
              ? bgObj.atmosphere
              : biome === 'space'
                ? 'stars'
                : 'minimal',
        },
        actors,
        props,
        elements,
        keyPoints,
      };
    });

  return enforceCharacterConsistency(
    normalizeStoryboardDurations(safeScenes, targetTotalSeconds)
  );
}

export function calculateAudioStagePercent(
  completedScenes: number,
  totalScenes: number
): number {
  if (totalScenes <= 0) return 95;
  const ratio = Math.max(0, Math.min(1, completedScenes / totalScenes));
  return Math.round(50 + ratio * 45);
}

export function inferWeatherFromText(
  text: string,
  biome: VideoBiome,
  mood: VideoMood
): VideoWeatherType {
  const lower = (text || '').toLowerCase();
  if (/\b(rain|rainy|storm|thunder|monsoon|drizzle|downpour)\b/.test(lower) || mood === 'stormy') {
    return 'rain';
  }
  if (/\b(snow|snowing|blizzard|winter|frost|icy|glacier)\b/.test(lower) || biome === 'mountain') {
    return 'snow';
  }
  if (/\b(fire|flame|volcano|lava|campfire|dragon|battle|spark|embers)\b/.test(lower) || biome === 'fantasy_kingdom') {
    return 'embers';
  }
  if (/\b(wind|breeze|gale|sail|sandstorm|desert)\b/.test(lower) || biome === 'desert' || biome === 'ocean') {
    return 'wind';
  }
  return 'clear';
}

export function inferExpressionFromAction(
  action: VideoActorAction,
  mood: VideoMood
): VideoActorExpression {
  if (action === 'dance' || action === 'wave') return 'happy';
  if (action === 'jump' || action === 'fly' || action === 'cast-spell') return 'excited';
  if (action === 'run' || action === 'drive') return 'focused';
  if (mood === 'dramatic' || mood === 'stormy') return 'surprised';
  return 'happy';
}

export function resolveExportDimensions(
  aspectRatio: VideoAspectRatio,
  resolution: VideoResolution
): { width: number; height: number } {
  const baseShort = resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 540;
  if (aspectRatio === '9:16') {
    const height = Math.round((baseShort * 16) / 9);
    return { width: baseShort, height: height % 2 === 0 ? height : height + 1 };
  }
  if (aspectRatio === '1:1') {
    const square = resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 640;
    return { width: square, height: square };
  }
  const width = Math.round((baseShort * 16) / 9);
  return { width: width % 2 === 0 ? width : width + 1, height: baseShort };
}

export function computeLipSyncAperture(
  elapsedSeconds: number,
  isSpeaking: boolean,
  intensity: VideoAnimationIntensity = 'dynamic'
): number {
  if (!isSpeaking) return 0;
  const gain = intensity === 'subtle' ? 0.72 : intensity === 'cinematic' ? 1.15 : 1.0;
  const syllable = Math.abs(Math.sin(elapsedSeconds * 11.4));
  const stress = 0.55 + 0.45 * Math.sin(elapsedSeconds * 4.1 + 0.6);
  const pauseGate = Math.sin(elapsedSeconds * 1.9) > -0.78 ? 1 : 0.15;
  return Math.max(0.08, Math.min(1, syllable * stress * pauseGate * gain));
}

export interface CameraTransformGoal {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  rollZ: number;
  fov: number;
}

export function resolveCameraTransform(
  shot: VideoCameraShot,
  sceneProgress: number,
  elapsedSeconds: number,
  heroPos: { x: number; y: number; z: number; yaw: number },
  intensity: VideoAnimationIntensity = 'dynamic',
  aspectRatio: VideoAspectRatio = '16:9'
): CameraTransformGoal {
  const t = Math.max(0, Math.min(1, sceneProgress));
  const amp = intensity === 'subtle' ? 0.65 : intensity === 'cinematic' ? 1.35 : 1.0;
  const baseFov = aspectRatio === '9:16' ? 54 : aspectRatio === '1:1' ? 50 : 48;

  switch (shot) {
    case 'first-person': {
      const fwdX = Math.sin(heroPos.yaw);
      const fwdZ = Math.cos(heroPos.yaw);
      const bob = Math.sin(elapsedSeconds * 6.5) * 0.08 * amp;
      return {
        camX: heroPos.x + fwdX * 0.35,
        camY: heroPos.y + 1.85 + bob,
        camZ: heroPos.z + fwdZ * 0.35,
        lookX: heroPos.x + fwdX * 7.5 + Math.sin(elapsedSeconds * 1.2) * 0.35,
        lookY: heroPos.y + 1.55 + bob * 0.6,
        lookZ: heroPos.z + fwdZ * 7.5,
        rollZ: Math.sin(elapsedSeconds * 3.2) * 0.018 * amp,
        fov: baseFov + 8,
      };
    }
    case 'handheld': {
      const shakeX = (Math.sin(elapsedSeconds * 4.7) * 0.22 + Math.cos(elapsedSeconds * 9.1) * 0.09) * amp;
      const shakeY = (Math.cos(elapsedSeconds * 5.3) * 0.16 + Math.sin(elapsedSeconds * 11.3) * 0.06) * amp;
      return {
        camX: heroPos.x * 0.65 - 2.2 * (1 - t) + shakeX,
        camY: heroPos.y + 1.85 + shakeY,
        camZ: heroPos.z + 6.4 - t * 1.2,
        lookX: heroPos.x + shakeX * 0.4,
        lookY: heroPos.y + 1.15 + shakeY * 0.4,
        lookZ: heroPos.z,
        rollZ: Math.sin(elapsedSeconds * 3.8) * 0.032 * amp,
        fov: baseFov,
      };
    }
    case 'dolly-in': {
      return {
        camX: heroPos.x * 0.45 + (0.5 - t) * 1.4,
        camY: heroPos.y + 2.4 - t * 0.45,
        camZ: heroPos.z + 11.4 - t * 5.6 * Math.min(1.15, amp),
        lookX: heroPos.x * 0.85,
        lookY: heroPos.y + 1.15,
        lookZ: heroPos.z,
        rollZ: 0,
        fov: baseFov - t * 3.5 * amp,
      };
    }
    case 'tracking':
    case 'follow-hero': {
      return {
        camX: heroPos.x - 3.6 + t * 1.4,
        camY: heroPos.y + 2.45 + Math.sin(t * Math.PI) * 0.45 * amp,
        camZ: heroPos.z + 6.9,
        lookX: heroPos.x + 0.5,
        lookY: heroPos.y + 1.1,
        lookZ: heroPos.z,
        rollZ: 0,
        fov: baseFov,
      };
    }
    case 'low-angle':
    case 'low-angle-push': {
      return {
        camX: heroPos.x + (0.5 - t) * 3.2 * amp,
        camY: Math.max(0.95, heroPos.y + 0.45),
        camZ: heroPos.z + 7.8 - t * 2.6,
        lookX: heroPos.x,
        lookY: heroPos.y + 1.45,
        lookZ: heroPos.z,
        rollZ: 0,
        fov: baseFov + 4,
      };
    }
    case 'aerial':
    case 'aerial-flyover': {
      return {
        camX: -6.2 * amp + t * 12.4 * amp,
        camY: 8.2 - Math.sin(t * Math.PI) * 1.4 * amp,
        camZ: 10.6 - t * 3.0,
        lookX: heroPos.x * 0.55,
        lookY: 1.0,
        lookZ: heroPos.z * 0.4,
        rollZ: Math.sin(t * Math.PI) * 0.025 * amp,
        fov: baseFov + 3,
      };
    }
    case 'zoom-sweep':
    case 'dialogue-pan': {
      return {
        camX: (-4.8 + t * 9.6) * amp,
        camY: 2.9 + Math.sin(t * Math.PI) * 0.5,
        camZ: 8.8 - t * 2.1,
        lookX: heroPos.x * 0.4,
        lookY: 1.2,
        lookZ: heroPos.z * 0.3,
        rollZ: 0,
        fov: baseFov - Math.sin(t * Math.PI) * 6 * amp,
      };
    }
    case 'orbit':
    case 'establish-orbit':
    default: {
      const ang = -0.68 + t * 1.36 * amp;
      return {
        camX: Math.sin(ang) * 11.2,
        camY: 4.5 + Math.sin(t * Math.PI) * 0.9 * amp,
        camZ: Math.cos(ang) * 11.2,
        lookX: heroPos.x * 0.5,
        lookY: 1.15,
        lookZ: heroPos.z * 0.5,
        rollZ: 0,
        fov: baseFov,
      };
    }
  }
}

export function enforceCharacterConsistency(scenes: VideoScene[]): VideoScene[] {
  if (scenes.length <= 1) return scenes;
  const leadRoleMap = new Map<
    VideoActorRole,
    { id: string; color: string; accentColor: string; scale: number }
  >();

  return scenes.map((scene) => {
    const updatedActors = (scene.actors || []).map((actor, idx) => {
      if (idx === 0) {
        const existing = leadRoleMap.get(actor.role);
        if (existing) {
          return {
            ...actor,
            id: existing.id,
            color: existing.color,
            accentColor: existing.accentColor,
            scale: existing.scale,
          };
        }
        leadRoleMap.set(actor.role, {
          id: actor.id,
          color: actor.color,
          accentColor: actor.accentColor,
          scale: actor.scale,
        });
      }
      return actor;
    });
    return { ...scene, actors: updatedActors };
  });
}

export function validateVideoStoryboardQuality(
  storyboard: VideoStoryboard
): VideoQualityReport {
  const warnings: string[] = [];
  const totalScenes = storyboard.scenes.length;
  let movingSceneCount = 0;
  let minTravelDistance = Number.POSITIVE_INFINITY;

  const seenLeadColors = new Map<VideoActorRole, string>();
  let characterConsistent = true;

  for (const scene of storyboard.scenes) {
    const lead = scene.actors?.[0];
    if (lead) {
      const prevColor = seenLeadColors.get(lead.role);
      if (prevColor && prevColor !== lead.color) {
        characterConsistent = false;
        warnings.push(`Lead ${lead.role} changed color in ${scene.title}`);
      } else {
        seenLeadColors.set(lead.role, lead.color);
      }
    }

    let maxDistInScene = 0;
    for (const actor of scene.actors || []) {
      const d = Math.hypot(
        (actor.endPos?.[0] ?? 0) - (actor.startPos?.[0] ?? 0),
        (actor.endPos?.[1] ?? 0) - (actor.startPos?.[1] ?? 0)
      );
      if (d > maxDistInScene) maxDistInScene = d;
    }

    if (maxDistInScene >= 1.5 || (scene.actors?.some((a) => a.action !== 'idle') ?? false)) {
      movingSceneCount += 1;
    } else {
      warnings.push(`Scene "${scene.title}" lacks actor motion`);
    }

    if (maxDistInScene < minTravelDistance) {
      minTravelDistance = maxDistInScene;
    }

    if (!scene.narration?.trim()) {
      warnings.push(`Scene "${scene.title}" has empty narration`);
    }
  }

  if (!Number.isFinite(minTravelDistance)) minTravelDistance = 0;

  return {
    passed: totalScenes > 0 && movingSceneCount === totalScenes && characterConsistent,
    movingSceneCount,
    totalScenes,
    characterConsistent,
    minTravelDistance: Math.round(minTravelDistance * 100) / 100,
    warnings,
  };
}

/* ==================== TEXT TO SPEECH STUDIO HELPERS ==================== */

export const GEMINI_VOICE_CATALOG: Array<{
  id: VoiceName;
  label: string;
  tone: string;
}> = [
  { id: 'Kore', label: 'Kore', tone: 'Warm, balanced, crystal-clear' },
  { id: 'Puck', label: 'Puck', tone: 'Upbeat, bright, conversational' },
  { id: 'Charon', label: 'Charon', tone: 'Deep, calm, authoritative' },
  { id: 'Fenrir', label: 'Fenrir', tone: 'Bold, expressive, dramatic' },
  { id: 'Zephyr', label: 'Zephyr', tone: 'Crisp, friendly, energetic' },
];

export const TTS_STYLE_PRESETS: Array<{ id: string; label: string; style: string }> = [
  { id: 'natural', label: 'Natural Assistant', style: 'Clear, warm, articulate assistant' },
  { id: 'news', label: 'News Anchor', style: 'Clear, authoritative, well-paced broadcast news anchor' },
  { id: 'storyteller', label: 'Storyteller', style: 'Expressive, engaging fiction storyteller with natural pauses' },
  { id: 'documentary', label: 'Documentary', style: 'Calm, cinematic documentary narrator' },
  { id: 'tutor', label: 'Friendly Tutor', style: 'Patient, encouraging teacher explaining clearly' },
  { id: 'podcast', label: 'Enthusiastic Host', style: 'Bright, lively podcast host with warm energy' },
];

export function cleanTextForTts(rawText: string, maxChars = 2500): string {
  const safeMax = Math.max(100, maxChars);
  return (rawText || '')
    .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, safeMax);
}

export function parseDialogueLines(
  script: string,
  speakerAName = 'Alex',
  speakerBName = 'Sam'
): TtsDialogueTurn[] {
  const spkA = speakerAName.trim() || 'Alex';
  const spkB = speakerBName.trim() || 'Sam';
  const rawLines = cleanTextForTts(script, 2500)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const turns: TtsDialogueTurn[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const match = line.match(/^([A-Za-z][A-Za-z0-9 _-]{0,20}):\s*(.+)$/);
    if (match) {
      const label = match[1].trim();
      const content = match[2].trim();
      if (!content) continue;
      const resolvedSpeaker =
        label.toLowerCase() === spkA.toLowerCase()
          ? spkA
          : label.toLowerCase() === spkB.toLowerCase()
            ? spkB
            : turns.length % 2 === 0
              ? spkA
              : spkB;
      turns.push({ speaker: resolvedSpeaker, text: content });
    } else {
      turns.push({ speaker: i % 2 === 0 ? spkA : spkB, text: line });
    }
  }
  return turns.slice(0, 14);
}
