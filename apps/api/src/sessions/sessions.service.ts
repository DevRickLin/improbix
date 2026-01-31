import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SessionsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async createSession(id: string, title?: string) {
    return this.db.saveChat({ id, title: title || 'New Chat' });
  }

  async getAllSessions() {
    return this.db.getAllChats();
  }

  async getSession(id: string) {
    const chat = await this.db.getChatById(id);
    if (!chat) return null;
    const messages = await this.db.getMessagesByChatId(id);
    return { ...chat, messages };
  }

  async updateTitle(id: string, title: string) {
    await this.db.updateChatTitle(id, title);
    return this.db.getChatById(id);
  }

  async deleteSession(id: string) {
    await this.db.deleteChat(id);
  }
}
