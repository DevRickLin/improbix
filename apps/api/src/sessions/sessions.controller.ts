import {
  Controller,
  Inject,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(@Inject(SessionsService) private readonly sessionsService: SessionsService) {}

  @Get()
  async list() {
    return this.sessionsService.getAllSessions();
  }

  @Post()
  async create(@Body() body: { id: string; title?: string }) {
    if (!body.id) {
      throw new HttpException('id is required', HttpStatus.BAD_REQUEST);
    }
    return this.sessionsService.createSession(body.id, body.title);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const session = await this.sessionsService.getSession(id);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return session;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { title: string }) {
    if (!body.title) {
      throw new HttpException('title is required', HttpStatus.BAD_REQUEST);
    }
    return this.sessionsService.updateTitle(id, body.title);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.sessionsService.deleteSession(id);
    return { success: true };
  }

  @Post(':id/messages')
  async addMessage(@Param('id') id: string, @Body() body: { role: string; content: string; parts?: string }) {
    if (!body.role || !body.content) {
      throw new HttpException('role and content are required', HttpStatus.BAD_REQUEST);
    }
    await this.sessionsService.addMessage(id, body.role, body.content, body.parts);
    return { success: true };
  }
}
