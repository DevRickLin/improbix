'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Link2, Trash2, ExternalLink } from 'lucide-react';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ReportDetail } from './report-detail';
import { useReports } from '@/lib/hooks/use-reports';
import type { AIReport } from '@/types/report';

interface ReportCardProps {
  report: AIReport;
}

export function ReportCard({ report }: ReportCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteReport } = useReports();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteReport(report.id);
    } catch {
      // Error handled by hook
    } finally {
      setIsDeleting(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(report.createdAt), { addSuffix: true });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium line-clamp-1">
              {report.title || 'Untitled Report'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
          {report.links && report.links.length > 0 && (
            <Badge variant="secondary" className="shrink-0">
              <Link2 className="h-3 w-3 mr-1" />
              {report.links.length} links
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {report.summary ? (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {report.summary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {report.content.slice(0, 200)}...
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDetail(true)}>
            <FileText className="h-4 w-4 mr-1" />
            View
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Report</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this report? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      <ReportDetail
        report={report}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
    </>
  );
}
