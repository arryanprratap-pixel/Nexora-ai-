import React, { useEffect, useState } from 'react';
import { Moon, Sun, Trash2, X } from 'lucide-react';
import { fetchElevenLabsVoices } from '../utils/apiClient';
import {
  DEFAULT_ELEVENLABS_VOICE_ID,
  ELEVENLABS_PRESET_VOICES,
} from '../utils/nexoraLogic';
import type {
  AppLanguage,
  ElevenLabsVoice,
  ResponseStyle,
  TtsProvider,
  UserSettings,
  VoiceName,
} from '../types/nexora';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (next: UserSettings) => void;
  onClearHistory: () => void;
}

const LANGUAGES: AppLanguage[] = ['English', 'Hindi', 'Hinglish'];
const STYLES: ResponseStyle[] = [
  'Balanced',
  'Simple & Easy',
  'Detailed & Technical',
  'Concise',
  'Friendly Tutor',
];
const VOICES: VoiceName[] = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [elVoices, setElVoices] = useState<ElevenLabsVoice[]>(ELEVENLABS_PRESET_VOICES);
  const [elConfigured, setElConfigured] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchElevenLabsVoices()
      .then((res) => {
        if (res.voices.length > 0) setElVoices(res.voices);
        setElConfigured(res.configured);
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#101726]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2
              id="settings-modal-title"
              className="font-display text-lg font-semibold text-slate-900 dark:text-white"
            >
              Settings & Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Customize appearance, language, voice, and assistant style
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Appearance */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Theme Mode
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, theme: 'dark' })}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  settings.theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-cyan-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                }`}
              >
                <Moon className="h-4 w-4" />
                <span>Dark Mode</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, theme: 'light' })}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  settings.theme === 'light'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                }`}
              >
                <Sun className="h-4 w-4" />
                <span>Light Mode</span>
              </button>
            </div>
          </div>

          {/* Language */}
          <div>
            <label
              htmlFor="settings-language"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Preferred Language
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, language: lang })}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    settings.language === lang
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Response Style */}
          <div>
            <label
              htmlFor="settings-style"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              AI Response Style
            </label>
            <select
              id="settings-style"
              value={settings.responseStyle}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  responseStyle: e.target.value as ResponseStyle,
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              {STYLES.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Engine & Persona Selection */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Voice Engine
              </label>
              <div
                role="group"
                aria-label="TTS voice engine"
                className="mt-2 grid grid-cols-2 gap-2"
              >
                {(['gemini', 'elevenlabs'] as TtsProvider[]).map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    aria-pressed={settings.ttsProvider === prov}
                    onClick={() => onUpdateSettings({ ...settings, ttsProvider: prov })}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      settings.ttsProvider === prov
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {prov === 'elevenlabs' ? 'ElevenLabs AI' : 'Gemini TTS'}
                  </button>
                ))}
              </div>
              {settings.ttsProvider === 'elevenlabs' && !elConfigured && (
                <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-300">
                  Add ELEVENLABS_API_KEY in Settings &gt; Secrets to enable live ElevenLabs voice synthesis.
                </p>
              )}
            </div>

            {settings.ttsProvider === 'elevenlabs' ? (
              <div>
                <label
                  htmlFor="settings-elevenlabs-voice"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  ElevenLabs Voice
                </label>
                <select
                  id="settings-elevenlabs-voice"
                  value={settings.elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      elevenLabsVoiceId: e.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  {elVoices.map((voice) => (
                    <option key={voice.voice_id} value={voice.voice_id}>
                      {voice.name}{voice.description ? ` — ${voice.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="settings-voice"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  AI Voice Persona
                </label>
                <select
                  id="settings-voice"
                  value={settings.voiceName}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      voiceName: e.target.value as VoiceName,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  {VOICES.map((voice) => (
                    <option key={voice} value={voice}>
                      {voice}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              User Profile
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-name"
                  className="block text-xs text-slate-500 dark:text-slate-400"
                >
                  Display Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={settings.profile.name}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      profile: { ...settings.profile, name: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-role"
                  className="block text-xs text-slate-500 dark:text-slate-400"
                >
                  Role / Focus
                </label>
                <input
                  id="profile-role"
                  type="text"
                  value={settings.profile.role}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      profile: { ...settings.profile, role: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Clear History */}
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear All Chat History</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <span className="text-xs font-medium text-red-600 dark:text-red-300">
                  Delete all saved conversations?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      setConfirmClear(false);
                      onClose();
                    }}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
