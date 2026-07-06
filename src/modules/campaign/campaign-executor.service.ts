import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign, CampaignStatus } from './campaign.entity';
import { ContactList } from './contact-list.entity';
import { BlacklistService } from './blacklist.service';
import { CampaignService } from './campaign.service';
import { SessionService } from '../session/session.service';
import { renderTemplate } from '../../common/utils/template-render';
import { createLogger } from '../../common/services/logger.service';
import { HookManager } from '../../core/hooks';
import type { DeliveryStatus } from '../../engine/interfaces/whatsapp-engine.interface';

@Injectable()
export class CampaignExecutorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('CampaignExecutor');
  private activeCampaigns = new Map<string, AbortController>();
  private resumeTimers = new Map<string, NodeJS.Timeout>();
  private sentMessages = new Map<string, string>();
  private scheduledCheckTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Campaign, 'data')
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(ContactList, 'data')
    private readonly contactListRepo: Repository<ContactList>,
    private readonly blacklistService: BlacklistService,
    private readonly campaignService: CampaignService,
    private readonly sessionService: SessionService,
    private readonly hookManager: HookManager,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Campaign executor initialized');
    const running = await this.campaignRepo.find({ where: { status: CampaignStatus.RUNNING } });
    for (const c of running) {
      this.logger.log(`Auto-resuming campaign: ${c.name}`, { campaignId: c.id, action: 'auto_resume' });
      void this.executeCampaign(c.id);
    }

    await this.checkScheduledCampaigns();
    this.scheduledCheckTimer = setInterval(() => {
      void this.checkScheduledCampaigns();
    }, 60_000);

    this.hookManager.register('campaign-executor', 'message:ack', async (ctx) => {
      const { messageId, status } = ctx.data as { messageId: string; status: DeliveryStatus };
      this.handleAck(messageId, status);
      return { continue: true };
    }, 100);
  }

  onModuleDestroy(): void {
    for (const [id, controller] of this.activeCampaigns) {
      controller.abort();
      this.logger.log(`Aborted campaign on shutdown: ${id}`);
    }
    for (const [, timer] of this.resumeTimers) {
      clearTimeout(timer);
    }
    if (this.scheduledCheckTimer) {
      clearInterval(this.scheduledCheckTimer);
    }
    this.activeCampaigns.clear();
    this.resumeTimers.clear();
    this.sentMessages.clear();
  }

  async executeCampaign(campaignId: string): Promise<void> {
    const campaign = await this.campaignService.findOne(campaignId);
    if (campaign.status !== CampaignStatus.RUNNING) return;

    const abortController = new AbortController();
    this.activeCampaigns.set(campaignId, abortController);

    try {
      this.logger.log(`Starting campaign execution: ${campaign.name}`, {
        campaignId,
        action: 'execute_start',
      });

      const contacts = await this.resolveContacts(campaign);
      if (contacts.length === 0) {
        await this.campaignService.updateProgress(campaignId, { status: CampaignStatus.COMPLETED });
        return;
      }

      if (campaign.randomizeOrder) {
        for (let i = contacts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [contacts[i], contacts[j]] = [contacts[j], contacts[i]];
        }
      }

      const blacklisted = await this.blacklistService.getBlacklistedNumbers(campaign.sessionId);
      const blacklistedSet = new Set(blacklisted);

      const filteredContacts = contacts.filter(c => !blacklistedSet.has(c.number));

      const variations = campaign.messageVariations.length > 0
        ? campaign.messageVariations
        : [campaign.messageTemplate];

      let spinningIndex = campaign.currentIndex;
      let sentToday = campaign.messagesSentToday;
      let sentThisHour = campaign.messagesSentThisHour;
      let hourWindowStart = campaign.hourWindowStart?.getTime() ?? 0;
      let dayWindowStart = campaign.dayWindowStart?.getTime() ?? 0;
      const now = Date.now();

      if (dayWindowStart === 0 || now - dayWindowStart > 86400000) {
        dayWindowStart = now;
        sentToday = 0;
      }
      if (hourWindowStart === 0 || now - hourWindowStart > 3600000) {
        hourWindowStart = now;
        sentThisHour = 0;
      }

      for (let i = campaign.currentIndex; i < filteredContacts.length; i++) {
        if (abortController.signal.aborted) break;

        const freshCampaign = await this.campaignService.findOne(campaignId);
        if (freshCampaign.status !== CampaignStatus.RUNNING) break;

        const contact = filteredContacts[i];

        if (freshCampaign.settings.respectBusinessHours) {
          const pauseInfo = this.checkTimeWindow(freshCampaign.settings);
          if (pauseInfo.shouldPause) {
            this.logger.log(`Campaign paused: outside time window`, {
              campaignId,
              action: 'time_window_pause',
              resumesAt: pauseInfo.resumesAt,
            });
            await this.campaignService.updateProgress(campaignId, {
              status: CampaignStatus.PAUSED,
              currentIndex: i,
              messagesSentToday: sentToday,
              messagesSentThisHour: sentThisHour,
              hourWindowStart: new Date(hourWindowStart),
              dayWindowStart: new Date(dayWindowStart),
            });
            this.scheduleResume(campaignId, pauseInfo.resumesAt);
            return;
          }
        }

        if (freshCampaign.settings.skipWeekends) {
          const day = new Date().getDay();
          if (day === 0 || day === 6) {
            this.logger.log('Campaign paused: weekend', { campaignId, action: 'weekend_pause' });
            await this.campaignService.updateProgress(campaignId, {
              status: CampaignStatus.PAUSED,
              currentIndex: i,
              messagesSentToday: sentToday,
              messagesSentThisHour: sentThisHour,
              hourWindowStart: new Date(hourWindowStart),
              dayWindowStart: new Date(dayWindowStart),
            });
            this.scheduleResumeToMonday(campaignId);
            return;
          }
        }

        if (sentToday >= freshCampaign.settings.dailyLimit) {
          this.logger.log(`Daily limit reached (${freshCampaign.settings.dailyLimit}), pausing until tomorrow`, {
            campaignId,
            action: 'daily_limit_pause',
          });
          await this.campaignService.updateProgress(campaignId, {
            status: CampaignStatus.PAUSED,
            currentIndex: i,
            messagesSentToday: sentToday,
            messagesSentThisHour: sentThisHour,
            hourWindowStart: new Date(hourWindowStart),
            dayWindowStart: new Date(dayWindowStart),
          });
          this.scheduleResumeToNextDay(campaignId);
          return;
        }

        if (sentThisHour >= freshCampaign.settings.hourlyLimit) {
          const waitMs = 3600000 - (Date.now() - hourWindowStart);
          if (waitMs > 0) {
            this.logger.log(`Hourly limit reached, waiting ${Math.round(waitMs / 1000)}s`, {
              campaignId,
              action: 'hourly_limit_wait',
            });
            await this.delay(waitMs);
          }
          hourWindowStart = Date.now();
          sentThisHour = 0;
        }

        const messageText = this.selectVariation(variations, spinningIndex);
        const rendered = renderTemplate(messageText, {
          name: contact.name ?? '',
          number: contact.number,
          ...contact.variables,
        });

        try {
          const engine = this.sessionService.getEngine(campaign.sessionId);
          if (!engine) {
            this.logger.error(`Session engine not available for ${campaign.sessionId}`, undefined, {
              campaignId,
              action: 'engine_unavailable',
            });
            await this.campaignService.updateProgress(campaignId, { status: CampaignStatus.FAILED });
            return;
          }

          const chatId = `${contact.number.replace('+', '')}@c.us`;
          const result = await engine.sendTextMessage(chatId, rendered);

          this.sentMessages.set(result.id, campaignId);

          sentToday++;
          sentThisHour++;
          spinningIndex++;

          await this.campaignService.updateProgress(campaignId, {
            sentCount: freshCampaign.sentCount + 1,
            currentIndex: i + 1,
            messagesSentToday: sentToday,
            messagesSentThisHour: sentThisHour,
            hourWindowStart: new Date(hourWindowStart),
            dayWindowStart: new Date(dayWindowStart),
          });

          this.logger.debug(`Message sent to ${contact.number}`, {
            campaignId,
            contact: contact.number,
            variationIndex: spinningIndex - 1,
            action: 'message_sent',
          });
        } catch (error) {
          this.logger.error(`Failed to send to ${contact.number}: ${String(error)}`, undefined, {
            campaignId,
            contact: contact.number,
            action: 'message_failed',
          });

          await this.campaignService.updateProgress(campaignId, {
            failedCount: freshCampaign.failedCount + 1,
          });

          if (freshCampaign.settings.warmupEnabled) {
            this.logger.warn('Warm-up mode: pausing after failure', { campaignId, action: 'warmup_pause' });
            await this.campaignService.updateProgress(campaignId, {
              status: CampaignStatus.PAUSED,
              currentIndex: i + 1,
            });
            return;
          }
        }

        const delayMs = this.calculateDelay(freshCampaign.settings);
        await this.delay(delayMs);
      }

      await this.campaignService.updateProgress(campaignId, {
        status: CampaignStatus.COMPLETED,
        completedAt: new Date(),
      });

      this.logger.log(`Campaign completed: ${campaign.name}`, {
        campaignId,
        action: 'execute_complete',
      });
    } catch (error) {
      this.logger.error(`Campaign execution failed: ${String(error)}`, undefined, {
        campaignId,
        action: 'execute_error',
      });
      await this.campaignService.updateProgress(campaignId, { status: CampaignStatus.FAILED });
    } finally {
      this.activeCampaigns.delete(campaignId);
    }
  }

  cancelCampaign(campaignId: string): void {
    const controller = this.activeCampaigns.get(campaignId);
    if (controller) {
      controller.abort();
      this.activeCampaigns.delete(campaignId);
      this.logger.log(`Campaign cancelled: ${campaignId}`, { campaignId, action: 'cancelled' });
    }
    const timer = this.resumeTimers.get(campaignId);
    if (timer) {
      clearTimeout(timer);
      this.resumeTimers.delete(campaignId);
    }
  }

  private async resolveContacts(campaign: Campaign): Promise<Array<{ number: string; name?: string; variables?: Record<string, string> }>> {
    if (campaign.contactSource === 'contact_list' && campaign.contactListId) {
      const list = await this.contactListRepo.findOne({ where: { id: campaign.contactListId } });
      return list?.contacts ?? [];
    }
    return campaign.manualContacts.map(number => ({ number }));
  }

  private selectVariation(variations: string[], index: number): string {
    return variations[index % variations.length];
  }

  private calculateDelay(settings: Campaign['settings']): number {
    const base = settings.delayMin + Math.random() * (settings.delayMax - settings.delayMin);
    return base * 1000;
  }

  private checkTimeWindow(settings: Campaign['settings']): { shouldPause: boolean; resumesAt: Date } {
    const now = new Date();
    const [startH, startM] = settings.timeWindowStart.split(':').map(Number);
    const [endH, endM] = settings.timeWindowEnd.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return { shouldPause: false, resumesAt: now };
    }

    const resumesAt = new Date(now);
    if (currentMinutes >= endMinutes) {
      resumesAt.setDate(resumesAt.getDate() + 1);
    }
    resumesAt.setHours(startH, startM, 0, 0);

    return { shouldPause: true, resumesAt };
  }

  private scheduleResume(campaignId: string, resumesAt: Date): void {
    const delay = resumesAt.getTime() - Date.now();
    if (delay <= 0) return;

    this.logger.log(`Scheduled resume at ${resumesAt.toISOString()}`, {
      campaignId,
      action: 'schedule_resume',
    });

    const timer = setTimeout(async () => {
      this.resumeTimers.delete(campaignId);
      const campaign = await this.campaignService.findOne(campaignId);
      if (campaign.status === CampaignStatus.PAUSED) {
        await this.campaignService.resume(campaignId);
        void this.executeCampaign(campaignId);
      }
    }, delay);
    timer.unref?.();
    this.resumeTimers.set(campaignId, timer);
  }

  private scheduleResumeToNextDay(campaignId: string): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    this.scheduleResume(campaignId, tomorrow);
  }

  private scheduleResumeToMonday(campaignId: string): void {
    const now = new Date();
    const daysUntilMonday = ((8 - now.getDay()) % 7) || 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + daysUntilMonday);
    monday.setHours(9, 0, 0, 0);
    this.scheduleResume(campaignId, monday);
  }

  private async checkScheduledCampaigns(): Promise<void> {
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60_000);
    const scheduled = await this.campaignRepo.find({
      where: {
        status: CampaignStatus.DRAFT,
      },
    });
    for (const c of scheduled) {
      if (c.scheduleAt && c.scheduleAt <= oneMinuteFromNow) {
        this.logger.log(`Auto-starting scheduled campaign: ${c.name}`, {
          campaignId: c.id,
          action: 'scheduled_auto_start',
        });
        await this.campaignService.start(c.id);
        void this.executeCampaign(c.id);
      }
    }
  }

  handleAck(messageId: string, status: DeliveryStatus): void {
    const campaignId = this.sentMessages.get(messageId);
    if (!campaignId) return;

    if (status === 'delivered') {
      void this.campaignRepo.increment({ id: campaignId }, 'deliveredCount', 1)
        .catch(() => {});
    } else if (status === 'read') {
      void this.campaignRepo.increment({ id: campaignId }, 'readCount', 1)
        .catch(() => {});
      this.sentMessages.delete(messageId);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
