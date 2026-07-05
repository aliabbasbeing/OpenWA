import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { jsonColumnType } from '../../common/utils/column-types';

export enum ContactListSource {
  CSV = 'csv',
  MANUAL = 'manual',
  WHATSAPP = 'whatsapp',
}

export interface ContactEntry {
  number: string;
  name?: string;
  variables?: Record<string, string>;
}

@Entity('contact_lists')
export class ContactList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Index()
  @Column({ name: 'session_id', type: 'varchar', length: 36, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', default: ContactListSource.MANUAL })
  source: ContactListSource;

  @Column({ type: jsonColumnType(), default: '[]' })
  contacts: ContactEntry[];

  @Column({ name: 'contact_count', type: 'int', default: 0 })
  contactCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
