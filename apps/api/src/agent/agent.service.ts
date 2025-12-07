import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, generateText, stepCountIs, type CoreMessage } from 'ai';
import { ProxyAgent } from 'undici';
import { SearchService } from '../search/search.service';
import { FeishuService } from '../feishu/feishu.service';
import { createAgentTools, type AgentTools } from './tools';

/** Anthropic provider 类型 */
type AnthropicProvider = ReturnType<typeof createAnthropic>;

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private anthropic: AnthropicProvider | null = null;
  private tools: AgentTools | null = null;

  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(SearchService) private searchService: SearchService,
    @Inject(FeishuService) private feishuService: FeishuService,
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not found, agent will not be initialized',
      );
      return;
    }

    // 创建 Anthropic provider，支持代理配置
    const proxyUrl = this.getProxyUrl();
    this.anthropic = createAnthropic({
      apiKey,
      ...(proxyUrl ? { fetch: this.createProxyFetch(proxyUrl) } : {}),
    });

    // 创建工具集
    this.tools = createAgentTools(this.searchService, this.feishuService);

    this.logger.log('Agent initialized with Vercel AI SDK');
  }

  private getBeijingTime(): string {
    return new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  /**
   * 流式执行 Agent
   * 返回 streamText 结果，可直接用于 pipeUIMessageStreamToResponse
   */
  streamChat(messages: CoreMessage[]) {
    if (!this.anthropic || !this.tools) {
      throw new Error('Agent not initialized');
    }

    const currentTime = this.getBeijingTime();
    const systemPrompt = `You are a helpful AI assistant. Current time (Beijing): ${currentTime}`;

    this.logger.log(
      `Starting agent stream with ${messages.length} messages...`,
    );

    return streamText({
      model: this.anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages,
      tools: this.tools,
      stopWhen: stepCountIs(10),
      onStepFinish: (event) => {
        this.logger.log(`Step finished: ${event.finishReason}`);
        if (event.toolCalls && event.toolCalls.length > 0) {
          for (const tc of event.toolCalls) {
            this.logger.log(
              `[Tool:${tc.toolName}] Called with: ${JSON.stringify(tc.input)}`,
            );
          }
        }
        if (event.toolResults && event.toolResults.length > 0) {
          for (const tr of event.toolResults) {
            const resultStr =
              typeof tr.output === 'string'
                ? tr.output
                : JSON.stringify(tr.output);
            this.logger.log(
              `[Tool:${tr.toolName}] Result: ${resultStr.substring(0, 200)}`,
            );
          }
        }
      },
    });
  }

  /**
   * 同步执行 Agent（用于定时任务等场景）
   */
  async runAgent(userPrompt: string): Promise<string> {
    if (!this.anthropic || !this.tools) {
      throw new Error('Agent not initialized');
    }

    const currentTime = this.getBeijingTime();
    this.logger.log(
      `Starting agent with prompt: ${userPrompt.substring(0, 100)}...`,
    );

    const result = await generateText({
      model: this.anthropic('claude-sonnet-4-20250514'),
      system: `You are a helpful AI assistant. Current time (Beijing): ${currentTime}`,
      messages: [{ role: 'user', content: userPrompt }],
      tools: this.tools,
      stopWhen: stepCountIs(10),
    });

    this.logger.log(`Agent completed: ${result.text.substring(0, 200)}...`);
    return result.text;
  }

  private getProxyUrl(): string | null {
    return (
      this.configService.get<string>('OPENAI_PROXY_URL') ||
      process.env.OPENAI_PROXY_URL ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.ALL_PROXY ||
      null
    );
  }

  private createProxyFetch(proxyUrl: string): typeof fetch {
    const proxyAgent = new ProxyAgent(proxyUrl);
    this.logger.log(`Using proxy for Anthropic traffic: ${proxyUrl}`);

    return (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        // @ts-expect-error - dispatcher is Node.js specific
        dispatcher: proxyAgent,
      });
    };
  }
}
