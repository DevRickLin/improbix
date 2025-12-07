import { create } from 'zustand';
import type { Topic } from '@/types/topic';

interface TopicState {
  topics: Topic[];
  isLoading: boolean;
  error: string | null;

  setTopics: (topics: Topic[]) => void;
  addTopic: (topic: Topic) => void;
  removeTopic: (id: number) => void;
  updateTopic: (id: number, updates: Partial<Topic>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTopicStore = create<TopicState>((set) => ({
  topics: [],
  isLoading: false,
  error: null,

  setTopics: (topics) => set({ topics, error: null }),

  addTopic: (topic) =>
    set((state) => ({ topics: [topic, ...state.topics] })),

  removeTopic: (id) =>
    set((state) => ({
      topics: state.topics.filter((t) => t.id !== id),
    })),

  updateTopic: (id, updates) =>
    set((state) => ({
      topics: state.topics.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),
}));
