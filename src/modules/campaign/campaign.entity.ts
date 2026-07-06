import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { jsonColumnType, dateColumnType } from '../../common/utils/column-types';
import { DateTransformer } from '../../common/transformers/date.transformer';

export enum CampaignStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum CampaignContactSource {
  MANUAL = 'manual',
  CSV = 'csv',
  CONTACT_LIST = 'contact_list',
}

export interface CampaignSettings {
  delayMin: number;
  delayMax: number;
  dailyLimit: number;
  hourlyLimit: number;
  timeWindowStart: string;
  timeWindowEnd: string;
  respectBusinessHours: boolean;
  skipWeekends: boolean;
  warmupEnabled: boolean;
  randomizeOrder?: boolean;
}

export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  delayMin: 30,
  delayMax: 90,
  dailyLimit: 500,
  hourlyLimit: 50,
  timeWindowStart: '09:00',
  timeWindowEnd: '21:00',
  respectBusinessHours: true,
  skipWeekends: false,
  warmupEnabled: false,
  randomizeOrder: false,
};

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Index()
  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Index()
  @Column({ type: 'varchar', default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Column({ name: 'message_template', type: 'text' })
  messageTemplate: string;

  @Column({ name: 'message_variations', type: jsonColumnType(), default: '[]' })
  messageVariations: string[];

  @Column({ name: 'contact_source', type: 'varchar', default: CampaignContactSource.MANUAL })
  contactSource: CampaignContactSource;

  @Column({ name: 'contact_list_id', type: 'varchar', length: 36, nullable: true })
  contactListId: string | null;

  @Column({ name: 'manual_contacts', type: jsonColumnType(), default: '[]' })
  manualContacts: string[];

  @Column({ name: 'total_contacts', type: 'int', default: 0 })
  totalContacts: number;

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sentCount: number;

  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount: number;

  @Column({ name: 'delivered_count', type: 'int', default: 0 })
  deliveredCount: number;

  @Column({ name: 'read_count', type: 'int', default: 0 })
  readCount: number;

  @Column({ type: jsonColumnType(), default: () => `'${JSON.stringify(DEFAULT_CAMPAIGN_SETTINGS)}'` })
  settings: CampaignSettings;

  @Column({ type: 'boolean', default: false })
  randomizeOrder: boolean;

  @Column({ name: 'schedule_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  scheduleAt: Date | null;

  @Column({ name: 'started_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  completedAt: Date | null;

  @Column({ name: 'current_index', type: 'int', default: 0 })
  currentIndex: number;

  @Column({ name: 'messages_sent_today', type: 'int', default: 0 })
  messagesSentToday: number;

  @Column({ name: 'messages_sent_this_hour', type: 'int', default: 0 })
  messagesSentThisHour: number;

  @Column({ name: 'hour_window_start', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  hourWindowStart: Date | null;

  @Column({ name: 'day_window_start', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  dayWindowStart: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
