'use client';

import { useState } from 'react';
import { Play, Trash2, Clock, Edit, CalendarClock } from 'lucide-react';
import cronstrue from 'cronstrue';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskDeleteDialog } from './task-delete-dialog';
import { TaskRunDialog } from './task-run-dialog';
import { TaskDialog } from './task-dialog';
import type { Task } from '@/types/task';

function formatNextRunAt(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  // If in the past, show "overdue"
  if (diffMs < 0) {
    return 'overdue';
  }

  // If within 1 hour, show relative time
  if (diffMs < 60 * 60 * 1000) {
    const minutes = Math.round(diffMs / (60 * 1000));
    return `in ${minutes} min`;
  }

  // If within 24 hours, show time only
  if (diffMs < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Otherwise show date and time
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const [cronDescription, setCronDescription] = useState<string>('');

  try {
    const desc = cronstrue.toString(task.cronSchedule, { locale: 'en' });
    if (cronDescription !== desc) {
      setCronDescription(desc);
    }
  } catch {
    if (cronDescription !== task.cronSchedule) {
      setCronDescription(task.cronSchedule);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">{task.name}</CardTitle>
        <Badge variant={task.isActive ? 'default' : 'secondary'}>
          {task.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{cronDescription || task.cronSchedule}</span>
        </div>
        {task.nextRunAt && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            <span>Next: {formatNextRunAt(task.nextRunAt)}</span>
          </div>
        )}
        <p className="text-sm line-clamp-3">{task.prompt}</p>
      </CardContent>
      <CardFooter className="flex gap-2">
        <TaskRunDialog task={task}>
          <Button variant="outline" size="sm">
            <Play className="h-4 w-4 mr-1" />
            Run
          </Button>
        </TaskRunDialog>
        <TaskDialog task={task} mode="edit">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </TaskDialog>
        <TaskDeleteDialog taskId={task.id} taskName={task.name}>
          <Button variant="outline" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </TaskDeleteDialog>
      </CardFooter>
    </Card>
  );
}
