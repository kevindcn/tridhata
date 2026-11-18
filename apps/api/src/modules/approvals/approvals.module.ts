import { Module } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocationsModule } from '../locations/locations.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, LocationsModule, AuditModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
