import { apiClient } from './client';

export interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  parts: string | null;
  createdAt: string;
}

export interface SessionWithMessages extends ChatSession {
  messages: ChatMessage[];
}

export const sessionsApi = {
  list: () => apiClient.get<ChatSession[]>('/sessions'),

  create: (id: string, title?: string) =>
    apiClient.post<ChatSession>('/sessions', { id, title }),

  get: (id: string) =>
    apiClient.get<SessionWithMessages>(`/sessions/${id}`),

  update: (id: string, title: string) =>
    apiClient.put<ChatSession>(`/sessions/${id}`, { title }),

  delete: (id: string) =>
    apiClient.delete(`/sessions/${id}`),
};
