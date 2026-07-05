import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactList, ContactEntry, ContactListSource } from './contact-list.entity';
import { CreateContactListDto, ImportCsvContactListDto } from './dto/contact-list.dto';
import { createLogger } from '../../common/services/logger.service';

@Injectable()
export class ContactListService {
  private readonly logger = createLogger('ContactListService');

  constructor(
    @InjectRepository(ContactList, 'data')
    private readonly repo: Repository<ContactList>,
  ) {}

  async create(dto: CreateContactListDto): Promise<ContactList> {
    const contacts: ContactEntry[] = (dto.contacts ?? []).map(c => ({
      number: this.normalizeNumber(c.number),
      name: c.name,
      variables: c.variables,
    }));

    const list = this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
      sessionId: dto.sessionId ?? null,
      source: dto.source ?? ContactListSource.MANUAL,
      contacts,
      contactCount: contacts.length,
    });

    const saved = await this.repo.save(list);
    this.logger.log(`Contact list created: ${saved.name} (${saved.contactCount} contacts)`, {
      contactListId: saved.id,
      action: 'create',
    });
    return saved;
  }

  async importCsv(dto: ImportCsvContactListDto): Promise<ContactList> {
    const contacts: ContactEntry[] = dto.data.map(row => {
      const number = this.normalizeNumber(row[dto.phoneColumn]);
      const name = dto.nameColumn ? row[dto.nameColumn] : undefined;
      const variables: Record<string, string> = {};

      if (dto.variableColumns) {
        for (const [varName, colName] of Object.entries(dto.variableColumns)) {
          if (row[colName]) {
            variables[varName] = row[colName];
          }
        }
      }

      return { number, name, variables: Object.keys(variables).length > 0 ? variables : undefined };
    });

    const validContacts = contacts.filter(c => c.number && c.number.length >= 8);

    if (validContacts.length === 0) {
      throw new BadRequestException('No valid phone numbers found in CSV data');
    }

    const list = this.repo.create({
      name: dto.name,
      description: null,
      sessionId: dto.sessionId ?? null,
      source: ContactListSource.CSV,
      contacts: validContacts,
      contactCount: validContacts.length,
    });

    const saved = await this.repo.save(list);
    this.logger.log(`CSV import: ${saved.name} (${saved.contactCount} contacts from ${dto.data.length} rows)`, {
      contactListId: saved.id,
      action: 'csv_import',
    });
    return saved;
  }

  async findAll(sessionId?: string): Promise<ContactList[]> {
    const where = sessionId ? { sessionId } : {};
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ContactList> {
    const list = await this.repo.findOne({ where: { id } });
    if (!list) throw new NotFoundException(`Contact list '${id}' not found`);
    return list;
  }

  async addContacts(id: string, contacts: Array<{ number: string; name?: string; variables?: Record<string, string> }>): Promise<ContactList> {
    const list = await this.findOne(id);
    const newEntries: ContactEntry[] = contacts.map(c => ({
      number: this.normalizeNumber(c.number),
      name: c.name,
      variables: c.variables,
    }));
    list.contacts = [...list.contacts, ...newEntries];
    list.contactCount = list.contacts.length;
    const saved = await this.repo.save(list);
    this.logger.log(`Added ${newEntries.length} contacts to ${saved.name} (total: ${saved.contactCount})`, {
      contactListId: id,
      action: 'add_contacts',
    });
    return saved;
  }

  async delete(id: string): Promise<void> {
    const list = await this.findOne(id);
    await this.repo.remove(list);
    this.logger.log(`Contact list deleted: ${list.name}`, {
      contactListId: id,
      action: 'delete',
    });
  }

  async importCsvFile(id: string, csvText: string): Promise<ContactList> {
    const list = await this.findOne(id);
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new BadRequestException('CSV must have a header row and at least one data row');

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const phoneIdx = headers.findIndex(h => /^phone|number|mobile|cell|tel/i.test(h));
    if (phoneIdx === -1) throw new BadRequestException('No phone/number column found in CSV headers');

    const nameIdx = headers.findIndex(h => /^name|first.?name|contact$/i.test(h));
    const newContacts: ContactEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const number = this.normalizeNumber(cols[phoneIdx] ?? '');
      if (!number || number.length < 8) continue;

      const name = nameIdx >= 0 ? cols[nameIdx] : undefined;
      const variables: Record<string, string> = {};
      for (let h = 0; h < headers.length; h++) {
        if (h !== phoneIdx && h !== nameIdx && cols[h]) {
          variables[headers[h]] = cols[h];
        }
      }
      newContacts.push({ number, name, variables: Object.keys(variables).length > 0 ? variables : undefined });
    }

    if (newContacts.length === 0) throw new BadRequestException('No valid phone numbers found in CSV');

    list.contacts = [...list.contacts, ...newContacts];
    list.contactCount = list.contacts.length;
    const saved = await this.repo.save(list);
    this.logger.log(`CSV file import to ${saved.name}: ${newContacts.length} contacts added (total: ${saved.contactCount})`, {
      contactListId: id,
      action: 'csv_file_import',
    });
    return saved;
  }

  private normalizeNumber(number: string): string {
    const cleaned = number.replace(/[\s\-()]/g, '');
    if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    return cleaned;
  }
}
