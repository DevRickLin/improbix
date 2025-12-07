import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DatabaseService,
  AIReport,
  AICollectedLink,
} from '../database/database.service';

export interface CreateReportDto {
  executionId?: string;
  taskId?: number;
  title?: string;
  content: string;
  summary?: string;
}

export interface CreateCollectedLinkDto {
  reportId?: string;
  executionId?: string;
  url: string;
  title?: string;
  description?: string;
  source?: string;
}

export interface ReportWithLinks extends AIReport {
  links: AICollectedLink[];
}

export interface FindReportsOptions {
  search?: string;
  taskId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface FindLinksOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async createReport(data: CreateReportDto): Promise<AIReport> {
    const id = randomUUID();
    return this.db.createReport({
      id,
      executionId: data.executionId,
      taskId: data.taskId,
      title: data.title,
      content: data.content,
      summary: data.summary,
    });
  }

  async getReportById(id: string): Promise<ReportWithLinks | null> {
    const report = await this.db.findReportById(id);
    if (!report) return null;

    const links = await this.db.findLinksByReportId(id);
    return { ...report, links };
  }

  async getReports(options: FindReportsOptions): Promise<{ data: AIReport[]; total: number }> {
    return this.db.findReports({
      search: options.search,
      taskId: options.taskId,
      startDate: options.startDate ? new Date(options.startDate) : undefined,
      endDate: options.endDate ? new Date(options.endDate) : undefined,
      limit: options.limit,
      offset: options.offset,
    });
  }

  async deleteReport(id: string): Promise<void> {
    await this.db.deleteReport(id);
  }

  // Link operations
  async createLink(data: CreateCollectedLinkDto): Promise<AICollectedLink> {
    return this.db.createCollectedLink({
      reportId: data.reportId,
      executionId: data.executionId,
      url: data.url,
      title: data.title,
      description: data.description,
      source: data.source,
    });
  }

  async getLinks(options: FindLinksOptions): Promise<{ data: AICollectedLink[]; total: number }> {
    return this.db.findCollectedLinks({
      search: options.search,
      limit: options.limit,
      offset: options.offset,
    });
  }

  async getLinksByReportId(reportId: string): Promise<AICollectedLink[]> {
    return this.db.findLinksByReportId(reportId);
  }

  // Cleanup operations
  async cleanupOldData(days: number = 90): Promise<{ reportsDeleted: number; linksDeleted: number }> {
    const linksDeleted = await this.db.deleteOldCollectedLinks(days);
    const reportsDeleted = await this.db.deleteOldReports(days);
    return { reportsDeleted, linksDeleted };
  }
}
