/* eslint-disable @typescript-eslint/no-explicit-any -- Deep Prisma and Audit mock objects for unit testing */
import { Test, TestingModule } from '@nestjs/testing';
import { SheetsSyncService } from './sheets-sync.service';
import { SHEETS_CLIENT, SheetsClient } from './sheets.client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FieldType, SheetEntity } from '@prisma/client';

describe('SheetsSyncService (SPEC Section 7 Requirements)', () => {
  let service: SheetsSyncService;
  let mockSheetsClient: jest.Mocked<SheetsClient>;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(async () => {
    mockSheetsClient = {
      getValues: jest.fn(),
    };

    mockPrisma = {
      $queryRaw: jest.fn(),
      $transaction: jest.fn().mockImplementation(async (arg) => {
        if (typeof arg === 'function') {
          return arg(mockPrisma);
        }
        return Promise.all(arg);
      }),
      location: {
        findUnique: jest.fn(),
      },
      sheetMapping: {
        findMany: jest.fn(),
      },
      syncRun: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      syncReport: {
        createMany: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      stockLevel: {
        upsert: jest.fn(),
      },
      forecast: {
        upsert: jest.fn(),
      },
      productionTarget: {
        upsert: jest.fn(),
      },
      sale: {
        upsert: jest.fn(),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SheetsSyncService,
        { provide: SHEETS_CLIENT, useValue: mockSheetsClient },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<SheetsSyncService>(SheetsSyncService);
  });

  const locationId = 'loc-bogor-uuid';
  const userId = 'user-admin-uuid';

  it('should skip when advisory lock is busy (another sync is currently running)', async () => {
    mockPrisma.location.findUnique.mockResolvedValue({
      id: locationId,
      code: 'BGR',
      spreadsheetId: 'sheet-123',
    });
    // Advisory lock returns false
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_try_advisory_lock: false }]);

    const result = await service.syncLocation(locationId, 'MANUAL', userId);
    expect(result.skipped).toBe(true);
    expect(result.status).toBe('RUNNING');
    expect(mockPrisma.syncRun.create).not.toHaveBeenCalled();
  });

  it('should report FAILED entity when tab or header is still TODO_CONFIRM', async () => {
    mockPrisma.location.findUnique.mockResolvedValue({
      id: locationId,
      code: 'BGR',
      spreadsheetId: 'sheet-123',
    });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_try_advisory_lock: true }]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    mockPrisma.syncRun.create.mockResolvedValue({ id: 'run-1' });
    mockPrisma.syncRun.update.mockResolvedValue({ id: 'run-1', status: 'FAILED' });

    // SheetMapping with TODO_CONFIRM
    mockPrisma.sheetMapping.findMany.mockResolvedValue([
      {
        id: 'map-1',
        locationId,
        entity: 'PRODUCT' as SheetEntity,
        tab: 'TODO_CONFIRM_TAB_NAME',
        sourceHeader: 'Kode SKU',
        targetField: 'sku',
        fieldType: 'STRING' as FieldType,
        required: true,
        isKey: true,
      },
    ]);

    const result = await service.syncLocation(locationId, 'MANUAL', userId);
    expect(result.status).toBe('FAILED');
    expect(result.report?.entities[0].status).toBe('FAILED');
    expect(result.report?.entities[0].error?.message).toContain('TODO_CONFIRM');
    // DB products should NOT be upserted
    expect(mockPrisma.product.upsert).not.toHaveBeenCalled();
  });

  it('should fail with missing header and leave DB untouched if required headers are absent', async () => {
    mockPrisma.location.findUnique.mockResolvedValue({
      id: locationId,
      code: 'BGR',
      spreadsheetId: 'sheet-123',
    });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_try_advisory_lock: true }]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    mockPrisma.syncRun.create.mockResolvedValue({ id: 'run-1' });
    mockPrisma.syncRun.update.mockResolvedValue({ id: 'run-1', status: 'FAILED' });

    mockPrisma.sheetMapping.findMany.mockResolvedValue([
      {
        id: 'm1',
        locationId,
        entity: 'PRODUCT' as SheetEntity,
        tab: 'Master Produk',
        sourceHeader: 'Kode SKU',
        targetField: 'sku',
        fieldType: 'STRING' as FieldType,
        required: true,
        isKey: true,
      },
      {
        id: 'm2',
        locationId,
        entity: 'PRODUCT' as SheetEntity,
        tab: 'Master Produk',
        sourceHeader: 'Nama Produk',
        targetField: 'name',
        fieldType: 'STRING' as FieldType,
        required: true,
        isKey: false,
      },
    ]);

    // Sheet only returns 'Kode SKU' but missing 'Nama Produk'
    mockSheetsClient.getValues.mockResolvedValue([
      ['Kode SKU', 'Kolom Tak Dikenal'],
      ['SKU-001', 'Data Lain'],
    ]);

    const result = await service.syncLocation(locationId, 'MANUAL', userId);
    expect(result.status).toBe('FAILED');
    expect(result.report?.entities[0].status).toBe('FAILED');
    expect(result.report?.entities[0].error?.message).toContain('Header wajib tidak ditemukan');
    expect(result.report?.entities[0].error?.message).toContain('Nama Produk');
    expect(mockPrisma.product.upsert).not.toHaveBeenCalled();
  });

  it('should isolate row errors: record rejected rows with rowNumber and reason, while saving valid rows', async () => {
    mockPrisma.location.findUnique.mockResolvedValue({
      id: locationId,
      code: 'BGR',
      spreadsheetId: 'sheet-123',
    });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_try_advisory_lock: true }]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    mockPrisma.syncRun.create.mockResolvedValue({ id: 'run-1' });
    mockPrisma.syncRun.update.mockResolvedValue({ id: 'run-1', status: 'PARTIAL' });

    mockPrisma.sheetMapping.findMany.mockResolvedValue([
      {
        id: 'm1',
        locationId,
        entity: 'PRODUCT' as SheetEntity,
        tab: 'Master Produk',
        sourceHeader: 'Kode SKU',
        targetField: 'sku',
        fieldType: 'STRING' as FieldType,
        required: true,
        isKey: true,
      },
      {
        id: 'm2',
        locationId,
        entity: 'PRODUCT' as SheetEntity,
        tab: 'Master Produk',
        sourceHeader: 'Nama Produk',
        targetField: 'name',
        fieldType: 'STRING' as FieldType,
        required: true,
        isKey: false,
      },
      {
        id: 'm3',
        locationId,
        entity: 'PRODUCT' as SheetEntity,
        tab: 'Master Produk',
        sourceHeader: 'Harga Pokok',
        targetField: 'cost',
        fieldType: 'DECIMAL' as FieldType,
        required: true,
        isKey: false,
      },
    ]);

    // Row 2 is valid, Row 3 has invalid cost ("BUKAN_ANGKA")
    mockSheetsClient.getValues.mockResolvedValue([
      ['Kode SKU', 'Nama Produk', 'Harga Pokok'],
      ['SKU-001', 'Kopi Robusta', '15000'],
      ['SKU-002', 'Teh Melati', 'BUKAN_ANGKA'],
    ]);

    mockPrisma.product.upsert.mockResolvedValue({ id: 'p1' });
    mockPrisma.syncReport.createMany.mockResolvedValue({ count: 1 });

    const result = await service.syncLocation(locationId, 'MANUAL', userId);

    expect(result.status).toBe('PARTIAL');
    expect(result.report?.entities[0].accepted).toBe(1);
    expect(result.report?.entities[0].rejected).toBe(1);

    // Only SKU-001 should be upserted
    expect(mockPrisma.product.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sku: 'SKU-001' },
      }),
    );

    // Report should record row 3 error
    expect(result.report?.entities[0].rejectedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 3,
          field: 'cost',
        }),
      ]),
    );
  });

  it('should reject row with DUPLICATE_KEY if natural key repeats within the same sheet', async () => {
    mockPrisma.location.findUnique.mockResolvedValue({
      id: locationId,
      code: 'BGR',
      spreadsheetId: 'sheet-123',
    });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_try_advisory_lock: true }]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    mockPrisma.syncRun.create.mockResolvedValue({ id: 'run-1' });
    mockPrisma.syncRun.update.mockResolvedValue({ id: 'run-1', status: 'PARTIAL' });

    mockPrisma.sheetMapping.findMany.mockResolvedValue([
      {
        id: 'm1',
        locationId,
        entity: 'PRODUCT' as SheetEntity,
        tab: 'Master Produk',
        sourceHeader: 'Kode SKU',
        targetField: 'sku',
        fieldType: 'STRING' as FieldType,
        required: true,
        isKey: true,
      },
      {
        id: 'm2',
        locationId,
        entity: 'PRODUCT' as SheetEntity,
        tab: 'Master Produk',
        sourceHeader: 'Nama Produk',
        targetField: 'name',
        fieldType: 'STRING' as FieldType,
        required: true,
        isKey: false,
      },
    ]);

    // Row 2 and 3 duplicate SKU-DUP
    mockSheetsClient.getValues.mockResolvedValue([
      ['Kode SKU', 'Nama Produk'],
      ['SKU-DUP', 'Barang 1'],
      ['SKU-DUP', 'Barang 2'],
    ]);

    mockPrisma.product.upsert.mockResolvedValue({ id: 'p1' });
    mockPrisma.syncReport.createMany.mockResolvedValue({ count: 1 });

    const result = await service.syncLocation(locationId, 'MANUAL', userId);

    expect(result.report?.entities[0].accepted).toBe(1);
    expect(result.report?.entities[0].rejected).toBe(1);
    expect(result.report?.entities[0].rejectedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 3,
          reason: 'DUPLICATE_KEY',
        }),
      ]),
    );
  });
});
