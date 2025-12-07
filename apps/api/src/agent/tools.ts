import { tool } from 'ai';
import { z } from 'zod';
import type { SearchService } from '../search/search.service';
import type { FeishuService } from '../feishu/feishu.service';
import type { ReportsService } from '../reports/reports.service';

export interface AgentToolsContext {
  executionId?: string;
  taskId?: number;
}

/**
 * 创建 Agent 工具集
 * 使用 Vercel AI SDK 的 tool() 函数定义类型安全的工具
 */
export function createAgentTools(
  searchService: SearchService,
  feishuService: FeishuService,
  reportsService: ReportsService,
  context: AgentToolsContext = {},
) {
  const searchInternet = tool({
    description:
      'Search the internet for latest news and information. Use this to find information on Hacker News, Reddit, or other sources.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      const result = await searchService.search(query);
      return typeof result === 'string' ? result : JSON.stringify(result);
    },
  });

  const scrapeUrl = tool({
    description:
      'Scrape a single URL and extract its content as markdown. Use this to read articles, documentation, or any web page content.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to scrape'),
    }),
    execute: async ({ url }) => {
      const result = await searchService.scrapeUrl(url);
      if (!result.success) {
        return `Error scraping URL: ${result.error}`;
      }
      return result.markdown || JSON.stringify(result);
    },
  });

  const mapWebsite = tool({
    description:
      'Get a list of all URLs from a website. Use this to understand a site structure before deciding which pages to scrape or crawl.',
    inputSchema: z.object({
      url: z.string().url().describe('The website URL to map'),
      limit: z.number().optional().describe('Maximum number of URLs to return'),
    }),
    execute: async ({ url, limit }) => {
      const result = await searchService.mapUrl(url, { limit });
      if (!result.success) {
        return `Error mapping URL: ${result.error}`;
      }
      return result.links?.join('\n') || 'No links found';
    },
  });

  const extractData = tool({
    description:
      'Extract structured data from a web page using AI. Use this to extract specific information like product details, contact info, tables, or any structured content.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to extract data from'),
      prompt: z
        .string()
        .describe('Instructions for what data to extract (e.g., "Extract all product names and prices")'),
    }),
    execute: async ({ url, prompt }) => {
      const result = await searchService.extractData(url, { prompt });
      return JSON.stringify(result);
    },
  });

  const sendReport = tool({
    description:
      'Finalize your work by saving a report and optionally notifying the user. This tool MUST be called when you have completed your task or research. It saves the content to the database and can send it to external platforms like Feishu/Lark.',
    inputSchema: z.object({
      title: z.string().describe('The title of the report'),
      content: z
        .string()
        .describe(
          'The full body content of the report in Markdown format. Supports: **bold**, *italic*, [links](url), bullet lists, etc.',
        ),
      summary: z.string().optional().describe('A brief summary of the report content'),
      publishTo: z
        .array(z.enum(['feishu']))
        .optional()
        .describe('List of platforms to send the report to. E.g. ["feishu"] to send a card to Lark.'),
    }),
    execute: async ({ title, content, summary, publishTo }) => {
      let resultMsg = '';
      let reportId = '';

      // 1. Save to Database
      try {
        const report = await reportsService.createReport({
          executionId: context.executionId,
          taskId: context.taskId,
          title,
          content,
          summary,
        });
        reportId = report.id;
        resultMsg += `Report saved successfully (ID: ${reportId}). `;
      } catch (error: any) {
        resultMsg += `Failed to save report to DB: ${error.message}. `;
      }

      // 2. Publish to Feishu (if requested)
      if (publishTo?.includes('feishu')) {
        try {
          await feishuService.sendSimpleCard(title, content, {
            headerColor: 'blue',
            buttons: [
              // Future: Add link to web view if available
              // { text: 'View Details', url: `.../reports/${reportId}` }
            ],
          });
          resultMsg += 'Sent to Feishu successfully.';
        } catch (error: any) {
          resultMsg += `Failed to send to Feishu: ${error.message}`;
        }
      }

      return resultMsg;
    },
  });

  // ==================== History Tools ====================

  const saveCollectedLink = tool({
    description:
      'Save a useful link/URL that was discovered during research. Use this to record interesting articles, resources, or references found while gathering information.',
    inputSchema: z.object({
      url: z.string().describe('The URL of the collected resource'),
      title: z.string().optional().describe('Title of the linked content'),
      description: z.string().optional().describe('Brief description of what this link contains'),
      source: z
        .string()
        .optional()
        .describe('Where this link was found (e.g., "Hacker News", "Reddit", "Google Search")'),
    }),
    execute: async ({ url, title, description, source }) => {
      try {
        await reportsService.createLink({
          executionId: context.executionId, // Link to current execution if available
          // We can't easily link to reportId here as it might not be created yet,
          // but executionId links them together implicitly.
          url,
          title,
          description,
          source,
        });
        return `Link saved successfully: ${url}`;
      } catch (error: any) {
        return `Failed to save link: ${error.message}`;
      }
    },
  });

  const queryReports = tool({
    description:
      'Search through previously saved AI reports from history. Use this to find past analyses, avoid duplicate work, or reference previous findings.',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe('Search query to find relevant reports by title, content, or summary'),
      limit: z.number().optional().describe('Maximum number of results to return (default: 10)'),
    }),
    execute: async ({ query, limit = 10 }) => {
      try {
        const { data, total } = await reportsService.getReports({
          search: query,
          limit,
        });
        if (data.length === 0) {
          return 'No reports found matching the query.';
        }
        const reportSummaries = data.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.summary,
          createdAt: r.createdAt,
        }));
        return JSON.stringify({ reports: reportSummaries, total });
      } catch (error: any) {
        return `Failed to query reports: ${error.message}`;
      }
    },
  });

  const queryCollectedLinks = tool({
    description:
      'Search through previously collected links from history. Use this to find saved resources or check if a link was already recorded.',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe('Search query to find links by URL, title, description, or source'),
      limit: z.number().optional().describe('Maximum number of results to return (default: 20)'),
    }),
    execute: async ({ query, limit = 20 }) => {
      try {
        const { data, total } = await reportsService.getLinks({
          search: query,
          limit,
        });
        if (data.length === 0) {
          return 'No collected links found matching the query.';
        }
        const linkSummaries = data.map((l) => ({
          url: l.url,
          title: l.title,
          description: l.description,
          source: l.source,
          collectedAt: l.collectedAt,
        }));
        return JSON.stringify({ links: linkSummaries, total });
      } catch (error: any) {
        return `Failed to query collected links: ${error.message}`;
      }
    },
  });

  return {
    search_internet: searchInternet,
    scrape_url: scrapeUrl,
    map_website: mapWebsite,
    extract_data: extractData,
    send_report: sendReport,
    save_collected_link: saveCollectedLink,
    query_reports: queryReports,
    query_collected_links: queryCollectedLinks,
  };
}

/** Agent 工具集类型 */
export type AgentTools = ReturnType<typeof createAgentTools>;