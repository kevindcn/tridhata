import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { LocationsModule } from '../locations/locations.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [LocationsModule, AuditModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
