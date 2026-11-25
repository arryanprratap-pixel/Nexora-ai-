import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Volume2,
  X,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  fileToBase64,
  runHomeworkHelper,
  synthesizeSpeech,
} from '../utils/apiClient';
import type {
  AppLanguage,
  HomeworkMode,
  HomeworkSubject,
  TtsProvider,
  VoiceName,
} from '../types/nexora';

interface HomeworkHelperViewProps {
  language: AppLanguage;
  voiceName: VoiceName;
  ttsProvider?: TtsProvider;
  elevenLabsVoiceId?: string;
}

const SUBJECTS: HomeworkSubject[] = ['Maths', 'Science', 'SST', 'English', 'Hindi', 'Other'];
const MODES: HomeworkMode[] = ['Explain', 'Solve', 'Give Hint', 'Check My Answer'];

export const HomeworkHelperView: React.FC<HomeworkHelperViewProps> = ({
  language,
  voiceName,
  ttsProvider = 'gemini',
  elevenLabsVoiceId,
}) => {
  const [subject, setSubject] = useState<HomeworkSubject>('Maths');
  const [mode, setMode] = useState<HomeworkMode>('Solve');
  const [question, setQuestion] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [imagePreview, setImagePreview] = useState<{
    name: string;
    mimeType: string;
    base64: string;
  } | null>(null);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setImagePreview({
      name: file.name,
      mimeType: file.type || 'image/png',
      base64,
    });
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!question.trim() && !imagePreview) || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const answer = await runHomeworkHelper({
        subject,
        mode,
        question,
        studentAnswer,
        language,
        imageBase64: imagePreview?.base64,
        imageMimeType: imagePreview?.mimeType,
      });
      setResult(answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process homework question.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async () => {
    if (!result) return;
    if (isSpeaking) {
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    try {
      const { audioBase64, mimeType } = await synthesizeSpeech({
        text: result,
        voiceName,
        provider: ttsProvider,
        elevenLabsVoiceId,
      });
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(result.replace(/[#*_`>]/g, '').slice(0, 800));
        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utter);
      } else {
        setIsSpeaking(false);
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            AI Homework Helper
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Upload a photo of your question or type it below for step-by-step explanations, hints, or answer checks.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726] lg:col-span-5"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Subject
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {SUBJECTS.map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSubject(subj)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      subject === subj
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Help Mode
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      mode === m
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Question Image (Optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-950/50 p-2 dark:border-slate-700">
                  <img
                    src={`data:${imagePreview.mimeType};base64,${imagePreview.base64}`}
                    alt={imagePreview.name}
                    className="max-h-40 w-full rounded-lg object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    aria-label="Remove uploaded question image"
                    className="absolute top-3 right-3 rounded-lg bg-slate-900/80 p-1.5 text-white hover:bg-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs font-medium text-slate-600 hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:text-cyan-300"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span>Upload Question Photo or Screenshot</span>
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor="homework-question"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Type or Paste Question
              </label>
              <textarea
                id="homework-question"
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., Solve 2x^2 - 5x + 3 = 0 or ask about photosynthesis..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {mode === 'Check My Answer' && (
              <div>
                <label
                  htmlFor="student-answer"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Your Answer to Check
                </label>
                <textarea
                  id="student-answer"
                  rows={3}
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Write your steps or final answer here..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={(!question.trim() && !imagePreview) || isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-45"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing Homework...</span>
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  <span>{mode}</span>
                </>
              )}
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726] lg:col-span-7">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Step-by-Step Solution
              </h2>
              {result && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSpeak}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>{isSpeaking ? 'Speaking...' : 'Listen'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(result);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4">
              {result ? (
                <MarkdownRenderer content={result} />
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <BookOpen className="h-10 w-10 text-slate-400 dark:text-slate-600" />
                  <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Ready to assist with {subject}
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                    Choose Explain, Solve, Give Hint, or Check My Answer and submit your question or photo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
