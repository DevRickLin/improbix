export interface TopicSource {
  id: number;
  topicId: number;
  name: string;
  description?: string | null;
  url: string;
  createdAt: string;
}

export interface Topic {
  id: number;
  name: string;
  prompt: string;
  autoFetchSources: boolean;
  sources: TopicSource[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopicDto {
  name: string;
  prompt: string;
  autoFetchSources?: boolean;
  sources?: Array<{
    name: string;
    description?: string;
    url: string;
  }>;
}

export interface UpdateTopicDto {
  name?: string;
  prompt?: string;
  autoFetchSources?: boolean;
}

export interface CreateTopicSourceDto {
  name: string;
  description?: string;
  url: string;
}

export interface UpdateTopicSourceDto {
  name?: string;
  description?: string;
  url?: string;
}
