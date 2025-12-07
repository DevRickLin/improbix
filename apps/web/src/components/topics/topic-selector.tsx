'use client';

import { useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useTopicStore } from '@/stores/topic-store';
import { useTopics } from '@/lib/hooks/use-topics';
import { useState } from 'react';

interface TopicSelectorProps {
  value: number[];
  onChange: (value: number[]) => void;
  disabled?: boolean;
}

export function TopicSelector({ value, onChange, disabled }: TopicSelectorProps) {
  const [open, setOpen] = useState(false);
  const { topics } = useTopicStore();
  const { fetchTopics } = useTopics();

  useEffect(() => {
    if (topics.length === 0) {
      fetchTopics();
    }
  }, [topics.length, fetchTopics]);

  const selectedTopics = topics.filter((t) => value.includes(t.id));

  const toggleTopic = (topicId: number) => {
    if (value.includes(topicId)) {
      onChange(value.filter((id) => id !== topicId));
    } else {
      onChange([...value, topicId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedTopics.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedTopics.map((topic) => (
                <Badge key={topic.id} variant="secondary" className="text-xs">
                  {topic.name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">Select topics...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search topics..." />
          <CommandList>
            <CommandEmpty>No topics found.</CommandEmpty>
            <CommandGroup>
              {topics.map((topic) => (
                <CommandItem
                  key={topic.id}
                  value={topic.name}
                  onSelect={() => toggleTopic(topic.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value.includes(topic.id) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{topic.name}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {topic.prompt}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
