import { tool } from 'ai';
import { z } from 'zod';
import type { SearchService } from '../search/search.service';
import type { FeishuService } from '../feishu/feishu.service';
import type { ReportsService } from '../reports/reports.service';
import type { EmailService } from '../email/email.service';
import type { DatabaseService } from '../database/database.service';
import type { SandboxService } from '../sandbox/sandbox.service';
import type { SimilarWebService } from '../similarweb/similarweb.service';
import { CronExpressionParser } from 'cron-parser';

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
  emailService: EmailService,
  db: DatabaseService,
  sandboxService: SandboxService,
  similarWebService: SimilarWebService,
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

  // ==================== Email Tools ====================

  const readEmails = tool({
    description:
      'Read emails from the connected Gmail inbox. Can search with a Gmail query or list unread emails. Use this to check for new messages, find specific emails, or review inbox content.',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe('Gmail search query (e.g., "from:user@example.com", "subject:report", "is:unread"). If omitted, returns unread emails.'),
      maxResults: z.number().optional().describe('Maximum number of emails to return (default: 10)'),
    }),
    execute: async ({ query, maxResults = 10 }) => {
      if (!emailService.isConfigured()) {
        return 'Gmail is not configured. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.';
      }
      try {
        const emails = query
          ? await emailService.searchEmails(query, maxResults)
          : await emailService.getUnreadEmails(maxResults);

        if (emails.length === 0) {
          return 'No emails found.';
        }

        return JSON.stringify(
          emails.map((e) => ({
            id: e.id,
            from: e.from,
            subject: e.subject,
            date: e.date,
            snippet: e.snippet,
            body: e.body.substring(0, 2000),
          })),
        );
      } catch (error: any) {
        return `Failed to read emails: ${error.message}`;
      }
    },
  });

  // ==================== Task Management Tools ====================

  const createTask = tool({
    description: 'Create a new scheduled task. The task will run automatically based on the cron schedule.',
    inputSchema: z.object({
      name: z.string().describe('Name of the task'),
      cronSchedule: z.string().describe('Cron expression (e.g., "0 9 * * *" for daily at 9am)'),
      prompt: z.string().describe('The prompt/instructions for the AI agent when this task runs'),
      timezone: z.string().optional().describe('Timezone (e.g., "Asia/Shanghai"). Defaults to UTC.'),
    }),
    execute: async ({ name, cronSchedule, prompt, timezone }) => {
      try {
        CronExpressionParser.parse(cronSchedule);
      } catch {
        return `Invalid cron expression: ${cronSchedule}`;
      }
      try {
        const interval = CronExpressionParser.parse(cronSchedule, { tz: timezone || 'UTC' });
        const nextRunAt = interval.next().toDate();
        const task = await db.createTask({ name, cronSchedule, prompt, timezone: timezone || null, nextRunAt });
        return `Task created successfully (ID: ${task.id}, name: ${task.name}, next run: ${nextRunAt.toISOString()})`;
      } catch (error: any) {
        return `Failed to create task: ${error.message}`;
      }
    },
  });

  const listTasks = tool({
    description: 'List all scheduled tasks with their status and associated topics.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const tasks = await db.findAllTasks();
        const result: Array<Record<string, unknown>> = [];
        for (const t of tasks) {
          const topicIds = await db.findTaskTopicIds(t.id);
          result.push({ ...t, topicIds });
        }
        return JSON.stringify(result);
      } catch (error: any) {
        return `Failed to list tasks: ${error.message}`;
      }
    },
  });

  const updateTask = tool({
    description: 'Update an existing task by ID. Only provided fields will be changed.',
    inputSchema: z.object({
      id: z.number().describe('Task ID'),
      name: z.string().optional().describe('New name'),
      cronSchedule: z.string().optional().describe('New cron expression'),
      prompt: z.string().optional().describe('New prompt'),
      isActive: z.boolean().optional().describe('Enable or disable the task'),
      timezone: z.string().optional().describe('New timezone'),
      topicIds: z.array(z.number()).optional().describe('Topic IDs to associate'),
    }),
    execute: async ({ id, topicIds, ...data }) => {
      try {
        if (data.cronSchedule) {
          CronExpressionParser.parse(data.cronSchedule);
        }
        const existing = await db.findTaskById(id);
        if (!existing) return `Task ${id} not found.`;

        if (data.cronSchedule || data.timezone !== undefined) {
          const cron = data.cronSchedule || existing.cronSchedule;
          const tz = data.timezone !== undefined ? data.timezone : existing.timezone;
          const interval = CronExpressionParser.parse(cron, { tz: tz || 'UTC' });
          (data as any).nextRunAt = interval.next().toDate();
        }
        await db.updateTask(id, data);
        if (topicIds !== undefined) {
          await db.setTaskTopics(id, topicIds);
        }
        return `Task ${id} updated successfully.`;
      } catch (error: any) {
        return `Failed to update task: ${error.message}`;
      }
    },
  });

  const deleteTask = tool({
    description: 'Delete a scheduled task by ID.',
    inputSchema: z.object({
      id: z.number().describe('Task ID to delete'),
    }),
    execute: async ({ id }) => {
      try {
        await db.deleteTask(id);
        return `Task ${id} deleted.`;
      } catch (error: any) {
        return `Failed to delete task: ${error.message}`;
      }
    },
  });

  // ==================== Topic Management Tools ====================

  const createTopic = tool({
    description: 'Create a new research topic/focus area with optional information sources.',
    inputSchema: z.object({
      name: z.string().describe('Topic name'),
      prompt: z.string().describe('Research goal/instructions for this topic'),
      sources: z.array(z.object({
        name: z.string().describe('Source name'),
        url: z.string().describe('Source URL'),
        description: z.string().optional().describe('Source description'),
      })).optional().describe('Information sources to monitor'),
    }),
    execute: async ({ name, prompt, sources }) => {
      try {
        const topic = await db.createTopic({ name, prompt });
        if (sources) {
          for (const s of sources) {
            await db.createTopicSource({ topicId: topic.id, name: s.name, url: s.url, description: s.description });
          }
        }
        return `Topic created (ID: ${topic.id}, name: ${topic.name})`;
      } catch (error: any) {
        return `Failed to create topic: ${error.message}`;
      }
    },
  });

  const listTopics = tool({
    description: 'List all research topics with their sources.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const topics = await db.findAllTopicsWithSources();
        return JSON.stringify(topics);
      } catch (error: any) {
        return `Failed to list topics: ${error.message}`;
      }
    },
  });

  const updateTopic = tool({
    description: 'Update a topic by ID.',
    inputSchema: z.object({
      id: z.number().describe('Topic ID'),
      name: z.string().optional(),
      prompt: z.string().optional(),
    }),
    execute: async ({ id, ...data }) => {
      try {
        await db.updateTopic(id, data);
        return `Topic ${id} updated.`;
      } catch (error: any) {
        return `Failed to update topic: ${error.message}`;
      }
    },
  });

  const deleteTopic = tool({
    description: 'Delete a topic by ID.',
    inputSchema: z.object({
      id: z.number().describe('Topic ID to delete'),
    }),
    execute: async ({ id }) => {
      try {
        await db.deleteTopic(id);
        return `Topic ${id} deleted.`;
      } catch (error: any) {
        return `Failed to delete topic: ${error.message}`;
      }
    },
  });

  // ==================== Additional Tools ====================

  const crawlWebsite = tool({
    description: 'Crawl multiple pages from a website. Use this for comprehensive site analysis when you need content from many pages.',
    inputSchema: z.object({
      url: z.string().url().describe('The website URL to crawl'),
      limit: z.number().optional().describe('Maximum number of pages to crawl (default: 10)'),
    }),
    execute: async ({ url, limit }) => {
      try {
        const result = await searchService.crawlUrl(url, { limit });
        return JSON.stringify(result);
      } catch (error: any) {
        return `Failed to crawl: ${error.message}`;
      }
    },
  });

  const sendFeishuMessage = tool({
    description: 'Send a message to Feishu/Lark. Can send plain text or a formatted card.',
    inputSchema: z.object({
      text: z.string().describe('Message text content'),
      format: z.enum(['text', 'card']).optional().describe('Message format: "text" for plain text, "card" for formatted card (default: text)'),
      title: z.string().optional().describe('Card title (only used when format is "card")'),
    }),
    execute: async ({ text, format = 'text', title }) => {
      try {
        if (format === 'card' && title) {
          await feishuService.sendSimpleCard(title, text, { headerColor: 'blue' });
        } else {
          await feishuService.sendText(text);
        }
        return 'Message sent to Feishu successfully.';
      } catch (error: any) {
        return `Failed to send Feishu message: ${error.message}`;
      }
    },
  });

  // ==================== Code Execution Tools ====================

  const executeCode = tool({
    description:
      'Execute Python or JavaScript code in a secure sandboxed environment. Use this for data analysis, calculations, generating charts, or running any code. The sandbox persists state between calls within the same session.',
    inputSchema: z.object({
      language: z.enum(['python', 'javascript']).describe('Programming language'),
      code: z.string().describe('The code to execute'),
    }),
    execute: async ({ language, code }) => {
      if (!sandboxService.isConfigured()) {
        return 'Code execution is not available. E2B_API_KEY is not configured.';
      }
      const result = await sandboxService.executeCode(language, code);
      return JSON.stringify(result);
    },
  });

  const executeShell = tool({
    description:
      'Execute a shell command in the sandbox environment. Use this for installing packages (pip install, npm install), file operations, or system commands.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute'),
    }),
    execute: async ({ command }) => {
      if (!sandboxService.isConfigured()) {
        return 'Shell execution is not available. E2B_API_KEY is not configured.';
      }
      const result = await sandboxService.executeShell(command);
      return JSON.stringify(result);
    },
  });

  // ==================== Data Platform Tools ====================

  const querySimilarweb = tool({
    description:
      'Query SimilarWeb for website traffic analytics. Returns traffic volume, engagement metrics, traffic sources, top keywords, or competitor sites for any domain.',
    inputSchema: z.object({
      domain: z.string().describe('The website domain to query (e.g., "google.com", "baidu.com")'),
      metric: z
        .enum(['traffic', 'sources', 'keywords', 'competitors'])
        .optional()
        .describe('Which metric to query. "traffic" = visits & engagement, "sources" = traffic source breakdown, "keywords" = top search keywords, "competitors" = similar sites. Default: traffic'),
      country: z.string().optional().describe('Country code filter (e.g., "us", "cn"). Default: "world" (global)'),
    }),
    execute: async ({ domain, metric = 'traffic', country }) => {
      if (!similarWebService.isConfigured()) {
        return 'SimilarWeb API is not configured. Set SIMILARWEB_API_KEY in environment.';
      }
      try {
        let result: any;
        switch (metric) {
          case 'traffic':
            result = await similarWebService.getWebsiteTraffic(domain, { country });
            break;
          case 'sources':
            result = await similarWebService.getTrafficSources(domain, { country });
            break;
          case 'keywords':
            result = await similarWebService.getTopKeywords(domain, { country });
            break;
          case 'competitors':
            result = await similarWebService.getCompetitors(domain);
            break;
        }
        return JSON.stringify(result);
      } catch (error: any) {
        return `Failed to query SimilarWeb: ${error.message}`;
      }
    },
  });

  const queryQuestmobile = tool({
    description:
      'Query QuestMobile for Chinese mobile internet data. Scrapes public pages from QuestMobile for app rankings, industry reports, and mobile usage trends. Best for Chinese market mobile app analytics.',
    inputSchema: z.object({
      query: z.string().describe('What to search for (e.g., "短视频 App 排行", "社交应用月活", "2024 移动互联网趋势")'),
      type: z
        .enum(['ranking', 'report', 'search'])
        .optional()
        .describe('"ranking" = app rankings page, "report" = research reports, "search" = general search on QuestMobile. Default: search'),
    }),
    execute: async ({ query, type = 'search' }) => {
      try {
        let url: string;
        let prompt: string;

        switch (type) {
          case 'ranking':
            url = 'https://www.questmobile.com.cn/research/report-new/172';
            prompt = `Extract app ranking data related to: ${query}. Include app names, rankings, monthly active users (MAU), and any growth metrics.`;
            break;
          case 'report':
            url = 'https://www.questmobile.com.cn/research/report-new/1';
            prompt = `Extract research report information related to: ${query}. Include report titles, dates, key findings, and summaries.`;
            break;
          default:
            // Use search_internet with site-specific query as fallback
            const searchResult = await searchService.search(`site:questmobile.com.cn ${query}`);
            return typeof searchResult === 'string' ? searchResult : JSON.stringify(searchResult);
        }

        const result = await searchService.extractData(url, { prompt });
        return JSON.stringify(result);
      } catch (error: any) {
        return `Failed to query QuestMobile: ${error.message}`;
      }
    },
  });

  const queryTalkingdata = tool({
    description:
      'Query TalkingData for mobile app and device data in China. Scrapes public pages from TalkingData for app rankings, device market share, and mobile ecosystem insights.',
    inputSchema: z.object({
      query: z.string().describe('What to search for (e.g., "App排行", "设备市场份额", "移动应用活跃度")'),
      type: z
        .enum(['ranking', 'device', 'search'])
        .optional()
        .describe('"ranking" = app rankings, "device" = device/OS market share data, "search" = general search. Default: search'),
    }),
    execute: async ({ query, type = 'search' }) => {
      try {
        let url: string;
        let prompt: string;

        switch (type) {
          case 'ranking':
            url = 'https://mi.talkingdata.com/app-rank.html';
            prompt = `Extract app ranking data related to: ${query}. Include app names, categories, rankings, coverage/penetration rates, and any growth data.`;
            break;
          case 'device':
            url = 'https://mi.talkingdata.com/device.html';
            prompt = `Extract device and market share data related to: ${query}. Include device brands, models, OS versions, market share percentages.`;
            break;
          default:
            const searchResult = await searchService.search(`site:talkingdata.com ${query}`);
            return typeof searchResult === 'string' ? searchResult : JSON.stringify(searchResult);
        }

        const result = await searchService.extractData(url, { prompt });
        return JSON.stringify(result);
      } catch (error: any) {
        return `Failed to query TalkingData: ${error.message}`;
      }
    },
  });

  return {
    search_internet: searchInternet,
    scrape_url: scrapeUrl,
    map_website: mapWebsite,
    crawl_website: crawlWebsite,
    extract_data: extractData,
    send_report: sendReport,
    save_collected_link: saveCollectedLink,
    query_reports: queryReports,
    query_collected_links: queryCollectedLinks,
    read_emails: readEmails,
    create_task: createTask,
    list_tasks: listTasks,
    update_task: updateTask,
    delete_task: deleteTask,
    create_topic: createTopic,
    list_topics: listTopics,
    update_topic: updateTopic,
    delete_topic: deleteTopic,
    send_feishu_message: sendFeishuMessage,
    execute_code: executeCode,
    execute_shell: executeShell,
    query_similarweb: querySimilarweb,
    query_questmobile: queryQuestmobile,
    query_talkingdata: queryTalkingdata,
  };
}

/** Agent 工具集类型 */
export type AgentTools = ReturnType<typeof createAgentTools>;