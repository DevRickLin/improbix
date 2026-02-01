import {
  Controller,
  Inject,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CronGuard } from './cron.guard';

@Controller('tasks')
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  // ========== Cron Endpoint (Special Auth) ==========

  @Get('cron/tick')
  @UseGuards(CronGuard)
  async cronTick() {
    return this.tasksService.processCronTick();
  }

  @Post('admin/initialize-schedules')
  @UseGuards(CronGuard)
  async initializeSchedules() {
    return this.tasksService.initializeNextRunTimes();
  }

  // ========== User Endpoints (JWT Auth) ==========

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() body: { name: string; cron: string; prompt: string; timezone?: string; topicIds?: number[] },
  ) {
    return this.tasksService.createTask(body.name, body.cron, body.prompt, body.timezone, body.topicIds);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return this.tasksService.listTasks();
  }

  @Get('executions')
  @UseGuards(JwtAuthGuard)
  async getExecutions(
    @Query('taskId') taskId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.tasksService.getExecutions(
      taskId ? parseInt(taskId, 10) : undefined,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':id/executions')
  @UseGuards(JwtAuthGuard)
  async getTaskExecutions(@Param('id') id: string) {
    return this.tasksService.getExecutions(parseInt(id, 10));
  }

  @Post(':id/run')
  @UseGuards(JwtAuthGuard)
  async runTask(@Param('id') id: string) {
    return this.tasksService.runTaskManually(parseInt(id, 10));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      cronSchedule?: string;
      prompt?: string;
      isActive?: boolean;
      timezone?: string;
      topicIds?: number[];
    },
  ) {
    return this.tasksService.updateTask(parseInt(id, 10), body);
  }

  @Post(':id/reset-schedule')
  @UseGuards(JwtAuthGuard)
  async resetSchedule(@Param('id') id: string) {
    return this.tasksService.resetTaskSchedule(parseInt(id, 10));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.tasksService.deleteTask(parseInt(id, 10));
  }

  // ========== Topic Association Endpoints ==========

  @Get(':id/topics')
  @UseGuards(JwtAuthGuard)
  async getTaskTopics(@Param('id') id: string) {
    return this.tasksService.getTaskTopics(parseInt(id, 10));
  }

  @Put(':id/topics')
  @UseGuards(JwtAuthGuard)
  async setTaskTopics(
    @Param('id') id: string,
    @Body() body: { topicIds: number[] },
  ) {
    return this.tasksService.setTaskTopics(parseInt(id, 10), body.topicIds);
  }
}
