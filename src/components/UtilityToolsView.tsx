import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  FileText,
  Languages,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  blobToBase64,
  fetchElevenLabsVoices,
  runUtilityTool,
  synthesizeSpeech,
  transcribeAudio,
} from '../utils/apiClient';
import {
  DEFAULT_ELEVENLABS_VOICE_ID,
  ELEVENLABS_PRESET_VOICES,
} from '../utils/nexoraLogic';
import type {
  AppLanguage,
  BrainstormResult,
  ElevenLabsVoice,
  TtsProvider,
  VoiceName,
} from '../types/nexora';

/* ---------------- STORY GENERATOR ---------------- */
export const StoryGeneratorView: React.FC<{
  language: AppLanguage;
  voiceName: VoiceName;
  ttsProvider?: TtsProvider;
  elevenLabsVoiceId?: string;
}> = ({ language, voiceName, ttsProvider = 'gemini', elevenLabsVoiceId }) => {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('Sci-Fi');
  const [tone, setTone] = useState('Inspiring');
  const [length, setLength] = useState('Medium (~600 words)');
  const [outLang, setOutLang] = useState<AppLanguage>(language);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runUtilityTool<{ result: string }>('story', {
        prompt,
        genre,
        tone,
        length,
        language: outLang,
      });
      setResult(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Story generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleListen = async () => {
    if (!result) return;
    if (speaking) {
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    try {
      const { audioBase64, mimeType } = await synthesizeSpeech({
        text: result,
        voiceName,
        style: 'Expressive storyteller',
        provider: ttsProvider,
        elevenLabsVoiceId,
      });
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(result.replace(/[#*_`>]/g, '').slice(0, 800));
        utter.onend = () => setSpeaking(false);
        utter.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utter);
      } else {
        setSpeaking(false);
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Story Generator
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Craft original stories in English, Hindi, or Hinglish with optional expressive narration.
          </p>
        </div>

        <form
          onSubmit={handleGenerate}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]"
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="story-genre" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Genre
              </label>
              <select
                id="story-genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {['Sci-Fi', 'Fantasy', 'Mystery', 'Adventure', 'Horror', 'Comedy', 'Moral Kids Story'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="story-tone" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Tone
              </label>
              <select
                id="story-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {['Inspiring', 'Suspenseful', 'Emotional', 'Humorous', 'Cinematic'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="story-length" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Length
              </label>
              <select
                id="story-length"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="Short (~250 words)">Short</option>
                <option value="Medium (~600 words)">Medium</option>
                <option value="Long (~1100 words)">Long</option>
              </select>
            </div>
            <div>
              <label htmlFor="story-lang" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Language
              </label>
              <select
                id="story-lang"
                value={outLang}
                onChange={(e) => setOutLang(e.target.value as AppLanguage)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Hinglish">Hinglish</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="story-prompt" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Story Idea, Characters, or Setting
            </label>
            <textarea
              id="story-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A teenage astronomer in Jaipur discovers a faint radio signal coming from Europa..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-45"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span>{loading ? 'Writing Story...' : 'Generate Story'}</span>
          </button>
        </form>

        {result && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#101726]">
            <div className="mb-4 flex items-center justify-end gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <button
                type="button"
                onClick={handleListen}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>{speaking ? 'Reading...' : 'Read Aloud'}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(result);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Story'}</span>
              </button>
            </div>
            <MarkdownRenderer content={result} />
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------------- AI TRANSLATOR ---------------- */
const TRANSLATE_LANGS = [
  'English',
  'Hindi',
  'Hinglish',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Arabic',
  'Bengali',
  'Tamil',
];

export const TranslatorView: React.FC = () => {
  const [sourceLang, setSourceLang] = useState('Auto-detect');
  const [targetLang, setTargetLang] = useState('Hindi');
  const [tone, setTone] = useState('Natural');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runUtilityTool<{ result: string }>('translator', {
        sourceLang,
        targetLang,
        tone,
        text,
      });
      setResult(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            AI Translator
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Fluently translate between English, Hindi, Hinglish, and major world languages.
          </p>
        </div>

        <form onSubmit={handleTranslate} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#101726]">
            <select
              aria-label="Source language"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="Auto-detect">Auto-detect</option>
              {TRANSLATE_LANGS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <button
              type="button"
              aria-label="Swap languages"
              onClick={() => {
                if (sourceLang !== 'Auto-detect') {
                  const prevSource = sourceLang;
                  setSourceLang(targetLang);
                  setTargetLang(prevSource);
                }
              }}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>

            <select
              aria-label="Target language"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              {TRANSLATE_LANGS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <select
              aria-label="Translation tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="Natural">Natural</option>
              <option value="Simple & Casual">Simple & Casual</option>
              <option value="Formal & Professional">Formal & Professional</option>
            </select>

            <button
              type="submit"
              disabled={!text.trim() || loading}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-45"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
              <span>Translate</span>
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <textarea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to translate..."
              aria-label="Source text to translate"
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-[#101726] dark:text-slate-100"
            />

            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#101726]">
              <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {targetLang} Output
                </span>
                {result && (
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(result);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-cyan-400"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {result ? (
                  <MarkdownRenderer content={result} />
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Translation will appear here...
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------------- TEXT SUMMARIZER ---------------- */
export const SummarizerView: React.FC<{ language: AppLanguage }> = ({ language }) => {
  const [text, setText] = useState('');
  const [format, setFormat] = useState('Bullet Points');
  const [outLang, setOutLang] = useState<AppLanguage>(language);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runUtilityTool<{ result: string }>('summarizer', {
        text,
        format,
        language: outLang,
      });
      setResult(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summarization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Text Summarizer
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Turn long articles, study notes, or documents into crisp summaries in seconds.
          </p>
        </div>

        <form
          onSubmit={handleSummarize}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]"
        >
          <div className="flex flex-wrap items-center gap-2">
            {['Bullet Points', 'Executive Summary', 'Simple ELI5', 'Key Takeaways'].map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormat(fmt)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  format === fmt
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                    : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                {fmt}
              </button>
            ))}

            <select
              aria-label="Summary language"
              value={outLang}
              onChange={(e) => setOutLang(e.target.value as AppLanguage)}
              className="ml-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Hinglish">Hinglish</option>
            </select>
          </div>

          <textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your article, lecture notes, or paragraph here..."
            aria-label="Text to summarize"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!text.trim() || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:opacity-45"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span>{loading ? 'Summarizing...' : 'Summarize Text'}</span>
          </button>
        </form>

        {result && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#101726]">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                {format}
              </h2>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(result);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-cyan-400"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <MarkdownRenderer content={result} />
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------------- AI VOICE ASSISTANT ---------------- */
export const VoiceAssistantView: React.FC<{
  language: AppLanguage;
  voiceName: VoiceName;
  ttsProvider?: TtsProvider;
  elevenLabsVoiceId?: string;
  onChangeTtsSettings?: (patch: {
    ttsProvider?: TtsProvider;
    voiceName?: VoiceName;
    elevenLabsVoiceId?: string;
  }) => void;
}> = ({
  language,
  voiceName,
  ttsProvider = 'gemini',
  elevenLabsVoiceId = DEFAULT_ELEVENLABS_VOICE_ID,
  onChangeTtsSettings,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<TtsProvider>(ttsProvider);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(voiceName);
  const [selectedElVoice, setSelectedElVoice] = useState<string>(elevenLabsVoiceId);
  const [elVoices, setElVoices] = useState<ElevenLabsVoice[]>(ELEVENLABS_PRESET_VOICES);
  const [elConfigured, setElConfigured] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'transcribing' | 'thinking' | 'speaking'>('idle');
  const [manualInput, setManualInput] = useState('');
  const [history, setHistory] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [latestAudio, setLatestAudio] = useState<{
    dataUrl: string;
    mimeType: string;
    provider: TtsProvider;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSelectedEngine(ttsProvider);
  }, [ttsProvider]);

  useEffect(() => {
    setSelectedVoice(voiceName);
  }, [voiceName]);

  useEffect(() => {
    setSelectedElVoice(elevenLabsVoiceId);
  }, [elevenLabsVoiceId]);

  useEffect(() => {
    fetchElevenLabsVoices()
      .then((res) => {
        if (res.voices.length > 0) setElVoices(res.voices);
        setElConfigured(res.configured);
      })
      .catch(() => {});

    return () => {
      audioRef.current?.pause();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playSynthesizedText = async (textToSpeak: string) => {
    setStatus('speaking');
    const tts = await synthesizeSpeech({
      text: textToSpeak,
      voiceName: selectedVoice,
      provider: selectedEngine,
      elevenLabsVoiceId: selectedElVoice,
    });
    const dataUrl = `data:${tts.mimeType};base64,${tts.audioBase64}`;
    setLatestAudio({
      dataUrl,
      mimeType: tts.mimeType,
      provider: selectedEngine,
    });
    const audio = new Audio(dataUrl);
    audioRef.current = audio;
    audio.onended = () => setStatus('idle');
    audio.onerror = () => setStatus('idle');
    await audio.play().catch(() => {
      setStatus('idle');
    });
  };

  const askAndSpeak = async (spokenText: string) => {
    if (!spokenText.trim()) return;
    setError(null);
    setHistory((prev) => [...prev, { role: 'user', text: spokenText.trim() }]);
    setStatus('thinking');

    try {
      const { result } = await runUtilityTool<{ result: string }>('voice', {
        prompt: spokenText.trim(),
        language,
      });
      setHistory((prev) => [...prev, { role: 'ai', text: result }]);
      try {
        await playSynthesizedText(result);
      } catch (ttsErr) {
        setStatus('idle');
        setError(ttsErr instanceof Error ? ttsErr.message : 'Speech synthesis failed.');
      }
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Voice assistant failed.');
    }
  };

  const handleDirectSpeakOnly = async () => {
    const clean = manualInput.trim();
    if (!clean || status !== 'idle') return;
    setError(null);
    setManualInput('');
    setHistory((prev) => [...prev, { role: 'ai', text: clean }]);
    try {
      await playSynthesizedText(clean);
    } catch (ttsErr) {
      setStatus('idle');
      setError(ttsErr instanceof Error ? ttsErr.message : 'Speech synthesis failed.');
    }
  };

  const toggleMic = async () => {
    setError(null);
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 200) return;
        setStatus('transcribing');
        try {
          const audioBase64 = await blobToBase64(blob);
          const { text } = await transcribeAudio({
            audioBase64,
            mimeType: blob.type || 'audio/webm',
          });
          if (text) {
            await askAndSpeak(text);
          } else {
            setStatus('idle');
          }
        } catch (err) {
          setStatus('idle');
          setError(err instanceof Error ? err.message : 'Could not transcribe voice.');
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError('Microphone unavailable. You can also type below to hear NEXORA speak.');
    }
  };

  const handleDownloadAudio = () => {
    if (!latestAudio) return;
    const ext = latestAudio.mimeType.includes('mpeg') ? 'mp3' : 'wav';
    const a = document.createElement('a');
    a.href = latestAudio.dataUrl;
    a.download = `nexora-voice-${latestAudio.provider}.${ext}`;
    a.click();
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              AI Voice Assistant
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Speak naturally or convert text to studio-quality speech with Gemini TTS & ElevenLabs voices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Voice TTS provider"
              className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                aria-pressed={selectedEngine === 'gemini'}
                onClick={() => {
                  setSelectedEngine('gemini');
                  onChangeTtsSettings?.({ ttsProvider: 'gemini' });
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedEngine === 'gemini'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Gemini TTS
              </button>
              <button
                type="button"
                aria-pressed={selectedEngine === 'elevenlabs'}
                onClick={() => {
                  setSelectedEngine('elevenlabs');
                  onChangeTtsSettings?.({ ttsProvider: 'elevenlabs' });
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedEngine === 'elevenlabs'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                ElevenLabs
              </button>
            </div>

            {selectedEngine === 'elevenlabs' ? (
              <select
                aria-label="Select ElevenLabs Voice"
                value={selectedElVoice}
                onChange={(e) => {
                  setSelectedElVoice(e.target.value);
                  onChangeTtsSettings?.({ elevenLabsVoiceId: e.target.value });
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {elVoices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    ElevenLabs: {v.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                aria-label="Select AI Voice"
                value={selectedVoice}
                onChange={(e) => {
                  const val = e.target.value as VoiceName;
                  setSelectedVoice(val);
                  onChangeTtsSettings?.({ voiceName: val });
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as VoiceName[]).map((v) => (
                  <option key={v} value={v}>Voice: {v}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {selectedEngine === 'elevenlabs' && !elConfigured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            ElevenLabs selected. Add <span className="font-mono font-semibold">ELEVENLABS_API_KEY</span> in Settings &gt; Secrets to synthesize ElevenLabs voices, or toggle Gemini TTS above anytime.
          </div>
        )}

        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#101726]">
          <button
            type="button"
            onClick={toggleMic}
            aria-label={isRecording ? 'Stop listening' : 'Tap to speak'}
            className={`relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 ${
              isRecording
                ? 'bg-red-500'
                : 'bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500'
            }`}
          >
            {isRecording ? <MicOff className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
          </button>

          <p className="mt-4 font-display text-base font-semibold text-slate-900 dark:text-white">
            {isRecording
              ? 'Listening... Tap to finish'
              : status === 'transcribing'
                ? 'Transcribing your voice...'
                : status === 'thinking'
                  ? 'NEXORA is thinking...'
                  : status === 'speaking'
                    ? `Speaking via ${selectedEngine === 'elevenlabs' ? 'ElevenLabs' : 'Gemini TTS'}...`
                    : 'Tap the microphone to speak'}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const txt = manualInput;
              setManualInput('');
              askAndSpeak(txt);
            }}
            className="mt-5 flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Ask a question or enter script to voice..."
              aria-label="Type a voice prompt"
              className="w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDirectSpeakOnly}
                disabled={!manualInput.trim() || status !== 'idle'}
                title="Read this text directly using selected voice engine"
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                <Volume2 className="h-3.5 w-3.5 text-cyan-500" />
                <span>Speak Text</span>
              </button>
              <button
                type="submit"
                disabled={!manualInput.trim() || status !== 'idle'}
                aria-label="Send voice text prompt"
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-45 whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Ask & Speak</span>
              </button>
            </div>
          </form>

          {latestAudio && (
            <div className="mt-4 flex w-full max-w-lg flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              <audio controls src={latestAudio.dataUrl} className="h-8 flex-1 min-w-[180px]" />
              <button
                type="button"
                onClick={handleDownloadAudio}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download {latestAudio.mimeType.includes('mpeg') ? 'MP3' : 'WAV'}</span>
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 w-full max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Voice Conversation Transcript
            </h2>
            <div className="space-y-2.5">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-start justify-between gap-3 rounded-xl p-3 text-sm ${
                    item.role === 'user'
                      ? 'bg-indigo-500/10 text-slate-900 dark:text-indigo-200'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  <div>
                    <span className="mr-2 font-semibold">
                      {item.role === 'user' ? 'You:' : 'NEXORA:'}
                    </span>
                    {item.text}
                  </div>
                  {item.role === 'ai' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (status === 'idle') {
                          setError(null);
                          playSynthesizedText(item.text).catch((err) => {
                            setStatus('idle');
                            setError(err instanceof Error ? err.message : 'TTS failed.');
                          });
                        }
                      }}
                      aria-label="Replay message audio"
                      className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-cyan-300"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------------- AI BRAINSTORMING ---------------- */
export const BrainstormingView: React.FC<{ language: AppLanguage }> = ({ language }) => {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('Startup Ideas');
  const [result, setResult] = useState<BrainstormResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrainstorm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runUtilityTool<BrainstormResult>('brainstorming', {
        topic,
        category,
        language,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Brainstorming failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            AI Brainstorming
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Generate structured idea pillars with concrete action steps for startups, games, content, or study projects.
          </p>
        </div>

        <form
          onSubmit={handleBrainstorm}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]"
        >
          <div className="flex flex-wrap gap-1.5">
            {['Startup Ideas', 'YouTube Content', 'Game Mechanics', 'Study Project', 'Creative Campaign'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  category === cat
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                    : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic, challenge, or goal to brainstorm..."
              aria-label="Brainstorming topic"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!topic.trim() || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:opacity-45 whitespace-nowrap"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              <span>Generate Ideas</span>
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
              {error}
            </div>
          )}
        </form>

        {result && (
          <div className="space-y-5">
            {result.summary && (
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {result.summary}
              </p>
            )}
            <div className="grid gap-5 md:grid-cols-2">
              {result.pillars?.map((pillar, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]"
                >
                  <h2 className="font-display text-base font-semibold text-indigo-600 dark:text-cyan-300">
                    {pillar.category}
                  </h2>
                  <div className="mt-3 space-y-3">
                    {pillar.ideas?.map((idea, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {idea.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {idea.description}
                        </p>
                        <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-cyan-400">
                          Next step: {idea.actionStep}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
