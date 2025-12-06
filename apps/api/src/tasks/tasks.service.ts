import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CronExpressionParser } from 'cron-parser';
import { DatabaseService, Task, TaskExecution } from '../database/database.service';
import { AgentService } from '../agent/agent.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);
  private readonly isVercel = process.env.VERCEL === '1';

  constructor(
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject(SchedulerRegistry) private schedulerRegistry: SchedulerRegistry,
    @Inject(AgentService) private agentService: AgentService,
  ) {}

  async onModuleInit() {
    // Only use in-memory scheduling for local development
    if (!this.isVercel) {
      await this.loadLocalScheduler();
    }
    // Initialize nextRunAt for tasks that don't have it set
    await this.initializeNextRunTimes();
  }

  /**
   * Initialize nextRunAt for existing tasks that don't have it set
   */
  private async initializeNextRunTimes() {
    const tasksWithoutNextRun = await this.db.findTasksWithNullNextRun();

    for (const task of tasksWithoutNextRun) {
      try {
        const nextRun = this.calculateNextRunTime(task.cronSchedule, task.timezone);
        await this.db.updateTask(task.id, { nextRunAt: nextRun });
        this.logger.log(`Initialized nextRunAt for task ${task.id}: ${nextRun}`);
      } catch (e) {
        this.logger.warn(`Failed to initialize nextRunAt for task ${task.id}`, e);
      }
    }
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

    const job = new CronJob(task.cronSchedule, async () => {
      this.logger.log(`[Local] Executing task: ${task.name}`);
      try {
        await this.agentService.runAgent(task.prompt);
        await this.db.updateTask(task.id, { lastRunAt: new Date() });
      } catch (e) {
        this.logger.error(`[Local] Task ${task.name} failed`, e);
      }
    });

    this.schedulerRegistry.addCronJob(jobName, job as any);
    job.start();
  }

  /**
   * Core method: Called by Vercel Cron every minute
   * Checks and executes all due tasks
   */
  async processCronTick(): Promise<{
    executedCount: number;
    tasks: Array<{ id: number; name: string; status: string; executionId?: string; error?: string }>;
  }> {
    const now = new Date();
    this.logger.log(`Processing cron tick at ${now.toISOString()}`);

    // Find tasks where nextRunAt <= now and isActive = true
    const dueTasks = await this.db.findAllTasks({
      isActive: true,
      nextRunAtLessThan: now,
    });

    this.logger.log(`Found ${dueTasks.length} due tasks`);

    const results: Array<{ id: number; name: string; status: string; executionId?: string; error?: string }> = [];

    for (const task of dueTasks) {
      try {
        // Create execution record
        const execution = await this.startExecution(task);

        // Execute task asynchronously (don't await completion)
        this.executeTaskAsync(task, execution.id);

        // Update nextRunAt for next execution
        await this.updateNextRunTime(task);

        results.push({
          id: task.id,
          name: task.name,
          status: 'started',
          executionId: execution.id,
        });
      } catch (error: any) {
        this.logger.error(`Failed to start task ${task.id}`, error);
        results.push({
          id: task.id,
          name: task.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    return {
      executedCount: results.filter((r) => r.status === 'started').length,
      tasks: results,
    };
  }

  /**
   * Calculate next run time from cron expression
   */
  private calculateNextRunTime(cronSchedule: string, timezone?: string | null): Date {
    const interval = CronExpressionParser.parse(cronSchedule, {
      tz: timezone || 'UTC',
    });
    return interval.next().toDate();
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
    try {
      this.logger.log(`Executing task: ${task.name}`);
      const result = await this.agentService.runAgent(task.prompt);

      await this.db.updateExecution(executionId, {
        status: 'success',
        result: typeof result === 'string' ? result : JSON.stringify(result),
        completedAt: new Date(),
      });
      this.logger.log(`Task ${task.name} completed successfully`);
    } catch (error: any) {
      this.logger.error(`Task ${task.name} failed`, error);
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
  ): Promise<Task> {
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

    // For local development, also schedule in-memory
    if (!this.isVercel) {
      this.scheduleLocalTask(savedTask);
    }

    return savedTask;
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
    data: Partial<Pick<Task, 'name' | 'cronSchedule' | 'prompt' | 'isActive' | 'timezone'>>,
  ): Promise<Task | null> {
    const updateData: Partial<Task> = { ...data };

    // Recalculate nextRunAt if cronSchedule changed
    if (data.cronSchedule) {
      try {
        CronExpressionParser.parse(data.cronSchedule);
        updateData.nextRunAt = this.calculateNextRunTime(
          data.cronSchedule,
          data.timezone || undefined,
        );
      } catch (e) {
        throw new Error(`Invalid cron expression: ${data.cronSchedule}`);
      }
    }

    await this.db.updateTask(id, updateData);

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
}
