import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Users, Audit & Locations Endpoints (e2e)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let staffToken: string;

  const adminUserId = '11111111-1111-1111-1111-111111111111';
  const staffUserId = '22222222-2222-2222-2222-222222222222';
  const bogorLocId = '33333333-3333-3333-3333-333333333333';
  const nganjukLocId = '44444444-4444-4444-4444-444444444444';

  const mockAdminUser = {
    id: adminUserId,
    name: 'Admin Tridhata',
    email: 'admin@tridhata.com',
    roleId: 'role-admin-id',
    division: 'Management',
    defaultLocationId: bogorLocId,
    extraPermissions: [],
    active: true,
    mustChangePassword: false,
    failedLogins: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: 'role-admin-id',
      name: 'ADMIN',
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
    access: [
      {
        locationId: bogorLocId,
        location: { id: bogorLocId, code: 'BOGOR', name: 'Pabrik Bogor' },
      },
    ],
  };

  const mockStaffUser = {
    id: staffUserId,
    name: 'Staff Lapangan',
    email: 'staff@tridhata.com',
    roleId: 'role-staff-id',
    division: 'Produksi',
    defaultLocationId: bogorLocId,
    extraPermissions: [],
    active: true,
    mustChangePassword: false,
    failedLogins: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: 'role-staff-id',
      name: 'STAFF',
      permissions: ['dashboard:read', 'export:run', 'approval:create'],
    },
    access: [
      {
        locationId: bogorLocId,
        location: { id: bogorLocId, code: 'BOGOR', name: 'Pabrik Bogor' },
      },
    ],
  };

  const mockLocations = [
    {
      id: bogorLocId,
      code: 'BOGOR',
      name: 'Pabrik Bogor',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: nganjukLocId,
      code: 'NGANJUK',
      name: 'Pabrik Nganjuk',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  interface MockPrisma {
    $connect: jest.Mock;
    $disconnect: jest.Mock;
    $queryRaw: jest.Mock;
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    role: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    location: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    locationAccess: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    refreshToken: {
      updateMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  }

  const prismaMock: MockPrisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    location: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    locationAccess: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prismaMock.$transaction.mockImplementation((callback: (tx: MockPrisma) => unknown) =>
    callback(prismaMock),
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    adminToken = jwtService.sign({ sub: mockAdminUser.id });
    staffToken = jwtService.sign({ sub: mockStaffUser.id });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === adminUserId) return Promise.resolve(mockAdminUser);
        if (where.id === staffUserId) return Promise.resolve(mockStaffUser);
        return Promise.resolve(null);
      },
    );
  });

  describe('GET /users', () => {
    it('returns 403 Forbidden for STAFF', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: {
          authorization: `Bearer ${staffToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 200 OK with user list for ADMIN', async () => {
      prismaMock.user.findMany.mockResolvedValue([mockAdminUser]);

      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].email).toBe('admin@tridhata.com');
    });
  });

  describe('POST /users', () => {
    it('returns 201 Created and temporaryPassword for ADMIN', async () => {
      prismaMock.user.findUnique.mockImplementation(
        ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id === adminUserId) return Promise.resolve(mockAdminUser);
          if (where.email === 'finance@tridhata.com') return Promise.resolve(null);
          return Promise.resolve(null);
        },
      );
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-finance-id', name: 'FINANCE' });
      prismaMock.location.findMany.mockResolvedValue([{ id: bogorLocId, code: 'BOGOR', name: 'Bogor' }]);
      prismaMock.user.create.mockResolvedValue({
        id: 'new-finance-id',
        name: 'Finance User',
        email: 'finance@tridhata.com',
        division: 'Keuangan',
        roleId: 'role-finance-id',
        defaultLocationId: bogorLocId,
        extraPermissions: [],
        active: true,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        role: { name: 'FINANCE' },
        access: [{ location: { id: bogorLocId, code: 'BOGOR', name: 'Bogor' } }],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Finance User',
          email: 'finance@tridhata.com',
          role: 'FINANCE',
          division: 'Keuangan',
          locationIds: [bogorLocId],
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload);
      expect(data.user.email).toBe('finance@tridhata.com');
      expect(data.temporaryPassword).toHaveLength(12);
    });
  });

  describe('PATCH /users/:id', () => {
    it('returns 200 OK on user update', async () => {
      prismaMock.user.findUnique.mockImplementation(
        ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id === adminUserId) return Promise.resolve(mockAdminUser);
          if (where.id === staffUserId) return Promise.resolve(mockStaffUser);
          return Promise.resolve(null);
        },
      );
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.update.mockResolvedValue({
        ...mockStaffUser,
        name: 'Staff Baru Nama',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${staffUserId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Staff Baru Nama',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.name).toBe('Staff Baru Nama');
    });
  });

  describe('POST /users/:id/reset-password', () => {
    it('returns 200 OK and new temporaryPassword', async () => {
      prismaMock.user.findUnique.mockImplementation(
        ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id === adminUserId) return Promise.resolve(mockAdminUser);
          if (where.id === staffUserId) return Promise.resolve(mockStaffUser);
          return Promise.resolve(null);
        },
      );
      prismaMock.user.update.mockResolvedValue(mockStaffUser);
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const res = await app.inject({
        method: 'POST',
        url: `/users/${staffUserId}/reset-password`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.temporaryPassword).toHaveLength(12);
    });
  });

  describe('GET /audit-logs', () => {
    it('returns 403 Forbidden for STAFF', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/audit-logs',
        headers: {
          authorization: `Bearer ${staffToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 200 OK with logs for ADMIN', async () => {
      prismaMock.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          userId: adminUserId,
          action: 'user.created',
          entity: 'User',
          entityId: 'new-user-id',
          before: null,
          after: { email: 'staff@tridhata.com' },
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          createdAt: new Date(),
          user: { id: adminUserId, name: 'Admin Tridhata', email: 'admin@tridhata.com' },
        },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/audit-logs',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].action).toBe('user.created');
    });
  });

  describe('GET /locations', () => {
    it('returns accessible locations for current user', async () => {
      prismaMock.location.findMany.mockResolvedValue(mockLocations);

      const res = await app.inject({
        method: 'GET',
        url: '/locations',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data).toHaveLength(2);
      expect(data[0].code).toBe('BOGOR');
      expect(data[1].code).toBe('NGANJUK');
    });
  });
});
