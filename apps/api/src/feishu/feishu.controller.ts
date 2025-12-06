import {
  Controller,
  Inject,
  Post,
  Body,
  Get,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  FeishuService,
  FeishuMsgType,
  FeishuPostMessage,
  FeishuPostElement,
  FeishuCardContent,
  FeishuCardHeader,
} from './feishu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// DTO 定义
class SendTextDto {
  text!: string;
}

class SendMessageDto {
  msg_type!: FeishuMsgType;
  content?: any;
  card?: FeishuCardContent;
}

class SendRichTextDto {
  post!: FeishuPostMessage;
}

class SendRichTextSimpleDto {
  title!: string;
  content!: FeishuPostElement[][];
}

class SendCardDto {
  card!: FeishuCardContent;
}

class SendSimpleCardDto {
  title!: string;
  content!: string;
  headerColor?: FeishuCardHeader['template'];
  buttons?: Array<{ text: string; url: string; type?: 'default' | 'primary' | 'danger' }>;
}

class SendImageDto {
  image_key!: string;
}

class SendShareChatDto {
  share_chat_id!: string;
}

@Controller('feishu')
@UseGuards(JwtAuthGuard)
export class FeishuController {
  constructor(@Inject(FeishuService) private readonly feishuService: FeishuService) {}

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
    if (!dto.msg_type) {
      throw new HttpException('msg_type is required', HttpStatus.BAD_REQUEST);
    }

    if (dto.msg_type === 'interactive' && !dto.card) {
      throw new HttpException(
        'card is required for interactive messages',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.msg_type !== 'interactive' && !dto.content) {
      throw new HttpException(
        'content is required for non-interactive messages',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.feishuService.sendMessage({
        msg_type: dto.msg_type,
        content: dto.content,
        card: dto.card,
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

  @Post('send-rich-text')
  async sendRichText(@Body() dto: SendRichTextDto) {
    if (!dto.post) {
      throw new HttpException('post is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.feishuService.sendRichText(dto.post);
      return {
        success: true,
        message: 'Rich text message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send rich text message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-rich-text-simple')
  async sendRichTextSimple(@Body() dto: SendRichTextSimpleDto) {
    if (!dto.title || !dto.content) {
      throw new HttpException(
        'title and content are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.feishuService.sendRichTextSimple(
        dto.title,
        dto.content,
      );
      return {
        success: true,
        message: 'Rich text message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send rich text message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-card')
  async sendCard(@Body() dto: SendCardDto) {
    if (!dto.card) {
      throw new HttpException('card is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.feishuService.sendCard(dto.card);
      return {
        success: true,
        message: 'Card message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send card message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-simple-card')
  async sendSimpleCard(@Body() dto: SendSimpleCardDto) {
    if (!dto.title || !dto.content) {
      throw new HttpException(
        'title and content are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.feishuService.sendSimpleCard(
        dto.title,
        dto.content,
        {
          headerColor: dto.headerColor,
          buttons: dto.buttons,
        },
      );
      return {
        success: true,
        message: 'Simple card message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send simple card message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-image')
  async sendImage(@Body() dto: SendImageDto) {
    if (!dto.image_key) {
      throw new HttpException('image_key is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.feishuService.sendImage(dto.image_key);
      return {
        success: true,
        message: 'Image message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send image message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-share-chat')
  async sendShareChat(@Body() dto: SendShareChatDto) {
    if (!dto.share_chat_id) {
      throw new HttpException(
        'share_chat_id is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.feishuService.sendShareChat(dto.share_chat_id);
      return {
        success: true,
        message: 'Share chat message sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send share chat message',
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

  @Post('test-card')
  async testCard() {
    try {
      const result = await this.feishuService.sendSimpleCard(
        'Improbix 连接测试',
        `**测试时间**: ${new Date().toISOString()}\n\n这是一条来自 Improbix 的测试卡片消息。`,
        {
          headerColor: 'green',
          buttons: [
            {
              text: '查看更多',
              url: 'https://github.com',
              type: 'primary',
            },
          ],
        },
      );
      return {
        success: true,
        message: 'Test card sent successfully',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Card test failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
