import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { REDIS_CLIENT } from '../redis/redis.module';

const JOB_QUEUE_KEY = 'jobs:agent';
const STREAM_KEY_PREFIX = 'stream:';
const STREAM_TTL_SECONDS = 1800; // 30 minutes (long enough for agent runs)
const STREAM_DONE_MARKER = '__DONE__';
const STREAM_ERROR_PREFIX = '__ERROR__:';

export interface AgentJob {
  type: 'chat' | 'task' | 'email';
  streamId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  get isAvailable(): boolean {
    return this.redis !== null;
  }

  async enqueueJob(job: AgentJob): Promise<void> {
    if (!this.redis) throw new Error('Redis not configured');
    await this.redis.rpush(JOB_QUEUE_KEY, JSON.stringify(job));
    this.logger.log(`Enqueued job: type=${job.type} streamId=${job.streamId}`);
  }

  async pollJob(): Promise<AgentJob | null> {
    if (!this.redis) return null;
    const raw = await this.redis.lpop<string>(JOB_QUEUE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AgentJob;
  }

  async pushStreamChunk(streamId: string, chunk: string): Promise<void> {
    if (!this.redis) return;
    const key = `${STREAM_KEY_PREFIX}${streamId}`;
    await this.redis.rpush(key, chunk);
    await this.redis.expire(key, STREAM_TTL_SECONDS);
  }

  async getStreamChunks(streamId: string, offset: number): Promise<string[]> {
    if (!this.redis) return [];
    const key = `${STREAM_KEY_PREFIX}${streamId}`;
    return (await this.redis.lrange(key, offset, -1)) as string[];
  }

  async markStreamDone(streamId: string): Promise<void> {
    if (!this.redis) return;
    const key = `${STREAM_KEY_PREFIX}${streamId}`;
    await this.redis.rpush(key, STREAM_DONE_MARKER);
    await this.redis.expire(key, STREAM_TTL_SECONDS);
  }

  async markStreamError(streamId: string, error: string): Promise<void> {
    if (!this.redis) return;
    const key = `${STREAM_KEY_PREFIX}${streamId}`;
    await this.redis.rpush(key, `${STREAM_ERROR_PREFIX}${error}`);
    await this.redis.expire(key, STREAM_TTL_SECONDS);
  }

  isDoneMarker(chunk: string): boolean {
    return chunk === STREAM_DONE_MARKER;
  }

  isErrorMarker(chunk: string): boolean {
    return chunk.startsWith(STREAM_ERROR_PREFIX);
  }

  getErrorMessage(chunk: string): string {
    return chunk.slice(STREAM_ERROR_PREFIX.length);
  }

  async cleanupStream(streamId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(`${STREAM_KEY_PREFIX}${streamId}`);
  }
}
