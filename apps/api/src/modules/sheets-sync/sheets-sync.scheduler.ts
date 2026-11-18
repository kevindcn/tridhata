import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../prisma/prisma.service';
import { SheetsSyncService } from './sheets-sync.service';

@Injectable()
export class SheetsSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SheetsSyncScheduler.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly syncService: SheetsSyncService,
  ) {}

  onModuleInit() {
    const syncEnabled = process.env.SYNC_ENABLED !== 'false';
    if (!syncEnabled) {
      this.logger.log('SYNC_ENABLED=false: Cron job sinkronisasi Sheets dinonaktifkan.');
      return;
    }

    const cronTime = process.env.SYNC_CRON || '*/15 * * * *';
    this.logger.log(
      `Mendaftarkan cron job sinkronisasi Sheets '${cronTime}' zona Asia/Jakarta...`,
    );

    const job = new CronJob(
      cronTime,
      async () => {
        await this.handleCron();
      },
      null,
      true,
      'Asia/Jakarta',
    );

    this.schedulerRegistry.addCronJob('sheets-sync-job', job);
  }

  async handleCron() {
    this.logger.log('Memulai sinkronisasi otomatis Google Sheets (Cron)...');

    const locations = await this.prisma.location.findMany({
      orderBy: { code: 'asc' },
    });

    for (const loc of locations) {
      try {
        this.logger.log(`Menjalankan sinkronisasi untuk lokasi ${loc.name} (${loc.code})...`);
        const res = await this.syncService.syncLocation(loc.id, 'CRON');
        if (res.skipped) {
          this.logger.warn(`Sinkronisasi lokasi ${loc.code} dilewati karena sedang berjalan.`);
        } else {
          this.logger.log(
            `Selesai sinkronisasi lokasi ${loc.code}: status ${res.status}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Gagal menjalankan sinkronisasi untuk lokasi ${loc.code}: ${err}`,
        );
      }
    }
  }
}
