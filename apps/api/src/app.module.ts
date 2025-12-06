import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { FeishuModule } from './feishu/feishu.module';
import { SearchModule } from './search/search.module';
import { AgentModule } from './agent/agent.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { Task } from './database/task.entity';
import { TaskExecution } from './database/task-execution.entity';

const isVercel = process.env.VERCEL === '1';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const tursoUrl = configService.get<string>('TURSO_DATABASE_URL');
        const tursoToken = configService.get<string>('TURSO_AUTH_TOKEN');

        // Use Turso in Vercel production environment
        if (isVercel && tursoUrl) {
          return {
            type: 'sqlite',
            database: tursoUrl,
            extra: {
              authToken: tursoToken,
            },
            entities: [Task, TaskExecution],
            synchronize: true, // For development; use migrations in production
          };
        }

        // Local development uses SQLite file
        return {
          type: 'sqlite',
          database: 'sqlite.db',
          entities: [Task, TaskExecution],
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    // ScheduleModule is still needed for local development
    ScheduleModule.forRoot(),
    AuthModule,
    FeishuModule,
    SearchModule,
    AgentModule,
    TasksModule,
  ],
})
export class AppModule {}
