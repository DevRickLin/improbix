import { Controller, Get, Inject, Post, Body, Param, Res, UseGuards, Logger, Optional } from '@nestjs/common';
import type { Response } from 'express';
import { generateId } from 'ai';
import { Redis } from '@upstash/redis';
import { AgentService } from './agent.service';
import { DatabaseService, TopicWithSources } from '../database/database.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REDIS_CLIENT } from '../redis/redis.module';

const STREAM_TTL_SECONDS = 300; // 5 minutes
const STREAM_KEY_PREFIX = 'stream:';

interface UIMessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface ChatRequestBody {
  id?: string;
  message?: {
    id: string;
    role: string;
    parts: UIMessagePart[];
    attachments?: unknown[];
  };
  sessionId?: string;
  taskId?: number;
}

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    @Inject(AgentService) private readonly agentService: AgentService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(@Body() body: ChatRequestBody, @Res() res: Response) {
    const { message, sessionId, taskId } = body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message and sessionId are required' });
    }

    try {
      // Ensure chat exists
      const chat = await this.db.getChatById(sessionId);
      if (!chat) {
        const title = this.extractTitle(message.parts) || 'New Chat';
        await this.db.saveChat({ id: sessionId, title });
      }

      // Load history from DB
      const previousMessages = await this.db.getMessagesByChatId(sessionId);

      // Save user message
      if (message.role === 'user') {
        await this.db.saveMessages([{
          id: message.id,
          chatId: sessionId,
          role: 'user',
          parts: message.parts,
          attachments: message.attachments || [],
          createdAt: new Date().toISOString(),
        }]);
      }

      // Build model messages from history + new message
      const allUIMessages = [
        ...previousMessages.map((m) => ({
          id: m.id,
          role: m.role,
          parts: m.parts as UIMessagePart[],
        })),
        { id: message.id, role: message.role, parts: message.parts },
      ];

      // Convert UI messages to CoreMessage format
      const modelMessages = allUIMessages.map((m) => {
        const textParts = (m.parts || [])
          .filter((p: UIMessagePart) => p.type === 'text' && p.text)
          .map((p: UIMessagePart) => p.text!)
          .join('\n');
        return {
          role: m.role as 'user' | 'assistant',
          content: textParts || '',
        };
      });

      // Get topics context if taskId provided
      let topicsContext: TopicWithSources[] | undefined;
      if (taskId) {
        topicsContext = await this.db.findTaskTopics(taskId);
      }

      const chatId = sessionId;

      // Create a streamId and save it for resume support
      const streamId = generateId();
      await this.db.createStreamId(streamId, chatId);

      const result = await this.agentService.streamChat(modelMessages, {
        topicsContext,
        onFinish: async ({ response }) => {
          try {
            // Save assistant response messages
            const assistantMessages = (response.messages || [])
              .filter((msg: any) => msg.role === 'assistant')
              .map((msg: any) => {
                // Convert response message content to parts format
                const parts: UIMessagePart[] = [];
                if (typeof msg.content === 'string') {
                  parts.push({ type: 'text', text: msg.content });
                } else if (Array.isArray(msg.content)) {
                  for (const part of msg.content) {
                    if (part.type === 'text') {
                      parts.push({ type: 'text', text: part.text });
                    } else if (part.type === 'tool-call') {
                      parts.push({
                        type: 'tool-invocation',
                        toolName: part.toolName,
                        toolCallId: part.toolCallId,
                        args: part.args,
                        state: 'call',
                      });
                    }
                  }
                }
                return {
                  id: generateId(),
                  chatId,
                  role: 'assistant',
                  parts,
                  attachments: [],
                  createdAt: new Date().toISOString(),
                };
              });

            // Also handle tool result messages
            const toolMessages = (response.messages || [])
              .filter((msg: any) => msg.role === 'tool')
              .map((msg: any) => ({
                id: generateId(),
                chatId,
                role: 'tool',
                parts: Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: String(msg.content) }],
                attachments: [],
                createdAt: new Date().toISOString(),
              }));

            if (assistantMessages.length > 0 || toolMessages.length > 0) {
              await this.db.saveMessages([...assistantMessages, ...toolMessages]);
            }
          } catch (e) {
            this.logger.warn(`Failed to save assistant messages: ${e}`);
          }

          // Clean up stream from Redis after finish
          try {
            await this.db.deleteStreamId(streamId);
            if (this.redis) {
              await this.redis.del(`${STREAM_KEY_PREFIX}${streamId}`);
            }
          } catch (e) {
            this.logger.warn(`Failed to clean up stream: ${e}`);
          }
        },
      });

      result.consumeStream();

      // If Redis is available, tee the stream to buffer chunks for resume
      if (this.redis) {
        const originalResponse = result.toUIMessageStreamResponse({
          headers: {
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
          },
        });

        const body = originalResponse.body;
        if (body) {
          const [clientStream, cacheStream] = body.tee();

          // Buffer cache stream chunks to Redis in background
          this.bufferStreamToRedis(streamId, cacheStream).catch((e) => {
            this.logger.warn(`Failed to buffer stream to Redis: ${e}`);
          });

          // Send headers from original response
          res.status(originalResponse.status);
          originalResponse.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });

          // Pipe client stream to response
          const reader = clientStream.getReader();
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  res.end();
                  return;
                }
                res.write(value);
              }
            } catch (e) {
              this.logger.warn(`Stream pipe error: ${e}`);
              if (!res.headersSent) {
                res.status(500).end();
              } else {
                res.end();
              }
            }
          };
          await pump();
        } else {
          res.status(200).end();
        }
      } else {
        // No Redis — just pipe directly
        result.pipeUIMessageStreamToResponse(res, {
          headers: {
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Chat error:', message);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    }
  }

  @Get('chat/:chatId/stream')
  @UseGuards(JwtAuthGuard)
  async resumeStream(@Param('chatId') chatId: string, @Res() res: Response) {
    try {
      // Look up latest streamId for this chat
      const streamIds = await this.db.getStreamIdsByChatId(chatId);
      const latestStreamId = streamIds.at(-1);

      if (!latestStreamId || !this.redis) {
        // No active stream — return 204 so AI SDK gives up gracefully
        return res.status(204).end();
      }

      const redisKey = `${STREAM_KEY_PREFIX}${latestStreamId}`;
      const chunks = await this.redis.lrange(redisKey, 0, -1);

      if (!chunks || chunks.length === 0) {
        return res.status(204).end();
      }

      // Pipe buffered chunks as SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Connection', 'keep-alive');

      for (const chunk of chunks) {
        res.write(chunk);
      }
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Resume stream error: ${message}`);
      if (!res.headersSent) {
        res.status(204).end();
      }
    }
  }

  @Post('run')
  @UseGuards(JwtAuthGuard)
  async run(@Body('task') task: string) {
    if (!task) {
      return { error: 'task is required' };
    }
    const result = await this.agentService.runAgent(task);
    return { status: 'completed', result };
  }

  private async bufferStreamToRedis(streamId: string, stream: ReadableStream<Uint8Array>) {
    const redisKey = `${STREAM_KEY_PREFIX}${streamId}`;
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        await this.redis!.rpush(redisKey, text);
        await this.redis!.expire(redisKey, STREAM_TTL_SECONDS);
      }
    } catch (e) {
      this.logger.warn(`Redis buffering error: ${e}`);
    }
  }

  private extractTitle(parts: UIMessagePart[]): string | null {
    const text = parts
      ?.filter((p) => p.type === 'text' && p.text)
      .map((p) => p.text!)
      .join(' ');
    if (!text) return null;
    return text.substring(0, 50) + (text.length > 50 ? '...' : '');
  }
}
