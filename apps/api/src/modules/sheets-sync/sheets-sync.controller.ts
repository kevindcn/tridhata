import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { SheetsSyncService } from './sheets-sync.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContext } from '../../common/decorators/req-ctx.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AuthUser,
  ReqCtx,
  updateSheetMappingsSchema,
  UpdateSheetMappingsDto,
} from '@tridhata/shared';
import { z } from 'zod';

const runSyncSchema = z.object({
  locationId: z.string().uuid({ message: 'ID lokasi harus berformat UUID' }),
});

type RunSyncDto = z.infer<typeof runSyncSchema>;

@Controller('sync')
export class SheetsSyncController {
  constructor(private readonly syncService: SheetsSyncService) {}

  @RequirePermissions('dashboard:read')
  @Get('status')
  async getStatus(@Query('locationId') locationId?: string) {
    if (!locationId) {
      throw new BadRequestException('Parameter locationId wajib disertakan');
    }
    return this.syncService.getSyncStatus(locationId);
  }

  @RequirePermissions('sync:manage')
  @Post('run')
  async runSync(
    @Body(new ZodValidationPipe(runSyncSchema)) dto: RunSyncDto,
    @CurrentUser() user: AuthUser,
    @RequestContext() ctx: ReqCtx,
  ) {
    return this.syncService.syncLocation(
      dto.locationId,
      'MANUAL',
      user.id,
      ctx,
    );
  }

  @RequirePermissions('sync:manage')
  @Get('mappings')
  async getMappings(@Query('locationId') locationId?: string) {
    if (!locationId) {
      throw new BadRequestException('Parameter locationId wajib disertakan');
    }
    return this.syncService.getMappings(locationId);
  }

  @RequirePermissions('sync:manage')
  @Put('mappings')
  async updateMappings(
    @Query('locationId') locationId: string,
    @Body(new ZodValidationPipe(updateSheetMappingsSchema))
    dto: UpdateSheetMappingsDto,
    @CurrentUser() user: AuthUser,
    @RequestContext() ctx: ReqCtx,
  ) {
    if (!locationId) {
      throw new BadRequestException('Parameter locationId wajib disertakan');
    }
    return this.syncService.updateMappings(locationId, dto, user.id, ctx);
  }
}
