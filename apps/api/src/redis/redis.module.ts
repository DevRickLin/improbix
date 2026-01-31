import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis | null => {
        const logger = new Logger('RedisModule');
        const url = configService.get<string>('KV_REST_API_URL');
        const token = configService.get<string>('KV_REST_API_TOKEN');
        if (!url || !token) {
          logger.warn('KV_REST_API_URL / KV_REST_API_TOKEN not set — resumable stream disabled');
          return null;
        }
        logger.log(`Connecting to Upstash Redis: ${url}`);
        return new Redis({ url, token });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
