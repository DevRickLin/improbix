'use client';

import { useEffect } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TaskList } from '@/components/tasks/task-list';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { useTasks } from '@/lib/hooks/use-tasks';

export default function DashboardPage() {
  const { fetchTasks } = useTasks();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Manage your automated AI agent tasks
          </p>
        </div>
        <TaskDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </TaskDialog>
      </div>

      <TaskList />
    </div>
  );
}
