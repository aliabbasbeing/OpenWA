import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageLog } from './message-log.entity';
import { MessageLogService } from './message-log.service';
import { MessageLogController } from './message-log.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MessageLog], 'data')],
  controllers: [MessageLogController],
  providers: [MessageLogService],
  exports: [MessageLogService],
})
export class MessageLogModule {}
