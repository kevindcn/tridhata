import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { DashboardService, getJakartaDateParts } from './dashboard.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContext } from '../../common/decorators/req-ctx.decorator';
import { AuthUser, ReqCtx, StockStatus } from '@tridhata/shared';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermissions('dashboard:read')
  @Get('sales')
  async getSales(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!locationId) {
      throw new BadRequestException('Parameter locationId wajib disertakan');
    }
    const nowJakarta = getJakartaDateParts();
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultFrom = `${nowJakarta.year}-${pad(nowJakarta.month)}-01`;
    const defaultTo = `${nowJakarta.year}-${pad(nowJakarta.month)}-${pad(nowJakarta.day)}`;

    return this.dashboardService.getSalesDashboard(user, {
      locationId,
      from: from || defaultFrom,
      to: to || defaultTo,
    });
  }

  @RequirePermissions('dashboard:read')
  @Get('inventory')
  async getInventory(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
  ) {
    if (!locationId) {
      throw new BadRequestException('Parameter locationId wajib disertakan');
    }
    return this.dashboardService.getInventoryDashboard(
      user,
      locationId,
      status as StockStatus,
    );
  }

  @RequirePermissions('dashboard:read')
  @Get('production')
  async getProduction(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
    @Query('period') period?: string,
  ) {
    if (!locationId) {
      throw new BadRequestException('Parameter locationId wajib disertakan');
    }
    return this.dashboardService.getProductionDashboard(
      user,
      locationId,
      period,
    );
  }

  @RequirePermissions('export:run')
  @Get(':page/export')
  async exportCsv(
    @Param('page') page: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthUser,
    @RequestContext() ctx: ReqCtx,
    @Res() reply: FastifyReply,
  ) {
    if (!['sales', 'production', 'inventory'].includes(page)) {
      throw new BadRequestException('Halaman ekspor tidak valid');
    }

    const { filename, csv } = await this.dashboardService.exportDashboard(
      user,
      page as 'sales' | 'production' | 'inventory',
      query,
      ctx,
    );

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv);
  }
}
