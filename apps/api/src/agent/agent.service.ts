import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { query, tool, createSdkMcpServer, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { SearchService } from '../search/search.service';
import { FeishuService } from '../feishu/feishu.service';

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private customServer!: ReturnType<typeof createSdkMcpServer>;

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

  async runAgent(userPrompt: string): Promise<string> {
    this.logger.log(`Starting agent with prompt: ${userPrompt}`);

    // Streaming input 模式需要使用 async generator
    async function* generateMessages(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: 'user',
        message: {
          role: 'user',
          content: userPrompt,
        },
      } as SDKUserMessage;
    }

    // 使用 query() 函数，SDK 内部处理 agentic loop
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
      // 处理不同类型的消息
      if (message.type === 'assistant') {
        this.logger.debug('Received assistant message');
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          this.logger.log('Agent finished task successfully.');
          return message.result;
        } else {
          this.logger.warn(`Agent finished with error: ${message.subtype}`);
          if ('errors' in message) {
            return `Error: ${(message as any).errors.join(', ')}`;
          }
          return 'Agent execution failed';
        }
      }
    }

    return 'Agent execution completed without result';
  }
}
