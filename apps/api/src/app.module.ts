import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { FeishuModule } from './feishu/feishu.module';
import { SearchModule } from './search/search.module';
import { AgentModule } from './agent/agent.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    ScheduleModule.forRoot(),
    AuthModule,
    FeishuModule,
    SearchModule,
    AgentModule,
    TasksModule,
  ],
})
export class AppModule {}
