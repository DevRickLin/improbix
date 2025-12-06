'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SchedulePicker } from '@/components/ui/schedule-picker';
import { useTasks } from '@/lib/hooks/use-tasks';

const taskSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cron: z.string().min(1, 'Schedule is required'),
  prompt: z.string().min(1, 'Prompt is required'),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskDialogProps {
  children: React.ReactNode;
}

export function TaskDialog({ children }: TaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { createTask } = useTasks();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      cron: '0 9 * * *',
      prompt: '',
    },
  });

  const onSubmit = async (data: TaskFormData) => {
    try {
      setIsLoading(true);
      await createTask(data);
      setOpen(false);
      reset();
    } catch {
      // Error is handled by useTasks hook
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Set up a new scheduled AI task. The task will run automatically based on the schedule.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Task Name</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g., Daily News Summary"
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Schedule</Label>
              <Controller
                name="cron"
                control={control}
                render={({ field }) => (
                  <SchedulePicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isLoading}
                  />
                )}
              />
              {errors.cron && (
                <p className="text-sm text-destructive">{errors.cron.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">AI Prompt</Label>
              <Textarea
                id="prompt"
                {...register('prompt')}
                placeholder="Describe what the AI should do..."
                rows={4}
                disabled={isLoading}
              />
              {errors.prompt && (
                <p className="text-sm text-destructive">{errors.prompt.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
