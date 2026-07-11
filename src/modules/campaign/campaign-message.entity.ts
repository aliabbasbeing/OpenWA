import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum CampaignMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Entity('campaign_messages')
@Index(['campaignId', 'contactNumber'])
export class CampaignMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  campaignId: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  sessionId: string;

  @Column({ type: 'varchar', length: 50 })
  contactNumber: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  contactName: string | null;

  @Column({ type: 'text' })
  renderedMessage: string;

  @Column({ type: 'varchar', length: 50, default: CampaignMessageStatus.PENDING })
  status: CampaignMessageStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  waMessageId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 0 })
  messageIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'date', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'date', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'date', nullable: true })
  readAt: Date | null;

  @Column({ type: 'date', nullable: true })
  failedAt: Date | null;
}
