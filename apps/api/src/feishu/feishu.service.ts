import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 消息类型
export type FeishuMsgType = 'text' | 'post' | 'image' | 'share_chat' | 'interactive';

// 基础消息参数
export interface FeishuMessageParams {
  msg_type: FeishuMsgType;
  content?: any;
  card?: FeishuCardContent;
}

// 富文本内容元素类型
export interface FeishuPostTextElement {
  tag: 'text';
  text: string;
  un_escape?: boolean;
}

export interface FeishuPostLinkElement {
  tag: 'a';
  text: string;
  href: string;
}

export interface FeishuPostAtElement {
  tag: 'at';
  user_id: string;
  user_name?: string;
}

export interface FeishuPostImageElement {
  tag: 'img';
  image_key: string;
  width?: number;
  height?: number;
}

export type FeishuPostElement =
  | FeishuPostTextElement
  | FeishuPostLinkElement
  | FeishuPostAtElement
  | FeishuPostImageElement;

// 富文本消息内容
export interface FeishuPostContent {
  title?: string;
  content: FeishuPostElement[][];
}

export interface FeishuPostMessage {
  zh_cn?: FeishuPostContent;
  en_us?: FeishuPostContent;
  ja_jp?: FeishuPostContent;
}

// 卡片元素类型
export interface FeishuCardTextElement {
  tag: 'plain_text' | 'lark_md';
  content: string;
}

export interface FeishuCardDivElement {
  tag: 'div';
  text?: FeishuCardTextElement;
  fields?: Array<{
    is_short: boolean;
    text: FeishuCardTextElement;
  }>;
}

export interface FeishuCardButtonElement {
  tag: 'button';
  text: FeishuCardTextElement;
  url?: string;
  type?: 'default' | 'primary' | 'danger';
  value?: Record<string, any>;
}

export interface FeishuCardActionElement {
  tag: 'action';
  actions: FeishuCardButtonElement[];
}

export interface FeishuCardImageElement {
  tag: 'img';
  img_key: string;
  alt?: FeishuCardTextElement;
  title?: FeishuCardTextElement;
}

export interface FeishuCardNoteElement {
  tag: 'note';
  elements: Array<FeishuCardTextElement | { tag: 'img'; img_key: string; alt: FeishuCardTextElement }>;
}

export interface FeishuCardHrElement {
  tag: 'hr';
}

export type FeishuCardElement =
  | FeishuCardDivElement
  | FeishuCardActionElement
  | FeishuCardImageElement
  | FeishuCardNoteElement
  | FeishuCardHrElement;

// 卡片消息内容
export interface FeishuCardHeader {
  title: FeishuCardTextElement;
  template?: 'blue' | 'wathet' | 'turquoise' | 'green' | 'yellow' | 'orange' | 'red' | 'carmine' | 'violet' | 'purple' | 'indigo' | 'grey';
}

export interface FeishuCardContent {
  header?: FeishuCardHeader;
  elements: FeishuCardElement[];
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
}

@Injectable()
export class FeishuService {
  private readonly logger = new Logger(FeishuService.name);
  private readonly webhookUrl: string;
  private readonly secret: string;
  private readonly axiosClient: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('FEISHU_WEBHOOK_URL', '');
    this.secret = this.configService.get<string>('FEISHU_SECRET', '');

    const proxyUrl = 
      this.configService.get<string>('HTTPS_PROXY') || 
      this.configService.get<string>('HTTP_PROXY') ||
      this.configService.get<string>('ALL_PROXY');

    const axiosConfig: any = {};
    if (proxyUrl) {
        this.logger.log(`Using proxy for Feishu: ${proxyUrl}`);
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
        axiosConfig.proxy = false; // Disable axios default proxy handling
    }

