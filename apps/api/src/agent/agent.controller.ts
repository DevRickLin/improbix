import { Controller, Inject, Post, Get, Body, Param, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface MessageEvent {
  data: string;
}

@Controller('agent')
export class AgentController {
  constructor(@Inject(AgentService) private readonly agentService: AgentService) {}

  /**
   * 启动 Agent 执行（立即返回 executionId）
   */
  @Post('run')
  @UseGuards(JwtAuthGuard)
  async run(@Body('task') task: string) {
    const executionId = crypto.randomUUID();

    // 后台异步执行，不等待
    this.agentService.runAgentStream(executionId, task);

    return {
      executionId,
      status: 'started',
      message: 'Agent execution started. Subscribe to SSE for updates.',
    };
  }

  /**
   * SSE 端点：流式推送执行过程
   * 注意：SSE 不走 JWT 认证，因为 EventSource 不支持 Authorization header
   */
  @Get('stream/:executionId')
  @Sse()
  stream(@Param('executionId') executionId: string): Observable<MessageEvent> {
    return this.agentService.getEventStream(executionId);
  }
}
