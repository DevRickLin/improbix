import { apiClient } from './client';

interface FeishuStatusResponse {
  configured: boolean;
  hasSecret: boolean;
}

interface FeishuSendResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface FeishuMessageContent {
  msg_type: 'text' | 'post' | 'image' | 'share_chat' | 'interactive';
  content: any;
}

export const feishuApi = {
  getStatus: () => apiClient.get<FeishuStatusResponse>('/feishu/status'),

  sendText: (text: string) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-text', { text }),

  sendMessage: (params: FeishuMessageContent) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-message', params),

  testConnection: () =>
    apiClient.post<FeishuSendResponse>('/feishu/test-connection'),
};
