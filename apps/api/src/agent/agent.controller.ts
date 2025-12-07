import { Controller, Inject, Post, Body, Res, UseGuards, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { CoreMessage } from 'ai';
import { AgentService } from './agent.service';
import { DatabaseService, TopicWithSources } from '../database/database.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface ChatRequestBody {
  messages?: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string }>;
    parts?: Array<{ type: string; text?: string }>;
  }>;
  prompt?: string;
  taskId?: number;  // 可选：传入任务ID以获取关联的主题
}

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    @Inject(AgentService) private readonly agentService: AgentService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  /**
   * Chat 端点 - 使用 Vercel AI SDK 流格式
   * 兼容前端 useChat hook
   */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(@Body() body: ChatRequestBody, @Res() res: Response) {
    const messages = this.extractMessages(body);
    if (messages.length === 0) {
      return res.status(400).json({ error: 'messages or prompt is required' });
    }

    try {
      // 如果提供了 taskId，获取任务关联的主题
      let topicsContext: TopicWithSources[] | undefined;
      if (body.taskId) {
        this.logger.log(`Chat request with taskId: ${body.taskId}`);
        topicsContext = await this.db.findTaskTopics(body.taskId);
        this.logger.log(`Loaded ${topicsContext.length} topics for task ${body.taskId}`);
      } else {
        this.logger.log('Chat request without taskId');
      }

      const result = this.agentService.streamChat(messages, { topicsContext });

      // 使用 pipeUIMessageStreamToResponse 的第二个参数传入自定义 headers
      // https://ai-sdk.dev/docs/reference/ai-sdk-ui/pipe-ui-message-stream-to-response
      result.pipeUIMessageStreamToResponse(res, {
        headers: {
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no', // 禁用 Nginx/代理缓冲
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Chat error:', message);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    }
  }

  /**
   * 同步执行 - 用于定时任务或简单调用
   */
  @Post('run')
  @UseGuards(JwtAuthGuard)
  async run(@Body('task') task: string) {
    if (!task) {
      return { error: 'task is required' };
    }

    const result = await this.agentService.runAgent(task);
    return {
      status: 'completed',
      result,
    };
  }

  /**
   * 从请求体提取消息数组
   */
  private extractMessages(body: ChatRequestBody): CoreMessage[] {
    // 处理直接的 prompt
    if (typeof body.prompt === 'string' && body.prompt.trim()) {
      return [{ role: 'user', content: body.prompt.trim() }];
    }

    // 处理 messages 数组 (来自 useChat)
    if (!Array.isArray(body.messages)) {
      return [];
    }

    return body.messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg): CoreMessage => {
        // 从各种格式提取文本内容
        let content: string;

        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .filter((part) => part.type === 'text' && part.text)
            .map((part) => part.text!)
            .join('\n');
        } else if (Array.isArray(msg.parts)) {
          content = msg.parts
            .filter((part) => part.type === 'text' && part.text)
            .map((part) => part.text!)
            .join('\n');
        } else {
          content = '';
        }

        return {
          role: msg.role as 'user' | 'assistant',
          content,
        };
      });
  }
}
