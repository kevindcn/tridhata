import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { AuditService } from '../audit/audit.service';
import {
  AuthUser,
  DashboardQueryDto,
  InventoryDashboard,
  ProductionDashboard,
  ReqCtx,
  SalesDashboard,
  StockStatus,
} from '@tridhata/shared';

export function getJakartaDateParts(d: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(d);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function computeStockStatus(
  qty: number,
  safetyStock: number,
  minStock: number,
): StockStatus {
  if (qty === 0) return 'EMPTY';
  if (qty < safetyStock) return 'CRITICAL';
  if (qty < minStock) return 'MINIMUM';
  return 'SAFE';
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locationsService: LocationsService,
    private readonly auditService: AuditService,
  ) {}

  async getSalesDashboard(
    user: AuthUser,
    query: DashboardQueryDto,
  ): Promise<SalesDashboard> {
    await this.locationsService.assertLocation(user, query.locationId);

    const hasFinance = user.permissions.includes('finance:read');
    const nowJakarta = getJakartaDateParts();

    // Default dates if omitted
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromStr =
      query.from ||
      `${nowJakarta.year}-${pad(nowJakarta.month)}-01`;
    const toStr =
      query.to ||
      `${nowJakarta.year}-${pad(nowJakarta.month)}-${pad(nowJakarta.day)}`;

    const fromDate = new Date(`${fromStr}T00:00:00+07:00`);
    const toDate = new Date(`${toStr}T23:59:59.999+07:00`);

    const fromParts = getJakartaDateParts(fromDate);
    const toParts = getJakartaDateParts(toDate);

    const daysInMonth = getDaysInMonth(fromParts.year, fromParts.month);

    // Calculate daysElapsed: if range starts at 1st of month, daysElapsed is toParts.day
    let daysElapsed =
      fromParts.day === 1 && fromParts.month === toParts.month
        ? toParts.day
        : Math.max(
            1,
            Math.round(
              (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000),
            ),
          );

    if (daysElapsed < 1) daysElapsed = 1;

    // Check last sync success
    const lastSync = await this.prisma.syncRun.findFirst({
      where: {
        locationId: query.locationId,
        status: { in: ['SUCCESS', 'PARTIAL'] },
      },
      orderBy: { finishedAt: 'desc' },
    });

    const lastSuccessAt = lastSync?.finishedAt
      ? lastSync.finishedAt.toISOString()
      : null;

    const staleAfterMinutes = Number(process.env.SYNC_STALE_MINUTES) || 120;
    const stale =
      !lastSync?.finishedAt ||
      (Date.now() - lastSync.finishedAt.getTime()) / (60 * 1000) >
        staleAfterMinutes;

    // 1. Sales in range
    const sales = await this.prisma.sale.findMany({
      where: {
        locationId: query.locationId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        product: true,
      },
    });

    // 2. Previous month revenue
    let previousMonthRevenue: number | null = null;
    if (hasFinance) {
      let prevYear = fromParts.year;
      let prevMonth = fromParts.month - 1;
      if (prevMonth < 1) {
        prevMonth = 12;
        prevYear -= 1;
      }
      const prevDays = getDaysInMonth(prevYear, prevMonth);
      const prevFrom = new Date(
        `${prevYear}-${pad(prevMonth)}-01T00:00:00+07:00`,
      );
      const prevTo = new Date(
        `${prevYear}-${pad(prevMonth)}-${pad(prevDays)}T23:59:59.999+07:00`,
      );

      const prevSalesSum = await this.prisma.sale.aggregate({
        where: {
          locationId: query.locationId,
          date: { gte: prevFrom, lte: prevTo },
        },
        _sum: { total: true },
      });

      previousMonthRevenue = prevSalesSum._sum.total
        ? Number(prevSalesSum._sum.total)
        : 0;
    }

    // 3. Products, Stock Levels, and Forecasts
    const products = await this.prisma.product.findMany({
      where: { active: true },
      include: {
        stock: {
          where: { locationId: query.locationId },
        },
        forecasts: {
          where: {
            locationId: query.locationId,
            period: `${fromParts.year}-${pad(fromParts.month)}`,
          },
        },
      },
    });

    // Aggregate totals
    let totalRevenue = 0;
    let totalSoldQty = 0;

    const salesBySku = new Map<string, number>();
    const salesByDate = new Map<string, { qty: number; revenue: number }>();

    for (const sale of sales) {
      const q = sale.qty;
      const t = Number(sale.total);
      totalSoldQty += q;
      totalRevenue += t;

      salesBySku.set(sale.product.sku, (salesBySku.get(sale.product.sku) || 0) + q);

      const dStr = sale.date.toISOString().slice(0, 10);
      const existing = salesByDate.get(dStr) || { qty: 0, revenue: 0 };
      existing.qty += q;
      existing.revenue += t;
      salesByDate.set(dStr, existing);
    }

    // Daily breakdown
    const daily: Array<{ date: string; qty: number; revenue: number | null }> = [];
    const curr = new Date(fromDate);
    while (curr <= toDate) {
      const dStr = curr.toISOString().slice(0, 10);
      const data = salesByDate.get(dStr) || { qty: 0, revenue: 0 };
      daily.push({
        date: dStr,
        qty: data.qty,
        revenue: hasFinance ? data.revenue : null,
      });
      curr.setDate(curr.getDate() + 1);
    }

    // Products table and shortage calculation
    let totalFullMonthForecast = 0;
    let shortageSkuCount = 0;
    let emptySkuCount = 0;
    let criticalSkuCount = 0;
    let stockShortageQty = 0;
    let totalStockValue = 0;

    const productRows = products.map((prod) => {
      const stockLevel = prod.stock[0];
      const stockQty = stockLevel?.qty ?? 0;
      const minStock = stockLevel?.minStock ?? 0;
      const safetyStock = stockLevel?.safetyStock ?? 0;

      const fullForecast = prod.forecasts[0]?.qty ?? 0;
      totalFullMonthForecast += fullForecast;

      const proportionalForecast = Math.round(
        (fullForecast * daysElapsed) / daysInMonth,
      );

      const soldSku = salesBySku.get(prod.sku) ?? 0;
      const pct =
        proportionalForecast > 0
          ? (soldSku / proportionalForecast) * 100
          : null;

      const status = computeStockStatus(stockQty, safetyStock, minStock);

      if (status === 'EMPTY') emptySkuCount++;
      if (status === 'CRITICAL') criticalSkuCount++;

      // Projected SKU at month end
      const projectedSku =
        daysElapsed > 0
          ? Math.round((soldSku / daysElapsed) * daysInMonth)
          : soldSku;

      const shortage = Math.max(0, projectedSku - soldSku - stockQty);
      if (shortage > 0) {
        shortageSkuCount++;
        stockShortageQty += shortage;
      }

      totalStockValue += stockQty * Number(prod.cost);

      return {
        sku: prod.sku,
        name: prod.name,
        soldQty: soldSku,
        forecastQty: proportionalForecast,
        pct: pct !== null ? Math.round(pct) : null,
        stockQty,
        status,
      };
    });

    const forecastQty = Math.round(
      (totalFullMonthForecast * daysElapsed) / daysInMonth,
    );

    const soldVsForecastPct =
      forecastQty > 0 ? (totalSoldQty / forecastQty) * 100 : null;

    const projectedMonthEndQty =
      daysElapsed > 0
        ? Math.round((totalSoldQty / daysElapsed) * daysInMonth)
        : null;

    return {
      meta: {
        locationId: query.locationId,
        from: fromStr,
        to: toStr,
        daysElapsed,
        daysInMonth,
        lastSuccessAt,
        stale,
      },
      cards: {
        revenue: hasFinance ? totalRevenue : null,
        previousMonthRevenue,
        soldQty: totalSoldQty,
        forecastQty,
        soldVsForecastPct:
          soldVsForecastPct !== null ? Math.round(soldVsForecastPct) : null,
        projectedMonthEndQty,
        stockShortageQty,
        shortageSkuCount,
        emptySkuCount,
        criticalSkuCount,
        stockValue: hasFinance ? totalStockValue : null,
      },
      daily,
      products: productRows,
    };
  }

  async getInventoryDashboard(
    user: AuthUser,
    locationId: string,
    statusFilter?: StockStatus,
  ): Promise<InventoryDashboard> {
    await this.locationsService.assertLocation(user, locationId);
    const hasFinance = user.permissions.includes('finance:read');

    const lastSync = await this.prisma.syncRun.findFirst({
      where: {
        locationId,
        status: { in: ['SUCCESS', 'PARTIAL'] },
      },
      orderBy: { finishedAt: 'desc' },
    });

    const lastSuccessAt = lastSync?.finishedAt
      ? lastSync.finishedAt.toISOString()
      : null;

    const staleAfterMinutes = Number(process.env.SYNC_STALE_MINUTES) || 120;
    const stale =
      !lastSync?.finishedAt ||
      (Date.now() - lastSync.finishedAt.getTime()) / (60 * 1000) >
        staleAfterMinutes;

    const products = await this.prisma.product.findMany({
      where: { active: true },
      include: {
        stock: {
          where: { locationId },
        },
      },
      orderBy: { sku: 'asc' },
    });

    let safeCount = 0;
    let minimumCount = 0;
    let criticalCount = 0;
    let emptyCount = 0;
    let totalStockValue = 0;

    const rows = products.map((prod) => {
      const stock = prod.stock[0];
      const qty = stock?.qty ?? 0;
      const minStock = stock?.minStock ?? 0;
      const safetyStock = stock?.safetyStock ?? 0;
      const status = computeStockStatus(qty, safetyStock, minStock);

      if (status === 'SAFE') safeCount++;
      else if (status === 'MINIMUM') minimumCount++;
      else if (status === 'CRITICAL') criticalCount++;
      else if (status === 'EMPTY') emptyCount++;

      const cost = Number(prod.cost);
      const val = qty * cost;
      totalStockValue += val;

      return {
        sku: prod.sku,
        name: prod.name,
        qty,
        minStock,
        safetyStock,
        status,
        value: hasFinance ? val : null,
        syncedAt: stock?.syncedAt
          ? stock.syncedAt.toISOString()
          : new Date().toISOString(),
      };
    });

    const filteredRows = statusFilter
      ? rows.filter((r) => r.status === statusFilter)
      : rows;

    return {
      meta: {
        locationId,
        lastSuccessAt,
        stale,
      },
      cards: {
        totalSku: products.length,
        safeCount,
        minimumCount,
        criticalCount,
        emptyCount,
        stockValue: hasFinance ? totalStockValue : null,
      },
      rows: filteredRows,
    };
  }

  async getProductionDashboard(
    user: AuthUser,
    locationId: string,
    periodQuery?: string,
  ): Promise<ProductionDashboard> {
    await this.locationsService.assertLocation(user, locationId);

    const nowJakarta = getJakartaDateParts();
    const pad = (n: number) => String(n).padStart(2, '0');
    const period = periodQuery || `${nowJakarta.year}-${pad(nowJakarta.month)}`;

    const lastSync = await this.prisma.syncRun.findFirst({
      where: {
        locationId,
        status: { in: ['SUCCESS', 'PARTIAL'] },
      },
      orderBy: { finishedAt: 'desc' },
    });

    const lastSuccessAt = lastSync?.finishedAt
      ? lastSync.finishedAt.toISOString()
      : null;

    const staleAfterMinutes = Number(process.env.SYNC_STALE_MINUTES) || 120;
    const stale =
      !lastSync?.finishedAt ||
      (Date.now() - lastSync.finishedAt.getTime()) / (60 * 1000) >
        staleAfterMinutes;

    const targets = await this.prisma.productionTarget.findMany({
      where: {
        locationId,
        period,
      },
      include: {
        product: true,
      },
      orderBy: { product: { sku: 'asc' } },
    });

    let totalTarget = 0;
    let totalActual = 0;
    let skuReached = 0;
    let skuBelow = 0;

    const rows = targets.map((t) => {
      const target = t.targetQty;
      const actual = t.actualQty;
      totalTarget += target;
      totalActual += actual;

      if (target > 0 && actual >= target) {
        skuReached++;
      } else if (actual < target) {
        skuBelow++;
      }

      const pct = target > 0 ? (actual / target) * 100 : null;
      const gap = target - actual;

      return {
        sku: t.product.sku,
        name: t.product.name,
        target,
        actual,
        pct: pct !== null ? Math.round(pct) : null,
        gap,
      };
    });

    const achievementPct =
      totalTarget > 0 ? (totalActual / totalTarget) * 100 : null;

    return {
      meta: {
        locationId,
        period,
        lastSuccessAt,
        stale,
      },
      cards: {
        totalTarget,
        totalActual,
        achievementPct:
          achievementPct !== null ? Math.round(achievementPct) : null,
        skuReached,
        skuBelow,
      },
      rows,
    };
  }

  async exportDashboard(
    user: AuthUser,
    page: 'sales' | 'production' | 'inventory',
    query: Record<string, string>,
    ctx: ReqCtx,
  ): Promise<{ filename: string; csv: string }> {
    const locationId = query.locationId;
    if (!locationId) {
      throw new NotFoundException('Parameter locationId wajib disertakan');
    }

    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });
    if (!location) throw new NotFoundException('Lokasi tidak ditemukan');

    const locCode = location.code.toLowerCase();
    const hasFinance = user.permissions.includes('finance:read');

    let csv = '\uFEFF'; // UTF-8 BOM
    let filename = '';

    if (page === 'sales') {
      const data = await this.getSalesDashboard(user, {
        locationId,
        from: query.from,
        to: query.to,
      });

      filename = `tridhata-sales-${locCode}-${data.meta.from}_${data.meta.to}.csv`;

      if (hasFinance) {
        csv += 'SKU,Nama Produk,Qty Terjual,Forecast Proposional,% Capaian,Stok Saat Ini,Status Stok\n';
        for (const p of data.products) {
          csv += `"${p.sku}","${p.name}",${p.soldQty},${p.forecastQty},${p.pct ?? ''},${p.stockQty},"${p.status}"\n`;
        }
      } else {
        csv += 'SKU,Nama Produk,Qty Terjual,Forecast Proposional,% Capaian,Stok Saat Ini,Status Stok\n';
        for (const p of data.products) {
          csv += `"${p.sku}","${p.name}",${p.soldQty},${p.forecastQty},${p.pct ?? ''},${p.stockQty},"${p.status}"\n`;
        }
      }
    } else if (page === 'inventory') {
      const data = await this.getInventoryDashboard(
        user,
        locationId,
        query.status as StockStatus,
      );

      const now = new Date().toISOString().slice(0, 10);
      filename = `tridhata-inventory-${locCode}-${now}.csv`;

      if (hasFinance) {
        csv += 'SKU,Nama Produk,Qty Stok,Min Stok,Safety Stock,Status,Nilai Stok (Rp),Terakhir Sinkron\n';
        for (const r of data.rows) {
          csv += `"${r.sku}","${r.name}",${r.qty},${r.minStock},${r.safetyStock},"${r.status}",${r.value ?? ''},"${r.syncedAt}"\n`;
        }
      } else {
        csv += 'SKU,Nama Produk,Qty Stok,Min Stok,Safety Stock,Status,Terakhir Sinkron\n';
        for (const r of data.rows) {
          csv += `"${r.sku}","${r.name}",${r.qty},${r.minStock},${r.safetyStock},"${r.status}","${r.syncedAt}"\n`;
        }
      }
    } else if (page === 'production') {
      const data = await this.getProductionDashboard(
        user,
        locationId,
        query.period,
      );

      filename = `tridhata-production-${locCode}-${data.meta.period}.csv`;
      csv += 'SKU,Nama Produk,Target Produksi,Aktual Produksi,% Capaian,Selisih (Gap)\n';
      for (const r of data.rows) {
        csv += `"${r.sku}","${r.name}",${r.target},${r.actual},${r.pct ?? ''},${r.gap}\n`;
      }
    }

    await this.auditService.record({
      userId: user.id,
      action: 'export.downloaded',
      entity: 'DashboardExport',
      entityId: `${page}-${locationId}`,
      after: {
        page,
        locationId,
        filename,
      },
      ctx,
    });

    return { filename, csv };
  }
}
