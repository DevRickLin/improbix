import { apiClient } from './client';
import type {
  AIReport,
  ReportsResponse,
  CollectedLinksResponse,
  FindReportsParams,
  FindLinksParams,
} from '@/types/report';

export const reportsApi = {
  getAll: (params?: FindReportsParams) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.taskId) query.set('taskId', String(params.taskId));
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return apiClient.get<ReportsResponse>(
      `/reports${queryString ? `?${queryString}` : ''}`
    );
  },

  getById: (id: string) => apiClient.get<AIReport>(`/reports/${id}`),

  getLinks: (params?: FindLinksParams) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return apiClient.get<CollectedLinksResponse>(
      `/reports/links${queryString ? `?${queryString}` : ''}`
    );
  },

  delete: (id: string) => apiClient.delete<void>(`/reports/${id}`),
};
