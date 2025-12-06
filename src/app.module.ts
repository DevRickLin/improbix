import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { FeishuModule } from './feishu/feishu.module';
import { SearchModule } from './search/search.module';
import { AgentModule } from './agent/agent.module';
import { TasksModule } from './tasks/tasks.module';
import { Task } from './database/task.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', 
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'sqlite.db',
      entities: [Task],
      synchronize: true, 
    }),
    ScheduleModule.forRoot(),
    FeishuModule,
    SearchModule,
    AgentModule,
    TasksModule,
  ],
})
export class AppModule {}
