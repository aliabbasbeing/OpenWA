import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MessageLogService } from './message-log.service';
import { MessageLogStatus, MessageLogDirection, MessageLogType } from './message-log.entity';

@ApiTags('message-logs')
@Controller('message-logs')
export class MessageLogController {
  constructor(private readonly messageLogService: MessageLogService) {}

  @Get()
  @ApiOperation({ summary: 'List message logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sessionId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'direction', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'contactNumber', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'campaignId', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: MessageLogStatus,
    @Query('direction') direction?: MessageLogDirection,
    @Query('type') type?: MessageLogType,
    @Query('contactNumber') contactNumber?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.messageLogService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      sessionId,
      status,
      direction,
      type,
      contactNumber,
      search,
      dateFrom,
      dateTo,
      campaignId,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get message log statistics' })
  async getStats() {
    return this.messageLogService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get message log detail' })
  async findOne(@Param('id') id: string) {
    return this.messageLogService.findOne(id);
  }
}
