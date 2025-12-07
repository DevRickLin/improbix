'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Link2 } from 'lucide-react';

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
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TopicSourceForm, SourceItem, type SourceFormData } from './topic-source-form';
import { useTopics } from '@/lib/hooks/use-topics';
import type { Topic, TopicSource } from '@/types/topic';

const topicSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  autoFetchSources: z.boolean(),
});

type TopicFormData = z.infer<typeof topicSchema>;

interface SourceChange {
  type: 'add' | 'edit' | 'delete';
  source: SourceFormData;
  originalId?: number;
}

interface TopicDialogProps {
  children: React.ReactNode;
  topic?: Topic;
  mode?: 'create' | 'edit';
}

export function TopicDialog({ children, topic, mode = 'create' }: TopicDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { createTopic, editTopic, addSource, editSource, deleteSource, fetchTopics } = useTopics();

  // Local sources state
  const [sources, setSources] = useState<SourceFormData[]>([]);
  const [sourceChanges, setSourceChanges] = useState<SourceChange[]>([]);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [editingSourceIndex, setEditingSourceIndex] = useState<number | null>(null);

  const isEditMode = mode === 'edit' && topic;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TopicFormData>({
    resolver: zodResolver(topicSchema),
    defaultValues: {
      name: topic?.name || '',
      prompt: topic?.prompt || '',
      autoFetchSources: topic?.autoFetchSources || false,
    },
  });

  const autoFetchSources = watch('autoFetchSources');

  // Initialize sources when dialog opens
  useEffect(() => {
    if (open) {
      if (topic) {
        setSources(topic.sources.map(s => ({
          id: s.id,
          name: s.name,
          url: s.url,
          description: s.description || undefined,
        })));
        reset({
          name: topic.name,
          prompt: topic.prompt,
          autoFetchSources: topic.autoFetchSources,
        });
      } else {
        setSources([]);
        reset({
          name: '',
          prompt: '',
          autoFetchSources: false,
        });
      }
      setSourceChanges([]);
      setIsAddingSource(false);
      setEditingSourceIndex(null);
    }
  }, [open, topic, reset]);

  const handleAddSource = useCallback((data: SourceFormData) => {
    setSources(prev => [...prev, data]);
    if (isEditMode) {
      setSourceChanges(prev => [...prev, { type: 'add', source: data }]);
    }
    setIsAddingSource(false);
  }, [isEditMode]);

  const handleEditSource = useCallback((index: number, data: SourceFormData) => {
    setSources(prev => {
      const newSources = [...prev];
      const oldSource = newSources[index];
      newSources[index] = data;
      return newSources;
    });

    if (isEditMode && sources[index]?.id) {
      setSourceChanges(prev => {
        // Remove any previous edit for this source
        const filtered = prev.filter(c => !(c.type === 'edit' && c.originalId === sources[index].id));
        return [...filtered, { type: 'edit', source: data, originalId: sources[index].id }];
      });
    }
    setEditingSourceIndex(null);
  }, [isEditMode, sources]);

  const handleDeleteSource = useCallback((index: number) => {
    const sourceToDelete = sources[index];
    setSources(prev => prev.filter((_, i) => i !== index));

    if (isEditMode && sourceToDelete?.id) {
      setSourceChanges(prev => {
        // Remove any add/edit changes for this source
        const filtered = prev.filter(c =>
          !(c.source.id === sourceToDelete.id || c.originalId === sourceToDelete.id)
        );
        return [...filtered, { type: 'delete', source: sourceToDelete }];
      });
    }

    if (editingSourceIndex === index) {
      setEditingSourceIndex(null);
    } else if (editingSourceIndex !== null && editingSourceIndex > index) {
      setEditingSourceIndex(editingSourceIndex - 1);
    }
  }, [isEditMode, sources, editingSourceIndex]);

  const onSubmit = async (data: TopicFormData) => {
    try {
      setIsLoading(true);

      if (isEditMode) {
        // Edit mode: update topic, then apply source changes
        await editTopic(topic.id, data);

        // Apply source changes
        for (const change of sourceChanges) {
          if (change.type === 'add') {
            await addSource(topic.id, {
              name: change.source.name,
              url: change.source.url,
              description: change.source.description,
            });
          } else if (change.type === 'edit' && change.originalId) {
            await editSource(topic.id, change.originalId, {
              name: change.source.name,
              url: change.source.url,
              description: change.source.description,
            });
          } else if (change.type === 'delete' && change.source.id) {
            await deleteSource(topic.id, change.source.id);
          }
        }

        // Refresh topics list
        await fetchTopics();
      } else {
        // Create mode: create topic with sources
        await createTopic({
          ...data,
          sources: sources.map(s => ({
            name: s.name,
            url: s.url,
            description: s.description,
          })),
        });
      }

      setOpen(false);
    } catch {
      // Error is handled by hook
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Topic' : 'Create New Topic'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the topic settings, focus areas, and information sources.'
              : 'Create a new topic to organize information sources and focus areas.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="grid gap-4 py-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="name">Topic Name</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., AI Tech News"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">Focus Instructions</Label>
                <Textarea
                  id="prompt"
                  {...register('prompt')}
                  placeholder="Describe what information to focus on..."
                  rows={3}
                  disabled={isLoading}
                />
                {errors.prompt && (
                  <p className="text-sm text-destructive">{errors.prompt.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoFetch">Auto Fetch Sources</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically fetch content from source URLs when running tasks
                  </p>
                </div>
                <Switch
                  id="autoFetch"
                  checked={autoFetchSources}
                  onCheckedChange={(checked) => setValue('autoFetchSources', checked)}
                  disabled={isLoading}
                />
              </div>

              {/* Sources Section */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <Label>Information Sources</Label>
                    <span className="text-xs text-muted-foreground">({sources.length})</span>
                  </div>
                  {!isAddingSource && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingSource(true)}
                      disabled={isLoading}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Source
                    </Button>
                  )}
                </div>

                {/* Add new source form */}
                {isAddingSource && (
                  <TopicSourceForm
                    isNew
                    onSave={handleAddSource}
                    onCancel={() => setIsAddingSource(false)}
                  />
                )}

                {/* Sources list */}
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {sources.map((source, index) => (
                    editingSourceIndex === index ? (
                      <TopicSourceForm
                        key={source.id || `new-${index}`}
                        source={source}
                        onSave={(data) => handleEditSource(index, data)}
                        onCancel={() => setEditingSourceIndex(null)}
                      />
                    ) : (
                      <SourceItem
                        key={source.id || `new-${index}`}
                        source={source}
                        onEdit={() => setEditingSourceIndex(index)}
                        onDelete={() => handleDeleteSource(index)}
                      />
                    )
                  ))}
                  {sources.length === 0 && !isAddingSource && (
                    <p className="text-sm text-muted-foreground italic text-center py-4">
                      No sources added yet. Click &quot;Add Source&quot; to add information sources.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? (isEditMode ? 'Saving...' : 'Creating...')
                : (isEditMode ? 'Save Changes' : 'Create Topic')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
