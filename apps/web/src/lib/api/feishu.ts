import { apiClient } from './client';

// 消息类型
export type FeishuMsgType = 'text' | 'post' | 'image' | 'share_chat' | 'interactive';

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
  value?: Record<string, unknown>;
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
export type FeishuCardHeaderTemplate =
  | 'blue'
  | 'wathet'
  | 'turquoise'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'carmine'
  | 'violet'
  | 'purple'
  | 'indigo'
  | 'grey';

export interface FeishuCardHeader {
  title: FeishuCardTextElement;
  template?: FeishuCardHeaderTemplate;
}

export interface FeishuCardContent {
  header?: FeishuCardHeader;
  elements: FeishuCardElement[];
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
}

// API 响应类型
interface FeishuStatusResponse {
  configured: boolean;
  hasSecret: boolean;
}

interface FeishuSendResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

// 请求参数类型
interface FeishuMessageContent {
  msg_type: FeishuMsgType;
  content?: unknown;
  card?: FeishuCardContent;
}

interface SendSimpleCardParams {
  title: string;
  content: string;
  headerColor?: FeishuCardHeaderTemplate;
  buttons?: Array<{ text: string; url: string; type?: 'default' | 'primary' | 'danger' }>;
}

export const feishuApi = {
  // 获取飞书配置状态
  getStatus: () => apiClient.get<FeishuStatusResponse>('/feishu/status'),

  // 发送纯文本消息
  sendText: (text: string) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-text', { text }),

  // 发送通用消息
  sendMessage: (params: FeishuMessageContent) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-message', params),

  // 发送富文本消息
  sendRichText: (post: FeishuPostMessage) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-rich-text', { post }),

  // 发送简化富文本消息（仅中文）
  sendRichTextSimple: (title: string, content: FeishuPostElement[][]) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-rich-text-simple', { title, content }),

  // 发送卡片消息
  sendCard: (card: FeishuCardContent) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-card', { card }),

  // 发送简化卡片消息
  sendSimpleCard: (params: SendSimpleCardParams) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-simple-card', params),

  // 发送图片消息
  sendImage: (imageKey: string) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-image', { image_key: imageKey }),

  // 发送群名片
  sendShareChat: (shareChatId: string) =>
    apiClient.post<FeishuSendResponse>('/feishu/send-share-chat', { share_chat_id: shareChatId }),

  // 测试连接（发送测试文本消息）
  testConnection: () =>
    apiClient.post<FeishuSendResponse>('/feishu/test-connection'),

  // 测试卡片消息
  testCard: () =>
    apiClient.post<FeishuSendResponse>('/feishu/test-card'),
};
