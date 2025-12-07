import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { AgentModule } from '../agent/agent.module';
import { ReportsModule } from '../reports/reports.module';
import { CronGuard } from './cron.guard';

@Module({
  imports: [AgentModule, ReportsModule],
  controllers: [TasksController],
  providers: [TasksService, CronGuard],
})
export class TasksModule {}
