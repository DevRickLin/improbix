import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from '../database/task.entity';
import { TaskExecution } from '../database/task-execution.entity';
import { AgentModule } from '../agent/agent.module';
import { CronGuard } from './cron.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskExecution]), AgentModule],
  controllers: [TasksController],
  providers: [TasksService, CronGuard],
})
export class TasksModule {}
