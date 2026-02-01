import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, Client, InStatement } from '@libsql/client';

export interface Task {
  id: number;
  name: string;
  cronSchedule: string;
  prompt: string;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  timezone: string | null;
}

export interface TaskExecution {
  id: string;
  taskId: number | null;
  taskName: string;
  prompt: string;
  result: string | null;
  status: 'running' | 'success' | 'error';
  startedAt: Date;
  completedAt: Date | null;
}

export interface Topic {
  id: number;
  name: string;
  prompt: string;
  autoFetchSources: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicSource {
  id: number;
  topicId: number;
  name: string;
  description: string | null;
  url: string;
  createdAt: Date;
}

export interface TopicWithSources extends Topic {
  sources: TopicSource[];
}

export interface AIReport {
  id: string;
  executionId: string | null;
  taskId: number | null;
  title: string | null;
  content: string;
  summary: string | null;
  createdAt: Date;
}

export interface AICollectedLink {
  id: number;
  reportId: string | null;
  executionId: string | null;
  url: string;
  title: string | null;
  description: string | null;
  source: string | null;
  collectedAt: Date;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private client!: Client;
  private readonly logger = new Logger(DatabaseService.name);
  private readonly isVercel = process.env.VERCEL === '1';

  constructor(@Inject(ConfigService) private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
    await this.initializeTables();
  }

  private async connect() {
    const tursoUrl = this.configService.get<string>('TURSO_DATABASE_URL');
    const tursoToken = this.configService.get<string>('TURSO_AUTH_TOKEN');

    try {
      if (tursoUrl) {
        this.logger.log('Connecting to Turso database...');
        this.client = createClient({
          url: tursoUrl,
          authToken: tursoToken,
        });
      } else {
        this.logger.log('Using local SQLite database...');
        this.client = createClient({
          url: 'file:sqlite.db',
        });
      }
    } catch (error: any) {
      throw error;
    }
  }

  private async initializeTables() {
    await this.client.batch([
      `CREATE TABLE IF NOT EXISTS task (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        cronSchedule VARCHAR(255) NOT NULL,
        prompt TEXT NOT NULL,
        isActive BOOLEAN DEFAULT 1,
        lastRunAt DATETIME,
        nextRunAt DATETIME,
        timezone VARCHAR(100)
      )`,
      `CREATE TABLE IF NOT EXISTS task_execution (
        id VARCHAR(36) PRIMARY KEY,
        taskId INTEGER,
        taskName VARCHAR(255) NOT NULL,
        prompt TEXT NOT NULL,
        result TEXT,
        status VARCHAR(50) DEFAULT 'running',
        startedAt DATETIME NOT NULL,
        completedAt DATETIME
      )`,
      // Topic tables
      `CREATE TABLE IF NOT EXISTS topic (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        prompt TEXT NOT NULL,
        autoFetchSources BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS topic_source (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topicId INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        url VARCHAR(1000) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topicId) REFERENCES topic(id) ON DELETE CASCADE
      )`,
      // Task-Topic association table
      `CREATE TABLE IF NOT EXISTS task_topic (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId INTEGER NOT NULL,
        topicId INTEGER NOT NULL,
        FOREIGN KEY (taskId) REFERENCES task(id) ON DELETE CASCADE,
        FOREIGN KEY (topicId) REFERENCES topic(id) ON DELETE CASCADE,
        UNIQUE(taskId, topicId)
      )`,
      // AI Report tables
      `CREATE TABLE IF NOT EXISTS ai_report (
        id VARCHAR(36) PRIMARY KEY,
        executionId VARCHAR(36),
        taskId INTEGER,
        title VARCHAR(500),
        content TEXT NOT NULL,
        summary TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (executionId) REFERENCES task_execution(id) ON DELETE SET NULL,
        FOREIGN KEY (taskId) REFERENCES task(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ai_collected_link (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reportId VARCHAR(36),
        executionId VARCHAR(36),
        url VARCHAR(2000) NOT NULL,
        title VARCHAR(500),
        description TEXT,
        source VARCHAR(255),
        collectedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reportId) REFERENCES ai_report(id) ON DELETE CASCADE
      )`,
      // Chat tables (ai-chatbot architecture)
      `CREATE TABLE IF NOT EXISTS chat (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS message (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        role TEXT NOT NULL,
        parts TEXT NOT NULL,
        attachments TEXT DEFAULT '[]',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chatId) REFERENCES chat(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS stream (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chatId) REFERENCES chat(id) ON DELETE CASCADE
      )`,
      // Email check state table
      `CREATE TABLE IF NOT EXISTS email_check_state (
        id TEXT PRIMARY KEY DEFAULT 'default',
        lastCheckAt TEXT NOT NULL,
        lastMessageId TEXT
      )`,
      // Indexes for better query performance
      `CREATE INDEX IF NOT EXISTS idx_ai_report_createdAt ON ai_report(createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_collected_link_collectedAt ON ai_collected_link(collectedAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_topic_source_topicId ON topic_source(topicId)`,
      `CREATE INDEX IF NOT EXISTS idx_task_topic_taskId ON task_topic(taskId)`,
      `CREATE INDEX IF NOT EXISTS idx_task_topic_topicId ON task_topic(topicId)`,
    ]);
    this.logger.log('Database tables initialized');
  }

