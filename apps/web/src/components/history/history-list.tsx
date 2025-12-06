'use client';

import { useHistoryStore } from '@/stores/history-store';
import { HistoryItem } from './history-item';
import { Button } from '@/components/ui/button';
import { Inbox, Trash2 } from 'lucide-react';

export function HistoryList() {
  const { history, clearHistory } = useHistoryStore();

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No execution history</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Run a task to see the execution history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={clearHistory}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear History
        </Button>
      </div>
      <div className="grid gap-4">
        {history.map((execution) => (
          <HistoryItem key={execution.id} execution={execution} />
        ))}
      </div>
    </div>
  );
}
