export interface AgentMessage {
  type: string;
  content: string;
  timestamp: string;
}

export interface ExecutionHistory {
  id: string;
  taskId: number | null;
  taskName: string;
  prompt: string;
  result: string;
  status: 'success' | 'error' | 'running';
  startedAt: string;
  completedAt?: string;
  messages: AgentMessage[];
}
