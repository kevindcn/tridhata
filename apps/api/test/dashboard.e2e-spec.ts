/* eslint-disable @typescript-eslint/no-explicit-any -- E2E test Prisma mocks */
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Dashboard & Sheets Sync Endpoints (e2e)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;

  const mockAdminUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Admin Tridhata',
    email: 'admin@tridhata.com',
    roleId: 'role-admin',
    defaultLocationId: 'loc-bogor',
    extraPermissions: [],
    active: true,
    mustChangePassword: false,
    role: {
      id: 'role-admin',
      name: 'ADMIN',
      permissions: ['dashboard:read', 'finance:read', 'export:run', 'sync:manage'],
    },
    access: [{ locationId: 'loc-bogor' }],
  };

  const mockStaffUser = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Staff PPIC',
    email: 'staff@tridhata.com',
    roleId: 'role-staff',
    defaultLocationId: 'loc-bogor',
    extraPermissions: [],
    active: true,
    mustChangePassword: false,
    role: {
      id: 'role-staff',
      name: 'STAFF',
      permissions: ['dashboard:read'],
    },
    access: [{ locationId: 'loc-bogor' }],
  };

  const mockPrisma: any = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: {
      findUnique: jest.fn((params) => {
        if (params.where.id === mockAdminUser.id) return Promise.resolve(mockAdminUser);
        if (params.where.id === mockStaffUser.id) return Promise.resolve(mockStaffUser);
        return Promise.resolve(null);
      }),
    },
    location: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'loc-bogor',
        code: 'BGR',
        name: 'Pabrik Bogor',
      }),
      findMany: jest.fn().mockResolvedValue([
        { id: 'loc-bogor', code: 'BGR', name: 'Pabrik Bogor' },
      ]),
    },
    syncRun: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'run-1',
        status: 'SUCCESS',
        startedAt: new Date(),
        finishedAt: new Date(),
        rowsAccepted: 10,
        rowsRejected: 0,
      }),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'p1',
          sku: 'SKU-001',
          name: 'Produk A',
          category: 'Kategori 1',
          unit: 'PCS',
          cost: 5000,
          price: 10000,
          active: true,
          stock: [
            {
              qty: 15,
              minStock: 20,
              safetyStock: 10,
              syncedAt: new Date(),
            },
          ],
          forecasts: [
            { qty: 1000 },
          ],
        },
      ]),
    },
    sale: {
      findMany: jest.fn().mockResolvedValue([
        {
          productId: 'p1',
          date: new Date(),
          qty: 50,
          total: 500000,
          hpp: 5000,
          product: { sku: 'SKU-001' },
        },
      ]),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { total: 400000 },
      }),
    },
    productionTarget: {
      findMany: jest.fn().mockResolvedValue([
        {
          productId: 'p1',
          targetQty: 100,
          actualQty: 90,
          product: { sku: 'SKU-001', name: 'Produk A' },
        },
      ]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyCookie as any);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const getAuthToken = (userId: string) => {
    return jwtService.sign({ sub: userId }, { expiresIn: '15m' });
  };

  it('GET /dashboard/sales - unmasks revenue for admin with finance:read', async () => {
    const token = getAuthToken(mockAdminUser.id);
    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/sales?locationId=loc-bogor',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cards.revenue).toBe(500000);
    expect(body.cards.soldQty).toBe(50);
  });

  it('GET /dashboard/sales - masks revenue to null for staff without finance:read', async () => {
    const token = getAuthToken(mockStaffUser.id);
    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/sales?locationId=loc-bogor',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cards.revenue).toBeNull();
    expect(body.cards.stockValue).toBeNull();
    expect(body.cards.soldQty).toBe(50); // Quantities remain visible
  });

  it('GET /dashboard/inventory - returns inventory status counts', async () => {
    const token = getAuthToken(mockAdminUser.id);
    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/inventory?locationId=loc-bogor',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cards.totalSku).toBe(1);
    expect(body.cards.minimumCount).toBe(1); // qty 15 is < minStock 20
    expect(body.rows[0].sku).toBe('SKU-001');
  });

  it('GET /dashboard/production - returns target vs actual gap', async () => {
    const token = getAuthToken(mockAdminUser.id);
    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/production?locationId=loc-bogor',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cards.totalTarget).toBe(100);
    expect(body.cards.totalActual).toBe(90);
    expect(body.rows[0].gap).toBe(10);
  });

  it('GET /sync/status - returns sync status and staleness', async () => {
    const token = getAuthToken(mockAdminUser.id);
    const res = await app.inject({
      method: 'GET',
      url: '/sync/status?locationId=loc-bogor',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.lastRun.status).toBe('SUCCESS');
    expect(body.stale).toBe(false);
  });

  it('GET /dashboard/:page/export - generates UTF-8 BOM CSV download', async () => {
    const token = getAuthToken(mockAdminUser.id);
    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/sales/export?locationId=loc-bogor',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    // Verify UTF-8 BOM (\uFEFF)
    expect(res.payload.charCodeAt(0)).toBe(0xfeff);
    expect(res.payload).toContain('SKU');
    expect(res.payload).toContain('Nama Produk');
    expect(res.payload).toContain('SKU-001');
  });
});