    this.axiosClient = axios.create(axiosConfig);
  }

  private generateSignature(timestamp: number): string {
    if (!this.secret) return '';
    const stringToSign = `${timestamp}\n${this.secret}`;
    const hmac = crypto.createHmac('sha256', stringToSign);
    return hmac.digest('base64');
  }

  async sendMessage(params: FeishuMessageParams): Promise<any> {
    if (!this.webhookUrl) {
      const errorMsg = 'Feishu Webhook URL is not configured. Please set FEISHU_WEBHOOK_URL environment variable.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payload: any = {
      timestamp: timestamp.toString(),
      msg_type: params.msg_type,
    };

    // 卡片消息使用 card 字段，其他消息使用 content 字段
    if (params.msg_type === 'interactive' && params.card) {
      payload.card = params.card;
    } else if (params.content) {
      payload.content = params.content;
    }

    if (this.secret) {
      payload.sign = this.generateSignature(timestamp);
    }

    try {
      const response = await this.axiosClient.post(this.webhookUrl, payload);
      if (response.data && response.data.code !== 0) {
        throw new Error(`Feishu API Error: ${response.data.msg || JSON.stringify(response.data)}`);
      }
      this.logger.log('Message sent to Feishu successfully');
      return response.data;
    } catch (error: any) {
      const errorMsg = `Error sending message to Feishu: ${error.message}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * 发送纯文本消息
   * @param text 消息内容，可以使用 <at user_id="xxx">name</at> 来 @ 用户
   */
  async sendText(text: string): Promise<any> {
    return this.sendMessage({
      msg_type: 'text',
      content: {
        text: text,
      },
    });
  }

  /**
   * 发送富文本消息
   * @param post 富文本内容，支持多语言
   */
  async sendRichText(post: FeishuPostMessage): Promise<any> {
    return this.sendMessage({
      msg_type: 'post',
      content: {
        post: post,
      },
    });
  }

  /**
   * 发送富文本消息（简化版本，仅中文）
   * @param title 标题
   * @param content 内容数组，每个元素是一行
   */
  async sendRichTextSimple(title: string, content: FeishuPostElement[][]): Promise<any> {
    return this.sendRichText({
      zh_cn: {
        title,
        content,
      },
    });
  }

  /**
   * 发送消息卡片
   * @param card 卡片内容
   */
  async sendCard(card: FeishuCardContent): Promise<any> {
    return this.sendMessage({
      msg_type: 'interactive',
      card: card,
    });
  }

  /**
   * 发送简单消息卡片
   * @param title 卡片标题
   * @param content 卡片内容（支持 Markdown）
   * @param options 可选配置
   */
  async sendSimpleCard(
    title: string,
    content: string,
    options?: {
      headerColor?: FeishuCardHeader['template'];
      buttons?: Array<{ text: string; url: string; type?: 'default' | 'primary' | 'danger' }>;
    },
  ): Promise<any> {
    const elements: FeishuCardElement[] = [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: content,
        },
      },
    ];

    // 添加按钮
    if (options?.buttons && options.buttons.length > 0) {
      elements.push({
        tag: 'action',
        actions: options.buttons.map((btn) => ({
          tag: 'button' as const,
          text: {
            tag: 'lark_md' as const,
            content: btn.text,
          },
          url: btn.url,
          type: btn.type || 'default',
        })),
      });
    }

    return this.sendCard({
      header: {
        title: {
          tag: 'plain_text',
          content: title,
        },
        template: options?.headerColor || 'blue',
      },
      elements,
    });
  }

  /**
   * 发送图片消息
   * @param imageKey 图片的 key（需要先上传图片获取）
   */
  async sendImage(imageKey: string): Promise<any> {
    return this.sendMessage({
      msg_type: 'image',
      content: {
        image_key: imageKey,
      },
    });
  }

  /**
   * 发送群名片消息
   * @param shareChatId 群的 chat_id
   */
  async sendShareChat(shareChatId: string): Promise<any> {
    return this.sendMessage({
      msg_type: 'share_chat',
      content: {
        share_chat_id: shareChatId,
      },
    });
  }
}
