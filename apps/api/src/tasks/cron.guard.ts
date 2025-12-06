import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CronGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Support both query parameter and authorization header
    const secretFromQuery = request.query?.secret;
    const authHeader = request.headers['authorization'];
    const secretFromHeader = authHeader?.replace('Bearer ', '');

    const providedSecret = secretFromQuery || secretFromHeader;
    const cronSecret = this.configService.get<string>('CRON_SECRET');

    if (!cronSecret) {
      throw new UnauthorizedException('CRON_SECRET not configured');
    }

    if (!providedSecret || providedSecret !== cronSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    return true;
  }
}
