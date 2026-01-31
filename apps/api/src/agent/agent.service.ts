import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createGateway,
  streamText,
  generateText,
  pruneMessages,
  stepCountIs,
  type CoreMessage,
} from 'ai';
import { ProxyAgent } from 'undici';
import { SearchService } from '../search/search.service';
import { FeishuService } from '../feishu/feishu.service';
import { EmailService } from '../email/email.service';
import { ReportsService } from '../reports/reports.service';
import { DatabaseService, TopicWithSources } from '../database/database.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { createAgentTools, type AgentTools } from './tools';
import { AgentPromptBuilder } from './prompts';

type GatewayProvider = ReturnType<typeof createGateway>;

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514';
const DEFAULT_SUMMARY_MODEL = 'anthropic/claude-haiku-3';
const DEFAULT_COMPRESS_THRESHOLD = 20;
const DEFAULT_TOKEN_LIMIT = 150000;
const RECENT_MESSAGES_TO_KEEP = 10;

const SUMMARY_PROMPT = `Summarize the following conversation concisely. Preserve key facts, decisions, and action items. Omit greetings, filler, and redundant details. Output only the summary in the same language as the conversation.`;


export interface RunAgentOptions {
  topicsContext?: TopicWithSources[];
  executionId?: string;
  taskId?: number;
  onFinish?: (event: { response: any }) => void | Promise<void>;
}

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private gateway: GatewayProvider | null = null;
  private modelId: string = DEFAULT_MODEL;
  private summaryModelId: string = DEFAULT_SUMMARY_MODEL;
  private compressThreshold: number = DEFAULT_COMPRESS_THRESHOLD;
  private tokenLimit: number = DEFAULT_TOKEN_LIMIT;
  private promptBuilder = new AgentPromptBuilder();

  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(SearchService) private searchService: SearchService,
    @Inject(FeishuService) private feishuService: FeishuService,
    @Inject(ReportsService) private reportsService: ReportsService,
    @Inject(EmailService) private emailService: EmailService,
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject(SandboxService) private sandboxService: SandboxService,
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
    this.summaryModelId = this.configService.get<string>('AI_SUMMARY_MODEL') || DEFAULT_SUMMARY_MODEL;
    this.compressThreshold = parseInt(this.configService.get<string>('CONTEXT_COMPRESS_THRESHOLD') || '', 10) || DEFAULT_COMPRESS_THRESHOLD;
    this.tokenLimit = parseInt(this.configService.get<string>('CONTEXT_TOKEN_LIMIT') || '', 10) || DEFAULT_TOKEN_LIMIT;

    this.logger.log(`Agent initialized with model: ${this.modelId}, summary model: ${this.summaryModelId}, token limit: ${this.tokenLimit}`);
  }

  /**
   * 创建带有上下文的工具集
   */
  private getTools(context: { executionId?: string; taskId?: number } = {}) {
    return createAgentTools(
      this.searchService,
      this.feishuService,
      this.reportsService,
      this.emailService,
      this.db,
      this.sandboxService,
      context,
    );
  }

  /**
   * 混合上下文压缩：先裁剪 tool calls/reasoning，超阈值后用轻量模型生成摘要
   */
  private async compressMessages(messages: CoreMessage[]): Promise<CoreMessage[]> {
    // Phase 1: prune tool calls and reasoning
    const pruned = pruneMessages({
      messages,
      reasoning: 'before-last-message',
      toolCalls: 'before-last-2-messages',
      emptyMessages: 'remove',
    });

    // Phase 2: if still over threshold, summarize old messages
    if (pruned.length <= this.compressThreshold) {
      return pruned;
    }

    const oldMessages = pruned.slice(0, -RECENT_MESSAGES_TO_KEEP);
    const recentMessages = pruned.slice(-RECENT_MESSAGES_TO_KEEP);

    try {
      const { text: summary } = await generateText({
        model: this.gateway!(this.summaryModelId),
        messages: [
          {
            role: 'user',
            content: `${SUMMARY_PROMPT}\n\n${oldMessages.map((m) => `[${m.role}]: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n')}`,
          },
        ],
      });

      this.logger.log(`Compressed ${oldMessages.length} messages into summary (${summary.length} chars)`);

      return [
        { role: 'user', content: `[Previous conversation summary]\n${summary}` },
        { role: 'assistant', content: 'Understood, I have the context from our previous conversation.' },
        ...recentMessages,
      ];
    } catch (error) {
      this.logger.warn(`Context compression failed, falling back to truncation: ${error}`);
      return recentMessages;
    }
  }

  /**
   * 构建统一的 Agent 配置
   */
  private async buildAgentConfig(messages: CoreMessage[], options?: RunAgentOptions) {
    if (!this.gateway) {
      throw new Error('Agent not initialized');
    }

    const systemPrompt = this.promptBuilder.build(options?.topicsContext);
    const tools = this.getTools({
      executionId: options?.executionId,
      taskId: options?.taskId,
    });

    const compressedMessages = await this.compressMessages(messages);
    this.logger.log(`Agent config: ${messages.length} -> ${compressedMessages.length} messages, ${options?.topicsContext?.length || 0} topics`);

    return {
      model: this.gateway(this.modelId),
      system: systemPrompt,
      messages: compressedMessages,
      tools,
      stopWhen: stepCountIs(100),
      prepareStep: async ({ steps, messages: stepMessages }: { steps: Array<{ usage?: { inputTokens?: number } }>; messages: CoreMessage[] }) => {
        const lastInputTokens = steps.at(-1)?.usage?.inputTokens ?? 0;
        if (lastInputTokens > this.tokenLimit || stepMessages.length > this.compressThreshold) {
          this.logger.log(`Compressing in prepareStep: inputTokens=${lastInputTokens}, messages=${stepMessages.length}`);
          return { messages: await this.compressMessages(stepMessages) };
        }
        return {};
      },
      onStepFinish: (event: { finishReason: string; usage?: Record<string, unknown>; toolCalls?: Array<{ toolName: string; input: unknown }>; toolResults?: Array<{ toolName: string; output: unknown }> }) => {
        this.logger.log(`Step finished: ${event.finishReason}, usage: ${JSON.stringify(event.usage)}`);
        if (event.toolCalls && event.toolCalls.length > 0) {
          for (const tc of event.toolCalls) {
            this.logger.log(`[Tool:${tc.toolName}] Called with: ${JSON.stringify(tc.input)}`);
          }
        }
        if (event.toolResults && event.toolResults.length > 0) {
          for (const tr of event.toolResults) {
            const resultStr = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
            this.logger.log(`[Tool:${tr.toolName}] Result: ${resultStr.substring(0, 200)}`);
          }
        }
      },
    };
  }

  /**
   * 流式执行 Agent
   */
  async streamChat(messages: CoreMessage[], options?: RunAgentOptions) {
    const config = await this.buildAgentConfig(messages, options);
    if (options?.onFinish) {
      (config as any).onFinish = options.onFinish;
    }
    return streamText(config);
  }

  /**
   * 同步执行 Agent（用于定时任务等场景）
   */
  async runAgent(userPrompt: string, options?: RunAgentOptions): Promise<string> {
    const config = await this.buildAgentConfig(
      [{ role: 'user', content: userPrompt }],
      options,
    );
    const result = await generateText(config);
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