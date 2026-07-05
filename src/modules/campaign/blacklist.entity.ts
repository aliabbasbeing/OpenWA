import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum BlacklistReason {
  MANUAL = 'manual',
  FAILED = 'failed',
  OPT_OUT = 'opt_out',
  INVALID = 'invalid',
}

@Entity('blacklist')
export class BlacklistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  number: string;

  @Column({ type: 'varchar', default: BlacklistReason.MANUAL })
  reason: BlacklistReason;

  @Index()
  @Column({ name: 'session_id', type: 'varchar', length: 36, nullable: true })
  sessionId: string | null;

  @Column({ name: 'campaign_id', type: 'varchar', length: 36, nullable: true })
  campaignId: string | null;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
