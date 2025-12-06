import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
