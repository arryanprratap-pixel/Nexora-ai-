import React, { useState } from 'react';
import { Code2, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { runCodingAssistant } from '../utils/apiClient';
import type { AppLanguage, CodingLanguage, CodingMode } from '../types/nexora';

interface CodingAssistantViewProps {
  outputLanguage: AppLanguage;
}

const LANGUAGES: CodingLanguage[] = [
  'HTML/CSS/JS',
  'Python',
  'JavaScript',
  'TypeScript',
  'Lua',
  'C++',
  'Java',
  'SQL',
];

const MODES: CodingMode[] = [
  'Generate Code',
  'Explain Code',
  'Fix Errors',
  'Complete Website',
  'Game Script',
];

export const CodingAssistantView: React.FC<CodingAssistantViewProps> = ({
  outputLanguage,
}) => {
  const [language, setLanguage] = useState<CodingLanguage>('Python');
  const [mode, setMode] = useState<CodingMode>('Generate Code');
  const [prompt, setPrompt] = useState('');
  const [existingCode, setExistingCode] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!prompt.trim() && !existingCode.trim()) || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await runCodingAssistant({
        language,
        mode,
        prompt,
        code: existingCode,
        outputLanguage,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coding request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            AI Coding Assistant
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Generate websites, Python utilities, Roblox/Lua game scripts, debug errors, or inspect code with syntax highlighting.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726] lg:col-span-5"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Programming Language
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      language === lang
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Task Mode
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
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
              <label
                htmlFor="coding-prompt"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                What do you want to build or fix?
              </label>
              <textarea
                id="coding-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Create a Lua Roblox obby checkpoint script with leaderboard saves..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {(mode === 'Explain Code' || mode === 'Fix Errors') && (
              <div>
                <label
                  htmlFor="coding-existing"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Paste Existing Code / Error Traceback
                </label>
                <textarea
                  id="coding-existing"
                  rows={5}
                  value={existingCode}
                  onChange={(e) => setExistingCode(e.target.value)}
                  placeholder="Paste your code or error message here..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
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
              disabled={(!prompt.trim() && !existingCode.trim()) || isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-45"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Writing Code...</span>
                </>
              ) : (
                <>
                  <Code2 className="h-4 w-4" />
                  <span>Run Coding Assistant</span>
                </>
              )}
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726] lg:col-span-7">
            <h2 className="border-b border-slate-200 pb-3 font-display text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
              Code & Technical Output
            </h2>
            <div className="mt-4">
              {result ? (
                <MarkdownRenderer content={result} />
              ) : (
                <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                  <Code2 className="h-10 w-10 text-slate-400 dark:text-slate-600" />
                  <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {language} · {mode}
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                    Syntax-highlighted code blocks include one-click copy buttons and live HTML previews.
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