  async execute(sql: InStatement) {
    return this.client.execute(sql);
  }

  // Task operations
  async findAllTasks(where?: { isActive?: boolean; nextRunAtLessThan?: Date }): Promise<Task[]> {
    let sql = 'SELECT * FROM task WHERE 1=1';
    const args: any[] = [];

    if (where?.isActive !== undefined) {
      sql += ' AND isActive = ?';
      args.push(where.isActive ? 1 : 0);
    }

    if (where?.nextRunAtLessThan) {
      sql += ' AND nextRunAt IS NOT NULL AND nextRunAt <= ?';
      args.push(where.nextRunAtLessThan.getTime());
    }

    sql += ' ORDER BY id DESC';

    const result = await this.client.execute({ sql, args });
    return result.rows.map((row) => this.rowToTask(row));
  }

  async findTasksWithNullNextRun(): Promise<Task[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM task WHERE isActive = 1 AND nextRunAt IS NULL',
      args: [],
    });
    return result.rows.map((row) => this.rowToTask(row));
  }

  async findTasksNeedingNextRunUpdate(now: Date): Promise<Task[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM task
            WHERE isActive = 1
            AND (nextRunAt IS NULL OR nextRunAt <= ?)`,
      args: [now.getTime()],
    });
    return result.rows.map((row) => this.rowToTask(row));
  }

  async findTaskById(id: number): Promise<Task | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM task WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.rowToTask(result.rows[0]);
  }

  async createTask(data: {
    name: string;
    cronSchedule: string;
    prompt: string;
    timezone?: string | null;
    nextRunAt?: Date;
  }): Promise<Task> {
    const result = await this.client.execute({
      sql: `INSERT INTO task (name, cronSchedule, prompt, timezone, nextRunAt, isActive)
            VALUES (?, ?, ?, ?, ?, 1)`,
      args: [
        data.name,
        data.cronSchedule,
        data.prompt,
        data.timezone || null,
        data.nextRunAt?.getTime() || null,
      ],
    });

    const id = Number(result.lastInsertRowid);
    return (await this.findTaskById(id))!;
  }

  async updateTask(
    id: number,
    data: Partial<Pick<Task, 'name' | 'cronSchedule' | 'prompt' | 'isActive' | 'timezone' | 'nextRunAt' | 'lastRunAt'>>,
  ): Promise<void> {
    const updates: string[] = [];
    const args: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      args.push(data.name);
    }
    if (data.cronSchedule !== undefined) {
      updates.push('cronSchedule = ?');
      args.push(data.cronSchedule);
    }
    if (data.prompt !== undefined) {
      updates.push('prompt = ?');
      args.push(data.prompt);
    }
    if (data.isActive !== undefined) {
      updates.push('isActive = ?');
      args.push(data.isActive ? 1 : 0);
    }
    if (data.timezone !== undefined) {
      updates.push('timezone = ?');
      args.push(data.timezone);
    }
    if (data.nextRunAt !== undefined) {
      updates.push('nextRunAt = ?');
      args.push(data.nextRunAt?.getTime() || null);
    }
    if (data.lastRunAt !== undefined) {
      updates.push('lastRunAt = ?');
      args.push(data.lastRunAt?.getTime() || null);
    }

    if (updates.length === 0) return;

    args.push(id);
    await this.client.execute({
      sql: `UPDATE task SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });
  }

  async deleteTask(id: number): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM task WHERE id = ?',
      args: [id],
    });
  }

  // TaskExecution operations
  async createExecution(data: {
    id: string;
    taskId: number | null;
    taskName: string;
    prompt: string;
    startedAt: Date;
  }): Promise<TaskExecution> {
    await this.client.execute({
      sql: `INSERT INTO task_execution (id, taskId, taskName, prompt, status, startedAt)
            VALUES (?, ?, ?, ?, 'running', ?)`,
      args: [data.id, data.taskId, data.taskName, data.prompt, data.startedAt.toISOString()],
    });

    return (await this.findExecutionById(data.id))!;
  }

  async findExecutionById(id: string): Promise<TaskExecution | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM task_execution WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.rowToExecution(result.rows[0]);
  }

  async updateExecution(
    id: string,
    data: Partial<Pick<TaskExecution, 'status' | 'result' | 'completedAt'>>,
  ): Promise<void> {
    const updates: string[] = [];
    const args: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      args.push(data.status);
    }
    if (data.result !== undefined) {
      updates.push('result = ?');
      args.push(data.result);
    }
    if (data.completedAt !== undefined) {
      updates.push('completedAt = ?');
      args.push(data.completedAt?.toISOString() || null);
    }

    if (updates.length === 0) return;

    args.push(id);
    await this.client.execute({
      sql: `UPDATE task_execution SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });
  }

  async findExecutions(options: {
    taskId?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ data: TaskExecution[]; total: number }> {
    let sql = 'SELECT * FROM task_execution WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM task_execution WHERE 1=1';
    const args: any[] = [];
    const countArgs: any[] = [];

    if (options.taskId !== undefined) {
      sql += ' AND taskId = ?';
      countSql += ' AND taskId = ?';
      args.push(options.taskId);
      countArgs.push(options.taskId);
    }

    sql += ' ORDER BY startedAt DESC';
    sql += ` LIMIT ${options.limit || 20} OFFSET ${options.offset || 0}`;

    const [dataResult, countResult] = await Promise.all([
      this.client.execute({ sql, args }),
      this.client.execute({ sql: countSql, args: countArgs }),
    ]);

    return {
      data: dataResult.rows.map((row) => this.rowToExecution(row)),
      total: Number(countResult.rows[0].count),
    };
  }

  /**
   * Parse date from database value (supports both ISO string and Unix timestamp)
   */
  private parseDate(value: any): Date | null {
    if (!value) return null;
    const num = Number(value);
    // If it's a valid number and looks like a millisecond timestamp (> year 2001)
    if (!isNaN(num) && num > 1000000000000) {
      return new Date(num);
    }
    // Otherwise treat as ISO string
    return new Date(String(value));
  }

  private rowToTask(row: any): Task {
    return {
      id: Number(row.id),
      name: String(row.name),
      cronSchedule: String(row.cronSchedule),
      prompt: String(row.prompt),
      isActive: Boolean(row.isActive),
      lastRunAt: this.parseDate(row.lastRunAt),
      nextRunAt: this.parseDate(row.nextRunAt),
      timezone: row.timezone ? String(row.timezone) : null,
    };
  }

  private rowToExecution(row: any): TaskExecution {
    return {
      id: String(row.id),
      taskId: row.taskId ? Number(row.taskId) : null,
      taskName: String(row.taskName),
      prompt: String(row.prompt),
      result: row.result ? String(row.result) : null,
      status: row.status as 'running' | 'success' | 'error',
      startedAt: new Date(String(row.startedAt)),
      completedAt: row.completedAt ? new Date(String(row.completedAt)) : null,
    };
  }

  // ==================== Topic Operations ====================

  async createTopic(data: {
    name: string;
    prompt: string;
    autoFetchSources?: boolean;
  }): Promise<Topic> {
    const now = new Date().toISOString();
    const result = await this.client.execute({
      sql: `INSERT INTO topic (name, prompt, autoFetchSources, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?)`,
      args: [data.name, data.prompt, data.autoFetchSources ? 1 : 0, now, now],
    });
    const id = Number(result.lastInsertRowid);
    return (await this.findTopicById(id))!;
  }

  async findAllTopics(): Promise<Topic[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM topic ORDER BY id DESC',
      args: [],
    });
    return result.rows.map((row) => this.rowToTopic(row));
  }

  async findTopicById(id: number): Promise<Topic | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM topic WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.rowToTopic(result.rows[0]);
  }

  async findTopicWithSources(id: number): Promise<TopicWithSources | null> {
    const topic = await this.findTopicById(id);
    if (!topic) return null;
    const sources = await this.findTopicSources(id);
    return { ...topic, sources };
  }

  async findAllTopicsWithSources(): Promise<TopicWithSources[]> {
    const topics = await this.findAllTopics();
    const result: TopicWithSources[] = [];
    for (const topic of topics) {
      const sources = await this.findTopicSources(topic.id);
      result.push({ ...topic, sources });
    }
    return result;
  }

  async updateTopic(
    id: number,
    data: Partial<Pick<Topic, 'name' | 'prompt' | 'autoFetchSources'>>,
  ): Promise<void> {
    const updates: string[] = [];
    const args: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      args.push(data.name);
    }
    if (data.prompt !== undefined) {
      updates.push('prompt = ?');
      args.push(data.prompt);
    }
    if (data.autoFetchSources !== undefined) {
      updates.push('autoFetchSources = ?');
      args.push(data.autoFetchSources ? 1 : 0);
    }

    if (updates.length === 0) return;

    updates.push('updatedAt = ?');
    args.push(new Date().toISOString());
    args.push(id);

    await this.client.execute({
      sql: `UPDATE topic SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });
  }

  async deleteTopic(id: number): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM topic WHERE id = ?',
      args: [id],
    });
  }

  private rowToTopic(row: any): Topic {
    return {
      id: Number(row.id),
      name: String(row.name),
      prompt: String(row.prompt),
      autoFetchSources: Boolean(row.autoFetchSources),
      createdAt: new Date(String(row.createdAt)),
      updatedAt: new Date(String(row.updatedAt)),
    };
  }

  // ==================== TopicSource Operations ====================

  async createTopicSource(data: {
    topicId: number;
    name: string;
    description?: string | null;
    url: string;
  }): Promise<TopicSource> {
    const result = await this.client.execute({
      sql: `INSERT INTO topic_source (topicId, name, description, url, createdAt)
            VALUES (?, ?, ?, ?, ?)`,
      args: [data.topicId, data.name, data.description || null, data.url, new Date().toISOString()],
    });
    const id = Number(result.lastInsertRowid);
    return (await this.findTopicSourceById(id))!;
  }

  async findTopicSources(topicId: number): Promise<TopicSource[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM topic_source WHERE topicId = ? ORDER BY id ASC',
      args: [topicId],
    });
    return result.rows.map((row) => this.rowToTopicSource(row));
  }

  async findTopicSourceById(id: number): Promise<TopicSource | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM topic_source WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.rowToTopicSource(result.rows[0]);
  }

  async updateTopicSource(
    id: number,
    data: Partial<Pick<TopicSource, 'name' | 'description' | 'url'>>,
  ): Promise<void> {
    const updates: string[] = [];
    const args: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      args.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      args.push(data.description);
    }
    if (data.url !== undefined) {
      updates.push('url = ?');
      args.push(data.url);
    }

    if (updates.length === 0) return;

    args.push(id);
    await this.client.execute({
      sql: `UPDATE topic_source SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });
  }

  async deleteTopicSource(id: number): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM topic_source WHERE id = ?',
      args: [id],
    });
  }

  private rowToTopicSource(row: any): TopicSource {
    return {
      id: Number(row.id),
      topicId: Number(row.topicId),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      url: String(row.url),
      createdAt: new Date(String(row.createdAt)),
    };
  }

  // ==================== Task-Topic Association Operations ====================

  async setTaskTopics(taskId: number, topicIds: number[]): Promise<void> {
    // Delete existing associations
    await this.client.execute({
      sql: 'DELETE FROM task_topic WHERE taskId = ?',
      args: [taskId],
    });

    // Insert new associations
    for (const topicId of topicIds) {
      await this.client.execute({
        sql: 'INSERT INTO task_topic (taskId, topicId) VALUES (?, ?)',
        args: [taskId, topicId],
      });
    }
  }

  async findTaskTopicIds(taskId: number): Promise<number[]> {
    const result = await this.client.execute({
      sql: 'SELECT topicId FROM task_topic WHERE taskId = ?',
      args: [taskId],
    });
    return result.rows.map((row) => Number(row.topicId));
  }

  async findTaskTopics(taskId: number): Promise<TopicWithSources[]> {
    const topicIds = await this.findTaskTopicIds(taskId);
    const topics: TopicWithSources[] = [];
    for (const topicId of topicIds) {
      const topic = await this.findTopicWithSources(topicId);
      if (topic) topics.push(topic);
    }
    return topics;
  }

  async addTaskTopic(taskId: number, topicId: number): Promise<void> {
    await this.client.execute({
      sql: 'INSERT OR IGNORE INTO task_topic (taskId, topicId) VALUES (?, ?)',
      args: [taskId, topicId],
    });
  }

  async removeTaskTopic(taskId: number, topicId: number): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM task_topic WHERE taskId = ? AND topicId = ?',
      args: [taskId, topicId],
    });
  }

  // ==================== AI Report Operations ====================

  async createReport(data: {
    id: string;
    executionId?: string | null;
    taskId?: number | null;
    title?: string | null;
    content: string;
    summary?: string | null;
  }): Promise<AIReport> {
    await this.client.execute({
      sql: `INSERT INTO ai_report (id, executionId, taskId, title, content, summary, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.id,
        data.executionId || null,
        data.taskId || null,
        data.title || null,
        data.content,
        data.summary || null,
        new Date().toISOString(),
      ],
    });
    return (await this.findReportById(data.id))!;
  }

  async findReportById(id: string): Promise<AIReport | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM ai_report WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.rowToReport(result.rows[0]);
  }

  async findReports(options: {
    search?: string;
    taskId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AIReport[]; total: number }> {
    let sql = 'SELECT * FROM ai_report WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM ai_report WHERE 1=1';
    const args: any[] = [];
    const countArgs: any[] = [];

    if (options.search) {
      const searchPattern = `%${options.search}%`;
      sql += ' AND (title LIKE ? OR content LIKE ? OR summary LIKE ?)';
      countSql += ' AND (title LIKE ? OR content LIKE ? OR summary LIKE ?)';
      args.push(searchPattern, searchPattern, searchPattern);
      countArgs.push(searchPattern, searchPattern, searchPattern);
    }

    if (options.taskId !== undefined) {
      sql += ' AND taskId = ?';
      countSql += ' AND taskId = ?';
      args.push(options.taskId);
      countArgs.push(options.taskId);
    }

    if (options.startDate) {
      sql += ' AND createdAt >= ?';
      countSql += ' AND createdAt >= ?';
      args.push(options.startDate.toISOString());
      countArgs.push(options.startDate.toISOString());
    }

    if (options.endDate) {
      sql += ' AND createdAt <= ?';
      countSql += ' AND createdAt <= ?';
      args.push(options.endDate.toISOString());
      countArgs.push(options.endDate.toISOString());
    }

    sql += ' ORDER BY createdAt DESC';
    sql += ` LIMIT ${options.limit || 20} OFFSET ${options.offset || 0}`;

    const [dataResult, countResult] = await Promise.all([
      this.client.execute({ sql, args }),
      this.client.execute({ sql: countSql, args: countArgs }),
    ]);

    return {
      data: dataResult.rows.map((row) => this.rowToReport(row)),
      total: Number(countResult.rows[0].count),
    };
  }

  async deleteReport(id: string): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM ai_report WHERE id = ?',
      args: [id],
    });
  }

  async deleteOldReports(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.client.execute({
      sql: 'DELETE FROM ai_report WHERE createdAt < ?',
      args: [cutoffDate.toISOString()],
    });
    return Number(result.rowsAffected);
  }

  private rowToReport(row: any): AIReport {
    return {
      id: String(row.id),
      executionId: row.executionId ? String(row.executionId) : null,
      taskId: row.taskId ? Number(row.taskId) : null,
      title: row.title ? String(row.title) : null,
      content: String(row.content),
      summary: row.summary ? String(row.summary) : null,
      createdAt: new Date(String(row.createdAt)),
    };
  }

  // ==================== AI Collected Link Operations ====================

  async createCollectedLink(data: {
    reportId?: string | null;
    executionId?: string | null;
    url: string;
    title?: string | null;
    description?: string | null;
    source?: string | null;
  }): Promise<AICollectedLink> {
    const result = await this.client.execute({
      sql: `INSERT INTO ai_collected_link (reportId, executionId, url, title, description, source, collectedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.reportId || null,
        data.executionId || null,
        data.url,
        data.title || null,
        data.description || null,
        data.source || null,
        new Date().toISOString(),
      ],
    });
    const id = Number(result.lastInsertRowid);
    return (await this.findCollectedLinkById(id))!;
  }

  async findCollectedLinkById(id: number): Promise<AICollectedLink | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM ai_collected_link WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return this.rowToCollectedLink(result.rows[0]);
  }

  async findCollectedLinks(options: {
    reportId?: string;
    executionId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AICollectedLink[]; total: number }> {
    let sql = 'SELECT * FROM ai_collected_link WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM ai_collected_link WHERE 1=1';
    const args: any[] = [];
    const countArgs: any[] = [];

    if (options.reportId) {
      sql += ' AND reportId = ?';
      countSql += ' AND reportId = ?';
      args.push(options.reportId);
      countArgs.push(options.reportId);
    }

    if (options.executionId) {
      sql += ' AND executionId = ?';
      countSql += ' AND executionId = ?';
      args.push(options.executionId);
      countArgs.push(options.executionId);
    }

    if (options.search) {
      const searchPattern = `%${options.search}%`;
      sql += ' AND (url LIKE ? OR title LIKE ? OR description LIKE ? OR source LIKE ?)';
      countSql += ' AND (url LIKE ? OR title LIKE ? OR description LIKE ? OR source LIKE ?)';
      args.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countArgs.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY collectedAt DESC';
    sql += ` LIMIT ${options.limit || 20} OFFSET ${options.offset || 0}`;

    const [dataResult, countResult] = await Promise.all([
      this.client.execute({ sql, args }),
      this.client.execute({ sql: countSql, args: countArgs }),
    ]);

    return {
      data: dataResult.rows.map((row) => this.rowToCollectedLink(row)),
      total: Number(countResult.rows[0].count),
    };
  }

  async findLinksByReportId(reportId: string): Promise<AICollectedLink[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM ai_collected_link WHERE reportId = ? ORDER BY collectedAt DESC',
      args: [reportId],
    });
    return result.rows.map((row) => this.rowToCollectedLink(row));
  }

  async deleteOldCollectedLinks(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.client.execute({
      sql: 'DELETE FROM ai_collected_link WHERE collectedAt < ?',
      args: [cutoffDate.toISOString()],
    });
    return Number(result.rowsAffected);
  }

  // ==================== Chat Operations (ai-chatbot architecture) ====================

  async saveChat({ id, title }: { id: string; title: string }): Promise<{ id: string; title: string; createdAt: string }> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: 'INSERT OR IGNORE INTO chat (id, title, createdAt) VALUES (?, ?, ?)',
      args: [id, title, now],
    });
    return { id, title, createdAt: now };
  }

  async getChatById(id: string): Promise<{ id: string; title: string; createdAt: string } | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM chat WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: String(row.id),
      title: String(row.title),
      createdAt: String(row.createdAt),
    };
  }

  async getAllChats(): Promise<Array<{ id: string; title: string; createdAt: string }>> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM chat ORDER BY createdAt DESC',
      args: [],
    });
    return result.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      createdAt: String(row.createdAt),
    }));
  }

  async updateChatTitle(id: string, title: string): Promise<void> {
    await this.client.execute({
      sql: 'UPDATE chat SET title = ? WHERE id = ?',
      args: [title, id],
    });
  }

  async deleteChat(id: string): Promise<void> {
    await this.client.execute({ sql: 'DELETE FROM chat WHERE id = ?', args: [id] });
  }

  async saveMessages(messages: Array<{
    id: string;
    chatId: string;
    role: string;
    parts: unknown;
    attachments?: unknown;
    createdAt?: string;
  }>): Promise<void> {
    if (messages.length === 0) return;
    const stmts = messages.map((m) => ({
      sql: 'INSERT OR IGNORE INTO message (id, chatId, role, parts, attachments, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      args: [
        m.id,
        m.chatId,
        m.role,
        JSON.stringify(m.parts),
        JSON.stringify(m.attachments || []),
        m.createdAt || new Date().toISOString(),
      ],
    }));
    await this.client.batch(stmts);
  }

  async getMessagesByChatId(chatId: string): Promise<Array<{
    id: string;
    chatId: string;
    role: string;
    parts: unknown[];
    attachments: unknown[];
    createdAt: string;
  }>> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM message WHERE chatId = ? ORDER BY createdAt ASC',
      args: [chatId],
    });
    return result.rows.map((row) => ({
      id: String(row.id),
      chatId: String(row.chatId),
      role: String(row.role),
      parts: JSON.parse(String(row.parts)),
      attachments: JSON.parse(String(row.attachments || '[]')),
      createdAt: String(row.createdAt),
    }));
  }

  async createStreamId(streamId: string, chatId: string): Promise<void> {
    await this.client.execute({
      sql: 'INSERT INTO stream (id, chatId, createdAt) VALUES (?, ?, ?)',
      args: [streamId, chatId, new Date().toISOString()],
    });
  }

  async getStreamIdsByChatId(chatId: string): Promise<string[]> {
    const result = await this.client.execute({
      sql: 'SELECT id FROM stream WHERE chatId = ? ORDER BY createdAt ASC',
      args: [chatId],
    });
    return result.rows.map((row) => String(row.id));
  }

  async deleteStreamId(streamId: string): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM stream WHERE id = ?',
      args: [streamId],
    });
  }

  // ==================== Email Check State Operations ====================

  async getEmailCheckState(): Promise<{ lastCheckAt: string; lastMessageId: string | null } | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM email_check_state WHERE id = 'default'",
      args: [],
    });
    if (result.rows.length === 0) return null;
    return {
      lastCheckAt: String(result.rows[0].lastCheckAt),
      lastMessageId: result.rows[0].lastMessageId ? String(result.rows[0].lastMessageId) : null,
    };
  }

  async upsertEmailCheckState(lastCheckAt: string, lastMessageId?: string | null): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO email_check_state (id, lastCheckAt, lastMessageId)
            VALUES ('default', ?, ?)
            ON CONFLICT(id) DO UPDATE SET lastCheckAt = ?, lastMessageId = ?`,
      args: [lastCheckAt, lastMessageId || null, lastCheckAt, lastMessageId || null],
    });
  }

  private rowToCollectedLink(row: any): AICollectedLink {
    return {
      id: Number(row.id),
      reportId: row.reportId ? String(row.reportId) : null,
      executionId: row.executionId ? String(row.executionId) : null,
      url: String(row.url),
      title: row.title ? String(row.title) : null,
      description: row.description ? String(row.description) : null,
      source: row.source ? String(row.source) : null,
      collectedAt: new Date(String(row.collectedAt)),
    };
  }
}
