/* eslint-disable @typescript-eslint/no-explicit-any -- Deep Prisma, Locations, and Audit mock objects for unit testing */
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LocationsService } from '../locations/locations.service';
import { AuthUser } from '@tridhata/shared';

describe('DashboardService (SPEC Section 8 Formulas & Masking)', () => {
  let service: DashboardService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockLocationsService: any;

  beforeEach(async () => {
    mockPrisma = {
      syncRun: {
        findFirst: jest.fn().mockResolvedValue({
          finishedAt: new Date('2026-04-18T10:00:00+07:00'),
        }),
      },
      product: {
        findMany: jest.fn(),
      },
      sale: {
        findMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 } }),
      },
      forecast: {
        findMany: jest.fn(),
      },
      stockLevel: {
        findMany: jest.fn(),
      },
      productionTarget: {
        findMany: jest.fn(),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockLocationsService = {
      assertLocation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LocationsService, useValue: mockLocationsService },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('Section 8 Benchmark Calculations (April 2026 fixture: day 18 of 30, sold 30, forecast 3,419)', () => {
    const mockLocationId = 'loc-bogor-uuid';
    const mockUserFinance: AuthUser = {
      id: 'user-1',
      name: 'Super Admin',
      email: 'admin@tridhata.id',
      role: 'ADMIN',
      permissions: ['finance:read', 'dashboard:read'],
      locationIds: [mockLocationId],
      defaultLocationId: mockLocationId,
      mustChangePassword: false,
    };
    const mockUserNoFinance: AuthUser = {
      id: 'user-2',
      name: 'PPIC Staff',
      email: 'staff@tridhata.id',
      role: 'STAFF',
      permissions: ['dashboard:read'],
      locationIds: [mockLocationId],
      defaultLocationId: mockLocationId,
      mustChangePassword: false,
    };

    it('should compute exact proportional forecast = 2,051 and projected = 50 for benchmark fixture', async () => {
      // Product with stock
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU-001',
          name: 'Produk Uji 1',
          category: 'Kategori A',
          unit: 'PCS',
          cost: 5000,
          price: 10000,
          stock: [
            {
              qty: 5,
              minStock: 20,
              safetyStock: 10,
              syncedAt: new Date('2026-04-18T10:00:00+07:00'),
            },
          ],
          forecasts: [
            {
              qty: 3419,
            },
          ],
        },
      ]);

      // Sold 30 units at 10,000 each = 300,000 revenue
      mockPrisma.sale.findMany.mockResolvedValue([
        {
          productId: 'prod-1',
          date: new Date('2026-04-10T00:00:00+07:00'),
          qty: 30,
          total: 300000,
          hpp: 5000,
          product: { sku: 'SKU-001' },
        },
      ]);

      const result = await service.getSalesDashboard(mockUserFinance, {
        locationId: mockLocationId,
        from: '2026-04-01',
        to: '2026-04-18',
      });

      // Verify Cards
      expect(result.cards.soldQty).toBe(30);
      expect(result.cards.forecastQty).toBe(2051); // 3419 * 18 / 30 = 2051.4 -> 2051
      expect(result.cards.soldVsForecastPct).toBe(1); // round(30 / 2051 * 100) = 1%
      expect(result.cards.projectedMonthEndQty).toBe(50); // 30 / 18 * 30 = 50
      expect(result.cards.shortageSkuCount).toBe(1); // remaining = 50 - 30 = 20, stock = 5, shortage = 15 > 0
      expect(result.cards.stockShortageQty).toBe(15);

      // Finance fields present for user with finance:read
      expect(result.cards.revenue).toBe(300000);
      expect(result.cards.stockValue).toBe(25000); // 5 * 5000

      // Products table
      expect(result.products).toHaveLength(1);
      const prod = result.products[0];
      expect(prod.sku).toBe('SKU-001');
      expect(prod.soldQty).toBe(30);
      expect(prod.forecastQty).toBe(2051);
      expect(prod.status).toBe('CRITICAL'); // 0 < 5 < 10 (safetyStock)
    });

    it('should mask all financial data to null when user lacks finance:read', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU-001',
          name: 'Produk Uji 1',
          category: 'Kategori A',
          unit: 'PCS',
          cost: 5000,
          price: 10000,
          stock: [
            {
              qty: 5,
              minStock: 20,
              safetyStock: 10,
              syncedAt: new Date('2026-04-18T10:00:00+07:00'),
            },
          ],
          forecasts: [
            {
              qty: 3419,
            },
          ],
        },
      ]);
      mockPrisma.sale.findMany.mockResolvedValue([
        {
          productId: 'prod-1',
          date: new Date('2026-04-10T00:00:00+07:00'),
          qty: 30,
          total: 300000,
          hpp: 5000,
          product: { sku: 'SKU-001' },
        },
      ]);

      const result = await service.getSalesDashboard(mockUserNoFinance, {
        locationId: mockLocationId,
        from: '2026-04-01',
        to: '2026-04-18',
      });

      // Quantities are visible
      expect(result.cards.soldQty).toBe(30);
      expect(result.cards.forecastQty).toBe(2051);
      expect(result.cards.projectedMonthEndQty).toBe(50);

      // Financials are strictly null
      expect(result.cards.revenue).toBeNull();
      expect(result.cards.previousMonthRevenue).toBeNull();
      expect(result.cards.stockValue).toBeNull();
    });

    it('should correctly classify stockStatus with priority EMPTY > CRITICAL > MINIMUM > SAFE', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p-empty', sku: 'SKU-EMPTY', name: 'Empty', category: 'C', unit: 'PCS', cost: 1000, price: 2000, stock: [{ qty: 0, minStock: 20, safetyStock: 10 }], forecasts: [] },
        { id: 'p-crit', sku: 'SKU-CRIT', name: 'Critical', category: 'C', unit: 'PCS', cost: 1000, price: 2000, stock: [{ qty: 8, minStock: 20, safetyStock: 10 }], forecasts: [] },
        { id: 'p-min', sku: 'SKU-MIN', name: 'Minimum', category: 'C', unit: 'PCS', cost: 1000, price: 2000, stock: [{ qty: 15, minStock: 20, safetyStock: 10 }], forecasts: [] },
        { id: 'p-safe', sku: 'SKU-SAFE', name: 'Safe', category: 'C', unit: 'PCS', cost: 1000, price: 2000, stock: [{ qty: 25, minStock: 20, safetyStock: 10 }], forecasts: [] },
      ]);

      mockPrisma.sale.findMany.mockResolvedValue([]);

      const result = await service.getSalesDashboard(mockUserFinance, {
        locationId: mockLocationId,
        from: '2026-04-01',
        to: '2026-04-18',
      });

      const statusMap = new Map(result.products.map((p) => [p.sku, p.status]));
      expect(statusMap.get('SKU-EMPTY')).toBe('EMPTY');
      expect(statusMap.get('SKU-CRIT')).toBe('CRITICAL');
      expect(statusMap.get('SKU-MIN')).toBe('MINIMUM');
      expect(statusMap.get('SKU-SAFE')).toBe('SAFE');
    });
  });

  describe('Inventory & Production Dashboards', () => {
    const mockLocationId = 'loc-bogor-uuid';
    const mockUser: AuthUser = {
      id: 'user-1',
      name: 'Super Admin',
      email: 'admin@tridhata.id',
      role: 'ADMIN',
      permissions: ['finance:read', 'dashboard:read', 'export:run'],
      locationIds: [mockLocationId],
      defaultLocationId: mockLocationId,
      mustChangePassword: false,
    };

    it('should calculate inventory summary counts per status and stock value', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'P1', name: 'P1', category: 'A', unit: 'PCS', cost: 10000, stock: [{ qty: 0, minStock: 20, safetyStock: 10, syncedAt: new Date() }] },
        { id: 'p2', sku: 'P2', name: 'P2', category: 'A', unit: 'PCS', cost: 20000, stock: [{ qty: 25, minStock: 20, safetyStock: 10, syncedAt: new Date() }] },
      ]);

      const inv = await service.getInventoryDashboard(mockUser, mockLocationId);
      expect(inv.cards.totalSku).toBe(2);
      expect(inv.cards.emptyCount).toBe(1);
      expect(inv.cards.safeCount).toBe(1);
      expect(inv.cards.criticalCount).toBe(0);
      expect(inv.cards.stockValue).toBe(500000); // 0*10000 + 25*20000
    });

    it('should calculate production target vs actual achievement and gap per SKU', async () => {
      mockPrisma.productionTarget.findMany.mockResolvedValue([
        {
          productId: 'p1',
          targetQty: 100,
          actualQty: 85,
          product: { sku: 'P1', name: 'Produk 1' },
        },
      ]);

      const prod = await service.getProductionDashboard(mockUser, mockLocationId, '2026-04');
      expect(prod.cards.totalTarget).toBe(100);
      expect(prod.cards.totalActual).toBe(85);
      expect(prod.cards.achievementPct).toBe(85); // 85 / 100 * 100 = 85%
      expect(prod.cards.skuReached).toBe(0);
      expect(prod.cards.skuBelow).toBe(1);

      expect(prod.rows[0].target).toBe(100);
      expect(prod.rows[0].actual).toBe(85);
      expect(prod.rows[0].gap).toBe(15);
      expect(prod.rows[0].pct).toBe(85);
    });
  });
});
