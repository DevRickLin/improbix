import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { FeishuModule } from './feishu/feishu.module';
import { SearchModule } from './search/search.module';
import { AgentModule } from './agent/agent.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { TopicsModule } from './topics/topics.module';
import { ReportsModule } from './reports/reports.module';
import { EmailModule } from './email/email.module';
import { SessionsModule } from './sessions/sessions.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    AuthModule,
    FeishuModule,
    EmailModule,
    SearchModule,
    AgentModule,
    TasksModule,
    TopicsModule,
    ReportsModule,
    SessionsModule,
  ],
})
export class AppModule {}
