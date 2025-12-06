import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { AgentModule } from '../agent/agent.module';
import { CronGuard } from './cron.guard';

@Module({
  imports: [AgentModule],
  controllers: [TasksController],
  providers: [TasksService, CronGuard],
})
export class TasksModule {}
