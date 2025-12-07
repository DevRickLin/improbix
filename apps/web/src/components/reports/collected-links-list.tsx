'use client';

import { useEffect, useCallback, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReportStore } from '@/stores/report-store';
import { useReports } from '@/lib/hooks/use-reports';
import { ReportSearch } from './report-search';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

const PAGE_SIZE = 20;

export function CollectedLinksList() {
  const { links, isLoading, error, linksTotal } = useReportStore();
  const { fetchLinks } = useReports();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLinks({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: search || undefined });
  }, [fetchLinks, page, search]);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(0);
  }, []);

  const totalPages = Math.ceil(linksTotal / PAGE_SIZE);
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  if (isLoading && links.length === 0) {
    return (
      <div className="space-y-4">
        <ReportSearch onSearch={handleSearch} placeholder="Search links..." />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ReportSearch onSearch={handleSearch} placeholder="Search links..." />
        <div className="text-center py-8 text-destructive">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReportSearch onSearch={handleSearch} placeholder="Search links..." />

      {links.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>{search ? 'No links found matching your search.' : 'No collected links yet.'}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {links.map((link) => (
              <Card key={link.id}>
                <CardContent className="p-4">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 group"
                  >
                    <ExternalLink className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary group-hover:underline truncate">
                        {link.title || link.url}
                      </p>
                      {link.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {link.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {link.source && (
                          <Badge variant="outline" className="text-xs">
                            {link.source}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(link.collectedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </a>
                </CardContent>
              </Card>
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
