import {
  Controller,
  Inject,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class SearchQueryDto {
  query!: string;
}

class ScrapeUrlDto {
  url!: string;
}

class CrawlUrlDto {
  url!: string;
  limit?: number;
}

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get('status')
  async getStatus() {
    const isConfigured = !!(process.env.FIRECRAWL_API_KEY);
    return {
      configured: isConfigured,
    };
  }

  @Get('query')
  async searchByQuery(@Query('q') query: string) {
    if (!query) {
      throw new HttpException('Query parameter "q" is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.searchService.search(query);
      return {
        success: true,
        query,
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('search')
  async search(@Body() dto: SearchQueryDto) {
    if (!dto.query) {
      throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.searchService.search(dto.query);
      return {
        success: true,
        query: dto.query,
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scrape')
  async scrapeUrl(@Body() dto: ScrapeUrlDto) {
    if (!dto.url) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.searchService.scrapeUrl(dto.url);
      return {
        success: true,
        url: dto.url,
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Scrape failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('crawl')
  async crawlUrl(@Body() dto: CrawlUrlDto) {
    if (!dto.url) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.searchService.crawlUrl(dto.url, {
        limit: dto.limit,
      });
      return {
        success: true,
        url: dto.url,
        limit: dto.limit || 10,
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Crawl failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
