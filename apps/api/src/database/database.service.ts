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

    if (this.isVercel && tursoUrl) {
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
      sql += ' AND nextRunAt <= ?';
      args.push(where.nextRunAtLessThan.toISOString());
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
        data.nextRunAt?.toISOString() || null,
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
      args.push(data.nextRunAt?.toISOString() || null);
    }
    if (data.lastRunAt !== undefined) {
      updates.push('lastRunAt = ?');
      args.push(data.lastRunAt?.toISOString() || null);
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

  private rowToTask(row: any): Task {
    return {
      id: Number(row.id),
      name: String(row.name),
      cronSchedule: String(row.cronSchedule),
      prompt: String(row.prompt),
      isActive: Boolean(row.isActive),
      lastRunAt: row.lastRunAt ? new Date(String(row.lastRunAt)) : null,
      nextRunAt: row.nextRunAt ? new Date(String(row.nextRunAt)) : null,
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
}
