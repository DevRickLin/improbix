import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  snippet: string;
  labelIds: string[];
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private gmail: gmail_v1.Gmail | null = null;
  private userEmail: string = '';

  constructor(@Inject(ConfigService) private configService: ConfigService) {}

  async onModuleInit() {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');
    this.userEmail = this.configService.get<string>('GMAIL_USER_EMAIL') || 'me';

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.warn('Gmail not configured (missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN)');
      return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    this.logger.log(`Gmail service initialized for ${this.userEmail}`);
  }

  isConfigured(): boolean {
    return this.gmail !== null;
  }

  async getUnreadEmails(maxResults = 10): Promise<EmailMessage[]> {
    if (!this.gmail) throw new Error('Gmail not configured');

    const res = await this.gmail.users.messages.list({
      userId: this.userEmail,
      q: 'is:unread',
      maxResults,
    });

    const messages = res.data.messages || [];
    return Promise.all(messages.map((m) => this.getMessage(m.id!)));
  }

  async getMessage(messageId: string): Promise<EmailMessage> {
    if (!this.gmail) throw new Error('Gmail not configured');

    const res = await this.gmail.users.messages.get({
      userId: this.userEmail,
      id: messageId,
      format: 'full',
    });

    const headers = res.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: res.data.id!,
      threadId: res.data.threadId!,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      body: this.extractBody(res.data.payload),
      date: getHeader('Date'),
      snippet: res.data.snippet || '',
      labelIds: res.data.labelIds || [],
    };
  }

  async searchEmails(query: string, maxResults = 10): Promise<EmailMessage[]> {
    if (!this.gmail) throw new Error('Gmail not configured');

    const res = await this.gmail.users.messages.list({
      userId: this.userEmail,
      q: query,
      maxResults,
    });

    const messages = res.data.messages || [];
    return Promise.all(messages.map((m) => this.getMessage(m.id!)));
  }

  async getNewEmailsSince(afterTimestamp: string): Promise<EmailMessage[]> {
    if (!this.gmail) throw new Error('Gmail not configured');

    const epochSeconds = Math.floor(new Date(afterTimestamp).getTime() / 1000);
    const query = `is:unread after:${epochSeconds}`;

    return this.searchEmails(query, 20);
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    // Simple text/plain body
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // Multipart: recurse into parts
    if (payload.parts) {
      // Prefer text/plain
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      // Fallback to text/html
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      // Recurse into nested multipart
      for (const part of payload.parts) {
        const nested = this.extractBody(part);
        if (nested) return nested;
      }
    }

    // Direct body data
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    return '';
  }
}
