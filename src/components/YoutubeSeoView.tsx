import React, { useState } from 'react';
import { Check, Copy, Loader2, Youtube } from 'lucide-react';
import { runYoutubeSeo } from '../utils/apiClient';
import type {
  AppLanguage,
  YoutubeCategory,
  YoutubeSeoResult,
} from '../types/nexora';

interface YoutubeSeoViewProps {
  language: AppLanguage;
}

const CATEGORIES: YoutubeCategory[] = [
  'Shorts',
  'Gaming',
  'Educational',
  'Entertainment',
  'Vlog',
];

export const YoutubeSeoView: React.FC<YoutubeSeoViewProps> = ({ language }) => {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState<YoutubeCategory>('Gaming');
  const [outputLang, setOutputLang] = useState<AppLanguage>(language);
  const [result, setResult] = useState<YoutubeSeoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await runYoutubeSeo({
        topic,
        category,
        language: outputLang,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate YouTube SEO.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            YouTube SEO Generator
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Generate high-CTR titles, long SEO descriptions, tags, hashtags, and thumbnail text concepts.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label
                htmlFor="yt-topic"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Video Topic or Idea
              </label>
              <input
                id="yt-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Top 10 Secret Tricks in Minecraft Survival 2026"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="yt-lang"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Language
              </label>
              <select
                id="yt-lang"
                value={outputLang}
                onChange={(e) => setOutputLang(e.target.value as AppLanguage)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Hinglish">Hinglish</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    category === cat
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!topic.trim() || isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-45 whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Optimizing SEO...</span>
                </>
              ) : (
                <>
                  <Youtube className="h-4 w-4" />
                  <span>Generate SEO Package</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
        </form>

        {result && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Titles */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Catchy Video Titles
              </h2>
              <ul className="mt-3 space-y-2">
                {result.titles?.map((title, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span className="text-slate-800 dark:text-slate-100">{title}</span>
                    <button
                      type="button"
                      onClick={() => copyText(`title_${i}`, title)}
                      aria-label={`Copy title ${i + 1}`}
                      className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      {copiedKey === `title_${i}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Thumbnail Text & Hook */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Thumbnail Text & Visual Concepts
                </h2>
                <div className="mt-3 space-y-2.5">
                  {result.thumbnailIdeas?.map((idea, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <p className="font-display text-sm font-bold text-indigo-600 dark:text-cyan-300">
                        “{idea.headlineText}”
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {idea.visualConcept}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {result.hookScript && (
                <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      15-Second Intro Hook
                    </h3>
                    <button
                      type="button"
                      onClick={() => copyText('hook', result.hookScript)}
                      className="text-xs text-indigo-600 dark:text-cyan-400 hover:underline"
                    >
                      {copiedKey === 'hook' ? 'Copied' : 'Copy Hook'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {result.hookScript}
                  </p>
                </div>
              )}
            </div>

            {/* Long SEO Description */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726] md:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  SEO Video Description
                </h2>
                <button
                  type="button"
                  onClick={() => copyText('desc', result.description)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {copiedKey === 'desc' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedKey === 'desc' ? 'Copied' : 'Copy Description'}</span>
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {result.description}
              </pre>
            </div>

            {/* Tags & Hashtags */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726] md:col-span-2">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                      SEO Tags
                    </h2>
                    <button
                      type="button"
                      onClick={() => copyText('tags', (result.tags || []).join(', '))}
                      className="text-xs font-medium text-indigo-600 dark:text-cyan-400 hover:underline"
                    >
                      {copiedKey === 'tags' ? 'Copied' : 'Copy All Tags'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {(result.tags || []).join(' · ')}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                      Hashtags
                    </h2>
                    <button
                      type="button"
                      onClick={() => copyText('hashtags', (result.hashtags || []).join(' '))}
                      className="text-xs font-medium text-indigo-600 dark:text-cyan-400 hover:underline"
                    >
                      {copiedKey === 'hashtags' ? 'Copied' : 'Copy Hashtags'}
                    </button>
                  </div>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-indigo-600 dark:text-cyan-300">
                    {(result.hashtags || []).join(' ')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
