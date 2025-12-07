import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  TopicsService,
  CreateTopicDto,
  UpdateTopicDto,
  CreateTopicSourceDto,
  UpdateTopicSourceDto,
} from './topics.service';

@Controller('topics')
@UseGuards(JwtAuthGuard)
export class TopicsController {
  constructor(@Inject(TopicsService) private readonly topicsService: TopicsService) {}

  @Get()
  async getAllTopics() {
    return this.topicsService.getAllTopics();
  }

  @Get(':id')
  async getTopicById(@Param('id', ParseIntPipe) id: number) {
    const topic = await this.topicsService.getTopicById(id);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }
    return topic;
  }

  @Post()
  async createTopic(@Body() data: CreateTopicDto) {
    return this.topicsService.createTopic(data);
  }

  @Put(':id')
  async updateTopic(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateTopicDto,
  ) {
    const topic = await this.topicsService.updateTopic(id, data);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }
    return topic;
  }

  @Delete(':id')
  async deleteTopic(@Param('id', ParseIntPipe) id: number) {
    const topic = await this.topicsService.getTopicById(id);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }
    await this.topicsService.deleteTopic(id);
    return { message: 'Topic deleted successfully' };
  }

  // Source endpoints
  @Post(':id/sources')
  async addSource(
    @Param('id', ParseIntPipe) topicId: number,
    @Body() data: CreateTopicSourceDto,
  ) {
    const topic = await this.topicsService.getTopicById(topicId);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }
    return this.topicsService.addSource(topicId, data);
  }

  @Put(':topicId/sources/:sourceId')
  async updateSource(
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('sourceId', ParseIntPipe) sourceId: number,
    @Body() data: UpdateTopicSourceDto,
  ) {
    const source = await this.topicsService.getSourceById(sourceId);
    if (!source || source.topicId !== topicId) {
      throw new NotFoundException(`Source with ID ${sourceId} not found in topic ${topicId}`);
    }
    return this.topicsService.updateSource(sourceId, data);
  }

  @Delete(':topicId/sources/:sourceId')
  async deleteSource(
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('sourceId', ParseIntPipe) sourceId: number,
  ) {
    const source = await this.topicsService.getSourceById(sourceId);
    if (!source || source.topicId !== topicId) {
      throw new NotFoundException(`Source with ID ${sourceId} not found in topic ${topicId}`);
    }
    await this.topicsService.deleteSource(sourceId);
    return { message: 'Source deleted successfully' };
  }
}
