import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Campaign, CampaignStatus, CampaignContactSource, DEFAULT_CAMPAIGN_SETTINGS } from './campaign.entity';
import { ContactList } from './contact-list.entity';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';
import { createLogger } from '../../common/services/logger.service';

@Injectable()
export class CampaignService {
  private readonly logger = createLogger('CampaignService');

  constructor(
    @InjectRepository(Campaign, 'data')
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(ContactList, 'data')
    private readonly contactListRepo: Repository<ContactList>,
  ) {}

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    let totalContacts = dto.manualContacts?.length ?? 0;

    if (!dto.contactListId && totalContacts === 0) {
      throw new BadRequestException('Provide either contactListId or manualContacts');
    }

    if (dto.contactListId && totalContacts === 0) {
      const list = await this.contactListRepo.findOne({ where: { id: dto.contactListId } });
      if (list) {
        totalContacts = list.contactCount;
      }
    }

    const settings = {
      ...DEFAULT_CAMPAIGN_SETTINGS,
      ...dto.settings,
    };

    const campaign = this.campaignRepo.create({
      name: dto.name,
      sessionId: dto.sessionId,
      status: CampaignStatus.DRAFT,
      messageTemplate: dto.messageTemplate,
      messageVariations: dto.messageVariations ?? [dto.messageTemplate],
      contactSource: dto.contactSource ?? CampaignContactSource.MANUAL,
      contactListId: dto.contactListId ?? null,
      manualContacts: dto.manualContacts ?? [],
      totalContacts,
      settings,
      scheduleAt: dto.scheduleAt ? new Date(dto.scheduleAt) : null,
    });

    const saved = await this.campaignRepo.save(campaign);
    this.logger.log(`Campaign created: ${saved.name}`, {
      campaignId: saved.id,
      action: 'create',
    });
    return saved;
  }

  async findAll(sessionId?: string): Promise<Campaign[]> {
    const where = sessionId ? { sessionId } : {};
    return this.campaignRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign '${id}' not found`);
    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findOne(id);

    const isRunning = campaign.status === CampaignStatus.RUNNING;
    const isPaused = campaign.status === CampaignStatus.PAUSED;

    if (isRunning || isPaused) {
      if (dto.settings !== undefined) {
        campaign.settings = { ...campaign.settings, ...dto.settings };
      }
      return this.campaignRepo.save(campaign);
    }

    if (dto.name !== undefined) campaign.name = dto.name;
    if (dto.messageTemplate !== undefined) {
      campaign.messageTemplate = dto.messageTemplate;
      if (!dto.messageVariations) {
        campaign.messageVariations = [dto.messageTemplate];
      }
    }
    if (dto.messageVariations !== undefined) {
      campaign.messageVariations = dto.messageVariations;
    }
    if (dto.settings !== undefined) {
      campaign.settings = { ...campaign.settings, ...dto.settings };
    }
    if (dto.scheduleAt !== undefined) {
      campaign.scheduleAt = dto.scheduleAt ? new Date(dto.scheduleAt) : null;
    }

    return this.campaignRepo.save(campaign);
  }

  async delete(id: string): Promise<void> {
    const campaign = await this.findOne(id);
    if (campaign.status === CampaignStatus.RUNNING) {
      throw new BadRequestException('Cannot delete a running campaign. Cancel it first.');
    }
    await this.campaignRepo.remove(campaign);
    this.logger.log(`Campaign deleted: ${campaign.name}`, {
      campaignId: id,
      action: 'delete',
    });
  }

  async start(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);

    if (campaign.status === CampaignStatus.RUNNING) {
      throw new BadRequestException('Campaign is already running');
    }
    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('Campaign is already completed');
    }

    // Recalculate totalContacts from the contact list if using one
    if (campaign.contactSource === CampaignContactSource.CONTACT_LIST && campaign.contactListId) {
      const list = await this.contactListRepo.findOne({ where: { id: campaign.contactListId } });
      if (list) {
        campaign.totalContacts = list.contactCount;
      }
    }

    if (campaign.totalContacts === 0) {
      throw new BadRequestException('Campaign has no contacts');
    }

    campaign.status = CampaignStatus.RUNNING;
    campaign.startedAt = new Date();
    return this.campaignRepo.save(campaign);
  }

  async pause(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (campaign.status !== CampaignStatus.RUNNING) {
      throw new BadRequestException('Can only pause a running campaign');
    }
    campaign.status = CampaignStatus.PAUSED;
    return this.campaignRepo.save(campaign);
  }

  async resume(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException('Can only resume a paused campaign');
    }
    campaign.status = CampaignStatus.RUNNING;
    return this.campaignRepo.save(campaign);
  }

  async cancel(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (campaign.status !== CampaignStatus.RUNNING && campaign.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException('Can only cancel a running or paused campaign');
    }
    campaign.status = CampaignStatus.CANCELLED;
    campaign.completedAt = new Date();
    return this.campaignRepo.save(campaign);
  }

  async updateProgress(id: string, progress: {
    sentCount?: number;
    failedCount?: number;
    currentIndex?: number;
    messagesSentToday?: number;
    messagesSentThisHour?: number;
    status?: CampaignStatus;
    hourWindowStart?: Date;
    dayWindowStart?: Date;
    completedAt?: Date;
  }): Promise<Campaign> {
    const campaign = await this.findOne(id);
    Object.assign(campaign, progress);
    return this.campaignRepo.save(campaign);
  }

  async getProgress(id: string): Promise<{
    totalContacts: number;
    sentCount: number;
    failedCount: number;
    deliveredCount: number;
    readCount: number;
    currentIndex: number;
    percentComplete: number;
    status: string;
  }> {
    const campaign = await this.findOne(id);
    const percentComplete = campaign.totalContacts > 0
      ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalContacts) * 100)
      : 0;

    return {
      totalContacts: campaign.totalContacts,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      currentIndex: campaign.currentIndex,
      percentComplete,
      status: campaign.status,
    };
  }
}
