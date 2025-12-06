import { apiClient } from './client';

interface SearchStatusResponse {
  configured: boolean;
}

interface SearchResponse {
  success: boolean;
  query?: string;
  url?: string;
  limit?: number;
  data: any;
}

export const searchApi = {
  getStatus: () => apiClient.get<SearchStatusResponse>('/search/status'),

  search: (query: string) =>
    apiClient.post<SearchResponse>('/search/search', { query }),

  searchByQuery: (query: string) =>
    apiClient.get<SearchResponse>(`/search/query?q=${encodeURIComponent(query)}`),

  scrapeUrl: (url: string) =>
    apiClient.post<SearchResponse>('/search/scrape', { url }),

  crawlUrl: (url: string, limit?: number) =>
    apiClient.post<SearchResponse>('/search/crawl', { url, limit }),
};
