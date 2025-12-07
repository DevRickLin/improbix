import type { Topic } from './topic';

export interface Task {
  id: number;
  name: string;
  cronSchedule: string;
  prompt: string;
  isActive: boolean;
  timezone?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  topicIds?: number[];
  topics?: Topic[];
}

export interface CreateTaskDto {
  name: string;
  cron: string;
  prompt: string;
  timezone?: string;
  topicIds?: number[];
}

export interface UpdateTaskDto {
  name?: string;
  cronSchedule?: string;
  prompt?: string;
  isActive?: boolean;
  timezone?: string;
}

export interface TaskExecution {
  id: string;
  taskId: number | null;
  taskName: string;
  prompt: string;
  result: string | null;
  status: 'running' | 'success' | 'error';
  startedAt: string;
  completedAt?: string | null;
}

export interface TaskExecutionsResponse {
  data: TaskExecution[];
  total: number;
}
