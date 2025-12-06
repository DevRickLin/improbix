import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { query, tool, createSdkMcpServer, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { Subject, Observable } from 'rxjs';
import { SearchService } from '../search/search.service';
import { FeishuService } from '../feishu/feishu.service';

interface MessageEvent {
  data: string;
}

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private customServer!: ReturnType<typeof createSdkMcpServer>;
  private streams = new Map<string, Subject<MessageEvent>>();

  constructor(
    private configService: ConfigService,
    private searchService: SearchService,
    private feishuService: FeishuService,
  ) {}

  onModuleInit() {
    // 创建包含自定义工具的 MCP server
    this.customServer = createSdkMcpServer({
      name: 'improbix-tools',
      version: '1.0.0',
      tools: [
        tool(
          'search_internet',
          'Search the internet for latest news and information. Use this to find information on Hacker News, Reddit, or other sources.',
          { query: z.string().describe('The search query') },
          async (args) => {
            this.logger.log(`Executing search for: ${args.query}`);
            try {
              const result = await this.searchService.search(args.query);
              return {
                content: [{
                  type: 'text' as const,
                  text: typeof result === 'string' ? result : JSON.stringify(result),
                }],
              };
            } catch (e: any) {
              return {
                content: [{ type: 'text' as const, text: `Error searching: ${e.message}` }],
              };
            }
          }
        ),
        tool(
          'send_feishu_message',
          'Send a message or summary to Feishu (Lark).',
          { message: z.string().describe('The message content to send') },
          async (args) => {
            this.logger.log('Sending Feishu message...');
            try {
              await this.feishuService.sendText(args.message);
              return {
                content: [{ type: 'text' as const, text: 'Message sent successfully.' }],
              };
            } catch (e: any) {
              return {
                content: [{ type: 'text' as const, text: `Error sending message: ${e.message}` }],
              };
            }
          }
        ),
      ],
    });
  }

  /**
   * 获取执行事件流（用于 SSE）
   */
  getEventStream(executionId: string): Observable<MessageEvent> {
    const subject = this.streams.get(executionId);
    if (!subject) {
      // 如果流不存在，返回一个立即完成的 Observable
      return new Observable((subscriber) => {
        subscriber.next({ data: JSON.stringify({ type: 'error', message: 'Execution not found' }) });
        subscriber.complete();
      });
    }
    return subject.asObservable();
  }

  /**
   * 流式执行 Agent（用于 SSE 推送）
   */
  async runAgentStream(executionId: string, userPrompt: string): Promise<void> {
    this.logger.log(`[${executionId}] Starting agent stream with prompt: ${userPrompt}`);

    // 创建 Subject 用于推送事件
    const subject = new Subject<MessageEvent>();
    this.streams.set(executionId, subject);

    // 发送开始事件
    subject.next({ data: JSON.stringify({ type: 'started', executionId, prompt: userPrompt }) });

    async function* generateMessages(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: 'user',
        message: {
          role: 'user',
          content: userPrompt,
        },
      } as SDKUserMessage;
    }

    try {
      for await (const message of query({
        prompt: generateMessages(),
        options: {
          mcpServers: { 'improbix-tools': this.customServer },
          allowedTools: [
            'mcp__improbix-tools__search_internet',
            'mcp__improbix-tools__send_feishu_message',
          ],
          maxTurns: 10,
          model: 'claude-sonnet-4-20250514',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      })) {
        // 推送消息到客户端
        subject.next({ data: JSON.stringify(message) });
        this.logger.log(`[${executionId}] ${message.type}`);

        // 如果是结果消息，完成流
        if (message.type === 'result') {
          this.logger.log(`[${executionId}] Agent completed`);
          subject.complete();
          break;
        }
      }
    } catch (error: any) {
      this.logger.error(`[${executionId}] Agent error: ${error.message}`);
      subject.next({ data: JSON.stringify({ type: 'error', message: error.message }) });
      subject.complete();
    } finally {
      // 清理
      setTimeout(() => {
        this.streams.delete(executionId);
      }, 5000);
    }
  }

  /**
   * 同步执行 Agent（用于定时任务等场景）
   */
  async runAgent(userPrompt: string): Promise<string> {
    this.logger.log(`Starting agent with prompt: ${userPrompt}`);

    async function* generateMessages(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: 'user',
        message: {
          role: 'user',
          content: userPrompt,
        },
      } as SDKUserMessage;
    }

    for await (const message of query({
      prompt: generateMessages(),
      options: {
        mcpServers: { 'improbix-tools': this.customServer },
        allowedTools: [
          'mcp__improbix-tools__search_internet',
          'mcp__improbix-tools__send_feishu_message',
        ],
        maxTurns: 10,
        model: 'claude-sonnet-4-20250514',
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      },
    })) {
      this.logger.log(`[${message.type}] ${JSON.stringify(message, null, 2)}`);

      if (message.type === 'assistant') {
        const assistantMsg = message as any;
        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            if (block.type === 'text') {
              this.logger.log(`[Assistant Text] ${block.text}`);
            } else if (block.type === 'tool_use') {
              this.logger.log(`[Tool Call] ${block.name}: ${JSON.stringify(block.input)}`);
            }
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          this.logger.log(`[Result Success] ${message.result}`);
          return message.result;
        } else {
          this.logger.warn(`[Result Error] subtype: ${message.subtype}`);
          if ('errors' in message) {
            this.logger.error(`[Errors] ${JSON.stringify((message as any).errors)}`);
            return `Error: ${(message as any).errors.join(', ')}`;
          }
          return 'Agent execution failed';
        }
      }
    }

    return 'Agent execution completed without result';
  }
}
