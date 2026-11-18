/* eslint-disable @typescript-eslint/no-explicit-any -- E2E test Prisma mocks */
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';

describe('Approvals Endpoints (e2e) — SPEC Section 6.8 & 10.2', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;

  const mockLocationId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const reqId1 = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const reqId2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const reqFinanceSelfId = 'dddddddd-dddd-4ddd-9ddd-dddddddddddd';

  const mockAdminUser = {
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Admin Tridhata',
    email: 'admin@tridhata.com',
    roleId: 'role-admin',
    defaultLocationId: mockLocationId,
    extraPermissions: [],
    active: true,
    mustChangePassword: false,
    role: {
      id: 'role-admin',
      name: 'ADMIN',
      // Explicitly NO approval:decide per SPEC line 190-201
      permissions: [
        'dashboard:read',
        'finance:read',
        'export:run',
        'approval:create',
        'approval:read_all',
        'user:manage',
        'audit:read',
        'sync:manage',
        'location:all',
      ],
    },
    access: [{ locationId: mockLocationId }],
  };

  const mockFinanceUser = {
    id: '22222222-2222-4222-a222-222222222222',
    name: 'Finance Manager',
    email: 'finance@tridhata.com',
    roleId: 'role-finance',
    defaultLocationId: mockLocationId,
    extraPermissions: [],
    active: true,
    mustChangePassword: false,
    role: {
      id: 'role-finance',
      name: 'FINANCE',
      permissions: [
        'dashboard:read',
        'finance:read',
        'export:run',
        'approval:create',
        'approval:read_all',
        'approval:decide',
        'location:all',
      ],
    },
    access: [{ locationId: mockLocationId }],
  };

  const mockStaffUser = {
    id: '33333333-3333-4333-a333-333333333333',
    name: 'Staff Sales',
    email: 'sales@tridhata.com',
    roleId: 'role-staff',
    defaultLocationId: mockLocationId,
    extraPermissions: [],
    active: true,
    mustChangePassword: false,
    role: {
      id: 'role-staff',
      name: 'STAFF',
      permissions: ['dashboard:read', 'export:run', 'approval:create'],
    },
    access: [{ locationId: mockLocationId }],
  };

  let mockPrisma: any;

  beforeAll(async () => {
    mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      user: {
        findUnique: jest.fn((params) => {
          if (params.where.id === mockAdminUser.id) return Promise.resolve(mockAdminUser);
          if (params.where.id === mockFinanceUser.id) return Promise.resolve(mockFinanceUser);
          if (params.where.id === mockStaffUser.id) return Promise.resolve(mockStaffUser);
          return Promise.resolve(null);
        }),
      },
      location: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockLocationId,
          code: 'BGR',
          name: 'Pabrik Bogor',
        }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          { id: mockLocationId, code: 'BGR', name: 'Pabrik Bogor' },
        ]),
      },
      request: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      approval: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

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

  it('POST /approvals - Staff creates discount request successfully and writes audit log', async () => {
    const token = getAuthToken(mockStaffUser.id);
    const mockCreated = {
      id: reqId1,
      requesterId: mockStaffUser.id,
      locationId: mockLocationId,
      type: 'Diskon Khusus',
      title: 'Diskon volume order distributor',
      note: 'Volume 500 karton',
      amount: new Prisma.Decimal(1500000),
      status: 'PENDING',
      version: 1,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      requester: { id: mockStaffUser.id, name: mockStaffUser.name, email: mockStaffUser.email },
      approvals: [],
    };

    mockPrisma.request.create.mockResolvedValue(mockCreated);

    const res = await app.inject({
      method: 'POST',
      url: '/approvals',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        locationId: mockLocationId,
        type: 'Diskon Khusus',
        title: 'Diskon volume order distributor',
        amount: 1500000,
        note: 'Volume 500 karton',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(reqId1);
    expect(body.status).toBe('PENDING');
    expect(body.amount).toBe(1500000);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'request.created',
          entity: 'Request',
          entityId: reqId1,
        }),
      }),
    );
  });

  it('GET /approvals - scopes by requesterId for Staff without approval:read_all', async () => {
    const token = getAuthToken(mockStaffUser.id);
    mockPrisma.request.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: `/approvals?locationId=${mockLocationId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          locationId: mockLocationId,
          requesterId: mockStaffUser.id,
        }),
      }),
    );
  });

  it('GET /approvals - does not restrict requesterId for Finance with approval:read_all', async () => {
    const token = getAuthToken(mockFinanceUser.id);
    mockPrisma.request.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: `/approvals?locationId=${mockLocationId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          requesterId: mockFinanceUser.id,
        }),
      }),
    );
  });

  it('POST /approvals/:id/decide - rejects decision from ADMIN (Separation of Duties)', async () => {
    const token = getAuthToken(mockAdminUser.id);

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${reqId1}/decide`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { decision: 'APPROVED' },
    });

    // Admin has no approval:decide permission per SPEC
    expect(res.statusCode).toBe(403);
  });

  it('POST /approvals/:id/decide - rejects decision if requester attempts self-approval', async () => {
    const token = getAuthToken(mockFinanceUser.id);

    // Request was created by Finance user
    mockPrisma.request.findUnique.mockResolvedValue({
      id: reqFinanceSelfId,
      requesterId: mockFinanceUser.id,
      locationId: mockLocationId,
      status: 'PENDING',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${reqFinanceSelfId}/decide`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { decision: 'APPROVED' },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('sendiri');
  });

  it('POST /approvals/:id/decide - returns 409 Conflict if already decided', async () => {
    const token = getAuthToken(mockFinanceUser.id);

    mockPrisma.request.findUnique.mockResolvedValue({
      id: reqId1,
      requesterId: mockStaffUser.id,
      locationId: mockLocationId,
      status: 'APPROVED', // already approved
    });
    mockPrisma.request.updateMany.mockResolvedValue({ count: 0 });

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${reqId1}/decide`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { decision: 'APPROVED' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('POST /approvals/:id/decide - approves request successfully and writes request.approved audit log', async () => {
    const token = getAuthToken(mockFinanceUser.id);

    mockPrisma.request.findUnique.mockResolvedValue({
      id: reqId1,
      requesterId: mockStaffUser.id,
      locationId: mockLocationId,
      type: 'Diskon Khusus',
      title: 'Diskon volume',
      amount: new Prisma.Decimal(1500000),
      status: 'PENDING',
    });
    mockPrisma.request.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.approval.create.mockResolvedValue({
      id: 'app-001',
      requestId: reqId1,
      approverId: mockFinanceUser.id,
      level: 1,
      decision: 'APPROVED',
      note: null,
      decidedAt: new Date(),
    });
    mockPrisma.request.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: reqId1,
      requesterId: mockStaffUser.id,
      locationId: mockLocationId,
      type: 'Diskon Khusus',
      title: 'Diskon volume',
      note: null,
      amount: new Prisma.Decimal(1500000),
      status: 'APPROVED',
      version: 2,
      decidedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      requester: { id: mockStaffUser.id, name: mockStaffUser.name, email: mockStaffUser.email },
      approvals: [
        {
          id: 'app-001',
          requestId: reqId1,
          approverId: mockFinanceUser.id,
          approver: { id: mockFinanceUser.id, name: mockFinanceUser.name, email: mockFinanceUser.email },
          level: 1,
          decision: 'APPROVED',
          note: null,
          decidedAt: new Date(),
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${reqId1}/decide`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { decision: 'APPROVED' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('APPROVED');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'request.approved',
          entity: 'Request',
          entityId: reqId1,
        }),
      }),
    );
  });

  it('POST /approvals/:id/decide - rejects with validation error if REJECTED without note or note < 5 chars', async () => {
    const token = getAuthToken(mockFinanceUser.id);

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${reqId1}/decide`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { decision: 'REJECTED', note: 'No' }, // only 2 chars
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /approvals/:id/decide - rejects request with valid note and writes request.rejected audit log', async () => {
    const token = getAuthToken(mockFinanceUser.id);

    mockPrisma.request.findUnique.mockResolvedValue({
      id: reqId2,
      requesterId: mockStaffUser.id,
      locationId: mockLocationId,
      type: 'Diskon Khusus',
      title: 'Diskon berlebih',
      amount: new Prisma.Decimal(5000000),
      status: 'PENDING',
    });
    mockPrisma.request.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.approval.create.mockResolvedValue({
      id: 'app-002',
      requestId: reqId2,
      approverId: mockFinanceUser.id,
      level: 1,
      decision: 'REJECTED',
      note: 'Melebihi toleransi margin pabrik Bogor',
      decidedAt: new Date(),
    });
    mockPrisma.request.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: reqId2,
      requesterId: mockStaffUser.id,
      locationId: mockLocationId,
      type: 'Diskon Khusus',
      title: 'Diskon berlebih',
      note: null,
      amount: new Prisma.Decimal(5000000),
      status: 'REJECTED',
      version: 2,
      decidedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      requester: { id: mockStaffUser.id, name: mockStaffUser.name, email: mockStaffUser.email },
      approvals: [
        {
          id: 'app-002',
          requestId: reqId2,
          approverId: mockFinanceUser.id,
          approver: { id: mockFinanceUser.id, name: mockFinanceUser.name, email: mockFinanceUser.email },
          level: 1,
          decision: 'REJECTED',
          note: 'Melebihi toleransi margin pabrik Bogor',
          decidedAt: new Date(),
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${reqId2}/decide`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        decision: 'REJECTED',
        note: 'Melebihi toleransi margin pabrik Bogor',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('REJECTED');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'request.rejected',
          entity: 'Request',
          entityId: reqId2,
        }),
      }),
    );
  });
});
