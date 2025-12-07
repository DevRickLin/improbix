'use client';

import { useState } from 'react';
import { Play, Trash2, Clock, Edit } from 'lucide-react';
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
