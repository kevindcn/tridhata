import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SheetsSyncService } from './sheets-sync.service';
import { SheetsSyncController } from './sheets-sync.controller';
import { SheetsSyncScheduler } from './sheets-sync.scheduler';
import { GoogleSheetsClient, SHEETS_CLIENT } from './sheets.client';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SheetsSyncController],
  providers: [
    SheetsSyncService,
    SheetsSyncScheduler,
    {
      provide: SHEETS_CLIENT,
      useClass: GoogleSheetsClient,
    },
  ],
  exports: [SheetsSyncService],
})
export class SheetsSyncModule {}
