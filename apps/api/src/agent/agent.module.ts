import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { FeishuModule } from '../feishu/feishu.module';
import { SearchModule } from '../search/search.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, FeishuModule, SearchModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
