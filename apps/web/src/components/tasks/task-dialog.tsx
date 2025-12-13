'use client';

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SchedulePicker } from '@/components/ui/schedule-picker';
import { TopicSelector } from '@/components/topics/topic-selector';
import { useTasks } from '@/lib/hooks/use-tasks';
import type { Task } from '@/types/task';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '北京时间 (UTC+8)' },
  { value: 'Asia/Tokyo', label: '东京时间 (UTC+9)' },
  { value: 'America/New_York', label: '纽约时间 (UTC-5)' },
  { value: 'America/Los_Angeles', label: '洛杉矶时间 (UTC-8)' },
  { value: 'Europe/London', label: '伦敦时间 (UTC+0)' },
  { value: 'UTC', label: 'UTC' },
];

// Get browser's default timezone
const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

const taskSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cron: z.string().min(1, 'Schedule is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  timezone: z.string(),
  topicIds: z.array(z.number()),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskDialogProps {
  children: React.ReactNode;
  task?: Task;
  mode?: 'create' | 'edit';
}

export function TaskDialog({ children, task, mode = 'create' }: TaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { createTask, updateTask } = useTasks();
  const isEditMode = mode === 'edit' && task;

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
      timezone: getBrowserTimezone(),
      topicIds: [],
    },
  });

  // Initialize form when dialog opens in edit mode
  useEffect(() => {
    if (open) {
      if (task) {
        reset({
          name: task.name,
          cron: task.cronSchedule,
          prompt: task.prompt,
          timezone: task.timezone || getBrowserTimezone(),
          topicIds: task.topics?.map((t) => t.id) || [],
        });
      } else {
        reset({
          name: '',
          cron: '0 9 * * *',
          prompt: '',
          timezone: getBrowserTimezone(),
          topicIds: [],
        });
      }
    }
  }, [open, task, reset]);

  const onSubmit = async (data: TaskFormData) => {
    try {
      setIsLoading(true);
      if (isEditMode) {
        await updateTask(task.id, {
          name: data.name,
          cronSchedule: data.cron,
          prompt: data.prompt,
          timezone: data.timezone,
          topicIds: data.topicIds,
        });
      } else {
        await createTask({
          name: data.name,
          cron: data.cron,
          prompt: data.prompt,
          timezone: data.timezone,
          topicIds: data.topicIds,
        });
      }
      setOpen(false);
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
          <DialogTitle>{isEditMode ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the task settings and schedule.'
              : 'Set up a new scheduled AI task. The task will run automatically based on the schedule.'}
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
              <Label>Timezone</Label>
              <Controller
                name="timezone"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                The schedule will be executed based on this timezone.
              </p>
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

            <div className="space-y-2">
              <Label>Topics (Optional)</Label>
              <Controller
                name="topicIds"
                control={control}
                render={({ field }) => (
                  <TopicSelector
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isLoading}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">
                Select topics to provide context and information sources to the AI.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? (isEditMode ? 'Saving...' : 'Creating...')
                : (isEditMode ? 'Save Changes' : 'Create Task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
