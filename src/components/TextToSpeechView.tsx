import React, { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Download,
  Loader2,
  Play,
  Sliders,
  Sparkles,
  Trash2,
  Users,
  Volume2,
} from 'lucide-react';
import { fetchElevenLabsVoices, synthesizeSpeech } from '../utils/apiClient';
import {
  cleanTextForTts,
  DEFAULT_ELEVENLABS_VOICE_ID,
  ELEVENLABS_PRESET_VOICES,
  GEMINI_VOICE_CATALOG,
  parseDialogueLines,
  TTS_STYLE_PRESETS,
} from '../utils/nexoraLogic';
import type {
  ElevenLabsVoice,
  TtsClipRecord,
  TtsProvider,
  TtsSpeechMode,
  VoiceName,
} from '../types/nexora';

interface TextToSpeechViewProps {
  voiceName: VoiceName;
  ttsProvider: TtsProvider;
  elevenLabsVoiceId: string;
  onChangeTtsSettings?: (patch: {
    ttsProvider?: TtsProvider;
    voiceName?: VoiceName;
    elevenLabsVoiceId?: string;
  }) => void;
}

const SAMPLE_SCRIPTS: Array<{
  id: string;
  label: string;
  mode: TtsSpeechMode;
  styleId: string;
  text: string;
}> = [
  {
    id: 'news',
    label: 'News Brief',
    mode: 'single',
    styleId: 'news',
    text: 'Good evening. Today in science and technology, researchers unveiled a next-generation neural audio engine capable of producing studio-grade narration in seconds across dozens of languages.',
  },
  {
    id: 'story',
    label: 'Story Intro',
    mode: 'single',
    styleId: 'storyteller',
    text: 'As twilight settled over the quiet mountain observatory, Maya adjusted the brass telescope and froze. Beyond the rings of Saturn, a faint turquoise pulse blinked back in steady rhythm.',
  },
  {
    id: 'hinglish',
    label: 'Hindi / Hinglish',
    mode: 'single',
    styleId: 'tutor',
    text: 'Namaste doston! Aaj hum seekhenge ki artificial intelligence kaise text ko bilkul natural human voice me convert karta hai. Bas apna script likho aur Generate Speech dabao!',
  },
  {
    id: 'dialogue',
    label: 'Podcast Dialogue',
    mode: 'dialogue',
    styleId: 'podcast',
    text: 'Alex: Welcome back to Tech Pulse! Today we are testing dual-speaker AI voices.\nSam: That is right, Alex. Both voices stay crisp, expressive, and ready for instant download.',
  },
];

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export const TextToSpeechView: React.FC<TextToSpeechViewProps> = ({
  voiceName,
  ttsProvider,
  elevenLabsVoiceId,
  onChangeTtsSettings,
}) => {
  const [engine, setEngine] = useState<TtsProvider>(ttsProvider);
  const [speechMode, setSpeechMode] = useState<TtsSpeechMode>('single');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(voiceName);
  const [secondaryVoice, setSecondaryVoice] = useState<VoiceName>('Puck');
  const [speakerAName, setSpeakerAName] = useState('Alex');
  const [speakerBName, setSpeakerBName] = useState('Sam');
  const [selectedElVoice, setSelectedElVoice] = useState<string>(
    elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID
  );
  const [elVoices, setElVoices] = useState<ElevenLabsVoice[]>(ELEVENLABS_PRESET_VOICES);
  const [elConfigured, setElConfigured] = useState(false);

  const [stylePresetId, setStylePresetId] = useState<string>('natural');
  const [customStyle, setCustomStyle] = useState<string>('');
  const [stability, setStability] = useState<number>(0.48);
  const [similarityBoost, setSimilarityBoost] = useState<number>(0.78);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const [script, setScript] = useState<string>(SAMPLE_SCRIPTS[0].text);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<TtsClipRecord | null>(null);
  const [clips, setClips] = useState<TtsClipRecord[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setEngine(ttsProvider);
  }, [ttsProvider]);

  useEffect(() => {
    if (engine === 'elevenlabs' && speechMode === 'dialogue') {
      setSpeechMode('single');
    }
  }, [engine, speechMode]);

  useEffect(() => {
    setSelectedVoice(voiceName);
  }, [voiceName]);

  useEffect(() => {
    setSelectedElVoice(elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID);
  }, [elevenLabsVoiceId]);

  useEffect(() => {
    fetchElevenLabsVoices()
      .then((res) => {
        if (res.voices.length > 0) setElVoices(res.voices);
        setElConfigured(res.configured);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, activeClip]);

  const activeStyleString =
    customStyle.trim() ||
    TTS_STYLE_PRESETS.find((p) => p.id === stylePresetId)?.style ||
    TTS_STYLE_PRESETS[0].style;

  const cleanedCount = cleanTextForTts(script, 2500).length;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanTextForTts(script, 2500);
    if (!cleaned || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const effectiveMode: TtsSpeechMode =
        engine === 'gemini' && speechMode === 'dialogue' ? 'dialogue' : 'single';
      const dialogueLines =
        effectiveMode === 'dialogue'
          ? parseDialogueLines(script, speakerAName, speakerBName)
          : undefined;

      const res = await synthesizeSpeech({
        text: cleaned,
        voiceName: selectedVoice,
        style: activeStyleString,
        provider: engine,
        elevenLabsVoiceId: selectedElVoice,
        mode: effectiveMode,
        secondaryVoiceName: secondaryVoice,
        speakerAName,
        speakerBName,
        dialogueLines,
        stability,
        similarityBoost,
      });

      const elVoiceName =
        elVoices.find((v) => v.voice_id === selectedElVoice)?.name || 'ElevenLabs Voice';
      const voiceLabel =
        engine === 'elevenlabs'
          ? `ElevenLabs · ${elVoiceName}`
          : effectiveMode === 'dialogue'
            ? `Gemini Dialogue (${selectedVoice} & ${secondaryVoice})`
            : `Gemini · ${selectedVoice}`;

      const clip: TtsClipRecord = {
        id: `tts_${Date.now()}`,
        title: cleaned.slice(0, 44) + (cleaned.length > 44 ? '...' : ''),
        text: cleaned,
        provider: engine,
        mode: effectiveMode,
        voiceLabel,
        style:
          TTS_STYLE_PRESETS.find((p) => p.id === stylePresetId)?.label || 'Custom',
        audioUrl: `data:${res.mimeType};base64,${res.audioBase64}`,
        mimeType: res.mimeType,
        createdAt: Date.now(),
      };

      setActiveClip(clip);
      setClips((prev) => [clip, ...prev].slice(0, 12));

      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.playbackRate = playbackSpeed;
          audioRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to synthesize speech audio.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadClip = (clip: TtsClipRecord) => {
    const ext = clip.mimeType.includes('mpeg') ? 'mp3' : 'wav';
    const a = document.createElement('a');
    a.href = clip.audioUrl;
    a.download = `nexora-tts-${clip.provider}-${clip.id.slice(-6)}.${ext}`;
    a.click();
  };

  const applySample = (sample: (typeof SAMPLE_SCRIPTS)[number]) => {
    setScript(sample.text);
    setStylePresetId(sample.styleId);
    setCustomStyle('');
    if (sample.mode === 'dialogue' && engine === 'gemini') {
      setSpeechMode('dialogue');
    } else {
      setSpeechMode('single');
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header + Provider Switch */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Text to Speech Studio
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Convert scripts, stories, lessons, or dual-speaker dialogues into lifelike downloadable voiceovers.
            </p>
          </div>

          <div
            role="group"
            aria-label="TTS Engine Provider"
            className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              type="button"
              aria-pressed={engine === 'gemini'}
              onClick={() => {
                setEngine('gemini');
                onChangeTtsSettings?.({ ttsProvider: 'gemini' });
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                engine === 'gemini'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Gemini TTS
            </button>
            <button
              type="button"
              aria-pressed={engine === 'elevenlabs'}
              onClick={() => {
                setEngine('elevenlabs');
                setSpeechMode('single');
                onChangeTtsSettings?.({ ttsProvider: 'elevenlabs' });
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                engine === 'elevenlabs'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              ElevenLabs
            </button>
          </div>
        </div>

        {engine === 'elevenlabs' && !elConfigured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            ElevenLabs selected. Add{' '}
            <span className="font-mono font-semibold">ELEVENLABS_API_KEY</span> in
            Settings &gt; Secrets to synthesize ElevenLabs voices, or switch to Gemini TTS above.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Studio Controls & Script Editor */}
          <form
            onSubmit={handleGenerate}
            className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#101726] lg:col-span-7"
          >
            {/* Mode + Voice Config */}
            {engine === 'gemini' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Speech Mode
                  </span>
                  <div
                    role="group"
                    aria-label="Speech generation mode"
                    className="grid max-w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      aria-pressed={speechMode === 'single'}
                      onClick={() => setSpeechMode('single')}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                        speechMode === 'single'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Volume2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Single Voice</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={speechMode === 'dialogue'}
                      onClick={() => setSpeechMode('dialogue')}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                        speechMode === 'dialogue'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span>Dual-Speaker</span>
                    </button>
                  </div>
                </div>

                {speechMode === 'single' ? (
                  <div>
                    <label
                      htmlFor="tts-gemini-voice"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      Gemini Voice Persona
                    </label>
                    <select
                      id="tts-gemini-voice"
                      value={selectedVoice}
                      onChange={(e) => {
                        const val = e.target.value as VoiceName;
                        setSelectedVoice(val);
                        onChangeTtsSettings?.({ voiceName: val });
                      }}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {GEMINI_VOICE_CATALOG.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label} — {v.tone}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70 space-y-2">
                      <label
                        htmlFor="tts-speaker-a-name"
                        className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
                      >
                        Speaker 1 Name &amp; Voice
                      </label>
                      <input
                        id="tts-speaker-a-name"
                        type="text"
                        value={speakerAName}
                        onChange={(e) => setSpeakerAName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <select
                        aria-label="Speaker 1 Voice"
                        value={selectedVoice}
                        onChange={(e) => {
                          const val = e.target.value as VoiceName;
                          setSelectedVoice(val);
                          onChangeTtsSettings?.({ voiceName: val });
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {GEMINI_VOICE_CATALOG.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label} ({v.tone})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70 space-y-2">
                      <label
                        htmlFor="tts-speaker-b-name"
                        className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
                      >
                        Speaker 2 Name &amp; Voice
                      </label>
                      <input
                        id="tts-speaker-b-name"
                        type="text"
                        value={speakerBName}
                        onChange={(e) => setSpeakerBName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <select
                        aria-label="Speaker 2 Voice"
                        value={secondaryVoice}
                        onChange={(e) => setSecondaryVoice(e.target.value as VoiceName)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {GEMINI_VOICE_CATALOG.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label} ({v.tone})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Speaking Style */}
                <div>
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Delivery Style
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {TTS_STYLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setStylePresetId(preset.id);
                          setCustomStyle('');
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                          stylePresetId === preset.id && !customStyle.trim()
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder="Optional custom direction (e.g., Warm upbeat radio host)..."
                    aria-label="Custom voice direction"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="tts-el-voice"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    ElevenLabs Voice
                  </label>
                  <select
                    id="tts-el-voice"
                    value={selectedElVoice}
                    onChange={(e) => {
                      setSelectedElVoice(e.target.value);
                      onChangeTtsSettings?.({ elevenLabsVoiceId: e.target.value });
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {elVoices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name} {v.description ? `— ${v.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="tts-el-stability" className="font-medium text-slate-600 dark:text-slate-300">
                        Voice Stability
                      </label>
                      <span className="font-mono text-indigo-600 dark:text-cyan-400">
                        {Math.round(stability * 100)}%
                      </span>
                    </div>
                    <input
                      id="tts-el-stability"
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={stability}
                      onChange={(e) => setStability(Number(e.target.value))}
                      className="mt-2 w-full accent-indigo-600"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="tts-el-similarity" className="font-medium text-slate-600 dark:text-slate-300">
                        Similarity Boost
                      </label>
                      <span className="font-mono text-indigo-600 dark:text-cyan-400">
                        {Math.round(similarityBoost * 100)}%
                      </span>
                    </div>
                    <input
                      id="tts-el-similarity"
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={similarityBoost}
                      onChange={(e) => setSimilarityBoost(Number(e.target.value))}
                      className="mt-2 w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Sample Scripts */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Samples:
                </span>
                {SAMPLE_SCRIPTS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => applySample(sample)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-500/40 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-cyan-300 whitespace-nowrap"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
              {script && (
                <button
                  type="button"
                  onClick={() => setScript('')}
                  className="text-[11px] font-medium text-slate-400 hover:text-red-500"
                >
                  Clear Text
                </button>
              )}
            </div>

            {/* Script Textarea */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="tts-script-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  {speechMode === 'dialogue' && engine === 'gemini'
                    ? `Dialogue Script (Use "${speakerAName}:" and "${speakerBName}:" per line)`
                    : 'Text to Convert into Speech'}
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {cleanedCount} / 2500
                </span>
              </div>
              <textarea
                id="tts-script-input"
                rows={7}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Type or paste any text, story, announcement, Hindi/Hinglish script, or dialogue..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!cleanedCount || isGenerating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-45"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating Speech Audio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    Generate Speech ({engine === 'elevenlabs' ? 'ElevenLabs MP3' : 'Gemini WAV'})
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Right Audio Output & History */}
          <div className="min-w-0 space-y-5 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <AudioLines className="h-4 w-4 text-cyan-500" />
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Voice Output Player
                  </h2>
                </div>
                {activeClip && (
                  <button
                    type="button"
                    onClick={() => handleDownloadClip(activeClip)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>
                      Download {activeClip.mimeType.includes('mpeg') ? 'MP3' : 'WAV'}
                    </span>
                  </button>
                )}
              </div>

              {activeClip ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-indigo-600 dark:text-cyan-300">
                        {activeClip.voiceLabel}
                      </span>
                      <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {activeClip.style}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {activeClip.text}
                    </p>
                  </div>

                  <audio
                    ref={audioRef}
                    controls
                    src={activeClip.audioUrl}
                    className="w-full"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Sliders className="h-3.5 w-3.5" />
                      <span>Playback Speed</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      {SPEED_OPTIONS.map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setPlaybackSpeed(spd)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            playbackSpeed === spd
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                  <Volume2 className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                  <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    No speech generated yet
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                    Enter your text or pick a sample on the left, select a voice persona, and click Generate Speech.
                  </p>
                </div>
              )}
            </div>

            {/* Session Clips History */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Recent Speech Clips ({clips.length})
              </h2>
              {clips.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Generated audio clips from this session will appear here for instant replay or download.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {clips.map((clip) => (
                    <li
                      key={clip.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs ${
                        activeClip?.id === clip.id
                          ? 'border-indigo-500/60 bg-indigo-500/10'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveClip(clip);
                          setTimeout(() => {
                            if (audioRef.current) {
                              audioRef.current.playbackRate = playbackSpeed;
                              audioRef.current.play().catch(() => {});
                            }
                          }, 50);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-cyan-300">
                          <Play className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {clip.title}
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {clip.voiceLabel} · {clip.style}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadClip(clip)}
                          aria-label={`Download ${clip.title}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-cyan-300"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setClips((prev) => prev.filter((c) => c.id !== clip.id));
                            if (activeClip?.id === clip.id) setActiveClip(null);
                          }}
                          aria-label={`Delete ${clip.title}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
