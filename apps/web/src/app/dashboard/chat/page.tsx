'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  Plus,
  Trash2,
  Send,
  Loader2,
  Bot,
  User,
  MessageSquare,
  Wrench,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { sessionsApi, type ChatSession } from '@/lib/api/sessions';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  : '';
const chatEndpoint = apiBaseUrl
  ? `${apiBaseUrl}/api/agent/chat`
  : '/api/agent/chat';

// ==================== Tool Part Display ====================

interface ToolPart {
  type: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  state?: string;
}

function ToolPartDisplay({ part }: { part: ToolPart }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = part.toolName || 'tool';
  const isResult = part.type === 'tool-result';
  const hasResult = isResult && part.result !== undefined;
  const hasError = part.state === 'error';

  return (
    <div className="my-1 p-2 bg-muted/50 rounded-md border border-border/50 text-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Wrench className="h-3 w-3 text-orange-500" />
        <span className="font-medium flex-1">{toolName}</span>
        {!hasResult && !hasError && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {hasResult && !hasError && <CheckCircle2 className="h-3 w-3 text-green-500" />}
        {hasError && <XCircle className="h-3 w-3 text-red-500" />}
      </button>
      {expanded && (
        <div className="mt-2 pl-5 space-y-1">
          {part.args !== undefined && (
            <pre className="bg-muted p-1 rounded overflow-x-auto max-h-20 overflow-y-auto">
              {typeof part.args === 'string' ? part.args : JSON.stringify(part.args, null, 2)}
            </pre>
          )}
          {hasResult && (
            <pre className="bg-muted p-1 rounded overflow-x-auto max-h-24 overflow-y-auto">
              {typeof part.result === 'string' ? part.result : JSON.stringify(part.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Message Renderer ====================

function MessageContent({ parts }: { parts?: UIMessage['parts'] }) {
  if (!parts) return null;
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <span key={i} className="whitespace-pre-wrap break-words">
              {part.text}
            </span>
          );
        }
        if (part.type === 'tool-invocation' || part.type === 'tool-result') {
          return <ToolPartDisplay key={i} part={part as unknown as ToolPart} />;
        }
        return null;
      })}
    </>
  );
}

// ==================== Main Chat Page ====================

export default function ChatPage() {
  const { token } = useAuthStore();
  const {
    sessions,
    currentSessionId,
    setSessions,
    addSession,
    removeSession,
    updateSession,
    setCurrentSessionId,
  } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Create transport with session support
  const transport = useCallback(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return new DefaultChatTransport({
      api: chatEndpoint,
      headers,
      prepareSendMessagesRequest({ messages }) {
        return {
          body: {
            messages,
            sessionId: useChatStore.getState().currentSessionId ?? undefined,
          },
        };
      },
    });
  }, [token]);

  const {
    messages,
    sendMessage,
    status,
    setMessages,
  } = useChat({
    transport: transport(),
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Load sessions on mount
  useEffect(() => {
    sessionsApi.list().then(setSessions).catch(() => {});
  }, [setSessions]);

  // Load messages when switching session
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }
    sessionsApi.get(currentSessionId).then((session) => {
      const uiMessages: UIMessage[] = session.messages.map((m, i) => ({
        id: String(m.id || i),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        parts: [{ type: 'text' as const, text: m.content }],
      }));
      setMessages(uiMessages);
    }).catch(() => {
      setMessages([]);
    });
  }, [currentSessionId, setMessages]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleNewSession = async () => {
    const id = crypto.randomUUID();
    try {
      const session = await sessionsApi.create(id, 'New Chat');
      addSession(session);
      setCurrentSessionId(id);
      setMessages([]);
    } catch {
      toast.error('Failed to create session');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await sessionsApi.delete(id);
      removeSession(id);
      if (currentSessionId === id) {
        setMessages([]);
      }
    } catch {
      toast.error('Failed to delete session');
    }
  };

  const handleRenameSession = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      await sessionsApi.update(id, editTitle.trim());
      updateSession(id, { title: editTitle.trim() });
      setEditingId(null);
    } catch {
      toast.error('Failed to rename session');
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // Auto-create session if none selected
    if (!currentSessionId) {
      const id = crypto.randomUUID();
      const title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
      try {
        const session = await sessionsApi.create(id, title);
        addSession(session);
        setCurrentSessionId(id);
      } catch {
        toast.error('Failed to create session');
        return;
      }
    } else {
      // Update session title if it's still "New Chat"
      const current = sessions.find((s) => s.id === currentSessionId);
      if (current?.title === 'New Chat') {
        const title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
        sessionsApi.update(currentSessionId, title).then(() => {
          updateSession(currentSessionId, { title });
        }).catch(() => {});
      }
    }

    setInputValue('');
    await sendMessage({
      role: 'user',
      parts: [{ type: 'text', text }],
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar */}
      <div className="w-64 flex flex-col border rounded-lg bg-card">
        <div className="p-3 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Sessions</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewSession}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No sessions yet</p>
            )}
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm ${
                  currentSessionId === session.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => {
                  if (editingId !== session.id) {
                    setCurrentSessionId(session.id);
                  }
                }}
              >
                <MessageSquare className="h-3 w-3 flex-shrink-0" />
                {editingId === session.id ? (
                  <Input
                    className="h-6 text-xs flex-1"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRenameSession(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSession(session.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate text-xs">
                    {session.title || 'Untitled'}
                  </span>
                )}
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    className="p-0.5 rounded hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(session.id);
                      setEditTitle(session.title || '');
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="p-0.5 rounded hover:bg-destructive/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col border rounded-lg bg-card">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">Start a conversation with the agent</p>
              <p className="text-xs mt-1">The agent can manage tasks, topics, search the web, read emails, and more.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div className="flex-shrink-0 mt-1">
                {msg.role === 'user' ? (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                ) : (
                  <div className="h-7 w-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-purple-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <MessageContent parts={msg.parts} />
              </div>
            </div>
          ))}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              className="flex-1 min-h-[40px] max-h-[120px] resize-none"
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <Button
              className="self-end"
              size="icon"
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
