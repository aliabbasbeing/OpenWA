import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { jsonColumnType } from '../../common/utils/column-types';

export enum MessageLogDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageLogType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  CAMPAIGN = 'campaign',
  TEMPLATE = 'template',
}

export enum MessageLogStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('message_logs')
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ name: 'session_name', type: 'varchar', length: 100, nullable: true })
  sessionName: string | null;

  @Column({ type: 'varchar', length: 10, default: MessageLogDirection.OUTBOUND })
  direction: MessageLogDirection;

  @Column({ type: 'varchar', length: 20, default: MessageLogType.TEXT })
  type: MessageLogType;

  @Index()
  @Column({ name: 'chat_id', type: 'varchar', length: 100 })
  chatId: string;

  @Index()
  @Column({ name: 'contact_number', type: 'varchar', length: 50 })
  contactNumber: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 200, nullable: true })
  contactName: string | null;

  @Column({ type: 'text' })
  body: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: MessageLogStatus.PENDING })
  status: MessageLogStatus;

  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true })
  errorMessage: string | null;

  @Column({ name: 'wa_message_id', type: 'varchar', length: 100, nullable: true })
  waMessageId: string | null;

  @Index()
  @Column({ name: 'campaign_id', type: 'varchar', length: 36, nullable: true })
  campaignId: string | null;

  @Column({ name: 'campaign_name', type: 'varchar', length: 200, nullable: true })
  campaignName: string | null;

  @Column({ type: jsonColumnType(), nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
