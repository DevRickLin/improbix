import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { NestExpressApplication } from '@nestjs/platform-express';

let app: NestExpressApplication | null = null;

async function bootstrap(): Promise<NestExpressApplication> {
  if (!app) {
    app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: [
        'https://improbix-web.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
      ],
      credentials: true,
    });
    await app.init();
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const nestApp = await bootstrap();
  const expressApp = nestApp.getHttpAdapter().getInstance();
  expressApp(req, res);
}
