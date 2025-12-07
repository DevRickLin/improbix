'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  Bot,
  User,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Wrench,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAgentChat } from '@/lib/hooks/use-agent-chat';
import { useHistoryStore } from '@/stores/history-store';
import type { Task } from '@/types/task';

interface TaskRunDialogProps {
  task: Task;
  children: React.ReactNode;
}

interface ToolPart {
  type: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  state?: string;
}

function getMessageIcon(role: string) {
  switch (role) {
    case 'user':
      return <User className="h-4 w-4 text-blue-500" />;
    case 'assistant':
      return <Bot className="h-4 w-4 text-purple-500" />;
    default:
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusIcon(status: string | undefined) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

/**
 * 格式化值为可读的字符串
 */
function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 工具调用显示组件
 */
function ToolPartDisplay({ part }: { part: ToolPart }) {
  const [expanded, setExpanded] = useState(false);

  // 从 part.type 提取工具名称
  // 格式可能是 'tool-invocation' 或 'tool-result'
  const toolName = part.toolName || 'tool';
  const isInvocation = part.type === 'tool-invocation';
  const isResult = part.type === 'tool-result';

  // 确定状态
  const isLoading = isInvocation && !isResult;
  const hasResult = isResult && part.result !== undefined;
  const hasError = part.state === 'error';

  return (
    <div className="my-2 p-2 bg-background/50 rounded-md border border-border/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <Wrench className="h-4 w-4 text-orange-500" />
        <span className="font-medium text-sm flex-1">{toolName}</span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {hasResult && !hasError && <CheckCircle2 className="h-3 w-3 text-green-500" />}
        {hasError && <XCircle className="h-3 w-3 text-red-500" />}
      </button>

      {expanded && (
        <div className="mt-2 pl-5 space-y-2">
          {/* 显示输入参数 */}
          {part.args !== undefined && (
            <div>
              <span className="text-xs text-muted-foreground">Input:</span>
              <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-24 overflow-y-auto">
                {formatValue(part.args)}
              </pre>
            </div>
          )}

          {/* 显示输出结果或错误 */}
          {hasResult && !hasError && (
            <div>
              <span className="text-xs text-muted-foreground">Output:</span>
              <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                {formatValue(part.result)}
              </pre>
            </div>
          )}

          {hasError && (
            <div className="flex items-start gap-2 text-red-500">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-xs">{formatValue(part.result)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 渲染消息部分
 */
function renderMessageParts(parts: Array<{ type: string; text?: string; [key: string]: unknown }> | undefined) {
  if (!parts) return null;

  return parts.map((part, j) => {
    if (part.type === 'text') {
      return <span key={j}>{part.text}</span>;
    }

    // 处理工具相关部分
    if (part.type === 'tool-invocation' || part.type === 'tool-result') {
      return <ToolPartDisplay key={j} part={part as ToolPart} />;
    }

    // 兼容旧格式
    if (part.type.startsWith('tool-')) {
      return <ToolPartDisplay key={j} part={part as ToolPart} />;
    }

    return null;
  });
}

export function TaskRunDialog({ task, children }: TaskRunDialogProps) {
  const [open, setOpen] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const { messages, isLoading, runAgent, reset } = useAgentChat({
    taskId: task.id,
    taskName: task.name,
  });
  const { history } = useHistoryStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get current execution status from history
  const currentExecution = executionId ? history.find((h) => h.id === executionId) : null;
  const status = currentExecution?.status;

  // Auto scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleRun = async () => {
    try {
      reset();
      setExecutionId(null);
      const id = await runAgent(task.prompt);
      setExecutionId(id);
    } catch {
      // Error already handled by hook
    }
  };

  const handleClose = () => {
    setOpen(false);
    setExecutionId(null);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Run Task: {task.name}
            {getStatusIcon(status)}
          </DialogTitle>
          <DialogDescription>Execute this task manually with the AI agent.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Left: Prompt */}
          <div className="flex flex-col h-[400px]">
            <Label className="mb-2 flex-shrink-0">Prompt</Label>
            <div className="flex-1 p-3 bg-muted rounded-md text-sm overflow-y-auto min-h-0">
              <p className="whitespace-pre-wrap">{task.prompt}</p>
            </div>
          </div>

          {/* Right: Chat messages */}
          <div className="flex flex-col h-[400px]">
            <Label className="mb-2 flex-shrink-0">Execution Log</Label>
            <div ref={scrollRef} className="flex-1 p-3 bg-muted rounded-md overflow-y-auto min-h-0">
              {messages.length === 0 && !isLoading && (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Click &quot;Run Now&quot; to start execution
                </div>
              )}
              {messages.length === 0 && isLoading && (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Waiting for agent...</span>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={msg.id || i} className="py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-start gap-2">
                    {getMessageIcon(msg.role)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="font-medium capitalize">{msg.role}</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {renderMessageParts(msg.parts)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && messages.length > 0 && (
                <div className="py-2 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button onClick={handleRun} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              'Run Now'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
