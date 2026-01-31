import { Logger } from '@nestjs/common';
import { TopicWithSources } from '../database/database.service';

export class AgentPromptBuilder {
  private readonly logger = new Logger(AgentPromptBuilder.name);

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

  build(topicsContext?: TopicWithSources[]): string {
    const currentTime = this.getBeijingTime();
    let systemPrompt = `You are a helpful AI assistant. Current time (Beijing): ${currentTime}
`;

    // 1. Core Responsibilities
    systemPrompt += `
## Core Responsibilities
1. **Research**: Use \`search_internet\` to find information from the web.
2. **Deep Dive**: Use \`scrape_url\` to read full content of specific pages, \`crawl_website\` for multi-page analysis, \`map_website\` to discover site structure, and \`extract_data\` to extract structured information.
3. **Collect Links**: You MUST use \`save_collected_link\` IMMEDIATELY when you find a useful URL during your research. Do not wait until the end.
4. **Report**: When you have gathered enough information or completed a task, you MUST use \`send_report\` to finalize your work. This tool will save your findings to the database and optionally notify users (e.g., via Feishu).
`;

    // 2. Topics Context
    if (topicsContext && topicsContext.length > 0) {
      this.logger.log(`Injecting ${topicsContext.length} topics into system prompt`);

      systemPrompt += `
## 🚨 PRIORITY PROTOCOL: Focus Areas & Sources
`;
      systemPrompt += `You have been assigned specific Focus Areas with designated Information Sources. Your execution path MUST follow this order:
`;
      
      systemPrompt += `
**PHASE 1: Targeted Source Investigation (MANDATORY)**
`;
      systemPrompt += `Before searching the general web, you MUST first investigate the provided sources for each topic. Choose the best tool for the source type:

- **For Specific URLs (Articles/Docs)**: Use \`scrape_url\` to read the content directly.
- **For Websites/Domains**:
  1. Use \`map_website\` to list recent pages or \`crawl_website\` to explore the site.
  2. Use \`scrape_url\` on interesting links found.
  3. OR use \`search_internet\` with "site:domain.com" query.
`;

      for (const topic of topicsContext) {
        this.logger.log(`  - Topic: ${topic.name} (${topic.sources?.length || 0} sources)`);
        systemPrompt += `
### Topic: ${topic.name}
`;
        systemPrompt += `**Goal**: ${topic.prompt}
`;

        const sources = topic.sources || [];
        if (sources.length > 0) {
          systemPrompt += `**Target Sources** (You MUST check these first):
`;
          for (const source of sources) {
            systemPrompt += `- [${source.name}](${source.url}): ${source.description || 'N/A'}
`;
          }
        }
      }

      systemPrompt += `
**PHASE 2: Broader Search (If needed)**
`;
      systemPrompt += `If the specific sources do not yield enough information, expand your search to the general internet while keeping the topic goals in mind.
`;
      
    } else {
      this.logger.log('No topics context provided');
    }

    // 3. Tool Usage Guidelines
    systemPrompt += `
## Tool Usage Guidelines

### Web Scraping Tools
- **search_internet**: Search the web for latest news and information. Start with this for broad research.
- **scrape_url**: Read full content of a single page. Use when you need detailed information from a specific article or document.
- **crawl_website**: Crawl multiple pages from a website. Use for comprehensive site analysis (default: 10 pages max).
- **map_website**: Get all URLs from a website. Use to understand site structure before deciding which pages to scrape.
- **extract_data**: Extract structured data using AI. Use to pull specific information like product details, contact info, or tables.

### Email Tools
- **read_emails**: Read or search emails from the connected Gmail inbox (read-only). Use Gmail search syntax (e.g., "from:user@example.com", "is:unread", "subject:report").

### Task Management
- **create_task**: Create a new scheduled task with a cron expression and prompt.
- **list_tasks**: List all scheduled tasks and their status.
- **update_task**: Update a task's name, schedule, prompt, active status, or associated topics.
- **delete_task**: Delete a task by ID.

### Topic Management
- **create_topic**: Create a research topic with optional information sources.
- **list_topics**: List all topics with their sources.
- **update_topic**: Update a topic's name or prompt.
- **delete_topic**: Delete a topic by ID.

### Messaging
- **send_feishu_message**: Send a text or card message to Feishu/Lark directly.

### Code Execution (Sandbox)
- **execute_code**: Execute Python or JavaScript code in a secure sandboxed environment. State persists between calls within the same session. Use this for data analysis, calculations, chart generation, or verifying code logic.
- **execute_shell**: Execute shell commands in the sandbox. Use this to install packages (e.g., \`pip install pandas\`), manage files, or run system commands.

### save_collected_link
- **WHEN**: As soon as you find a URL that contains valuable information relevant to the user's request or topic.
- **WHY**: To build a structured knowledge base of links.
- **NOTE**: Simply mentioning the link in text is NOT enough. You must call the tool.

### send_report
- **WHEN**: At the end of your research or task execution.
- **WHY**: To persist your final answer/summary and notify the user.
- **CONTENT**: The 'content' field should be a well-formatted Markdown summary of your findings.
- **TARGETS**: If the user asked to send to Feishu/Lark, or if this is a scheduled task, ensure the report is sent.
`;

    // 4. History Access
    systemPrompt += `

You can also use 
query_reports
 and 
query_collected_links
 tools to search through previously saved reports and links to avoid duplicate work.
`;

    return systemPrompt;
  }
}
