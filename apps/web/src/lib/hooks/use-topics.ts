'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTopicStore } from '@/stores/topic-store';
import { topicsApi } from '@/lib/api/topics';
import type { CreateTopicDto, UpdateTopicDto, CreateTopicSourceDto, UpdateTopicSourceDto } from '@/types/topic';

export function useTopics() {
  const { setTopics, addTopic, removeTopic, updateTopic, setLoading, setError } = useTopicStore();

  const fetchTopics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const topics = await topicsApi.getAll();
      setTopics(topics);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch topics';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [setTopics, setLoading, setError]);

  const createTopic = useCallback(
    async (data: CreateTopicDto) => {
      try {
        setLoading(true);
        const topic = await topicsApi.create(data);
        addTopic(topic);
        toast.success('Topic created successfully');
        return topic;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create topic';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [addTopic, setLoading]
  );

  const editTopic = useCallback(
    async (id: number, data: UpdateTopicDto) => {
      try {
        setLoading(true);
        const topic = await topicsApi.update(id, data);
        updateTopic(id, topic);
        toast.success('Topic updated successfully');
        return topic;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update topic';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [updateTopic, setLoading]
  );

  const deleteTopic = useCallback(
    async (id: number) => {
      try {
        setLoading(true);
        await topicsApi.delete(id);
        removeTopic(id);
        toast.success('Topic deleted successfully');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete topic';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [removeTopic, setLoading]
  );

  const addSource = useCallback(
    async (topicId: number, data: CreateTopicSourceDto) => {
      try {
        const source = await topicsApi.addSource(topicId, data);
        // Refetch to get updated topic with new source
        await fetchTopics();
        toast.success('Source added successfully');
        return source;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add source';
        toast.error(message);
        throw error;
      }
    },
    [fetchTopics]
  );

  const editSource = useCallback(
    async (topicId: number, sourceId: number, data: UpdateTopicSourceDto) => {
      try {
        const source = await topicsApi.updateSource(topicId, sourceId, data);
        await fetchTopics();
        toast.success('Source updated successfully');
        return source;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update source';
        toast.error(message);
        throw error;
      }
    },
    [fetchTopics]
  );

  const deleteSource = useCallback(
    async (topicId: number, sourceId: number) => {
      try {
        await topicsApi.deleteSource(topicId, sourceId);
        await fetchTopics();
        toast.success('Source deleted successfully');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete source';
        toast.error(message);
        throw error;
      }
    },
    [fetchTopics]
  );

  return {
    fetchTopics,
    createTopic,
    editTopic,
    deleteTopic,
    addSource,
    editSource,
    deleteSource,
  };
}
