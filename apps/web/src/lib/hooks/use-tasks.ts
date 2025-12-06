'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTaskStore } from '@/stores/task-store';
import { useHistoryStore } from '@/stores/history-store';
import { tasksApi } from '@/lib/api/tasks';
import { agentApi } from '@/lib/api/agent';
import type { CreateTaskDto } from '@/types/task';
import type { ExecutionHistory } from '@/types/history';

// 提取消息内容摘要
function extractMessageContent(msg: any): string {
  switch (msg.type) {
    case 'started':
      return 'Agent started';
    case 'assistant': {
      const textBlocks = msg.message?.content?.filter((b: any) => b.type === 'text') || [];
      const toolBlocks = msg.message?.content?.filter((b: any) => b.type === 'tool_use') || [];
      const texts = textBlocks.map((b: any) => b.text).join('\n');
      const tools = toolBlocks.map((b: any) => `[Tool: ${b.name}]`).join(' ');
      return texts || tools || 'Thinking...';
    }
    case 'tool_result':
      return 'Tool result received';
    case 'result':
      return msg.subtype === 'success' ? msg.result : `Error: ${msg.errors?.join(', ') || 'Unknown error'}`;
    case 'error':
      return msg.message || 'Unknown error';
    default:
      return `[${msg.type}]`;
  }
}

export function useTasks() {
  const { setTasks, addTask, removeTask, setLoading, setError } = useTaskStore();
  const { addExecution, updateExecution, appendMessage } = useHistoryStore();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tasks = await tasksApi.getAll();
      setTasks(tasks);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tasks';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [setTasks, setLoading, setError]);

  const createTask = useCallback(
    async (data: CreateTaskDto) => {
      try {
        setLoading(true);
        const task = await tasksApi.create(data);
        addTask(task);
        toast.success('Task created successfully');
        return task;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create task';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [addTask, setLoading]
  );

  const deleteTask = useCallback(
    async (id: number) => {
      try {
        setLoading(true);
        await tasksApi.delete(id);
        removeTask(id);
        toast.success('Task deleted successfully');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete task';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [removeTask, setLoading]
  );

  /**
   * 执行任务（使用 SSE 实时推送）
   */
  const runTask = useCallback(
    async (taskId: number | null, taskName: string, prompt: string) => {
      try {
        // 1. 启动执行（立即返回 executionId）
        const response = await agentApi.run(prompt);
        const { executionId } = response;

        // 2. 添加执行记录
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

        // 3. 订阅 SSE 获取实时更新
        const eventSource = new EventSource(agentApi.getStreamUrl(executionId));

        eventSource.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            // 追加消息到日志
            const content = extractMessageContent(msg);
            appendMessage(executionId, {
              type: msg.type,
              content,
              timestamp: new Date().toISOString(),
            });

            // 处理结果消息
            if (msg.type === 'result') {
              const result = msg.subtype === 'success' ? msg.result : `Error: ${msg.errors?.join(', ') || 'Unknown error'}`;
              updateExecution(executionId, {
                result,
                status: msg.subtype === 'success' ? 'success' : 'error',
                completedAt: new Date().toISOString(),
              });
              if (msg.subtype === 'success') {
                toast.success('Task executed successfully');
              } else {
                toast.error('Task execution failed');
              }
              eventSource.close();
            }

            // 处理错误消息
            if (msg.type === 'error') {
              updateExecution(executionId, {
                result: msg.message || 'Unknown error',
                status: 'error',
                completedAt: new Date().toISOString(),
              });
              toast.error(msg.message || 'Execution failed');
              eventSource.close();
            }
          } catch (e) {
            console.error('Failed to parse SSE message:', e);
          }
        };

        eventSource.onerror = () => {
          updateExecution(executionId, {
            result: 'Connection lost',
            status: 'error',
            completedAt: new Date().toISOString(),
          });
          toast.error('Connection lost');
          eventSource.close();
        };

        return executionId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start execution';
        toast.error(message);
        throw error;
      }
    },
    [addExecution, updateExecution, appendMessage]
  );

  return {
    fetchTasks,
    createTask,
    deleteTask,
    runTask,
  };
}
