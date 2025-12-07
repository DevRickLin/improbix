'use client';

import { Pencil, Trash2, Link2, ExternalLink } from 'lucide-react';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TopicDeleteDialog } from './topic-delete-dialog';
import { TopicDialog } from './topic-dialog';
import type { Topic } from '@/types/topic';

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">{topic.name}</CardTitle>
        <Badge variant={topic.autoFetchSources ? 'default' : 'secondary'}>
          {topic.autoFetchSources ? 'Auto Fetch' : 'Manual'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{topic.prompt}</p>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Sources ({topic.sources.length})
          </div>
          {topic.sources.length > 0 ? (
            <div className="space-y-1">
              {topic.sources.slice(0, 3).map((source) => (
                <div key={source.id} className="flex items-center gap-2 text-sm">
                  <span className="truncate flex-1">{source.name}</span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
              {topic.sources.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{topic.sources.length - 3} more sources
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No sources configured</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <TopicDialog topic={topic} mode="edit">
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </TopicDialog>
        <TopicDeleteDialog topicId={topic.id} topicName={topic.name}>
          <Button variant="outline" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </TopicDeleteDialog>
      </CardFooter>
    </Card>
  );
}
