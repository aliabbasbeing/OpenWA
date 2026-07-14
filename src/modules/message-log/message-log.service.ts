import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import {
  MessageLog,
  MessageLogDirection,
  MessageLogType,
  MessageLogStatus,
} from './message-log.entity';
import { createLogger } from '../../common/services/logger.service';

export interface LogMessageOptions {
  sessionId: string;
  sessionName?: string;
  direction?: MessageLogDirection;
  type?: MessageLogType;
  chatId: string;
  contactNumber: string;
  contactName?: string;
  body: string;
  status?: MessageLogStatus;
  errorMessage?: string;
  waMessageId?: string;
  campaignId?: string;
  campaignName?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageLogQueryOptions {
  page?: number;
  limit?: number;
  sessionId?: string;
  status?: MessageLogStatus;
  direction?: MessageLogDirection;
  type?: MessageLogType;
  contactNumber?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  campaignId?: string;
}

@Injectable()
export class MessageLogService {
  private readonly logger = createLogger('MessageLogService');

  constructor(
    @InjectRepository(MessageLog, 'data')
    private readonly logRepo: Repository<MessageLog>,
  ) {}

  async log(options: LogMessageOptions): Promise<MessageLog> {
    const entry = this.logRepo.create({
      sessionId: options.sessionId,
      sessionName: options.sessionName ?? null,
      direction: options.direction ?? MessageLogDirection.OUTBOUND,
      type: options.type ?? MessageLogType.TEXT,
      chatId: options.chatId,
      contactNumber: options.contactNumber,
      contactName: options.contactName ?? null,
      body: options.body,
      status: options.status ?? MessageLogStatus.PENDING,
      errorMessage: options.errorMessage ?? null,
      waMessageId: options.waMessageId ?? null,
      campaignId: options.campaignId ?? null,
      campaignName: options.campaignName ?? null,
      metadata: options.metadata ?? null,
    });
    return this.logRepo.save(entry);
  }

  async updateStatus(
    waMessageId: string,
    status: MessageLogStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.logRepo.update(
      { waMessageId },
      { status, ...(errorMessage ? { errorMessage } : {}) } as any,
    );
  }

  async findAll(options: MessageLogQueryOptions): Promise<{ data: MessageLog[]; total: number }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 200);
    const where: Record<string, unknown> = {};

    if (options.sessionId) where.sessionId = options.sessionId;
    if (options.status) where.status = options.status;
    if (options.direction) where.direction = options.direction;
    if (options.type) where.type = options.type;
    if (options.campaignId) where.campaignId = options.campaignId;

    if (options.contactNumber) {
      where.contactNumber = Like(`%${options.contactNumber}%`);
    }

    if (options.search) {
      where.body = Like(`%${options.search}%`);
    }

    if (options.dateFrom && options.dateTo) {
      where.createdAt = Between(new Date(options.dateFrom), new Date(options.dateTo));
    } else if (options.dateFrom) {
      where.createdAt = Between(new Date(options.dateFrom), new Date());
    }

    const [data, total] = await this.logRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async findOne(id: string): Promise<MessageLog | null> {
    return this.logRepo.findOne({ where: { id } });
  }

  async getStats(): Promise<Record<string, number>> {
    const total = await this.logRepo.count();
    const sent = await this.logRepo.count({ where: { status: MessageLogStatus.SENT } });
    const delivered = await this.logRepo.count({ where: { status: MessageLogStatus.DELIVERED } });
    const read = await this.logRepo.count({ where: { status: MessageLogStatus.READ } });
    const failed = await this.logRepo.count({ where: { status: MessageLogStatus.FAILED } });
    const skipped = await this.logRepo.count({ where: { status: MessageLogStatus.SKIPPED } });
    return { total, sent, delivered, read, failed, skipped };
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const result = await this.logRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}
