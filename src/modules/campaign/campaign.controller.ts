import { Controller, Get, Post, Patch, Delete, Param, Query, Body, HttpCode, HttpStatus, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CampaignService } from './campaign.service';
import { Campaign } from './campaign.entity';
import { CampaignMessage, CampaignMessageStatus } from './campaign-message.entity';
import { CampaignExecutorService } from './campaign-executor.service';
import { ContactListService } from './contact-list.service';
import { BlacklistService } from './blacklist.service';
import { SessionService } from '../session/session.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';
import { CreateContactListDto, ImportCsvContactListDto } from './dto/contact-list.dto';
import { AddToBlacklistDto, ImportBlacklistDto } from './dto/blacklist.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly campaignExecutor: CampaignExecutorService,
    private readonly contactListService: ContactListService,
    private readonly blacklistService: BlacklistService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  // ==================== Campaigns (fixed paths first) ====================

  @Post()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created' })
  async createCampaign(@Body() dto: CreateCampaignDto) {
    const campaign = await this.campaignService.create(dto);
    await this.auditService.logInfo(AuditAction.CAMPAIGN_CREATED as AuditAction, {
      sessionId: dto.sessionId,
      metadata: { campaignId: campaign.id, campaignName: campaign.name },
    });
    return campaign;
  }

  @Get()
  @ApiOperation({ summary: 'List all campaigns' })
  @ApiQuery({ name: 'sessionId', required: false })
  async listCampaigns(@Query('sessionId') sessionId?: string) {
    return this.campaignService.findAll(sessionId);
  }

  // ==================== Contact Lists (fixed paths BEFORE any :id) ====================

  @Get('contact-lists')
  @ApiOperation({ summary: 'List all contact lists' })
  @ApiQuery({ name: 'sessionId', required: false })
  async listContactLists(@Query('sessionId') sessionId?: string) {
    return this.contactListService.findAll(sessionId);
  }

  @Post('contact-lists')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create a contact list' })
  async createContactList(@Body() dto: CreateContactListDto) {
    return this.contactListService.create(dto);
  }

  @Post('contact-lists/import')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Import contacts from CSV data (new list)' })
  async importContactList(@Body() dto: ImportCsvContactListDto) {
    return this.contactListService.importCsv(dto);
  }

  @Get('contact-lists/:id')
  @ApiOperation({ summary: 'Get contact list details' })
  @ApiParam({ name: 'id', description: 'Contact List ID' })
  async getContactList(@Param('id') id: string) {
    return this.contactListService.findOne(id);
  }

  @Post('contact-lists/:id/import')
  @RequireRole(ApiKeyRole.OPERATOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Import contacts from CSV file into existing list' })
  @ApiParam({ name: 'id', description: 'Contact List ID' })
  async importCsvFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const csvText = file.buffer.toString('utf-8');
    return this.contactListService.importCsvFile(id, csvText);
  }

  @Post('contact-lists/:id/contacts')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Add contacts to an existing list' })
  @ApiParam({ name: 'id', description: 'Contact List ID' })
  async addContacts(@Param('id') id: string, @Body() body: { contacts: Array<{ number: string; name?: string; variables?: Record<string, string> }> }) {
    return this.contactListService.addContacts(id, body.contacts);
  }

  @Post('contact-lists/extract-from-session')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Extract recent chat contacts from a WhatsApp session' })
  @ApiBody({ schema: { type: 'object', properties: {
    sessionId: { type: 'string' },
    name: { type: 'string' },
  }, required: ['sessionId'] } })
  async extractFromSession(@Body() body: { sessionId: string; name?: string }) {
    const chats = await this.sessionService.getChats(body.sessionId, { limit: 10000 });
    const seen = new Set<string>();
    const entries: Array<{ number: string; name?: string }> = [];
    for (const c of chats) {
      if (c.isGroup || !c.id.endsWith('@c.us')) continue;
      const raw = c.id.replace('@c.us', '');
      const digits = raw.replace(/\D/g, '');
      if (digits.length < 7 || /^0+$/.test(digits)) continue;
      const number = raw.startsWith('+') ? raw : `+${raw}`;
      if (seen.has(number)) continue;
      seen.add(number);
      entries.push({
        number,
        name: c.name && c.name !== raw && c.name !== number ? c.name : undefined,
      });
    }
    if (entries.length === 0) throw new BadRequestException('No recent chats found in this session');
    return this.contactListService.create({
      name: body.name || `Recent Chats - ${new Date().toISOString().slice(0, 10)}`,
      contacts: entries,
    });
  }

  @Get('contact-lists/:id/export')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Export contact list as CSV' })
  @ApiParam({ name: 'id', description: 'Contact List ID' })
  async exportCsv(@Param('id') id: string, @Res() res: any) {
    const list = await this.contactListService.findOne(id);
    const header = 'number,name\n';
    const rows = list.contacts.map(c =>
      `"${c.number}","${(c.name || '').replace(/"/g, '""')}"`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`);
    res.send(header + rows);
  }

  @Delete('contact-lists/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contact list' })
  @ApiParam({ name: 'id', description: 'Contact List ID' })
  async deleteContactList(@Param('id') id: string) {
    await this.contactListService.delete(id);
  }

  // ==================== Blacklist (fixed paths BEFORE any :id) ====================

  @Get('blacklist')
  @ApiOperation({ summary: 'List blacklisted numbers' })
  @ApiQuery({ name: 'sessionId', required: false })
  async listBlacklist(@Query('sessionId') sessionId?: string) {
    return this.blacklistService.findAll(sessionId);
  }

  @Get('blacklist/check')
  @ApiOperation({ summary: 'Check if a number is blacklisted' })
  @ApiQuery({ name: 'number', required: true })
  @ApiQuery({ name: 'sessionId', required: false })
  async checkBlacklist(@Query('number') number: string, @Query('sessionId') sessionId?: string) {
    return this.blacklistService.isBlacklisted(number, sessionId);
  }

  @Post('blacklist')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Add number to blacklist' })
  async addToBlacklist(@Body() dto: AddToBlacklistDto) {
    return this.blacklistService.add(dto);
  }

  @Post('blacklist/import')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Import numbers to blacklist' })
  async importBlacklist(@Body() dto: ImportBlacklistDto) {
    return this.blacklistService.import(dto);
  }

  @Delete('blacklist/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove from blacklist' })
  @ApiParam({ name: 'id', description: 'Blacklist entry ID' })
  async removeFromBlacklist(@Param('id') id: string) {
    await this.blacklistService.remove(id);
  }

  // ==================== Campaign fixed paths BEFORE :id ====================

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Get campaign analytics summary' })
  async getAnalytics(@Query('sessionId') sessionId?: string) {
    return this.campaignService.getAnalytics(sessionId);
  }

  @Post(':id/duplicate')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Duplicate a campaign as draft' })
  @ApiResponse({ status: 200, description: 'Campaign duplicated' })
  async duplicate(@Param('id') id: string): Promise<Campaign> {
    return this.campaignService.duplicate(id);
  }

  // ==================== Campaign :id routes (AFTER all fixed paths) ====================

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async getCampaign(@Param('id') id: string) {
    return this.campaignService.findOne(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get campaign messages with delivery status' })
  @ApiQuery({ name: 'status', required: false, enum: CampaignMessageStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getCampaignMessages(
    @Param('id') id: string,
    @Query('status') status?: CampaignMessageStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '50', 10);
    return this.campaignService.getCampaignMessages(id, { status, page: pageNum, limit: limitNum });
  }

  @Patch(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async updateCampaign(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignService.update(id, dto);
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async deleteCampaign(@Param('id') id: string) {
    await this.campaignService.delete(id);
  }

  @Post(':id/start')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Start campaign execution' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async startCampaign(@Param('id') id: string) {
    const campaign = await this.campaignService.start(id);
    await this.auditService.logInfo(AuditAction.CAMPAIGN_STARTED as AuditAction, {
      sessionId: campaign.sessionId,
      metadata: { campaignId: campaign.id, campaignName: campaign.name },
    });
    void this.campaignExecutor.executeCampaign(id);
    return campaign;
  }

  @Post(':id/pause')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Pause a running campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async pauseCampaign(@Param('id') id: string) {
    return this.campaignService.pause(id);
  }

  @Post(':id/resume')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Resume a paused campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async resumeCampaign(@Param('id') id: string) {
    const campaign = await this.campaignService.resume(id);
    void this.campaignExecutor.executeCampaign(id);
    return campaign;
  }

  @Post(':id/cancel')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Cancel a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async cancelCampaign(@Param('id') id: string) {
    return this.campaignService.cancel(id);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Get campaign live progress' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async getCampaignProgress(@Param('id') id: string) {
    return this.campaignService.getProgress(id);
  }
}
