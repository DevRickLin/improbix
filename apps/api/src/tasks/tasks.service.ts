import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Task } from '../database/task.entity';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    private schedulerRegistry: SchedulerRegistry,
    private agentService: AgentService,
  ) {}

  async onModuleInit() {
    await this.loadTasks();
  }

  async loadTasks() {
    const tasks = await this.tasksRepository.find({ where: { isActive: true } });
    tasks.forEach(task => this.scheduleTask(task));
    this.logger.log(`Loaded ${tasks.length} tasks.`);
  }

  private scheduleTask(task: Task) {
    const jobName = `task-${task.id}`;
    
    // Clean up existing job if it exists
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
    }

    const job = new CronJob(task.cronSchedule, async () => {
      this.logger.log(`Executing task: ${task.name}`);
      try {
        await this.agentService.runAgent(task.prompt);
      } catch (e) {
        this.logger.error(`Task ${task.name} failed`, e);
      }
    });

    this.schedulerRegistry.addCronJob(jobName, job as any);
    job.start();
  }

  async createTask(name: string, cronSchedule: string, prompt: string) {
    const task = this.tasksRepository.create({ name, cronSchedule, prompt });
    await this.tasksRepository.save(task);
    this.scheduleTask(task);
    return task;
  }
  
  async listTasks() {
      return this.tasksRepository.find();
  }

  async deleteTask(id: number) {
      await this.tasksRepository.delete(id);
      const jobName = `task-${id}`;
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
          this.schedulerRegistry.deleteCronJob(jobName);
      }
  }
}
