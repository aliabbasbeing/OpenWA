import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { SessionService } from './session.service';
import { createLogger } from '../../common/services/logger.service';

@Injectable()
export class AutoRestartService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('AutoRestartService');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Session, 'data')
    private readonly sessionRepository: Repository<Session>,
    private readonly sessionService: SessionService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.checkAndRestart();
    }, 60_000);
    this.logger.log('Auto-restart scheduler initialized (checking every 60s)');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkAndRestart(): Promise<void> {
    try {
      const now = new Date();
      const sessions = await this.sessionRepository.find({
        where: { autoRestart: true },
      });

      for (const session of sessions) {
        const intervalMs = session.autoRestartIntervalHours * 60 * 60 * 1000;
        const lastRun = session.autoRestartLastRun?.getTime() ?? 0;
        const nextRun = lastRun + intervalMs;

        if (now.getTime() >= nextRun) {
          this.logger.log(`Auto-restarting session: ${session.name} (interval: ${session.autoRestartIntervalHours}h)`, {
            sessionId: session.id,
            action: 'auto_restart_triggered',
          });

          try {
            if (['ready', 'initializing', 'connecting', 'qr_ready'].includes(session.status)) {
              await this.sessionService.stop(session.id);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }

            await this.sessionService.start(session.id);

            session.autoRestartLastRun = now;
            await this.sessionRepository.save(session);

            this.logger.log(`Auto-restart completed for session: ${session.name}`, {
              sessionId: session.id,
              action: 'auto_restart_completed',
            });
          } catch (error) {
            this.logger.error(`Auto-restart failed for session: ${session.name}`, String(error), {
              sessionId: session.id,
              action: 'auto_restart_failed',
            });
            session.autoRestartLastRun = now;
            await this.sessionRepository.save(session);
          }
        }
      }
    } catch (error) {
      this.logger.error('Auto-restart check failed', String(error), {
        action: 'auto_restart_check_failed',
      });
    }
  }
}
