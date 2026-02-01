import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CronExpressionParser } from 'cron-parser';
import { DatabaseService, Task, TaskExecution, TopicWithSources } from '../database/database.service';
import { AgentService } from '../agent/agent.service';
import { ReportsService } from '../reports/reports.service';
import { EmailService } from '../email/email.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);
  private readonly isVercel = process.env.VERCEL === '1';

  constructor(
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject(SchedulerRegistry) private schedulerRegistry: SchedulerRegistry,
    @Inject(AgentService) private agentService: AgentService,
    @Inject(ReportsService) private reportsService: ReportsService,
    @Inject(EmailService) private emailService: EmailService,
  ) {}

  async onModuleInit() {
    // Only use in-memory scheduling for local development
    if (!this.isVercel) {
      await this.loadLocalScheduler();
    }
  }

  /**
   * Initialize nextRunAt for tasks where it is NULL.
   * Only fixes missing schedules — does not advance expired ones.
   */
  async initializeNextRunTimes(): Promise<{ updated: number; total: number }> {
    const allActiveTasks = await this.db.findAllTasks({ isActive: true });

    // Only fix tasks with NULL nextRunAt
    const tasksNeedingUpdate = allActiveTasks.filter((task) => !task.nextRunAt);

    this.logger.log(
      `[init] Found ${tasksNeedingUpdate.length} tasks with NULL nextRunAt (out of ${allActiveTasks.length} active)`,
    );

    for (const task of tasksNeedingUpdate) {
      try {
        const nextRun = this.calculateNextRunTime(task.cronSchedule, task.timezone);
        await this.db.updateTask(task.id, { nextRunAt: nextRun });
        this.logger.log(`[init] task=${task.id} nextRunAt=${nextRun.toISOString()}`);
      } catch (e) {
        this.logger.warn(`[init] task=${task.id} failed to compute nextRunAt`, e);
      }
    }

    return { updated: tasksNeedingUpdate.length, total: allActiveTasks.length };
  }

  /**
   * Local development: use in-memory cron scheduling
   */
  private async loadLocalScheduler() {
    const tasks = await this.db.findAllTasks({ isActive: true });
    tasks.forEach((task) => this.scheduleLocalTask(task));
    this.logger.log(`[Local] Loaded ${tasks.length} tasks.`);
  }

  private scheduleLocalTask(task: Task) {
    const jobName = `task-${task.id}`;

    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
    }

    const job = CronJob.from({
      cronTime: task.cronSchedule,
      onTick: async () => {
        this.logger.log(`[local] task=${task.id} name="${task.name}" status=started`);
        try {
          const execution = await this.startExecution(task);
          await this.executeTaskAsync(task, execution.id);
          await this.db.updateTask(task.id, { lastRunAt: new Date() });
        } catch (e) {
          this.logger.error(`[local] task=${task.id} name="${task.name}" status=error`, e);
        }
      },
      timeZone: task.timezone || 'UTC',
    });

    this.schedulerRegistry.addCronJob(jobName, job as any);
    job.start();
  }

  /**
   * Core method: Called by Vercel Cron every minute
   * Checks and executes all due tasks
   */
  private static readonly COMPENSATION_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

  async processCronTick(): Promise<{
    executedCount: number;
    tasks: Array<{ id: number; name: string; status: string; executionId?: string; error?: string }>;
    cleanup?: { reportsDeleted: number; linksDeleted: number };
  }> {
    const now = new Date();
    const nowTs = now.getTime();
    this.logger.log(`[cron] tick at=${now.toISOString()}`);

    // Debug: log all active tasks
    const allActive = await this.db.findAllTasks({ isActive: true });
    this.logger.debug(`[cron] active_tasks=${allActive.length}`);
    for (const t of allActive) {
      const nextRunTs = t.nextRunAt?.getTime() || null;
      const isDue = nextRunTs !== null && nextRunTs <= nowTs;
      this.logger.debug(
        `[cron] task=${t.id} name="${t.name}" cron=${t.cronSchedule} tz=${t.timezone || 'UTC'} nextRunAt=${t.nextRunAt?.toISOString() || 'NULL'} isDue=${isDue}`,
      );
    }

    // Find tasks where nextRunAt <= now and isActive = true
    const dueTasks = await this.db.findAllTasks({
      isActive: true,
      nextRunAtLessThan: now,
    });

    this.logger.log(`[cron] due_tasks=${dueTasks.length}`);

    const results: Array<{ id: number; name: string; status: string; executionId?: string; error?: string }> = [];

    for (const task of dueTasks) {
      const overdueMs = task.nextRunAt ? nowTs - task.nextRunAt.getTime() : 0;

      // Compensation: skip execution for tasks overdue beyond the window
      if (overdueMs > TasksService.COMPENSATION_WINDOW_MS) {
        this.logger.warn(
          `[cron] task=${task.id} name="${task.name}" overdueMs=${overdueMs} status=skipped (beyond ${TasksService.COMPENSATION_WINDOW_MS}ms window)`,
        );
        await this.updateNextRunTime(task);
        results.push({ id: task.id, name: task.name, status: 'skipped' });
        continue;
      }

      try {
        const execution = await this.startExecution(task);

        this.logger.log(
          `[cron] task=${task.id} executionId=${execution.id} cron=${task.cronSchedule} tz=${task.timezone || 'UTC'} nextRunAt=${task.nextRunAt?.toISOString()} overdueMs=${overdueMs} status=started`,
        );

        // Execute task asynchronously (don't await completion)
        this.executeTaskAsync(task, execution.id).catch((err) => {
          this.logger.error(`[cron] task=${task.id} executionId=${execution.id} status=async_error`, err);
        });

        // Update nextRunAt for next execution
        await this.updateNextRunTime(task);

        results.push({
          id: task.id,
          name: task.name,
          status: 'started',
          executionId: execution.id,
        });
      } catch (error: any) {
        this.logger.error(`[cron] task=${task.id} status=error error=${error.message}`);
        results.push({
          id: task.id,
          name: task.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    // Cleanup old data once a day (at midnight hour)
    let cleanup: { reportsDeleted: number; linksDeleted: number } | undefined;
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour === 0 && minute === 0) {
      try {
        cleanup = await this.reportsService.cleanupOldData(90); // Keep 90 days
        this.logger.log(`Cleanup completed: ${cleanup.reportsDeleted} reports, ${cleanup.linksDeleted} links deleted`);
      } catch (error: any) {
        this.logger.error('Failed to cleanup old data', error);
      }
    }

    // Check for new emails and trigger agent
    await this.processInboundEmails();

    return {
      executedCount: results.filter((r) => r.status === 'started').length,
      tasks: results,
      cleanup,
    };
  }

  /**
   * Check for new unread emails and trigger agent for each
   */
  private async processInboundEmails(): Promise<void> {
    if (!this.emailService.isConfigured()) return;

    try {
      const state = await this.db.getEmailCheckState();
      const lastCheckAt = state?.lastCheckAt || new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const emails = await this.emailService.getNewEmailsSince(lastCheckAt);
      if (emails.length === 0) return;

      this.logger.log(`Found ${emails.length} new emails to process`);

      for (const email of emails) {
        const executionId = randomUUID();
        const taskName = `Email: ${email.subject}`;
        const prompt = `You received a new email. Please read it, understand what is being asked, and take appropriate action (reply, research, save information, etc.).\n\n**From**: ${email.from}\n**Subject**: ${email.subject}\n**Date**: ${email.date}\n**Message ID**: ${email.id}\n\n**Body**:\n${email.body}`;

        await this.db.createExecution({
          id: executionId,
          taskId: null,
          taskName,
          prompt,
          startedAt: new Date(),
        });

        // Execute asynchronously
        this.executeEmailTask(executionId, prompt, email.id).catch((err) => {
          this.logger.error(`Email task execution failed for ${email.id}`, err);
        });
      }

      // Update check state
      await this.db.upsertEmailCheckState(new Date().toISOString(), emails[0]?.id);
    } catch (error: any) {
      this.logger.error('Failed to process inbound emails', error);
    }
  }

  private async executeEmailTask(executionId: string, prompt: string, emailId: string): Promise<void> {
    try {
      const result = await this.agentService.runAgent(prompt, { executionId });
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);

      await this.db.updateExecution(executionId, {
        status: 'success',
        result: resultStr,
        completedAt: new Date(),
      });

      this.logger.log(`Email task for ${emailId} completed successfully`);
    } catch (error: any) {
      this.logger.error(`Email task for ${emailId} failed`, error);
      await this.db.updateExecution(executionId, {
        status: 'error',
        result: error.message,
        completedAt: new Date(),
      });
    }
  }

  /**
   * Calculate next run time from cron expression
   */
  private calculateNextRunTime(cronSchedule: string, timezone?: string | null): Date {
    try {
      const interval = CronExpressionParser.parse(cronSchedule, {
        tz: timezone || 'UTC',
      });
      const nextRun = interval.next().toDate();
      return nextRun;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Update task's nextRunAt and lastRunAt
   */
  private async updateNextRunTime(task: Task): Promise<void> {
    try {
      const nextRun = this.calculateNextRunTime(task.cronSchedule, task.timezone);
      await this.db.updateTask(task.id, {
        nextRunAt: nextRun,
        lastRunAt: new Date(),
      });
      this.logger.log(`Updated task ${task.id} nextRunAt: ${nextRun}`);
    } catch (e) {
      this.logger.error(`Failed to calculate next run time for task ${task.id}`, e);
    }
  }

  /**
   * Create execution record
   */
  private async startExecution(task: Task): Promise<TaskExecution> {
    return this.db.createExecution({
      id: randomUUID(),
      taskId: task.id,
      taskName: task.name,
      prompt: task.prompt,
      startedAt: new Date(),
    });
  }

  /**
   * Execute task asynchronously
   */
  private async executeTaskAsync(task: Task, executionId: string): Promise<void> {
    const startMs = Date.now();
    try {
      this.logger.log(`[exec] task=${task.id} executionId=${executionId} status=running`);

      const topics = await this.db.findTaskTopics(task.id);

      const result = await this.agentService.runAgent(task.prompt, {
        topicsContext: topics,
        executionId,
        taskId: task.id,
      });

      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      const durationMs = Date.now() - startMs;

      await this.db.updateExecution(executionId, {
        status: 'success',
        result: resultStr,
        completedAt: new Date(),
      });

      this.logger.log(`[exec] task=${task.id} executionId=${executionId} status=success durationMs=${durationMs}`);
    } catch (error: any) {
      const durationMs = Date.now() - startMs;
      this.logger.error(`[exec] task=${task.id} executionId=${executionId} status=error durationMs=${durationMs} error=${error.message}`);
      await this.db.updateExecution(executionId, {
        status: 'error',
        result: error.message,
        completedAt: new Date(),
      });
    }
  }

  /**
   * Create a new task
   */
  async createTask(
    name: string,
    cronSchedule: string,
    prompt: string,
    timezone?: string,
    topicIds?: number[],
  ): Promise<Task & { topicIds?: number[] }> {
    // Validate cron expression
    try {
      CronExpressionParser.parse(cronSchedule);
    } catch (e) {
      throw new Error(`Invalid cron expression: ${cronSchedule}`);
    }

    // Calculate first run time
    const nextRunAt = this.calculateNextRunTime(cronSchedule, timezone);

    const savedTask = await this.db.createTask({
      name,
      cronSchedule,
      prompt,
      timezone: timezone || null,
      nextRunAt,
    });

    // Associate topics if provided
    if (topicIds && topicIds.length > 0) {
      await this.db.setTaskTopics(savedTask.id, topicIds);
    }

    // For local development, also schedule in-memory
    if (!this.isVercel) {
      this.scheduleLocalTask(savedTask);
    }

    return { ...savedTask, topicIds: topicIds || [] };
  }

  /**
   * Manually trigger task execution
   */
  async runTaskManually(taskId: number): Promise<TaskExecution> {
    const task = await this.db.findTaskById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    const execution = await this.startExecution(task);

    // Execute asynchronously
    this.executeTaskAsync(task, execution.id);

    return execution;
  }

  /**
   * Get execution history
   */
  async getExecutions(
    taskId?: number,
    limit = 20,
    offset = 0,
  ): Promise<{ data: TaskExecution[]; total: number }> {
    return this.db.findExecutions({ taskId, limit, offset });
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<Task[]> {
    return this.db.findAllTasks();
  }

  /**
   * Delete a task
   */
  async deleteTask(id: number): Promise<void> {
    await this.db.deleteTask(id);

    // For local development, also remove from scheduler
    if (!this.isVercel) {
      const jobName = `task-${id}`;
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
      }
    }
  }

  /**
   * Update a task
   */
  async updateTask(
    id: number,
    data: Partial<Pick<Task, 'name' | 'cronSchedule' | 'prompt' | 'isActive' | 'timezone'>> & { topicIds?: number[] },
  ): Promise<Task | null> {
    const { topicIds, ...taskData } = data;
    const updateData: Partial<Task> = { ...taskData };

    // Get existing task to preserve timezone if not provided
    const existingTask = await this.db.findTaskById(id);
    if (!existingTask) {
      throw new Error(`Task ${id} not found`);
    }

    // Recalculate nextRunAt if cronSchedule or timezone changed
    if (data.cronSchedule || data.timezone !== undefined) {
      const cronSchedule = data.cronSchedule || existingTask.cronSchedule;
      // Use new timezone if provided, otherwise preserve existing
      const timezone = data.timezone !== undefined ? data.timezone : existingTask.timezone;

      try {
        CronExpressionParser.parse(cronSchedule);
        updateData.nextRunAt = this.calculateNextRunTime(cronSchedule, timezone);
      } catch (e) {
        throw new Error(`Invalid cron expression: ${cronSchedule}`);
      }
    }

    await this.db.updateTask(id, updateData);

    // Update topic associations if provided
    if (topicIds !== undefined) {
      await this.db.setTaskTopics(id, topicIds);
    }

    // For local development, reschedule if needed
    if (!this.isVercel && (data.cronSchedule || data.isActive !== undefined)) {
      const task = await this.db.findTaskById(id);
      if (task) {
        const jobName = `task-${id}`;
        if (this.schedulerRegistry.doesExist('cron', jobName)) {
          this.schedulerRegistry.deleteCronJob(jobName);
        }
        if (task.isActive) {
          this.scheduleLocalTask(task);
        }
      }
    }

    return this.db.findTaskById(id);
  }

  /**
   * Reset task's nextRunAt based on current cron schedule and timezone
   */
  async resetTaskSchedule(taskId: number): Promise<Task> {
    const task = await this.db.findTaskById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const nextRun = this.calculateNextRunTime(task.cronSchedule, task.timezone);
    await this.db.updateTask(taskId, { nextRunAt: nextRun });
    this.logger.log(`Reset nextRunAt for task ${taskId}: ${nextRun.toISOString()}`);

    return (await this.db.findTaskById(taskId))!;
  }

  // ========== Topic Association Methods ==========

  /**
   * Get topics associated with a task
   */
  async getTaskTopics(taskId: number): Promise<TopicWithSources[]> {
    return this.db.findTaskTopics(taskId);
  }

  /**
   * Set topics for a task (replaces all existing associations)
   */
  async setTaskTopics(taskId: number, topicIds: number[]): Promise<{ topicIds: number[] }> {
    await this.db.setTaskTopics(taskId, topicIds);
    return { topicIds };
  }

  /**
   * List all tasks with their topic IDs
   */
  async listTasksWithTopics(): Promise<Array<Task & { topicIds: number[] }>> {
    const tasks = await this.db.findAllTasks();
    const result: Array<Task & { topicIds: number[] }> = [];

    for (const task of tasks) {
      const topicIds = await this.db.findTaskTopicIds(task.id);
      result.push({ ...task, topicIds });
    }

    return result;
  }
}
