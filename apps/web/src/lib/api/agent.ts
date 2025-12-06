import { apiClient } from './client';

export interface RunAgentResponse {
  executionId: string;
  status: 'started';
  message: string;
}

export const agentApi = {
  /**
   * 启动 Agent 执行（立即返回 executionId）
   */
  run: (task: string) =>
    apiClient.post<RunAgentResponse>('/agent/run', { task }),

  /**
   * 获取 SSE 流 URL
   */
  getStreamUrl: (executionId: string) => `/api/agent/stream/${executionId}`,
};
