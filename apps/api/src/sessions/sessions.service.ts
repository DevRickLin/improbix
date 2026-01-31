import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SessionsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async createSession(id: string, title?: string) {
    return this.db.createSession(id, title);
  }

  async getAllSessions() {
    return this.db.findAllSessions();
  }

  async getSession(id: string) {
    const session = await this.db.findSessionById(id);
    if (!session) return null;
    const messages = await this.db.findSessionMessages(id);
    return { ...session, messages };
  }

  async updateTitle(id: string, title: string) {
    await this.db.updateSessionTitle(id, title);
    return this.db.findSessionById(id);
  }

  async deleteSession(id: string) {
    await this.db.deleteSession(id);
  }

  async addMessage(sessionId: string, role: string, content: string, parts?: string) {
    await this.db.createMessage(sessionId, role, content, parts);
    await this.db.touchSession(sessionId);
  }
}
