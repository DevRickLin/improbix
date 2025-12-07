'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TopicList } from '@/components/topics/topic-list';
import { TopicDialog } from '@/components/topics/topic-dialog';

export default function TopicsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Topics</h1>
          <p className="text-muted-foreground">
            Manage your information focus areas and sources
          </p>
        </div>
        <TopicDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Topic
          </Button>
        </TopicDialog>
      </div>
      <TopicList />
    </div>
  );
}
