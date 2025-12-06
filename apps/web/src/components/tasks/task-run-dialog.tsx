'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Rocket, Bot, Wrench, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';

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
import { useTasks } from '@/lib/hooks/use-tasks';
import { useHistoryStore } from '@/stores/history-store';
import type { Task } from '@/types/task';
import type { AgentMessage } from '@/types/history';

interface TaskRunDialogProps {
  task: Task;
  children: React.ReactNode;
}

function getMessageIcon(type: string) {
  switch (type) {
    case 'started':
      return <Rocket className="h-4 w-4 text-blue-500" />;
    case 'assistant':
      return <Bot className="h-4 w-4 text-purple-500" />;
    case 'tool_result':
      return <Wrench className="h-4 w-4 text-orange-500" />;
    case 'result':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
  }
}

function MessageItem({ message }: { message: AgentMessage }) {
  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <div className="flex items-start gap-2">
        {getMessageIcon(message.type)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-medium capitalize">{message.type}</span>
            <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

export function TaskRunDialog({ task, children }: TaskRunDialogProps) {
  const [open, setOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const { runTask } = useTasks();
  const { history } = useHistoryStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 获取当前执行的消息
  const currentExecution = executionId ? history.find(h => h.id === executionId) : null;
  const messages = currentExecution?.messages || [];
  const status = currentExecution?.status;

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // 执行完成时更新状态
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      setIsRunning(false);
    }
  }, [status]);

  const handleRun = async () => {
    try {
      setIsRunning(true);
      setExecutionId(null);
      const id = await runTask(task.id, task.name, task.prompt);
      setExecutionId(id);
    } catch {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setExecutionId(null);
    setIsRunning(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Run Task: {task.name}</DialogTitle>
          <DialogDescription>
            Execute this task manually with the AI agent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* 左侧：Prompt */}
          <div className="flex flex-col h-[400px]">
            <Label className="mb-2 flex-shrink-0">Prompt</Label>
            <div className="flex-1 p-3 bg-muted rounded-md text-sm overflow-y-auto min-h-0">
              <p className="whitespace-pre-wrap">{task.prompt}</p>
            </div>
          </div>

          {/* 右侧：执行日志 */}
          <div className="flex flex-col h-[400px]">
            <Label className="mb-2 flex-shrink-0">Execution Log</Label>
            <div
              ref={scrollRef}
              className="flex-1 p-3 bg-muted rounded-md overflow-y-auto min-h-0"
            >
              {messages.length === 0 && !isRunning && (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Click &quot;Run Now&quot; to start execution
                </div>
              )}
              {messages.length === 0 && isRunning && (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Waiting for agent...</span>
                </div>
              )}
              {messages.map((msg, i) => (
                <MessageItem key={i} message={msg} />
              ))}
              {isRunning && messages.length > 0 && (
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
          <Button onClick={handleRun} disabled={isRunning}>
            {isRunning ? (
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
