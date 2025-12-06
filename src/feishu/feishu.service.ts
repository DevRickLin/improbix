import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface FeishuMessageParams {
  msg_type: 'text' | 'post' | 'image' | 'share_chat' | 'interactive';
  content: any;
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
      this.logger.error('Feishu Webhook URL is not configured.');
      return; 
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payload: any = {
      timestamp: timestamp.toString(),
      ...params,
    };

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
      this.logger.error(`Error sending message to Feishu: ${error.message}`);
    }
  }

  async sendText(text: string) {
      return this.sendMessage({
          msg_type: 'text',
          content: {
              text: text
          }
      });
  }
}
