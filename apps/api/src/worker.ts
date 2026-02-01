import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AgentService } from './agent/agent.service.js';
import { AgentController } from './agent/agent.controller.js';
import { DatabaseService } from './database/database.service.js';
import { QueueService, type AgentJob } from './queue/queue.service.js';
import { Logger } from '@nestjs/common';
import type { TopicWithSources } from './database/database.service.js';

const POLL_INTERVAL_MS = 1000;
const logger = new Logger('Worker');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const queueService = app.get(QueueService);
  const agentService = app.get(AgentService);
  const agentController = app.get(AgentController);
  const db = app.get(DatabaseService);

  if (!queueService.isAvailable) {
    logger.error('Redis not configured. Worker requires Redis to operate.');
    process.exit(1);
  }

  logger.log('Worker started, polling for jobs...');

  const shutdown = async () => {
    logger.log('Shutting down worker...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (true) {
    try {
      const job = await queueService.pollJob();
      if (job) {
        logger.log(`Processing job: type=${job.type} streamId=${job.streamId}`);
        processJob(job, agentService, agentController, db, queueService).catch((err) => {
          logger.error(`Job failed: streamId=${job.streamId} error=${err.message}`);
          queueService.markStreamError(job.streamId, err.message).catch(() => {});
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err: any) {
      logger.error(`Poll error: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS * 5));
    }
  }
}

async function processJob(
  job: AgentJob,
  agentService: AgentService,
  agentController: AgentController,
  db: DatabaseService,
  queueService: QueueService,
) {
  const { streamId, payload } = job;

  if (job.type === 'chat') {
    const { chatId, modelMessages, topicsContext } = payload as {
      chatId: string;
      modelMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
      topicsContext?: TopicWithSources[];
    };

    const result = await agentService.streamChat(modelMessages, {
      topicsContext,
      onFinish: async ({ response }) => {
        try {
          await agentController.saveAssistantMessages(chatId, response);
        } catch (e) {
          logger.warn(`Failed to save assistant messages: ${e}`);
        }
        try {
          await db.deleteStreamId(streamId);
        } catch (e) {
          logger.warn(`Failed to clean up streamId: ${e}`);
        }
      },
    });

    // Read the UI message stream and push chunks to Redis
    const response = result.toUIMessageStreamResponse();
    const body = response.body;
    if (body) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          await queueService.pushStreamChunk(streamId, text);
        }
      } catch (e) {
        logger.error(`Stream reading error for ${streamId}: ${e}`);
        await queueService.markStreamError(streamId, String(e));
        return;
      }
    }

    await queueService.markStreamDone(streamId);
    logger.log(`Job completed: streamId=${streamId}`);

  } else if (job.type === 'task') {
    const { taskId, executionId, prompt, topicsContext } = payload as {
      taskId: number;
      executionId: string;
      prompt: string;
      topicsContext?: TopicWithSources[];
    };

    const startMs = Date.now();
    try {
      const result = await agentService.runAgent(prompt, {
        topicsContext,
        executionId,
        taskId,
      });

      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      await db.updateExecution(executionId, {
        status: 'success',
        result: resultStr,
        completedAt: new Date(),
      });
      logger.log(`Task job completed: taskId=${taskId} executionId=${executionId} durationMs=${Date.now() - startMs}`);
    } catch (error: any) {
      logger.error(`Task job failed: taskId=${taskId} executionId=${executionId} durationMs=${Date.now() - startMs} error=${error.message}`);
      await db.updateExecution(executionId, {
        status: 'error',
        result: error.message,
        completedAt: new Date(),
      });
    }

    await queueService.markStreamDone(streamId);

  } else if (job.type === 'email') {
    const { executionId, prompt, emailId } = payload as {
      executionId: string;
      prompt: string;
      emailId: string;
    };

    try {
      const result = await agentService.runAgent(prompt, { executionId });
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      await db.updateExecution(executionId, {
        status: 'success',
        result: resultStr,
        completedAt: new Date(),
      });
      logger.log(`Email job completed: emailId=${emailId} executionId=${executionId}`);
    } catch (error: any) {
      logger.error(`Email job failed: emailId=${emailId} executionId=${executionId} error=${error.message}`);
      await db.updateExecution(executionId, {
        status: 'error',
        result: error.message,
        completedAt: new Date(),
      });
    }

    await queueService.markStreamDone(streamId);
  }
}

bootstrap().catch((err) => {
  logger.error(`Worker bootstrap failed: ${err.message}`);
  process.exit(1);
});
