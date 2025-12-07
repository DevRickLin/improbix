import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createGateway,
  streamText,
  generateText,
  stepCountIs,
  type CoreMessage,
} from 'ai';
import { ProxyAgent } from 'undici';
import { SearchService } from '../search/search.service';
import { FeishuService } from '../feishu/feishu.service';
import { createAgentTools, type AgentTools } from './tools';

type GatewayProvider = ReturnType<typeof createGateway>;

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514';

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private gateway: GatewayProvider | null = null;
  private modelId: string = DEFAULT_MODEL;
  private tools: AgentTools | null = null;

  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(SearchService) private searchService: SearchService,
    @Inject(FeishuService) private feishuService: FeishuService,
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('AI_GATEWAY_API_KEY');
    if (!apiKey) {
      throw new Error('AI_GATEWAY_API_KEY is required');
    }

    const proxyUrl = this.getProxyUrl();
    this.gateway = createGateway({
      apiKey,
      ...(proxyUrl ? { fetch: this.createProxyFetch(proxyUrl) } : {}),
    });

    this.modelId = this.configService.get<string>('AI_MODEL') || DEFAULT_MODEL;
    this.tools = createAgentTools(this.searchService, this.feishuService);

    this.logger.log(`Agent initialized with model: ${this.modelId}`);
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
   */
  streamChat(messages: CoreMessage[]) {
    if (!this.gateway || !this.tools) {
      throw new Error('Agent not initialized');
    }

    const currentTime = this.getBeijingTime();
    const systemPrompt = `You are a helpful AI assistant. Current time (Beijing): ${currentTime}`;

    this.logger.log(`Starting agent stream with ${messages.length} messages...`);

    return streamText({
      model: this.gateway(this.modelId),
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
    if (!this.gateway || !this.tools) {
      throw new Error('Agent not initialized');
    }

    const currentTime = this.getBeijingTime();
    this.logger.log(
      `Starting agent with prompt: ${userPrompt.substring(0, 100)}...`,
    );

    const result = await generateText({
      model: this.gateway(this.modelId),
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
    this.logger.log(`Using proxy for AI traffic: ${proxyUrl}`);

    return (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        // @ts-expect-error - dispatcher is Node.js specific
        dispatcher: proxyAgent,
      });
    };
  }
}
