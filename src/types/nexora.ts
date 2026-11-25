export type ToolId =
  | 'chat'
  | 'video'
  | 'image'
  | 'coding'
  | 'homework'
  | 'story'
  | 'youtube'
  | 'translator'
  | 'summarizer'
  | 'tts'
  | 'voice'
  | 'brainstorming';

export type AppLanguage = 'English' | 'Hindi' | 'Hinglish';

export type ResponseStyle =
  | 'Balanced'
  | 'Simple & Easy'
  | 'Detailed & Technical'
  | 'Concise'
  | 'Friendly Tutor';

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type TtsProvider = 'gemini' | 'elevenlabs';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
}

export type TtsSpeechMode = 'single' | 'dialogue';

export interface TtsDialogueTurn {
  speaker: string;
  text: string;
}

export interface TtsClipRecord {
  id: string;
  title: string;
  text: string;
  provider: TtsProvider;
  mode: TtsSpeechMode;
  voiceLabel: string;
  style: string;
  audioUrl: string;
  mimeType: string;
  createdAt: number;
}

export type AiProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'openrouter';

export interface AiModelSpec {
  id: string;
  label: string;
  provider: AiProviderId;
  providerName: string;
  tagline: string;
  supportsVision?: boolean;
}

export interface ProviderStatus {
  id: AiProviderId;
  name: string;
  envVar: string;
  configured: boolean;
}

