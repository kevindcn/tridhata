import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SheetEntity, SyncStatus, SyncTrigger } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SHEETS_CLIENT, SheetsClient } from './sheets.client';
import {
  normalizeHeader,
  parseCell,
} from './sheets-parser';
import {
  ReqCtx,
  SheetMappingDto,
  SyncReport,
  SyncStatusResponse,
  UpdateSheetMappingsDto,
} from '@tridhata/shared';

interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
  key: string;
}

const ENTITY_ORDER: SheetEntity[] = [
  'PRODUCT',
  'STOCK',
  'FORECAST',
  'TARGET',
  'SALE',
];

@Injectable()
export class SheetsSyncService {
  private readonly logger = new Logger(SheetsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(SHEETS_CLIENT) private readonly sheetsClient: SheetsClient,
  ) {}

  async syncLocation(
    locationId: string,
    trigger: SyncTrigger,
    triggeredById?: string,
    ctx?: ReqCtx,
  ): Promise<{ runId?: string; status: SyncStatus; report?: SyncReport; skipped?: boolean }> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      throw new NotFoundException('Lokasi tidak ditemukan');
    }

    // Try PostgreSQL advisory lock to prevent concurrent sync for the same location
    const lockResult = await this.prisma.$queryRaw<
      Array<{ pg_try_advisory_lock: boolean }>
    >`SELECT pg_try_advisory_lock(hashtext(${'sync:' + locationId}))`;

    const hasLock = lockResult[0]?.pg_try_advisory_lock;
    if (!hasLock) {
      this.logger.warn(
        `Sinkronisasi untuk lokasi ${location.code} sedang berjalan. Permintaan dilewati.`,
      );
      return { skipped: true, status: 'RUNNING' };
    }

    const run = await this.prisma.syncRun.create({
      data: {
        locationId,
        trigger,
        triggeredById: triggeredById || null,
        status: 'RUNNING',
      },
    });

    const report: SyncReport = { entities: [] };
    let totalAccepted = 0;
    let totalRejected = 0;

    try {
      let spreadsheetId = location.spreadsheetId;
      if (!spreadsheetId) {
        const envSheetId =
          location.code === 'BOGOR'
            ? process.env.SHEET_ID_BOGOR
            : location.code === 'NGANJUK'
            ? process.env.SHEET_ID_NGANJUK
            : null;
        if (envSheetId) {
          spreadsheetId = envSheetId;
          await this.prisma.location.update({
            where: { id: location.id },
            data: { spreadsheetId: envSheetId },
          });
        }
      }
      if (!spreadsheetId) {
        throw new Error(
          `ID Spreadsheet belum dikonfigurasi untuk lokasi ${location.code}`,
        );
      }

      const allMappings = await this.prisma.sheetMapping.findMany({
        where: { locationId },
      });

      for (const entity of ENTITY_ORDER) {
        const entityMappings = allMappings.filter((m) => m.entity === entity);
        if (entityMappings.length === 0) {
          continue;
        }

        const tab = entityMappings[0].tab;

        // Check if mappings are not yet configured (contain TODO_CONFIRM)
        const unconfigured = entityMappings.some(
          (m) =>
            m.tab.includes('TODO_CONFIRM') ||
            m.sourceHeader.includes('TODO_CONFIRM'),
        );

        if (unconfigured) {
          report.entities.push({
            entity,
            tab,
            status: 'FAILED',
            accepted: 0,
            rejected: 0,
            error: {
              code: 'MAPPING_NOT_CONFIGURED',
              message: `Pemetaan untuk entitas ${entity} masih berisi TODO_CONFIRM. Konfigurasikan header terlebih dahulu.`,
            },
            rejectedRows: [],
          });
          continue;
        }

        // Fetch sheet values
        let rows: unknown[][];
        try {
          rows = await this.sheetsClient.getValues(spreadsheetId, `'${tab}'`);
        } catch (fetchErr: unknown) {
          const rawErrMsg =
            fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          const errMsg =
            rawErrMsg.includes('DECODER') || rawErrMsg.includes('unsupported')
              ? 'Kredensial Google Service Account tidak valid (Private Key belum dikonfigurasi dengan benar di berkas .env)'
              : rawErrMsg;
          this.logger.error(`Gagal mengambil tab '${tab}': ${rawErrMsg}`);
          report.entities.push({
            entity,
            tab,
            status: 'FAILED',
            accepted: 0,
            rejected: 0,
            error: {
              code: 'SHEET_UNREACHABLE',
              message: `Gagal membaca tab '${tab}' dari Google Sheets: ${errMsg}`,
            },
            rejectedRows: [],
          });
          continue;
        }

        if (!rows || rows.length === 0) {
          report.entities.push({
            entity,
            tab,
            status: 'FAILED',
            accepted: 0,
            rejected: 0,
            error: {
              code: 'MISSING_HEADERS',
              message: `Tab '${tab}' kosong atau tidak memiliki baris header.`,
            },
            rejectedRows: [],
          });
          continue;
        }

        // Validate headers
        const headerRow = (rows[0] || []).map((h) => normalizeHeader(h));
        const missing = entityMappings.filter(
          (m) =>
            m.required &&
            !headerRow.includes(normalizeHeader(m.sourceHeader)),
        );

        if (missing.length > 0) {
          const missingHeaders = missing.map((m) => m.sourceHeader);
          report.entities.push({
            entity,
            tab,
            status: 'FAILED',
            accepted: 0,
            rejected: 0,
            error: {
              code: 'MISSING_HEADERS',
              message: `Header wajib tidak ditemukan pada tab '${tab}': ${missingHeaders.join(', ')}`,
              headers: missingHeaders,
            },
            rejectedRows: [],
          });
          continue;
        }

        // Map column index to target mapping
        const mappingColumns = entityMappings.map((m) => ({
          mapping: m,
          colIndex: headerRow.indexOf(normalizeHeader(m.sourceHeader)),
        }));

        const acceptedRows: ParsedRow[] = [];
        const rejectedRows: Array<{ row: number; field?: string; reason: string }> = [];
        const seenKeys = new Set<string>();

        for (let i = 1; i < rows.length; i++) {
          const rowNumber = i + 1; // 1-based sheet row number
          const rowData = rows[i] || [];
          let rowValid = true;
          const parsedData: Record<string, unknown> = {};
          const keyParts: string[] = [];

          for (const item of mappingColumns) {
            const rawCell =
              item.colIndex >= 0 ? rowData[item.colIndex] : undefined;
            const res = parseCell(rawCell, item.mapping.fieldType);

            if (!res.ok) {
              if (item.mapping.required) {
                rejectedRows.push({
                  row: rowNumber,
                  field: item.mapping.targetField,
                  reason: res.reason,
                });
                rowValid = false;
                break;
              } else {
                parsedData[item.mapping.targetField] = null;
              }
            } else {
              parsedData[item.mapping.targetField] = res.value;
              if (item.mapping.isKey) {
                keyParts.push(String(res.value));
              }
            }
          }

          if (!rowValid) continue;

          // If no isKey defined, fallback to sku
          const naturalKey =
            keyParts.length > 0
              ? keyParts.join('|')
              : String(parsedData['sku'] || rowNumber);

          if (seenKeys.has(naturalKey)) {
            rejectedRows.push({
              row: rowNumber,
              reason: 'DUPLICATE_KEY',
            });
            continue;
          }

          seenKeys.add(naturalKey);
          acceptedRows.push({
            rowNumber,
            data: parsedData,
            key: naturalKey,
          });
        }

        // Ingest accepted rows in chunks of 200
        const chunkAccepted = await this.ingestEntityRows(
          entity,
          locationId,
          acceptedRows,
          rejectedRows,
        );

        totalAccepted += chunkAccepted;
        totalRejected += rejectedRows.length;

        const entityStatus =
          rejectedRows.length === 0
            ? 'SUCCESS'
            : chunkAccepted > 0
              ? 'PARTIAL'
              : 'FAILED';

        report.entities.push({
          entity,
          tab,
          status: entityStatus,
          accepted: chunkAccepted,
          rejected: rejectedRows.length,
          rejectedRows: rejectedRows.slice(0, 200),
        });
      }

      // Compute final run status
      const hasAnySuccess = report.entities.some(
        (e) => e.status === 'SUCCESS' || e.status === 'PARTIAL',
      );
      const hasAnyFailOrPartial = report.entities.some(
        (e) => e.status === 'FAILED' || e.status === 'PARTIAL',
      );

      const finalStatus: SyncStatus =
        !hasAnyFailOrPartial && hasAnySuccess
          ? 'SUCCESS'
          : hasAnySuccess
            ? 'PARTIAL'
            : 'FAILED';

      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          finishedAt: new Date(),
          rowsAccepted: totalAccepted,
          rowsRejected: totalRejected,
          report: report as unknown as Prisma.InputJsonValue,
        },
      });

      await this.auditService.record({
        userId: triggeredById,
        action: finalStatus === 'FAILED' ? 'sync.failed' : 'sync.run',
        entity: 'SyncRun',
        entityId: run.id,
        after: {
          locationId,
          trigger,
          status: finalStatus,
          rowsAccepted: totalAccepted,
          rowsRejected: totalRejected,
        },
        ctx,
      });

      return {
        runId: run.id,
        status: finalStatus,
        report,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Sinkronisasi lokasi ${location.code} gagal fatal: ${errMsg}`,
      );

      const failedReport: SyncReport =
        report.entities.length > 0
          ? report
          : {
              entities: [
                {
                  entity: 'PRODUCT',
                  tab: 'UNKNOWN',
                  status: 'FAILED',
                  accepted: 0,
                  rejected: 0,
                  error: {
                    code: 'SHEET_UNREACHABLE',
                    message: errMsg,
                  },
                  rejectedRows: [],
                },
              ],
            };

      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          rowsAccepted: totalAccepted,
          rowsRejected: totalRejected,
          report: failedReport as unknown as Prisma.InputJsonValue,
        },
      });

      await this.auditService.record({
        userId: triggeredById,
        action: 'sync.failed',
        entity: 'SyncRun',
        entityId: run.id,
        after: {
          locationId,
          trigger,
          status: 'FAILED',
          error: errMsg,
        },
        ctx,
      });

      return {
        runId: run.id,
        status: 'FAILED',
        report: failedReport,
      };
    } finally {
      // Always release advisory lock
      await this.prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${'sync:' + locationId}))`;
    }
  }

  private async ingestEntityRows(
    entity: SheetEntity,
    locationId: string,
    rows: ParsedRow[],
    rejectedRows: Array<{ row: number; field?: string; reason: string }>,
  ): Promise<number> {
    let acceptedCount = 0;
    const chunkSize = 200;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      await this.prisma.$transaction(async (tx) => {
        for (const row of chunk) {
          const d = row.data;

          try {
            switch (entity) {
              case 'PRODUCT': {
                const sku = String(d['sku']).trim();
                const name = String(d['name']).trim();
                const unit = d['unit'] ? String(d['unit']).trim() : 'pcs';
                const price =
                  d['price'] !== null && d['price'] !== undefined
                    ? new Prisma.Decimal(Number(d['price']))
                    : new Prisma.Decimal(0);
                const cost =
                  d['cost'] !== null && d['cost'] !== undefined
                    ? new Prisma.Decimal(Number(d['cost']))
                    : new Prisma.Decimal(0);

                await tx.product.upsert({
                  where: { sku },
                  update: { name, unit, price, cost },
                  create: { sku, name, unit, price, cost },
                });
                acceptedCount++;
                break;
              }

              case 'STOCK': {
                const sku = String(d['sku']).trim();
                const product = await tx.product.findUnique({
                  where: { sku },
                });

                if (!product) {
                  rejectedRows.push({
                    row: row.rowNumber,
                    field: 'sku',
                    reason: 'UNKNOWN_SKU',
                  });
                  break;
                }

                const qty = Number(d['qty'] || 0);
                const minStock = Number(d['minStock'] || 0);
                const safetyStock = Number(d['safetyStock'] || 0);

                await tx.stockLevel.upsert({
                  where: {
                    productId_locationId: {
                      productId: product.id,
                      locationId,
                    },
                  },
                  update: {
                    qty,
                    minStock,
                    safetyStock,
                    syncedAt: new Date(),
                  },
                  create: {
                    productId: product.id,
                    locationId,
                    qty,
                    minStock,
                    safetyStock,
                    syncedAt: new Date(),
                  },
                });
                acceptedCount++;
                break;
              }

              case 'FORECAST': {
                const sku = String(d['sku']).trim();
                const product = await tx.product.findUnique({
                  where: { sku },
                });

                if (!product) {
                  rejectedRows.push({
                    row: row.rowNumber,
                    field: 'sku',
                    reason: 'UNKNOWN_SKU',
                  });
                  break;
                }

                const period = String(d['period']).trim();
                const qty = Number(d['qty'] || 0);

                await tx.forecast.upsert({
                  where: {
                    productId_locationId_period: {
                      productId: product.id,
                      locationId,
                      period,
                    },
                  },
                  update: { qty },
                  create: {
                    productId: product.id,
                    locationId,
                    period,
                    qty,
                  },
                });
                acceptedCount++;
                break;
              }

              case 'TARGET': {
                const sku = String(d['sku']).trim();
                const product = await tx.product.findUnique({
                  where: { sku },
                });

                if (!product) {
                  rejectedRows.push({
                    row: row.rowNumber,
                    field: 'sku',
                    reason: 'UNKNOWN_SKU',
                  });
                  break;
                }

                const period = String(d['period']).trim();
                const targetQty = Number(d['targetQty'] || 0);
                const actualQty = Number(d['actualQty'] || 0);

                await tx.productionTarget.upsert({
                  where: {
                    productId_locationId_period: {
                      productId: product.id,
                      locationId,
                      period,
                    },
                  },
                  update: { targetQty, actualQty },
                  create: {
                    productId: product.id,
                    locationId,
                    period,
                    targetQty,
                    actualQty,
                  },
                });
                acceptedCount++;
                break;
              }

              case 'SALE': {
                const sku = String(d['sku']).trim();
                const product = await tx.product.findUnique({
                  where: { sku },
                });

                if (!product) {
                  rejectedRows.push({
                    row: row.rowNumber,
                    field: 'sku',
                    reason: 'UNKNOWN_SKU',
                  });
                  break;
                }

                const dateStr = String(d['date']);
                const qty = Number(d['qty'] || 0);
                const price =
                  d['price'] !== null && d['price'] !== undefined
                    ? new Prisma.Decimal(Number(d['price']))
                    : product.price;

                const total =
                  d['total'] !== null && d['total'] !== undefined
                    ? new Prisma.Decimal(Number(d['total']))
                    : price.mul(qty);

                const sourceKey = row.key;

                await tx.sale.upsert({
                  where: {
                    locationId_sourceKey: {
                      locationId,
                      sourceKey,
                    },
                  },
                  update: {
                    productId: product.id,
                    date: new Date(`${dateStr}T00:00:00Z`),
                    docNo: d['docNo'] ? String(d['docNo']).trim() : null,
                    qty,
                    price,
                    total,
                  },
                  create: {
                    locationId,
                    sourceKey,
                    productId: product.id,
                    date: new Date(`${dateStr}T00:00:00Z`),
                    docNo: d['docNo'] ? String(d['docNo']).trim() : null,
                    qty,
                    price,
                    total,
                  },
                });
                acceptedCount++;
                break;
              }
            }
          } catch (rowErr) {
            this.logger.error(
              `Gagal upsert entitas ${entity} baris ${row.rowNumber}: ${rowErr}`,
            );
            rejectedRows.push({
              row: row.rowNumber,
              reason: 'DB_ERROR',
            });
          }
        }
      });
    }

    return acceptedCount;
  }

  async getSyncStatus(locationId: string): Promise<SyncStatusResponse> {
    const staleAfterMinutes = Number(process.env.SYNC_STALE_MINUTES) || 120;

    const lastSuccess = await this.prisma.syncRun.findFirst({
      where: {
        locationId,
        status: { in: ['SUCCESS', 'PARTIAL'] },
      },
      orderBy: { finishedAt: 'desc' },
    });

    const lastRun = await this.prisma.syncRun.findFirst({
      where: { locationId },
      orderBy: { startedAt: 'desc' },
    });

    const lastSuccessAt = lastSuccess?.finishedAt
      ? lastSuccess.finishedAt.toISOString()
      : null;

    let stale = true;
    if (lastSuccess?.finishedAt) {
      const elapsedMinutes =
        (Date.now() - lastSuccess.finishedAt.getTime()) / (60 * 1000);
      stale = elapsedMinutes > staleAfterMinutes;
    }

    return {
      lastSuccessAt,
      lastRun: lastRun
        ? {
            status: lastRun.status,
            startedAt: lastRun.startedAt.toISOString(),
            finishedAt: lastRun.finishedAt ? lastRun.finishedAt.toISOString() : null,
            rowsAccepted: lastRun.rowsAccepted,
            rowsRejected: lastRun.rowsRejected,
            report: (lastRun.report as unknown as SyncReport) || null,
          }
        : null,
      stale,
      staleAfterMinutes,
    };
  }

  async getMappings(locationId: string): Promise<SheetMappingDto[]> {
    const mappings = await this.prisma.sheetMapping.findMany({
      where: { locationId },
      orderBy: [{ entity: 'asc' }, { targetField: 'asc' }],
    });

    return mappings.map((m) => ({
      id: m.id,
      locationId: m.locationId,
      tab: m.tab,
      entity: m.entity,
      sourceHeader: m.sourceHeader,
      targetField: m.targetField,
      fieldType: m.fieldType,
      required: m.required,
      isKey: m.isKey,
    }));
  }

  async updateMappings(
    locationId: string,
    dto: UpdateSheetMappingsDto,
    actorId: string,
    ctx?: ReqCtx,
  ): Promise<SheetMappingDto[]> {
    const existingMappings = await this.prisma.sheetMapping.findMany({
      where: { locationId },
    });

    await this.prisma.$transaction(async (tx) => {
      // Replace existing mappings for this location
      await tx.sheetMapping.deleteMany({
        where: { locationId },
      });

      await tx.sheetMapping.createMany({
        data: dto.mappings.map((m) => ({
          locationId,
          tab: m.tab.trim(),
          entity: m.entity,
          sourceHeader: m.sourceHeader.trim(),
          targetField: m.targetField.trim(),
          fieldType: m.fieldType,
          required: m.required ?? true,
          isKey: m.isKey ?? false,
        })),
      });

      await this.auditService.record(
        {
          userId: actorId,
          action: 'sync.mapping_updated',
          entity: 'SheetMapping',
          entityId: locationId,
          before: existingMappings,
          after: dto.mappings,
          ctx,
        },
        tx,
      );
    });

    return this.getMappings(locationId);
  }
}
