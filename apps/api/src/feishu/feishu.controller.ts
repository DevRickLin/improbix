import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FeishuService } from './feishu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class SendTextDto {
  text!: string;
}

class SendMessageDto {
  msg_type!: 'text' | 'post' | 'image' | 'share_chat' | 'interactive';
  content!: any;
}

@Controller('feishu')
@UseGuards(JwtAuthGuard)
export class FeishuController {
  constructor(private readonly feishuService: FeishuService) {}

  @Get('status')
  async getStatus() {
    // Check if Feishu is configured
    const isConfigured = !!(process.env.FEISHU_WEBHOOK_URL);
    return {
      configured: isConfigured,
      hasSecret: !!(process.env.FEISHU_SECRET),
    };
  }

  @Post('send-text')
  async sendText(@Body() dto: SendTextDto) {
    if (!dto.text) {
      throw new HttpException('Text is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.feishuService.sendText(dto.text);
      return {
        success: true,
        message: 'Message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-message')
  async sendMessage(@Body() dto: SendMessageDto) {
    if (!dto.msg_type || !dto.content) {
      throw new HttpException(
        'msg_type and content are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.feishuService.sendMessage({
        msg_type: dto.msg_type,
        content: dto.content,
      });
      return {
        success: true,
        message: 'Message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('test-connection')
  async testConnection() {
    try {
      const result = await this.feishuService.sendText(
        '[Test] Improbix connection test - ' + new Date().toISOString(),
      );
      return {
        success: true,
        message: 'Test message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Connection test failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
