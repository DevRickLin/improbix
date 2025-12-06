import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(@Body() body: { name: string; cron: string; prompt: string }) {
    return this.tasksService.createTask(body.name, body.cron, body.prompt);
  }

  @Get()
  async findAll() {
    return this.tasksService.listTasks();
  }
  
  @Delete(':id')
  async delete(@Param('id') id: string) {
      return this.tasksService.deleteTask(+id);
  }
}
