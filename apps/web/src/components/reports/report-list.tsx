'use client';

import { useEffect, useCallback, useState } from 'react';
import { useReportStore } from '@/stores/report-store';
import { useReports } from '@/lib/hooks/use-reports';
import { ReportCard } from './report-card';
import { ReportSearch } from './report-search';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 12;

export function ReportList() {
  const { reports, isLoading, error, total } = useReportStore();
  const { fetchReports } = useReports();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchReports({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: search || undefined });
  }, [fetchReports, page, search]);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(0);
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  if (isLoading && reports.length === 0) {
    return (
      <div className="space-y-4">
        <ReportSearch onSearch={handleSearch} placeholder="Search reports..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[180px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ReportSearch onSearch={handleSearch} placeholder="Search reports..." />
        <div className="text-center py-8 text-destructive">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReportSearch onSearch={handleSearch} placeholder="Search reports..." />

      {reports.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>{search ? 'No reports found matching your search.' : 'No reports yet.'}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={!hasPrevPage || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNextPage || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
