import { apiClient } from './client';
import type {
  Topic,
  TopicSource,
  CreateTopicDto,
  UpdateTopicDto,
  CreateTopicSourceDto,
  UpdateTopicSourceDto,
} from '@/types/topic';

export const topicsApi = {
  getAll: () => apiClient.get<Topic[]>('/topics'),

  getById: (id: number) => apiClient.get<Topic>(`/topics/${id}`),

  create: (data: CreateTopicDto) => apiClient.post<Topic>('/topics', data),

  update: (id: number, data: UpdateTopicDto) =>
    apiClient.put<Topic>(`/topics/${id}`, data),

  delete: (id: number) => apiClient.delete<void>(`/topics/${id}`),

  // Source operations
  addSource: (topicId: number, data: CreateTopicSourceDto) =>
    apiClient.post<TopicSource>(`/topics/${topicId}/sources`, data),

  updateSource: (topicId: number, sourceId: number, data: UpdateTopicSourceDto) =>
    apiClient.put<TopicSource>(`/topics/${topicId}/sources/${sourceId}`, data),

  deleteSource: (topicId: number, sourceId: number) =>
    apiClient.delete<void>(`/topics/${topicId}/sources/${sourceId}`),
};
