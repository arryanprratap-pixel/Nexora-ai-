import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileCode2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  blobToBase64,
  fileToBase64,
  synthesizeSpeech,
  transcribeAudio,
} from '../utils/apiClient';
import {
  AI_MODEL_CATALOG,
  NEXORA_EMBLEM_URL,
  getModelSpec,
} from '../utils/nexoraLogic';
import type {
  AiProviderId,
  ChatAttachment,
  ChatMessage,
  ProviderStatus,
  ToolId,
  UserSettings,
} from '../types/nexora';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (text: string, attachments: ChatAttachment[]) => Promise<void>;
  onStopStreaming: () => void;
  onSwitchTool: (tool: ToolId) => void;
  settings: UserSettings;
  providers: ProviderStatus[];
  onSelectModel: (modelId: string) => void;
}

const STARTER_PROMPTS: Array<{
  title: string;
  subtitle: string;
  prompt: string;
  tool?: ToolId;
}> = [
  {
    title: 'Explain Quantum Physics Simply',
    subtitle: 'Science · English or Hinglish',
    prompt: 'Explain quantum superposition in very simple everyday language with an example.',
  },
  {
    title: 'Build a Responsive Portfolio',
    subtitle: 'Coding · HTML, CSS & JS',
    prompt: 'Write a clean, modern single-file HTML/CSS landing page for a game developer.',
  },
  {
    title: 'Samjhao Pythagoras Theorem',
    subtitle: 'Hinglish · Step-by-step Maths',
    prompt: 'Pythagoras theorem ko simple Hinglish me step-by-step example ke saath samjhao.',
  },
  {
    title: 'Create a 2-Minute Animated Video',
    subtitle: 'Motion Studio · Multi-scene',
    prompt: '',
    tool: 'video',
  },
];

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onSwitchTool,
  settings,
  providers,
  onSelectModel,
}) => {
  const activeModel = getModelSpec(settings.selectedModelId);
  const activeProviderStatus = providers.find((p) => p.id === activeModel.provider);
  const providerGroups: Array<{ id: AiProviderId; label: string }> = [
    { id: 'gemini', label: 'Google Gemini' },
    { id: 'openai', label: 'OpenAI ChatGPT' },
    { id: 'anthropic', label: 'Anthropic Claude' },
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'openrouter', label: 'OpenRouter (Grok · Llama · Mistral · Qwen)' },
  ];
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;
    const text = input;
    const files = attachments;
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(text, files);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const loaded: ChatAttachment[] = [];
    for (const file of files.slice(0, 4)) {
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      if (file.type.startsWith('text/') || /\.(ts|tsx|js|py|lua|html|css|json|md)$/i.test(file.name)) {
        const textContent = await file.text();
        loaded.push({
          id,
          name: file.name,
          mimeType: file.type || 'text/plain',
          textContent: textContent.slice(0, 24000),
          size: file.size,
        });
      } else {
        const dataBase64 = await fileToBase64(file);
        loaded.push({
          id,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64,
          size: file.size,
        });
      }
    }
    setAttachments((prev) => [...prev, ...loaded]);
    e.target.value = '';
  };

  const toggleRecording = async () => {
    setVoiceError(null);
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 200) return;
        setIsTranscribing(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const { text } = await transcribeAudio({
            audioBase64,
            mimeType: blob.type || 'audio/webm',
          });
          if (text) {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
          }
        } catch (err) {
          setVoiceError(err instanceof Error ? err.message : 'Could not transcribe audio.');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setVoiceError('Microphone access was denied or is unavailable in this browser.');
    }
  };

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleReadAloud = async (id: string, text: string) => {
    if (speakingId === id) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      return;
    }
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(id);
    setVoiceError(null);

    const speakFallback = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(text.replace(/[#*_`>]/g, '').slice(0, 800));
        utter.onend = () => setSpeakingId(null);
        utter.onerror = () => setSpeakingId(null);
        window.speechSynthesis.speak(utter);
        return true;
      }
      return false;
    };

    try {
      const { audioBase64, mimeType } = await synthesizeSpeech({
        text,
        voiceName: settings.voiceName,
        provider: settings.ttsProvider,
        elevenLabsVoiceId: settings.elevenLabsVoiceId,
      });
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioPlayerRef.current = audio;
      audio.onended = () => setSpeakingId(null);
      audio.onerror = () => setSpeakingId(null);
      await audio.play();
    } catch (err) {
      if (!speakFallback()) {
        setSpeakingId(null);
        setVoiceError(err instanceof Error ? err.message : 'Unable to play voice response.');
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Multi-AI Model Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white/60 px-4 py-2 dark:border-slate-800/80 dark:bg-[#0D1321]/70 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <label
            htmlFor="ai-model-select"
            className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
          >
            AI Model
          </label>
          <select
            id="ai-model-select"
            value={activeModel.id}
            onChange={(e) => onSelectModel(e.target.value)}
            className="max-w-[230px] sm:max-w-xs rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {providerGroups.map((group) => {
              const groupStatus = providers.find((p) => p.id === group.id);
              const suffix = groupStatus
                ? groupStatus.configured
                  ? 'Ready'
                  : `Needs ${groupStatus.envVar}`
                : '';
              return (
                <optgroup
                  key={group.id}
                  label={suffix ? `${group.label} (${suffix})` : group.label}
                >
                  {AI_MODEL_CATALOG.filter((m) => m.provider === group.id).map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label} — {model.tagline}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          {activeProviderStatus && !activeProviderStatus.configured ? (
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-300">
              Add {activeProviderStatus.envVar} in Settings &gt; Secrets to enable {activeProviderStatus.name}
            </span>
          ) : (
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
              {activeModel.providerName} · Ready
            </span>
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-1 shadow-sm dark:border-slate-800">
                <img
                  src={NEXORA_EMBLEM_URL}
                  alt="NEXORA AI Emblem"
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-xl object-cover"
                />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl text-balance">
                What can I help you with today?
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
                Ask anything in English, Hindi, or Hinglish. Attach images or code, or launch a studio tool from the sidebar.
              </p>

              <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      if (item.tool) {
                        onSwitchTool(item.tool);
                      } else {
                        onSendMessage(item.prompt, []);
                      }
                    }}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#101726] dark:hover:border-cyan-500/40 dark:hover:bg-[#141d30]"
                  >
                    <p className="text-xs font-medium text-indigo-600 dark:text-cyan-400">
                      {item.subtitle}
                    </p>
                    <p className="mt-1 font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <img
                        src={NEXORA_EMBLEM_URL}
                        alt="NEXORA AI"
                        referrerPolicy="no-referrer"
                        className="mt-1 h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-slate-300 dark:ring-slate-700"
                      />
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-sm'
                          : msg.error
                            ? 'border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                            : 'border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-[#101726] dark:text-slate-100'
                      }`}
                    >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2.5 flex flex-wrap gap-2">
                          {msg.attachments.map((att) =>
                            att.mimeType.startsWith('image/') && att.dataBase64 ? (
                              <img
                                key={att.id}
                                src={`data:${att.mimeType};base64,${att.dataBase64}`}
                                alt={att.name}
                                className="max-h-44 rounded-xl border border-white/20 object-contain"
                              />
                            ) : (
                              <div
                                key={att.id}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-black/15 px-2.5 py-1 text-xs"
                              >
                                <FileCode2 className="h-3.5 w-3.5" />
                                <span className="max-w-[180px] truncate">{att.name}</span>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {isUser ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                      ) : msg.content ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <div
                          aria-label="NEXORA AI is thinking"
                          className="flex items-center gap-3 py-1 text-sm text-slate-500 dark:text-slate-400"
                        >
                          <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-nexora-orbit" />
                          <span>Thinking...</span>
                        </div>
                      )}

                      {!isUser && msg.content && !msg.error && (
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="text-emerald-500">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReadAloud(msg.id, msg.content)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                              <span>{speakingId === msg.id ? 'Stop Audio' : 'Listen'}</span>
                            </button>
                          </div>
                          {msg.modelLabel && (
                            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                              {msg.modelLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <img
                        src={settings.profile.avatarUrl}
                        alt={settings.profile.name}
                        referrerPolicy="no-referrer"
                        className="mt-1 h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-slate-300 dark:ring-slate-700"
                      />
                    )}
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-slate-800/80 dark:bg-[#0D1321]/95 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {voiceError && (
            <div className="mb-2 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
              <span>{voiceError}</span>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                aria-label="Dismiss voice notice"
                className="p-0.5 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span className="max-w-[160px] truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                    }
                    aria-label={`Remove ${att.name}`}
                    className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2 focus-within:border-indigo-500 dark:border-slate-700/80 dark:bg-[#131B2E]"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.txt,.md,.json,.js,.ts,.tsx,.py,.lua,.html,.css,audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file or image"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording
                  ? 'Listening... tap mic to stop'
                  : isTranscribing
                    ? 'Transcribing speech...'
                    : 'Message NEXORA AI...'
              }
              aria-label="Chat message input"
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-sm leading-5 text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            <button
              type="button"
              onClick={toggleRecording}
              aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                aria-label="Stop response"
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                aria-label="Send message"
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
