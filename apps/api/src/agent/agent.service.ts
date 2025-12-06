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

  private getBeijingTime(): string {
    return new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

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
            const startTime = Date.now();
            this.logger.log(`[Tool:search_internet] >>> INPUT: ${JSON.stringify(args)}`);
            try {
              const result = await this.searchService.search(args.query);
              const duration = Date.now() - startTime;
              const resultText = typeof result === 'string' ? result : JSON.stringify(result);
              const resultPreview = resultText.length > 500 ? resultText.substring(0, 500) + '...' : resultText;
              this.logger.log(`[Tool:search_internet] <<< OUTPUT (${duration}ms): ${resultPreview}`);
              return {
                content: [{
                  type: 'text' as const,
                  text: resultText,
                }],
              };
            } catch (e: any) {
              const duration = Date.now() - startTime;
              this.logger.error(`[Tool:search_internet] <<< ERROR (${duration}ms): ${e.message}`);
              return {
                content: [{ type: 'text' as const, text: `Error searching: ${e.message}` }],
              };
            }
          }
        ),
        tool(
          'send_feishu_message',
          'Send a plain text message to Feishu (Lark). For rich formatted content with titles and buttons, use send_feishu_card instead.',
          { message: z.string().describe('The message content to send') },
          async (args) => {
            const startTime = Date.now();
            const messagePreview = args.message.length > 200 ? args.message.substring(0, 200) + '...' : args.message;
            this.logger.log(`[Tool:send_feishu_message] >>> INPUT: ${JSON.stringify({ message: messagePreview })}`);
            try {
              await this.feishuService.sendText(args.message);
              const duration = Date.now() - startTime;
              this.logger.log(`[Tool:send_feishu_message] <<< OUTPUT (${duration}ms): Message sent successfully`);
              return {
                content: [{ type: 'text' as const, text: 'Message sent successfully.' }],
              };
            } catch (e: any) {
              const duration = Date.now() - startTime;
              this.logger.error(`[Tool:send_feishu_message] <<< ERROR (${duration}ms): ${e.message}`);
              return {
                content: [{ type: 'text' as const, text: `Error sending message: ${e.message}` }],
              };
            }
          }
        ),
        tool(
          'send_feishu_card',
          'Send a rich interactive card to Feishu (Lark). Cards support Markdown formatting, colored headers, and action buttons. Use this for well-formatted summaries, reports, or notifications.',
          {
            title: z.string().describe('Card header title'),
            content: z.string().describe('Card body content in Markdown format. Supports: **bold**, *italic*, [links](url), bullet lists (- item), numbered lists (1. item), and more.'),
            color: z.enum(['blue', 'wathet', 'turquoise', 'green', 'yellow', 'orange', 'red', 'carmine', 'violet', 'purple', 'indigo', 'grey'])
              .optional()
              .describe('Header background color theme. Default is blue.'),
            buttons: z.array(z.object({
              text: z.string().describe('Button label text'),
              url: z.string().describe('URL to open when button is clicked'),
              type: z.enum(['default', 'primary', 'danger']).optional().describe('Button style. Default is "default".'),
            })).optional().describe('Optional action buttons at the bottom of the card'),
          },
          async (args) => {
            const startTime = Date.now();
            this.logger.log(`[Tool:send_feishu_card] >>> INPUT: ${JSON.stringify({
              title: args.title,
              content: args.content.length > 100 ? args.content.substring(0, 100) + '...' : args.content,
              color: args.color,
              buttons: args.buttons,
            })}`);
            try {
              await this.feishuService.sendSimpleCard(args.title, args.content, {
                headerColor: args.color,
                buttons: args.buttons,
              });
              const duration = Date.now() - startTime;
              this.logger.log(`[Tool:send_feishu_card] <<< OUTPUT (${duration}ms): Card sent successfully`);
              return {
                content: [{ type: 'text' as const, text: 'Card sent successfully.' }],
              };
            } catch (e: any) {
              const duration = Date.now() - startTime;
              this.logger.error(`[Tool:send_feishu_card] <<< ERROR (${duration}ms): ${e.message}`);
              return {
                content: [{ type: 'text' as const, text: `Error sending card: ${e.message}` }],
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

    const currentTime = this.getBeijingTime();
    async function* generateMessages(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: 'user',
        message: {
          role: 'user',
          content: `[当前时间: ${currentTime}]\n\n${userPrompt}`,
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
            'mcp__improbix-tools__send_feishu_card',
          ],
          maxTurns: 10,
          model: 'claude-sonnet-4-20250514',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      })) {
        // 推送消息到客户端
        subject.next({ data: JSON.stringify(message) });

        // 详细的消息类型日志
        if (message.type === 'assistant') {
          const assistantMsg = message as any;
          if (assistantMsg.message?.content) {
            for (const block of assistantMsg.message.content) {
              if (block.type === 'text') {
                const textPreview = block.text.length > 200 ? block.text.substring(0, 200) + '...' : block.text;
                this.logger.log(`[${executionId}] [Assistant] Text: ${textPreview}`);
              } else if (block.type === 'tool_use') {
                this.logger.log(`[${executionId}] [Assistant] Tool Call: ${block.name}`);
                this.logger.log(`[${executionId}] [Assistant] Tool Input: ${JSON.stringify(block.input)}`);
              }
            }
          }
        } else if (message.type === 'tool_progress') {
          const toolProgressMsg = message as any;
          this.logger.log(`[${executionId}] [Tool Progress] ${JSON.stringify(toolProgressMsg)}`);
        } else if (message.type === 'result') {
          const resultMsg = message as any;
          if (resultMsg.subtype === 'success') {
            const resultPreview = resultMsg.result?.length > 300 ? resultMsg.result.substring(0, 300) + '...' : resultMsg.result;
            this.logger.log(`[${executionId}] [Result] Success: ${resultPreview}`);
          } else {
            this.logger.warn(`[${executionId}] [Result] ${resultMsg.subtype}: ${JSON.stringify(resultMsg.errors || [])}`);
          }
          subject.complete();
          break;
        } else {
          this.logger.log(`[${executionId}] [${message.type}]`);
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

    const currentTime = this.getBeijingTime();
    async function* generateMessages(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: 'user',
        message: {
          role: 'user',
          content: `[当前时间: ${currentTime}]\n\n${userPrompt}`,
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
