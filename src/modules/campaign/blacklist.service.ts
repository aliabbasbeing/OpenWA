import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BlacklistEntry, BlacklistReason } from './blacklist.entity';
import { AddToBlacklistDto, ImportBlacklistDto } from './dto/blacklist.dto';
import { createLogger } from '../../common/services/logger.service';

@Injectable()
export class BlacklistService {
  private readonly logger = createLogger('BlacklistService');

  constructor(
    @InjectRepository(BlacklistEntry, 'data')
    private readonly repo: Repository<BlacklistEntry>,
  ) {}

  async add(dto: AddToBlacklistDto): Promise<BlacklistEntry> {
    const where: Record<string, unknown> = { number: dto.number };
    if (dto.sessionId) where.sessionId = dto.sessionId;
    const existing = await this.repo.findOne({ where });
    if (existing) return existing;

    const entry = this.repo.create({
      number: dto.number,
      reason: dto.reason ?? BlacklistReason.MANUAL,
      sessionId: dto.sessionId ?? undefined,
    });

    const saved = await this.repo.save(entry);
    this.logger.log(`Blacklisted: ${saved.number} (${saved.reason})`, {
      blacklistId: saved.id,
      action: 'add',
    });
    return saved;
  }

  async import(dto: ImportBlacklistDto): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const number of dto.numbers) {
      const normalized = number.replace(/[\s\-()]/g, '');
      const formatted = normalized.startsWith('+') ? normalized : `+${normalized}`;

      const where: Record<string, unknown> = { number: formatted };
      if (dto.sessionId) where.sessionId = dto.sessionId;
      const existing = await this.repo.findOne({ where });
      if (existing) {
        skipped++;
        continue;
      }

      const entry = this.repo.create({
        number: formatted,
        reason: dto.reason ?? BlacklistReason.MANUAL,
        sessionId: dto.sessionId ?? null,
      });
      await this.repo.save(entry);
      imported++;
    }

    this.logger.log(`Blacklist import: ${imported} imported, ${skipped} skipped`, {
      action: 'import',
    });
    return { imported, skipped };
  }

  async findAll(sessionId?: string): Promise<BlacklistEntry[]> {
    const where = sessionId ? { sessionId } : {};
    return this.repo.find({ where, order: { addedAt: 'DESC' } });
  }

  async isBlacklisted(number: string, sessionId?: string): Promise<{ isBlacklisted: boolean; entry?: BlacklistEntry }> {
    const where: Record<string, unknown> = { number };
    if (sessionId) where.sessionId = sessionId;
    const entry = await this.repo.findOne({ where });
    return { isBlacklisted: !!entry, entry: entry ?? undefined };
  }

  async getBlacklistedNumbers(sessionId?: string): Promise<string[]> {
    const where: Record<string, unknown> = {};
    if (sessionId) where.sessionId = sessionId;
    const entries = await this.repo.find({ where, select: ['number'] });
    return entries.map(e => e.number);
  }

  async remove(id: string): Promise<void> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Blacklist entry '${id}' not found`);
    await this.repo.remove(entry);
    this.logger.log(`Removed from blacklist: ${entry.number}`, {
      blacklistId: id,
      action: 'remove',
    });
  }
}
