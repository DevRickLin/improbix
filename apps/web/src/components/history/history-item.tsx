'use client';

import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ExecutionHistory } from '@/types/history';

interface HistoryItemProps {
  execution: ExecutionHistory;
}

export function HistoryItem({ execution }: HistoryItemProps) {
  const statusIcon = {
    success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  };

  const statusVariant = {
    success: 'default' as const,
    error: 'destructive' as const,
    running: 'secondary' as const,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            {statusIcon[execution.status]}
            {execution.taskName}
          </CardTitle>
          <Badge variant={statusVariant[execution.status]}>
            {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
          </Badge>
        </div>
        <CardDescription>
          {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Prompt</p>
          <p className="text-sm line-clamp-2">{execution.prompt}</p>
        </div>
        {execution.result && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Result</p>
            <p className="text-sm line-clamp-3 font-mono bg-muted p-2 rounded">
              {execution.result}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
