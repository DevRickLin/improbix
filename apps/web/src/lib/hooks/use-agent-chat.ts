'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useHistoryStore } from '@/stores/history-store';
import { useAuthStore } from '@/stores/auth-store';
import type { ExecutionHistory } from '@/types/history';

interface UseAgentChatOptions {
  taskId?: number | null;
  taskName?: string;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  : '';
const chatEndpoint = apiBaseUrl
  ? `${apiBaseUrl}/api/agent/chat`
  : '/api/agent/chat';

// Extract text and tool content from message parts
function getMessageText(message: UIMessage): string {
  if (!message.parts) return '';

  return message.parts
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }
      return formatToolPart(part);
    })
    .filter(Boolean)
    .join('\n\n');
}

function formatToolPart(part: UIMessage['parts'][number]): string {
  if (typeof part?.type !== 'string') {
    return '';
  }

  // AI SDK 5 使用 'tool-invocation' 和 'tool-result' 类型
  const isToolPart =
    part.type === 'tool-invocation' ||
    part.type === 'tool-result' ||
    part.type === 'dynamic-tool' ||
    part.type.startsWith('tool-');

  if (!isToolPart) {
    return '';
  }

  const toolPart = part as {
    toolName?: string;
    toolCallId?: string;
    state?: string;
    args?: unknown;
    result?: unknown;
    // 兼容旧格式
    input?: unknown;
    output?: unknown;
    errorText?: string;
    preliminary?: boolean;
  };

  const toolName = toolPart.toolName ?? 'tool';

  // 处理错误
  if (toolPart.state === 'error' || toolPart.errorText) {
    const errorMsg = toolPart.errorText || serializeValue(toolPart.result);
    return `[Tool ${toolName} error]\n${errorMsg}`;
  }

  // 处理工具结果 (AI SDK 5 格式)
  if (part.type === 'tool-result' && toolPart.result !== undefined) {
    return `[Tool ${toolName} completed]\n${serializeValue(toolPart.result)}`;
  }

  // 处理工具调用 (AI SDK 5 格式)
  if (part.type === 'tool-invocation' && toolPart.args !== undefined) {
    return `[Tool ${toolName} called]\n${serializeValue(toolPart.args)}`;
  }

  // 兼容旧格式
  if (toolPart.output !== undefined) {
    const preliminaryLabel = toolPart.preliminary ? ' (preliminary)' : '';
    return `[Tool ${toolName} output]\n${serializeValue(toolPart.output)}${preliminaryLabel}`;
  }

  if (toolPart.input !== undefined) {
    return `[Tool ${toolName} input]\n${serializeValue(toolPart.input)}`;
  }

  return `[Tool ${toolName}]`;
}

function serializeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const { taskId = null, taskName = 'Manual Run' } = options;
  const { addExecution, updateExecution } = useHistoryStore();
  const { token } = useAuthStore();
  const currentExecutionId = useRef<string | null>(null);

  // Create transport with auth headers
  const transport = useMemo(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    return new DefaultChatTransport({
      api: chatEndpoint,
      headers,
    });
  }, [token]);

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
  } = useChat({
    transport,
    onFinish: ({ message }) => {
      if (currentExecutionId.current) {
        updateExecution(currentExecutionId.current, {
          result: getMessageText(message),
          status: 'success',
          completedAt: new Date().toISOString(),
        });
        toast.success('Task completed');
      }
    },
    onError: (error) => {
      if (currentExecutionId.current) {
        updateExecution(currentExecutionId.current, {
          result: error.message,
          status: 'error',
          completedAt: new Date().toISOString(),
        });
      }
      toast.error(error.message);
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const runAgent = useCallback(
    async (prompt: string) => {
      // Clear previous messages
      setMessages([]);

      // Generate execution ID
      const executionId = crypto.randomUUID();
      currentExecutionId.current = executionId;

      // Create execution record
      const execution: ExecutionHistory = {
        id: executionId,
        taskId,
        taskName,
        prompt,
        result: '',
        status: 'running',
        startedAt: new Date().toISOString(),
        messages: [],
      };
      addExecution(execution);

      // Send message to start the chat
      try {
        await sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: prompt }],
        });
        return executionId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start execution';
        toast.error(message);
        throw error;
      }
    },
    [sendMessage, addExecution, setMessages, taskId, taskName]
  );

  const reset = useCallback(() => {
    setMessages([]);
    currentExecutionId.current = null;
  }, [setMessages]);

  return {
    messages,
    isLoading,
    error,
    runAgent,
    reset,
    currentExecutionId: currentExecutionId.current,
  };
}
