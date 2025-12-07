import { Inject, Injectable } from '@nestjs/common';
import {
  DatabaseService,
  Topic,
  TopicSource,
  TopicWithSources,
} from '../database/database.service';

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

@Injectable()
export class TopicsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async createTopic(data: CreateTopicDto): Promise<TopicWithSources> {
    // Create topic
    const topic = await this.db.createTopic({
      name: data.name,
      prompt: data.prompt,
      autoFetchSources: data.autoFetchSources,
    });

    // Create sources if provided
    const sources: TopicSource[] = [];
    if (data.sources && data.sources.length > 0) {
      for (const sourceData of data.sources) {
        const source = await this.db.createTopicSource({
          topicId: topic.id,
          name: sourceData.name,
          description: sourceData.description,
          url: sourceData.url,
        });
        sources.push(source);
      }
    }

    return { ...topic, sources };
  }

  async getAllTopics(): Promise<TopicWithSources[]> {
    return this.db.findAllTopicsWithSources();
  }

  async getTopicById(id: number): Promise<TopicWithSources | null> {
    return this.db.findTopicWithSources(id);
  }

  async updateTopic(id: number, data: UpdateTopicDto): Promise<TopicWithSources | null> {
    await this.db.updateTopic(id, data);
    return this.db.findTopicWithSources(id);
  }

  async deleteTopic(id: number): Promise<void> {
    await this.db.deleteTopic(id);
  }

  // Source operations
  async addSource(topicId: number, data: CreateTopicSourceDto): Promise<TopicSource> {
    return this.db.createTopicSource({
      topicId,
      name: data.name,
      description: data.description,
      url: data.url,
    });
  }

  async updateSource(sourceId: number, data: UpdateTopicSourceDto): Promise<TopicSource | null> {
    await this.db.updateTopicSource(sourceId, data);
    return this.db.findTopicSourceById(sourceId);
  }

  async deleteSource(sourceId: number): Promise<void> {
    await this.db.deleteTopicSource(sourceId);
  }

  async getSourceById(sourceId: number): Promise<TopicSource | null> {
    return this.db.findTopicSourceById(sourceId);
  }
}
