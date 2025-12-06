import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FirecrawlApp from 'firecrawl';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private firecrawlApp: FirecrawlApp | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('FIRECRAWL_API_KEY');
    if (apiKey) {
      this.firecrawlApp = new FirecrawlApp({ apiKey });
    } else {
        this.logger.warn('FIRECRAWL_API_KEY not found.');
    }
  }

  async search(query: string) {
    if (!this.firecrawlApp) {
        throw new Error('Firecrawl API not initialized');
    }
    
    try {
        // Assuming search method exists as per requirements to "search internet"
        const searchResult = await this.firecrawlApp.search(query, {
            // scrapeOptions: { formats: ['markdown'] } // Uncomment if supported
        });
        return searchResult;
    } catch (e: any) {
        this.logger.error(`Firecrawl search failed: ${e.message}`);
        throw e;
    }
  }
}
