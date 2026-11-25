import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Plus, Settings } from 'lucide-react';
import { Sidebar, TOOL_ITEMS } from './components/Sidebar';
import { ChatWorkspace } from './components/ChatWorkspace';
import { VideoStudioView } from './components/VideoStudioView';
import { ImageStudioView } from './components/ImageStudioView';
import { HomeworkHelperView } from './components/HomeworkHelperView';
import { YoutubeSeoView } from './components/YoutubeSeoView';
import { CodingAssistantView } from './components/CodingAssistantView';
import {
  BrainstormingView,
  StoryGeneratorView,
  SummarizerView,
  TranslatorView,
  VoiceAssistantView,
} from './components/UtilityToolsView';
import { TextToSpeechView } from './components/TextToSpeechView';
import { SettingsModal } from './components/SettingsModal';
import { fetchProviders, streamChatCompletion } from './utils/apiClient';
import {
  appendMessageToSession,
  buildSystemPrompt,
  createChatSession,
  DEFAULT_SETTINGS,
  getModelSpec,
  updateLastAssistantMessage,
} from './utils/nexoraLogic';
import type {
  ChatAttachment,
  ChatSession,
  ProviderStatus,
  ToolId,
  UserSettings,
} from './types/nexora';

const SESSIONS_STORAGE_KEY = 'nexora_sessions_v1';
const SETTINGS_STORAGE_KEY = 'nexora_settings_v1';

function loadInitialSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      profile: {
        ...DEFAULT_SETTINGS.profile,
        ...(parsed?.profile || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadInitialSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [createChatSession()];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [createChatSession()];
  } catch {
    return [createChatSession()];
  }
}

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(loadInitialSettings);
  const [sessions, setSessions] = useState<ChatSession[]>(loadInitialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => loadInitialSessions()[0]?.id || ''
  );
  const [activeTool, setActiveTool] = useState<ToolId>('chat');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchProviders().then(setProviders).catch(() => {});
  }, []);

  // Sync theme to documentElement
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
  }, [settings]);

  // Persist chat sessions (strip large base64 payloads if quota is tight)
  useEffect(() => {
    try {
      const compact = sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) => ({
          ...m,
          attachments: m.attachments?.map((a) => ({
            ...a,
            dataBase64: a.dataBase64 && a.dataBase64.length > 180000 ? undefined : a.dataBase64,
          })),
        })),
      }));
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // ignore storage quota errors
    }
  }, [sessions]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const activeToolMeta = useMemo(() => {
    return TOOL_ITEMS.find((t) => t.id === activeTool) || TOOL_ITEMS[0];
  }, [activeTool]);

  const handleNewChat = () => {
    const fresh = createChatSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setActiveTool('chat');
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const fresh = createChatSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearHistory = () => {
    const fresh = createChatSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  };

  const handleSendMessage = async (text: string, attachments: ChatAttachment[]) => {
    if (!activeSession || isStreaming) return;
    const sessionId = activeSession.id;

    const userMsgId = `u_${Date.now()}`;
    const assistantMsgId = `a_${Date.now() + 1}`;

    const withUser = appendMessageToSession(activeSession, {
      id: userMsgId,
      role: 'user',
      content: text.trim() || 'Analyze the attached file(s).',
      createdAt: Date.now(),
      attachments,
    });

    const activeModel = getModelSpec(settings.selectedModelId);

    const withPlaceholder = appendMessageToSession(withUser, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      createdAt: Date.now() + 1,
      modelLabel: activeModel.label,
    });

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? withPlaceholder : s))
    );

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    try {
      const systemInstruction = buildSystemPrompt(
        settings.language,
        settings.responseStyle
      );
      await streamChatCompletion(
        withUser.messages,
        systemInstruction,
        (partialText) => {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? updateLastAssistantMessage(s, assistantMsgId, partialText, false)
                : s
            )
          );
        },
        controller.signal,
        activeModel.provider,
        activeModel.id
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Failed to reach NEXORA AI backend.';
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? updateLastAssistantMessage(s, assistantMsgId, message, true)
            : s
        )
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100">
      <Sidebar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        sessions={sessions}
        activeSessionId={activeSession?.id || ''}
        onSelectSession={setActiveSessionId}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setSettingsOpen(true)}
        profile={settings.profile}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean Workspace Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-sm dark:border-slate-800/80 dark:bg-[#0D1321]/90 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display text-sm font-semibold text-slate-900 dark:text-white truncate">
                {activeToolMeta.label}
              </span>
              <span className="hidden text-xs text-slate-400 sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline whitespace-nowrap">
                {settings.language} · {settings.responseStyle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Workspace settings"
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Active Tool Viewport */}
        <main className="min-h-0 flex-1 overflow-hidden">
          {activeTool === 'chat' && (
            <ChatWorkspace
              messages={activeSession?.messages || []}
              isStreaming={isStreaming}
              onSendMessage={handleSendMessage}
              onStopStreaming={handleStopStreaming}
              onSwitchTool={setActiveTool}
              settings={settings}
              providers={providers}
              onSelectModel={(modelId) =>
                setSettings((prev) => ({ ...prev, selectedModelId: modelId }))
              }
            />
          )}
          {activeTool === 'video' && (
            <VideoStudioView
              language={settings.language}
              voiceName={settings.voiceName}
              ttsProvider={settings.ttsProvider}
              elevenLabsVoiceId={settings.elevenLabsVoiceId}
            />
          )}
          {activeTool === 'image' && <ImageStudioView />}
          {activeTool === 'coding' && (
            <CodingAssistantView outputLanguage={settings.language} />
          )}
          {activeTool === 'homework' && (
            <HomeworkHelperView
              language={settings.language}
              voiceName={settings.voiceName}
              ttsProvider={settings.ttsProvider}
              elevenLabsVoiceId={settings.elevenLabsVoiceId}
            />
          )}
          {activeTool === 'story' && (
            <StoryGeneratorView
              language={settings.language}
              voiceName={settings.voiceName}
              ttsProvider={settings.ttsProvider}
              elevenLabsVoiceId={settings.elevenLabsVoiceId}
            />
          )}
          {activeTool === 'youtube' && (
            <YoutubeSeoView language={settings.language} />
          )}
          {activeTool === 'translator' && <TranslatorView />}
          {activeTool === 'summarizer' && (
            <SummarizerView language={settings.language} />
          )}
          {activeTool === 'tts' && (
            <TextToSpeechView
              voiceName={settings.voiceName}
              ttsProvider={settings.ttsProvider}
              elevenLabsVoiceId={settings.elevenLabsVoiceId}
              onChangeTtsSettings={(patch) =>
                setSettings((prev) => ({ ...prev, ...patch }))
              }
            />
          )}
          {activeTool === 'voice' && (
            <VoiceAssistantView
              language={settings.language}
              voiceName={settings.voiceName}
              ttsProvider={settings.ttsProvider}
              elevenLabsVoiceId={settings.elevenLabsVoiceId}
              onChangeTtsSettings={(patch) =>
                setSettings((prev) => ({ ...prev, ...patch }))
              }
            />
          )}
          {activeTool === 'brainstorming' && (
            <BrainstormingView language={settings.language} />
          )}
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
