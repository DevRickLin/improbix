'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useReportStore } from '@/stores/report-store';
import { reportsApi } from '@/lib/api/reports';
import type { FindReportsParams, FindLinksParams } from '@/types/report';

export function useReports() {
  const { setReports, setLinks, removeReport, setLoading, setError, setSearchQuery } = useReportStore();

  const fetchReports = useCallback(
    async (params?: FindReportsParams) => {
      try {
        setLoading(true);
        setError(null);
        const response = await reportsApi.getAll(params);
        setReports(response.data, response.total);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch reports';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [setReports, setLoading, setError]
  );

  const fetchLinks = useCallback(
    async (params?: FindLinksParams) => {
      try {
        setLoading(true);
        setError(null);
        const response = await reportsApi.getLinks(params);
        setLinks(response.data, response.total);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch links';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [setLinks, setLoading, setError]
  );

  const getReportById = useCallback(async (id: string) => {
    try {
      setLoading(true);
      return await reportsApi.getById(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch report';
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  const deleteReport = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        await reportsApi.delete(id);
        removeReport(id);
        toast.success('Report deleted successfully');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete report';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [removeReport, setLoading]
  );

  const searchReports = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      await fetchReports({ search: query });
    },
    [fetchReports, setSearchQuery]
  );

  const searchLinks = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      await fetchLinks({ search: query });
    },
    [fetchLinks, setSearchQuery]
  );

  return {
    fetchReports,
    fetchLinks,
    getReportById,
    deleteReport,
    searchReports,
    searchLinks,
  };
}
