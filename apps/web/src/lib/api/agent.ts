import { apiClient } from './client';

export interface RunAgentResponse {
  status: 'completed';
  result: string;
}

export const agentApi = {
  /**
   * Chat 端点 - 用于 useChat hook
   * 注意：useChat 会直接调用这个端点，不需要手动调用
   */
  chatEndpoint: '/api/agent/chat',

  /**
   * 同步执行 Agent（用于定时任务触发等场景）
   */
  run: (task: string) =>
    apiClient.post<RunAgentResponse>('/agent/run', { task }),
};
