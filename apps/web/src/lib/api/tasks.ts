import { apiClient } from './client';
import type {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
  TaskExecution,
  TaskExecutionsResponse,
} from '@/types/task';

export const tasksApi = {
  getAll: () => apiClient.get<Task[]>('/tasks'),

  create: (data: CreateTaskDto) => apiClient.post<Task>('/tasks', data),

  update: (id: number, data: UpdateTaskDto) =>
    apiClient.put<Task>(`/tasks/${id}`, data),

  delete: (id: number) => apiClient.delete<void>(`/tasks/${id}`),

  run: (id: number) => apiClient.post<TaskExecution>(`/tasks/${id}/run`),

  getExecutions: (params?: { taskId?: number; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.taskId) query.set('taskId', String(params.taskId));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return apiClient.get<TaskExecutionsResponse>(
      `/tasks/executions${queryString ? `?${queryString}` : ''}`
    );
  },

  getTaskExecutions: (taskId: number) =>
    apiClient.get<TaskExecutionsResponse>(`/tasks/${taskId}/executions`),
};
