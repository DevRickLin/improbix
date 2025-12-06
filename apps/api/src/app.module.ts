import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { FeishuModule } from './feishu/feishu.module';
import { SearchModule } from './search/search.module';
import { AgentModule } from './agent/agent.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { Task } from './database/task.entity';

// Use /tmp for Vercel serverless (ephemeral storage)
// For production, consider using a cloud database like Turso, PlanetScale, or Neon
const isVercel = process.env.VERCEL === '1';
const databasePath = isVercel ? '/tmp/sqlite.db' : 'sqlite.db';

@Module({
  imports: [
    // Environment variables are loaded by dotenv-cli in package.json scripts
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: databasePath,
      entities: [Task],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    FeishuModule,
    SearchModule,
    AgentModule,
    TasksModule,
  ],
})
export class AppModule {}
