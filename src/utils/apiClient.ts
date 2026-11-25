import { formatApiErrorMessage } from './nexoraLogic';
import type {
  AiProviderId,
  AppLanguage,
  BrainstormResult,
  ChatMessage,
  CodingLanguage,
  CodingMode,
  ElevenLabsVoice,
  HomeworkMode,
  HomeworkSubject,
  ImageGenerationMode,
  PhotoRemixRecipe,
  ProviderStatus,
  TtsDialogueTurn,
  TtsProvider,
  TtsSpeechMode,
  VideoAnimationIntensity,
  VideoAspectRatio,
  VideoCameraOverride,
  VideoFormatType,
  VideoResolution,
  VideoScene,
  VideoVisualStyle,
  VoiceName,
  YoutubeCategory,
  YoutubeSeoResult,
} from '../types/nexora';

export async function fetchProviders(): Promise<ProviderStatus[]> {
  const response = await fetch('/api/providers');
  if (!response.ok) return [];
  const data = (await response.json().catch(() => ({}))) as { providers?: ProviderStatus[] };
  return Array.isArray(data.providers) ? data.providers : [];
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  systemInstruction: string,
  onChunk: (fullText: string) => void,
  signal?: AbortSignal,
  provider: AiProviderId = 'gemini',
  modelId = 'gemini-4-hydrogen'
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      provider,
      modelId,
      systemInstruction,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          dataBase64: a.dataBase64,
          textContent: a.textContent,
        })),
      })),
    }),
  });

  if (!response.ok || !response.body) {
    let errText = '';
    try {
      const json = await response.json();
      errText = json.error;
    } catch {
      errText = await response.text();
    }
    throw new Error(formatApiErrorMessage(response.status, errText));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payloadStr = trimmed.slice(5).trim();
      if (!payloadStr) continue;
      const parsed = JSON.parse(payloadStr) as {
        text?: string;
        error?: string;
        status?: number;
        done?: boolean;
      };
      if (parsed.error) {
        throw new Error(formatApiErrorMessage(parsed.status ?? 500, parsed.error));
      }
      if (parsed.text) {
        accumulated += parsed.text;
        onChunk(accumulated);
      }
    }
  }

  return accumulated;
}

async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatApiErrorMessage(response.status, data?.error));
  }
  return data as T;
}

export async function runHomeworkHelper(params: {
  subject: HomeworkSubject;
  mode: HomeworkMode;
  question: string;
  studentAnswer?: string;
  language: AppLanguage;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<string> {
  const res = await postJson<{ result: string }>('/api/homework', params);
  return res.result;
}

export async function runYoutubeSeo(params: {
  topic: string;
  category: YoutubeCategory;
  language: AppLanguage;
}): Promise<YoutubeSeoResult> {
  return postJson<YoutubeSeoResult>('/api/youtube', params);
}

export async function runCodingAssistant(params: {
  language: CodingLanguage;
  mode: CodingMode;
  prompt: string;
  code?: string;
  outputLanguage: AppLanguage;
}): Promise<string> {
  const res = await postJson<{ result: string }>('/api/coding', params);
  return res.result;
}

export async function runUtilityTool<T = { result: string }>(
  tool: 'story' | 'translator' | 'summarizer' | 'brainstorming' | 'voice',
  payload: Record<string, string>
): Promise<T> {
  return postJson<T>('/api/utility', { tool, payload });
}

export async function generateVectorArtwork(params: {
  prompt: string;
  style: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
  previousSvg?: string;
  previousImageBase64?: string;
  previousImageMimeType?: string;
  mode?: ImageGenerationMode;
  referenceImages?: Array<{
    name: string;
    mimeType: string;
    dataBase64: string;
  }>;
}): Promise<{
  mode?: ImageGenerationMode;
  title: string;
  svgMarkup: string;
  imageUrl?: string;
  remixRecipe?: PhotoRemixRecipe;
  palette: string[];
  artDirectionNotes: string;
}> {
  return postJson('/api/image', params);
}

export async function generateVideoStoryboard(
  params: {
    topic: string;
    durationSeconds: number;
    videoType?: VideoFormatType;
    style: VideoVisualStyle;
    aspectRatio: VideoAspectRatio;
    language: AppLanguage;
    animationIntensity?: VideoAnimationIntensity;
    cameraOverride?: VideoCameraOverride;
  },
  signal?: AbortSignal
): Promise<{
  title: string;
  videoType?: VideoFormatType;
  scenes: VideoScene[];
}> {
  return postJson('/api/video/storyboard', params, signal);
}

export async function generateVeoVideo(
  params: {
    prompt: string;
    durationSeconds: number;
    aspectRatio: VideoAspectRatio;
    resolution: VideoResolution;
    style?: VideoVisualStyle;
    cameraOverride?: VideoCameraOverride;
  },
  signal?: AbortSignal
): Promise<{
  videoBase64: string;
  mimeType: string;
  model: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
}> {
  return postJson('/api/video/veo', params, signal);
}

export async function fetchElevenLabsVoices(): Promise<{
  configured: boolean;
  voices: ElevenLabsVoice[];
}> {
  const response = await fetch('/api/elevenlabs/voices');
  if (!response.ok) {
    return { configured: false, voices: [] };
  }
  const data = (await response.json().catch(() => ({}))) as {
    configured?: boolean;
    voices?: ElevenLabsVoice[];
  };
  return {
    configured: Boolean(data.configured),
    voices: Array.isArray(data.voices) ? data.voices : [],
  };
}

export async function synthesizeSpeech(
  params: {
    text: string;
    voiceName: VoiceName;
    style?: string;
    provider?: TtsProvider;
    elevenLabsVoiceId?: string;
    mode?: TtsSpeechMode;
    secondaryVoiceName?: VoiceName;
    speakerAName?: string;
    speakerBName?: string;
    dialogueLines?: TtsDialogueTurn[];
    stability?: number;
    similarityBoost?: number;
  },
  signal?: AbortSignal
): Promise<{ audioBase64: string; mimeType: string; provider?: TtsProvider }> {
  return postJson('/api/tts', params, signal);
}

export async function transcribeAudio(params: {
  audioBase64: string;
  mimeType: string;
}): Promise<{ text: string }> {
  return postJson('/api/transcribe', params);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to encode audio.'));
    reader.readAsDataURL(blob);
  });
}

export type { BrainstormResult };
