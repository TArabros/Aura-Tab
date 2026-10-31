import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIPanelMode, AISettings, AIChat, AIMessage } from '@/types';
import { requiresApiKey, streamAIResponse } from '@/services/ai-service';
import { getAIChats, saveAIChats, getCurrentChatId, setCurrentChatId } from '@/services/storage';
import {
  X, Send, Plus, Copy, Check, Trash2,
  MessageSquare, ChevronLeft, Sparkles,
  Maximize2, Minimize2, Loader2, AlertCircle,
  Settings
} from 'lucide-react';

interface Props {
  mode: AIPanelMode;
  onModeChange: (mode: AIPanelMode) => void;
  settings: AISettings;
  onSettingsChange: (settings: AISettings) => void;
}

export default function AIPanel({ mode, onModeChange, settings, onSettingsChange }: Props) {
  const [chats, setChats] = useState<AIChat[]>([]);
  const [currentChat, setCurrentChat] = useState<AIChat | null>(null);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [error, setError] = useState('');
  const isConfigured = !!settings.apiKey || !requiresApiKey(settings.apiEndpoint);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load chats
  useEffect(() => {
    async function load() {
      const savedChats = await getAIChats();
      setChats(savedChats);
      const currentId = await getCurrentChatId();
      if (currentId) {
        const chat = savedChats.find(c => c.id === currentId);
        if (chat) setCurrentChat(chat);
      }
    }
    load();
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages, streamedContent]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const createNewChat = useCallback(async () => {
    const chat: AIChat = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [chat, ...chats];
    setChats(updated);
    setCurrentChat(chat);
    await saveAIChats(updated);
    await setCurrentChatId(chat.id);
    setShowHistory(false);
    setError('');
    setInput('');
    return chat;
  }, [chats]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    let chat = currentChat;
    if (!chat) {
      chat = await createNewChat();
    }

    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    // Update title from first message
    const isFirst = chat.messages.length === 0;
    const updatedChat: AIChat = {
      ...chat,
      messages: [...chat.messages, userMsg],
      title: isFirst ? text.slice(0, 60) : chat.title,
      updatedAt: Date.now(),
    };

    setCurrentChat(updatedChat);
    setInput('');
    setError('');
    setIsGenerating(true);
    setStreamedContent('');

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const updatedChats = chats.map(c => c.id === updatedChat.id ? updatedChat : c);
    if (!chats.find(c => c.id === updatedChat.id)) {
      updatedChats.unshift(updatedChat);
    }
    setChats(updatedChats);
    await saveAIChats(updatedChats);

    // Stream response
    const abortController = new AbortController();
    abortRef.current = abortController;
    let accumulated = '';

    await streamAIResponse(
      updatedChat.messages,
      settings,
      // onChunk
      (chunk) => {
        accumulated += chunk;
        setStreamedContent(accumulated);
      },
      // onDone
      async () => {
        // Stopped before the first chunk: there is no answer to keep
        if (!accumulated) {
          setStreamedContent('');
          setIsGenerating(false);
          return;
        }
        const assistantMsg: AIMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: accumulated,
          timestamp: Date.now(),
        };
        const finalChat: AIChat = {
          ...updatedChat,
          messages: [...updatedChat.messages, assistantMsg],
          updatedAt: Date.now(),
        };
        setCurrentChat(finalChat);
        setStreamedContent('');
        setIsGenerating(false);

        const finalChats = updatedChats.map(c => c.id === finalChat.id ? finalChat : c);
        setChats(finalChats);
        await saveAIChats(finalChats);
      },
      // onError
      (err) => {
        setError(err);
        setIsGenerating(false);
        setStreamedContent('');
      },
      abortController.signal,
    );
  }, [input, currentChat, chats, settings, isGenerating, createNewChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  const copyMessage = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const clearHistory = async () => {
    setChats([]);
    setCurrentChat(null);
    await saveAIChats([]);
    await setCurrentChatId(null);
    setShowHistory(false);
  };

  const switchChat = async (chat: AIChat) => {
    setCurrentChat(chat);
    await setCurrentChatId(chat.id);
    setShowHistory(false);
    setError('');
  };

  const deleteChat = async (chatId: string) => {
    const updated = chats.filter(c => c.id !== chatId);
    setChats(updated);
    await saveAIChats(updated);
    if (currentChat?.id === chatId) {
      setCurrentChat(updated[0] || null);
      await setCurrentChatId(updated[0]?.id || null);
    }
  };

  // Panel is always mounted; visibility is driven by CSS class
  const isVisible = mode !== 'hidden';
  const width = mode === 'expanded' ? 500 : 320;

  return (
    <div
      className={`ai-panel ${isVisible ? 'visible' : ''}`}
      style={{ width: isVisible ? width : 320 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--ai-panel-border)' }}
      >
        <div className="flex items-center gap-2">
          {(showHistory || showAISettings) && (
            <button
              className="nova-btn-icon"
              onClick={() => {
                setShowHistory(false);
                setShowAISettings(false);
              }}
              title="Назад к AI Assistant"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <Sparkles size={18} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">
            {showHistory ? 'Chat History' : showAISettings ? 'AI Settings' : 'AI Assistant'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!showHistory && !showAISettings && (
            <>
              <button
                className="nova-btn-icon"
                onClick={() => setShowAISettings(true)}
                title="AI Settings"
              >
                <Settings size={15} />
              </button>
              <button
                className="nova-btn-icon"
                onClick={() => setShowHistory(true)}
                title="Chat history"
              >
                <MessageSquare size={15} />
              </button>
              <button className="nova-btn-icon" onClick={createNewChat} title="New chat">
                <Plus size={16} />
              </button>
            </>
          )}
          <button
            className="nova-btn-icon"
            onClick={() => onModeChange(mode === 'compact' ? 'expanded' : 'compact')}
            title={mode === 'compact' ? 'Expand' : 'Collapse'}
          >
            {mode === 'compact' ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
          </button>
          <button className="nova-btn-icon" onClick={() => onModeChange('hidden')} title="Close panel">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* AI Settings View */}
      {showAISettings ? (
        <AISettingsView
          settings={settings}
          onSettingsChange={onSettingsChange}
          onBack={() => setShowAISettings(false)}
        />
      ) : showHistory ? (
        /* Chat History */
        <div className="flex-1 overflow-y-auto p-3">
          {chats.length === 0 ? (
            <div className="text-center py-12 opacity-40">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <button
                  className="nova-btn-icon text-[var(--color-error)]"
                  onClick={clearHistory}
                  title="Clear all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {chats.map(chat => (
                <div
                  key={chat.id}
                  className="flex items-center gap-3 p-3 rounded-xl mb-1 cursor-pointer transition-colors group"
                  style={{
                    background: currentChat?.id === chat.id ? 'var(--chat-active-bg)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (currentChat?.id !== chat.id) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--chat-hover-bg)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentChat?.id !== chat.id) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                  onClick={() => switchChat(chat)}
                >
                  <MessageSquare size={14} className="flex-shrink-0 opacity-40" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{chat.title}</p>
                    <p className="text-[10px] opacity-30">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    className="nova-btn-icon opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        /* Chat View */
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {(!currentChat || currentChat.messages.length === 0) && !streamedContent && (
              <div className="text-center py-16 opacity-80">
                <Sparkles size={40} className="mx-auto mb-4 text-[var(--color-accent)] opacity-60" />
                <p className="text-sm font-medium mb-1">Чем я могу помочь?</p>
                {isConfigured ? (
                  <p className="text-xs opacity-50">Начните диалог в поле ввода ниже</p>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs opacity-60 mb-3">Для работы ассистента подключите API</p>
                    <button
                      onClick={() => setShowAISettings(true)}
                      className="nova-btn nova-btn-primary text-xs mx-auto flex items-center gap-1.5"
                    >
                      <Settings size={14} />
                      Подключить API
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentChat?.messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                copied={copied === msg.id}
                onCopy={() => copyMessage(msg.content, msg.id)}
                compact={mode === 'compact'}
              />
            ))}

            {/* Streaming content */}
            {streamedContent && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="markdown-content text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlockComponent }}>
                      {streamedContent}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Generating indicator */}
            {isGenerating && !streamedContent && (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 size={14} className="animate-spin text-[var(--color-accent)]" />
                <span className="text-xs opacity-50">Thinking...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl"
                style={{
                  background: 'var(--error-bg)',
                  border: '1px solid var(--error-border)',
                }}
              >
                <AlertCircle size={16} className="text-[var(--color-error)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--color-error)]">{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-3" style={{ borderTop: '1px solid var(--ai-panel-border)' }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isConfigured ? 'Type a message...' : 'Set up API key first...'}
                className="nova-input resize-none"
                style={{ minHeight: 40, maxHeight: 120 }}
                rows={1}
                disabled={!isConfigured}
              />
              {isGenerating ? (
                <button
                  className="nova-btn-icon flex-shrink-0"
                  onClick={stopGeneration}
                  title="Stop"
                  style={{
                    padding: 10,
                    background: 'var(--error-bg)',
                    color: 'var(--color-error)',
                  }}
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  className="nova-btn-icon flex-shrink-0"
                  onClick={sendMessage}
                  disabled={!input.trim() || !isConfigured}
                  title="Send"
                  style={{
                    padding: 10,
                    background: 'var(--color-accent)',
                    color: 'white',
                    opacity: (!input.trim() || !isConfigured) ? 0.4 : 1,
                  }}
                >
                  <Send size={16} />
                </button>
              )}
            </div>
            {mode === 'expanded' && (
              <p className="text-[10px] opacity-20 mt-1.5 text-center">
                {settings.model} • Press Enter to send, Shift+Enter for new line
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ===== Message Bubble =====
function MessageBubble({
  message,
  copied,
  onCopy,
  compact,
}: {
  message: AIMessage;
  copied: boolean;
  onCopy: () => void;
  compact: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-purple-600 flex items-center justify-center flex-shrink-0">
          <Sparkles size={14} className="text-white" />
        </div>
      )}
      <div className={`${compact ? 'max-w-[85%]' : 'max-w-[80%]'} min-w-0`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm ${
            isUser
              ? 'bg-[var(--color-accent)] text-white rounded-br-md'
              : 'rounded-bl-md'
          }`}
          style={!isUser ? { background: 'var(--ai-bubble-assistant)' } : undefined}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlockComponent,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (
          <div className="flex items-center gap-1 mt-1 opacity-0 hover:opacity-100 transition-opacity">
            <button
              className="nova-btn-icon"
              onClick={onCopy}
              style={{ padding: 3 }}
              title="Copy message"
            >
              {copied ? <Check size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlockComponent({ children, className, ...props }: React.ComponentPropsWithoutRef<'code'>) {
  const [copiedCode, setCopiedCode] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const content = String(children).replace(/\n$/, '');
  const isInline = !match && !content.includes('\n');

  if (isInline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded text-xs font-mono"
        style={{ background: 'var(--markdown-code-bg)' }}
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      className="relative my-2.5 rounded-xl overflow-hidden text-xs font-mono"
      style={{
        background: 'var(--ai-code-bg)',
        border: '1px solid var(--ai-code-border)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 text-[11px] opacity-70"
        style={{
          background: 'var(--ai-code-header)',
          borderBottom: '1px solid var(--ai-code-border)',
        }}
      >
        <span>{match ? match[1] : 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:opacity-100 opacity-60 transition-opacity cursor-pointer border-none bg-transparent text-inherit"
        >
          {copiedCode ? <Check size={11} className="text-[var(--color-success)]" /> : <Copy size={11} />}
          <span>{copiedCode ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto leading-relaxed text-[12px] m-0 bg-transparent border-none">
        <code>{content}</code>
      </pre>
    </div>
  );
}

const PROVIDER_PRESETS = [
  { name: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'deepseek/deepseek-chat' },
  { name: 'Groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { name: 'Ollama (Local)', endpoint: 'http://localhost:11434/v1/chat/completions', model: 'llama3.2' },
];

// ===== AI Settings View =====
function AISettingsView({
  settings,
  onSettingsChange,
  onBack,
}: {
  settings: AISettings;
  onSettingsChange: (s: AISettings) => void;
  onBack: () => void;
}) {
  const [local, setLocal] = useState(settings);

  const handleSave = () => {
    onSettingsChange(local);
    onBack();
  };

  const applyPreset = (preset: typeof PROVIDER_PRESETS[0]) => {
    setLocal(prev => ({
      ...prev,
      apiEndpoint: preset.endpoint,
      model: preset.model,
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Top back button to AI Assistant */}
      <button
        onClick={onBack}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all group cursor-pointer"
        style={{
          background: 'var(--settings-tab-bg)',
          border: '1px solid var(--settings-option-border)',
          color: 'var(--color-text-primary)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--settings-selected-bg)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--settings-tab-bg)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--settings-option-border)';
        }}
      >
        <ChevronLeft size={16} className="text-[var(--color-accent)] group-hover:-translate-x-0.5 transition-transform" />
        <span>Назад к AI Assistant</span>
      </button>

      {/* Quick Presets */}
      <div>
        <label className="text-xs opacity-50 block mb-1.5">Quick Presets</label>
        <div className="grid grid-cols-2 gap-1.5">
          {PROVIDER_PRESETS.map(p => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] transition-colors text-left"
              style={{
                border: '1px solid var(--settings-option-border)',
                background: 'var(--settings-tab-bg)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--settings-tab-hover)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--settings-tab-bg)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--settings-option-border)';
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs opacity-50 block mb-1.5">API Endpoint</label>
        <input
          type="text"
          value={local.apiEndpoint}
          onChange={(e) => setLocal({ ...local, apiEndpoint: e.target.value })}
          className="nova-input text-xs"
          placeholder="https://api.openai.com/v1/chat/completions"
        />
      </div>
      <div>
        <label className="text-xs opacity-50 block mb-1.5">API Key</label>
        <input
          type="password"
          value={local.apiKey}
          onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
          className="nova-input text-xs"
          placeholder="sk-..."
        />
        <p className="text-[10px] opacity-30 mt-1">Stored locally in chrome.storage, sent only to the endpoint above, not included in backups. Not needed for localhost.</p>
      </div>
      <div>
        <label className="text-xs opacity-50 block mb-1.5">Model</label>
        <input
          type="text"
          value={local.model}
          onChange={(e) => setLocal({ ...local, model: e.target.value })}
          className="nova-input text-xs"
          placeholder="gpt-4o-mini"
        />
      </div>
      <div>
        <label className="text-xs opacity-50 block mb-1.5">
          Temperature: {local.temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={local.temperature}
          onChange={(e) => setLocal({ ...local, temperature: parseFloat(e.target.value) })}
          className="w-full accent-[var(--color-accent)]"
        />
      </div>
      <div>
        <label className="text-xs opacity-50 block mb-1.5">Max Tokens</label>
        <input
          type="number"
          value={local.maxTokens}
          onChange={(e) => setLocal({ ...local, maxTokens: parseInt(e.target.value) || 2048 })}
          className="nova-input text-xs"
        />
      </div>
      <div>
        <label className="text-xs opacity-50 block mb-1.5">System Prompt</label>
        <textarea
          value={local.systemPrompt}
          onChange={(e) => setLocal({ ...local, systemPrompt: e.target.value })}
          className="nova-input text-xs resize-none"
          rows={3}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          className="nova-btn nova-btn-ghost flex-1 text-xs flex items-center justify-center gap-1.5"
          onClick={onBack}
        >
          <ChevronLeft size={14} />
          Назад к AI Assistant
        </button>
        <button className="nova-btn nova-btn-primary flex-1 text-xs" onClick={handleSave}>
          Сохранить настройки
        </button>
      </div>
    </div>
  );
}
