import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './campaign.entity';
import { ContactList } from './contact-list.entity';
import { BlacklistEntry } from './blacklist.entity';
import { CampaignMessage } from './campaign-message.entity';
import { CampaignService } from './campaign.service';
import { ContactListService } from './contact-list.service';
import { BlacklistService } from './blacklist.service';
import { CampaignExecutorService } from './campaign-executor.service';
import { CampaignController } from './campaign.controller';
import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, ContactList, BlacklistEntry, CampaignMessage], 'data'),
    AuditModule,
    SessionModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService, ContactListService, BlacklistService, CampaignExecutorService],
  exports: [CampaignService, ContactListService, BlacklistService, CampaignExecutorService],
})
export class CampaignModule {}
