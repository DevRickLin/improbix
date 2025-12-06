import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FirecrawlApp from '@mendable/firecrawl-js';
import Bottleneck from 'bottleneck';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private firecrawl: FirecrawlApp | null = null;
  private limiter: Bottleneck;

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    const apiKey = this.configService.get<string>('FIRECRAWL_API_KEY');
    if (apiKey) {
      this.firecrawl = new FirecrawlApp({ apiKey });
    } else {
      this.logger.warn('FIRECRAWL_API_KEY not found.');
    }

    // 配置限流器：5 请求/分钟
    this.limiter = new Bottleneck({
      reservoir: 5, // 初始令牌数
      reservoirRefreshAmount: 5, // 刷新时补充的令牌数
      reservoirRefreshInterval: 60000, // 每60秒刷新一次
      maxConcurrent: 1, // 同时只执行1个请求
      minTime: 12000, // 请求间隔至少12秒
    });
  }

  onModuleInit() {
    // 监听限流器事件
    this.limiter.on('failed', async (error, jobInfo) => {
      const { retryCount } = jobInfo;
      if (retryCount < 3 && this.isRateLimitError(error)) {
        const waitTime =
          this.parseRetryAfter(error) || (retryCount + 1) * 15000;
        this.logger.warn(
          `Rate limited, retrying in ${waitTime}ms (attempt ${retryCount + 1})`,
        );
        return waitTime; // 返回重试等待时间
      }
      return; // 不重试
    });

    this.limiter.on('retry', (error, jobInfo) => {
      this.logger.log(`Retrying job (attempt ${jobInfo.retryCount + 1})`);
    });
  }

  private isRateLimitError(error: any): boolean {
    return (
      error?.message?.includes('429') ||
      error?.message?.includes('Rate limit')
    );
  }

  private parseRetryAfter(error: any): number | null {
    const match = error?.message?.match(/retry after (\d+)s/i);
    return match ? parseInt(match[1], 10) * 1000 : null;
  }

  async search(query: string) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl API not initialized');
    }

    return this.limiter.schedule(() => this.firecrawl!.search(query));
  }

  async scrapeUrl(url: string) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl API not initialized');
    }

    return this.limiter.schedule(() =>
      this.firecrawl!.scrapeUrl(url, { formats: ['markdown', 'html'] }),
    );
  }

  async crawlUrl(url: string, options?: { limit?: number }) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl API not initialized');
    }

    return this.limiter.schedule(() =>
      this.firecrawl!.crawlUrl(url, { limit: options?.limit || 10 }),
    );
  }
}
