'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTaskStore } from '@/stores/task-store';
import { tasksApi } from '@/lib/api/tasks';
import type { CreateTaskDto } from '@/types/task';

/**
 * Hook for task CRUD operations.
 * For running agent tasks, use useAgentChat hook instead.
 */
export function useTasks() {
  const { setTasks, addTask, removeTask, setLoading, setError } = useTaskStore();

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

  return {
    fetchTasks,
    createTask,
    deleteTask,
  };
}
