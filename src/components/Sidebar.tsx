import React from 'react';
import {
  BookOpen,
  Code2,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Languages,
  Lightbulb,
  MessageSquare,
  Mic,
  Plus,
  Settings,
  Sparkles,
  FileText,
  Trash2,
  Volume2,
  X,
  Youtube,
} from 'lucide-react';
import { NEXORA_EMBLEM_URL } from '../utils/nexoraLogic';
import type { ChatSession, ToolId, UserProfile } from '../types/nexora';

export interface ToolNavItem {
  id: ToolId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const TOOL_ITEMS: ToolNavItem[] = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'video', label: 'Animated Video Studio', icon: Film },
  { id: 'image', label: 'AI Image Generator', icon: ImageIcon },
  { id: 'coding', label: 'AI Coding Assistant', icon: Code2 },
  { id: 'homework', label: 'Homework Helper', icon: BookOpen },
  { id: 'story', label: 'Story Generator', icon: Sparkles },
  { id: 'youtube', label: 'YouTube SEO Generator', icon: Youtube },
  { id: 'translator', label: 'AI Translator', icon: Languages },
  { id: 'summarizer', label: 'Text Summarizer', icon: FileText },
  { id: 'tts', label: 'Text to Speech', icon: Volume2 },
  { id: 'voice', label: 'AI Voice Assistant', icon: Mic },
  { id: 'brainstorming', label: 'AI Brainstorming', icon: Lightbulb },
];

interface SidebarProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
  profile: UserProfile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTool,
  onSelectTool,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onOpenSettings,
  profile,
  mobileOpen,
  onCloseMobile,
}) => {
  const sidebarBody = (
    <aside
      aria-label="Primary Navigation"
      className="flex h-full w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800/80 dark:bg-[#0D1321]"
    >
      {/* Brand + New Chat */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800/80">
        <button
          type="button"
          onClick={() => {
            onSelectTool('chat');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg"
        >
          <img
            src={NEXORA_EMBLEM_URL}
            alt="NEXORA AI"
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-300 dark:ring-slate-700"
          />
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            NEXORA AI
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onSelectTool('chat');
            onCloseMobile();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Scrollable Tools + Chat History */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
        <nav aria-label="AI Tools">
          <p className="px-2.5 pb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            AI Tools
          </p>
          <ul className="space-y-0.5">
            {TOOL_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTool === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTool(item.id);
                      onCloseMobile();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-cyan-300'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive
                          ? 'text-indigo-600 dark:text-cyan-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div>
          <p className="px-2.5 pb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Recent Chats
          </p>
          {sessions.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500">
              No saved chats yet.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {sessions.map((session) => {
                const isSelected = activeTool === 'chat' && session.id === activeSessionId;
                return (
                  <li key={session.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSession(session.id);
                        onSelectTool('chat');
                        onCloseMobile();
                      }}
                      className={`flex-1 truncate rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-slate-200/80 text-slate-900 dark:bg-slate-800 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                      }`}
                    >
                      {session.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSession(session.id)}
                      aria-label={`Delete '${session.title}'`}
                      className="rounded-md p-1.5 text-slate-400 opacity-70 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Sponsored Direct Link + User Profile + Settings */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-800/80 space-y-2">
        <a
          href="https://uplcm.com/4/12350216"
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="flex items-center justify-between gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-500/15 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <span className="truncate">Support Free Studio · Sponsored</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
        </a>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-100/80 p-2 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg"
          >
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-300 dark:ring-slate-700"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {profile.name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {profile.role}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white shrink-0"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <div className="hidden h-full shrink-0 lg:block">{sidebarBody}</div>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            onClick={onCloseMobile}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
          />
          <div className="relative z-10 h-full transition-transform duration-200">
            {sidebarBody}
          </div>
        </div>
      )}
    </>
  );
};
