import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SimilarWebTrafficData {
  globalRank?: number;
  totalVisits?: number;
  bounceRate?: number;
  pagesPerVisit?: number;
  avgVisitDuration?: number;
  trafficSources?: Record<string, number>;
  topCountries?: Array<{ country: string; share: number }>;
}

@Injectable()
export class SimilarWebService {
  private readonly logger = new Logger(SimilarWebService.name);
  private readonly apiKey: string | null;
  private readonly baseUrl = 'https://api.similarweb.com/v1';

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SIMILARWEB_API_KEY') || null;
    if (!this.apiKey) {
      this.logger.warn('SIMILARWEB_API_KEY not configured');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async request(path: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('SimilarWeb API key not configured. Set SIMILARWEB_API_KEY in environment.');
    }

    const url = `${this.baseUrl}${path}${path.includes('?') ? '&' : '?'}api_key=${this.apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SimilarWeb API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  async getWebsiteTraffic(domain: string, options?: { country?: string; granularity?: string }): Promise<any> {
    const country = options?.country || 'world';
    const granularity = options?.granularity || 'monthly';
    const now = new Date();
    const startDate = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.request(
      `/website/${domain}/total-traffic-and-engagement/visits?country=${country}&granularity=${granularity}&main_domain_only=false&start_date=${startDate}&end_date=${endDate}`,
    );
  }

  async getTrafficSources(domain: string, options?: { country?: string }): Promise<any> {
    const country = options?.country || 'world';
    const now = new Date();
    const startDate = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.request(
      `/website/${domain}/traffic-sources/overview-share?country=${country}&granularity=monthly&main_domain_only=false&start_date=${startDate}&end_date=${endDate}`,
    );
  }

  async getTopKeywords(domain: string, options?: { country?: string }): Promise<any> {
    const country = options?.country || 'world';
    const now = new Date();
    const startDate = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.request(
      `/website/${domain}/search-keywords/paid-search-overview?country=${country}&main_domain_only=false&start_date=${startDate}&end_date=${endDate}`,
    );
  }

  async getCompetitors(domain: string): Promise<any> {
    return this.request(`/website/${domain}/similar-sites/similarsites`);
  }
}