export interface UserProfile {
  name: string;
  role: string;
  avatarUrl: string;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  language: AppLanguage;
  responseStyle: ResponseStyle;
  voiceName: VoiceName;
  ttsProvider: TtsProvider;
  elevenLabsVoiceId: string;
  selectedModelId: string;
  profile: UserProfile;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataBase64?: string;
  textContent?: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  error?: boolean;
  modelLabel?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export type HomeworkSubject = 'Maths' | 'Science' | 'SST' | 'English' | 'Hindi' | 'Other';
export type HomeworkMode = 'Explain' | 'Solve' | 'Give Hint' | 'Check My Answer';

export type YoutubeCategory = 'Shorts' | 'Gaming' | 'Educational' | 'Entertainment' | 'Vlog';

export interface YoutubeSeoResult {
  titles: string[];
  description: string;
  tags: string[];
  hashtags: string[];
  thumbnailIdeas: Array<{
    headlineText: string;
    visualConcept: string;
  }>;
  hookScript: string;
}

export type CodingLanguage =
  | 'HTML/CSS/JS'
  | 'Python'
  | 'JavaScript'
  | 'TypeScript'
  | 'Lua'
  | 'C++'
  | 'Java'
  | 'SQL';

export type CodingMode =
  | 'Generate Code'
  | 'Explain Code'
  | 'Fix Errors'
  | 'Complete Website'
  | 'Game Script';

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

export type VideoResolution = '540p' | '720p' | '1080p';

export type VideoFps = 24 | 30 | 60;

export type VideoAnimationIntensity = 'subtle' | 'dynamic' | 'cinematic';

export type VideoEngineMode = 'nexora_cinema' | 'veo_ai';

export type VideoFormatType =
  | 'auto'
  | '3d_animation'
  | '2d_motion'
  | 'whiteboard_explainer'
  | 'cinematic_story';

export type VideoVisualStyle =
  | 'Auto (AI Decides)'
  | 'Realistic 3D'
  | 'Cinematic 3D'
  | '3D Cartoon / Pixar'
  | 'Anime 3D'
  | 'Educational 3D'
  | 'Gaming & Action'
  | 'Storybook 3D'
  | 'Space & Cosmos';

export type VideoBiome =
  | 'forest'
  | 'city'
  | 'ocean'
  | 'desert'
  | 'classroom'
  | 'indoor_studio'
  | 'mountain'
  | 'fantasy_kingdom'
  | 'cyber_arena'
  | 'space';

export type VideoMood =
  | 'daylight'
  | 'golden_hour'
  | 'night_neon'
  | 'stormy'
  | 'cozy'
  | 'dramatic';

export type VideoWeatherType = 'clear' | 'rain' | 'snow' | 'embers' | 'wind';

export type VideoCameraShot =
  | 'dolly-in'
  | 'tracking'
  | 'orbit'
  | 'low-angle'
  | 'aerial'
  | 'first-person'
  | 'handheld'
  | 'zoom-sweep'
  | 'establish-orbit'
  | 'follow-hero'
  | 'low-angle-push'
  | 'aerial-flyover'
  | 'dialogue-pan';

export type VideoCameraOverride =
  | 'auto'
  | 'dolly-in'
  | 'tracking'
  | 'orbit'
  | 'low-angle'
  | 'aerial'
  | 'first-person'
  | 'handheld'
  | 'zoom-sweep';

export type VideoActorRole =
  | 'human'
  | 'student'
  | 'wizard'
  | 'robot'
  | 'cat'
  | 'dog'
  | 'car'
  | 'drone'
  | 'bird'
  | 'dragon'
  | 'rocket';

export type VideoActorAction =
  | 'walk'
  | 'run'
  | 'jump'
  | 'fly'
  | 'drive'
  | 'cast-spell'
  | 'dance'
  | 'wave'
  | 'talk'
  | 'idle';

export type VideoActorExpression =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'focused'
  | 'surprised';

export interface VideoActorSpec {
  id: string;
  role: VideoActorRole;
  color: string;
  accentColor: string;
  action: VideoActorAction;
  expression?: VideoActorExpression;
  startPos: [number, number];
  endPos: [number, number];
  scale: number;
  label?: string;
}

export type VideoPropKind =
  | 'tree'
  | 'pine'
  | 'house'
  | 'building'
  | 'desk'
  | 'bookshelf'
  | 'mountain'
  | 'rock'
  | 'boat'
  | 'streetlamp'
  | 'stage'
  | 'portal'
  | 'chest'
  | 'flower'
  | 'fountain'
  | 'goalpost'
  | 'ball';

export interface VideoPropSpec {
  kind: VideoPropKind;
  x: number;
  z: number;
  scale: number;
  color: string;
  rotationY?: number;
}

export type VideoElementKind =
  | 'orb'
  | 'planet'
  | 'ring'
  | 'wave'
  | 'bars'
  | 'grid'
  | 'particle-stream'
  | 'rocket'
  | 'atom'
  | 'tree'
  | 'building'
  | 'chart-line'
  | 'code-card'
  | 'text-callout'
  | 'character'
  | 'heart'
  | 'star'
  | 'lightning'
  | 'trophy'
  | 'shield'
  | 'sword'
  | 'gamepad'
  | 'camera'
  | 'music'
  | 'book'
  | 'flame'
  | 'cloud'
  | 'sun'
  | 'moon'
  | 'car';

export interface VideoSceneElement {
  kind: VideoElementKind;
  x: number;
  y: number;
  scale: number;
  color: string;
  motion: 'float' | 'orbit' | 'pulse' | 'rise' | 'slide-right' | 'spin' | 'static';
  label?: string;
}

export interface VideoScene {
  id: string;
  title: string;
  narration: string;
  subtitle: string;
  durationSeconds: number;
  biome: VideoBiome;
  mood: VideoMood;
  weather?: VideoWeatherType;
  cameraShot: VideoCameraShot;
  cameraMotion: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'orbit';
  transition: 'crossfade' | 'wipe' | 'zoom';
  background: {
    topColor: string;
    bottomColor: string;
    accentColor: string;
    atmosphere: 'stars' | 'grid' | 'bokeh' | 'aurora' | 'minimal';
  };
  actors: VideoActorSpec[];
  props: VideoPropSpec[];
  elements: VideoSceneElement[];
  keyPoints?: string[];
}

export interface VideoQualityReport {
  passed: boolean;
  movingSceneCount: number;
  totalScenes: number;
  characterConsistent: boolean;
  minTravelDistance: number;
  warnings: string[];
}

export interface VideoStoryboard {
  id: string;
  title: string;
  videoType: Exclude<VideoFormatType, 'auto'>;
  style: VideoVisualStyle;
  aspectRatio: VideoAspectRatio;
  totalDurationSeconds: number;
  createdAt: number;
  scenes: VideoScene[];
  qualityReport?: VideoQualityReport;
}

export type ImageGenerationMode = 'remix' | 'vector' | 'pixel';

export interface PhotoRemixRecipe {
  title: string;
  brightness: number; // 0.65..1.45
  contrast: number; // 0.75..1.65
  saturate: number; // 0.2..2.2
  hueRotate: number; // -180..180
  sepia: number; // 0..0.85
  bloom: number; // 0..0.6
  vignette: number; // 0..0.85
  tintTopColor: string;
  tintBottomColor: string;
  tintOpacity: number; // 0..0.65
  blendMode: 'screen' | 'overlay' | 'soft-light' | 'color' | 'multiply';
  particleEffect: 'none' | 'rain' | 'neon-sparks' | 'bokeh' | 'sunbeams' | 'grain';
  edgeStyle: 'natural' | 'cyber-scan' | 'comic-ink' | 'dream-glow' | 'film-noir';
  palette: string[];
  artDirectionNotes: string;
}

export interface ReferenceImageInput {
  id: string;
  name: string;
  mimeType: string;
  dataBase64: string;
  previewUrl: string;
}

export interface GeneratedArtwork {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
  title: string;
  svgMarkup: string;
  imageUrl?: string;
  mode?: ImageGenerationMode;
  referenceCount?: number;
  remixRecipe?: PhotoRemixRecipe;
  palette: string[];
  artDirectionNotes: string;
  createdAt: number;
}

export interface BrainstormResult {
  topic: string;
  summary: string;
  pillars: Array<{
    category: string;
    ideas: Array<{
      title: string;
      description: string;
      actionStep: string;
    }>;
  }>;
}
