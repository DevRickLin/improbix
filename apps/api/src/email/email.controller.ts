import {
  Controller,
  Inject,
  Post,
  Get,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(@Inject(EmailService) private readonly emailService: EmailService) {}

  @Get('status')
  async getStatus() {
    return {
      configured: this.emailService.isConfigured(),
    };
  }

  @Post('check')
  async checkEmails() {
    if (!this.emailService.isConfigured()) {
      throw new HttpException('Gmail not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      const emails = await this.emailService.getUnreadEmails(5);
      return {
        success: true,
        count: emails.length,
        emails: emails.map((e) => ({
          id: e.id,
          from: e.from,
          subject: e.subject,
          date: e.date,
          snippet: e.snippet,
        })),
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to check emails',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
