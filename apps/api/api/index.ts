import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import serverlessExpress from '@codegenie/serverless-express';
import { AppModule } from '../src/app.module';
import type { Handler, Context, Callback } from 'aws-lambda';

// 强制打包器包含此 ESM 包（此导入从不执行）
// @ts-ignore - Bundler hint for dynamic import
export const _dependencies = () => import('@anthropic-ai/claude-agent-sdk');

let cachedServer: Handler;

async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create(AppModule);
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

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

export default async function handler(
  event: any,
  context: Context,
  callback: Callback,
) {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  return cachedServer(event, context, callback);
}
