import { create } from 'zustand';
import type { AIReport, CollectedLink } from '@/types/report';

interface ReportState {
  reports: AIReport[];
  links: CollectedLink[];
  isLoading: boolean;
  error: string | null;
  total: number;
  linksTotal: number;
  searchQuery: string;

  setReports: (reports: AIReport[], total: number) => void;
  setLinks: (links: CollectedLink[], total: number) => void;
  removeReport: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearReports: () => void;
}

export const useReportStore = create<ReportState>((set) => ({
  reports: [],
  links: [],
  isLoading: false,
  error: null,
  total: 0,
  linksTotal: 0,
  searchQuery: '',

  setReports: (reports, total) => set({ reports, total, error: null }),

  setLinks: (links, linksTotal) => set({ links, linksTotal, error: null }),

  removeReport: (id) =>
    set((state) => ({
      reports: state.reports.filter((r) => r.id !== id),
      total: state.total - 1,
    })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearReports: () => set({ reports: [], links: [], total: 0, linksTotal: 0 }),
}));
