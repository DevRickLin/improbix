import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { FeishuModule } from '../feishu/feishu.module';
import { SearchModule } from '../search/search.module';
import { ReportsModule } from '../reports/reports.module';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { SimilarWebModule } from '../similarweb/similarweb.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, FeishuModule, EmailModule, SearchModule, ReportsModule, DatabaseModule, SandboxModule, SimilarWebModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
