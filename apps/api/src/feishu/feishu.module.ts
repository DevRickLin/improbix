import { Module } from '@nestjs/common';
import { FeishuService } from './feishu.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [FeishuService],
  exports: [FeishuService],
})
export class FeishuModule {}
