import { Module } from '@nestjs/common';
import { SimilarWebService } from './similarweb.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [SimilarWebService],
  exports: [SimilarWebService],
})
export class SimilarWebModule {}
