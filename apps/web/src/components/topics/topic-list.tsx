'use client';

import { useEffect } from 'react';
import { useTopicStore } from '@/stores/topic-store';
import { useTopics } from '@/lib/hooks/use-topics';
import { TopicCard } from './topic-card';
import { Skeleton } from '@/components/ui/skeleton';

export function TopicList() {
  const { topics, isLoading, error } = useTopicStore();
  const { fetchTopics } = useTopics();

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  if (isLoading && topics.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[200px]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No topics yet. Create your first topic to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} />
      ))}
    </div>
  );
}
