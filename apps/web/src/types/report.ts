export interface CollectedLink {
  id: number;
  reportId?: string | null;
  executionId?: string | null;
  url: string;
  title?: string | null;
  description?: string | null;
  source?: string | null;
  collectedAt: string;
}

export interface AIReport {
  id: string;
  executionId?: string | null;
  taskId?: number | null;
  title?: string | null;
  content: string;
  summary?: string | null;
  createdAt: string;
  links?: CollectedLink[];
}

export interface ReportsResponse {
  data: AIReport[];
  total: number;
}

export interface CollectedLinksResponse {
  data: CollectedLink[];
  total: number;
}

export interface FindReportsParams {
  search?: string;
  taskId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface FindLinksParams {
  search?: string;
  limit?: number;
  offset?: number;
}
