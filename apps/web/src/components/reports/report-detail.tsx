'use client';

import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Link2, Calendar } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { AIReport } from '@/types/report';

interface ReportDetailProps {
  report: AIReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDetail({ report, open, onOpenChange }: ReportDetailProps) {
  const timeAgo = formatDistanceToNow(new Date(report.createdAt), { addSuffix: true });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="pr-8">{report.title || 'Untitled Report'}</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {timeAgo}
            {report.taskId && (
              <Badge variant="outline">Task #{report.taskId}</Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {report.summary && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Summary</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {report.summary}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Content</h4>
              <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                {report.content}
              </div>
            </div>

            {report.links && report.links.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Collected Links ({report.links.length})
                  </h4>
                  <div className="space-y-2">
                    {report.links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 rounded-md hover:bg-muted transition-colors group"
                      >
                        <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">
                            {link.title || link.url}
                          </p>
                          {link.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {link.description}
                            </p>
                          )}
                          {link.source && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {link.source}
                            </Badge>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
