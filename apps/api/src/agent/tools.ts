import { tool } from 'ai';
import { z } from 'zod';
import type { SearchService } from '../search/search.service';
import type { FeishuService } from '../feishu/feishu.service';

/**
 * 创建 Agent 工具集
 * 使用 Vercel AI SDK 的 tool() 函数定义类型安全的工具
 */
export function createAgentTools(
  searchService: SearchService,
  feishuService: FeishuService,
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

  const sendFeishuMessage = tool({
    description:
      'Send a plain text message to Feishu (Lark). For rich formatted content with titles and buttons, use send_feishu_card instead.',
    inputSchema: z.object({
      message: z.string().describe('The message content to send'),
    }),
    execute: async ({ message }) => {
      await feishuService.sendText(message);
      return 'Message sent successfully.';
    },
  });

  const sendFeishuCard = tool({
    description:
      'Send a rich interactive card to Feishu (Lark). Cards support Markdown formatting, colored headers, and action buttons. Use this for well-formatted summaries, reports, or notifications.',
    inputSchema: z.object({
      title: z.string().describe('Card header title'),
      content: z
        .string()
        .describe(
          'Card body content in Markdown format. Supports: **bold**, *italic*, [links](url), bullet lists (- item), numbered lists (1. item), and more.',
        ),
      color: z
        .enum([
          'blue',
          'wathet',
          'turquoise',
          'green',
          'yellow',
          'orange',
          'red',
          'carmine',
          'violet',
          'purple',
          'indigo',
          'grey',
        ])
        .optional()
        .describe('Header background color theme. Default is blue.'),
      buttons: z
        .array(
          z.object({
            text: z.string().describe('Button label text'),
            url: z.string().describe('URL to open when button is clicked'),
            type: z
              .enum(['default', 'primary', 'danger'])
              .optional()
              .describe('Button style. Default is "default".'),
          }),
        )
        .optional()
        .describe('Optional action buttons at the bottom of the card'),
    }),
    execute: async ({ title, content, color, buttons }) => {
      await feishuService.sendSimpleCard(title, content, {
        headerColor: color,
        buttons,
      });
      return 'Card sent successfully.';
    },
  });

  return {
    search_internet: searchInternet,
    send_feishu_message: sendFeishuMessage,
    send_feishu_card: sendFeishuCard,
  };
}

/** Agent 工具集类型 */
export type AgentTools = ReturnType<typeof createAgentTools>;
