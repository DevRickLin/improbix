import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExecutionHistory, AgentMessage } from '@/types/history';

interface HistoryState {
  history: ExecutionHistory[];

  addExecution: (execution: ExecutionHistory) => void;
  updateExecution: (id: string, updates: Partial<ExecutionHistory>) => void;
  appendMessage: (id: string, message: AgentMessage) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      history: [],

      addExecution: (execution) =>
        set((state) => ({
          history: [execution, ...state.history].slice(0, 100),
        })),

      updateExecution: (id, updates) =>
        set((state) => ({
          history: state.history.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        })),

      appendMessage: (id, message) =>
        set((state) => ({
          history: state.history.map((h) =>
            h.id === id
              ? { ...h, messages: [...(h.messages || []), message] }
              : h
          ),
        })),

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'execution-history',
    }
  )
);
