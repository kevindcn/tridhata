import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Controller, Get, Param } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LocationsService } from '../src/modules/locations/locations.service';
import { RequirePermissions } from '../src/common/decorators/permissions.decorator';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { AuthUser, ROLE_DEFAULTS } from '@tridhata/shared';

// Test Controller untuk memverifikasi matriks izin dan pengamanan endpoint
@Controller('test-permission')
class TestPermissionController {
  constructor(private readonly locationsService: LocationsService) {}

  @RequirePermissions('approval:decide')
  @Get('decide')
  decide() {
    return { allowed: true };
  }

  @RequirePermissions('dashboard:read')
  @Get('dashboard')
  dashboard() {
    return { allowed: true };
  }

  @Get('location/:locationId')
  async checkLocation(
    @CurrentUser() user: AuthUser,
    @Param('locationId') locationId: string,
  ) {
    await this.locationsService.assertLocation(user, locationId);
    return { allowed: true };
  }
}

describe('Permissions Matrix & Location Scope (e2e)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;

  const createMockUser = (roleName: 'ADMIN' | 'FINANCE' | 'STAFF', locationIds: string[] = ['loc-bogor']) => ({
    id: `user-${roleName.toLowerCase()}`,
    name: `${roleName} User`,
    email: `${roleName.toLowerCase()}@tridhata.com`,
    passwordHash: 'dummy',
    roleId: `role-${roleName.toLowerCase()}`,
    defaultLocationId: 'loc-bogor',
    extraPermissions: [],
    active: true,
    mustChangePassword: false,
    failedLogins: 0,
    lockedUntil: null,
    lastLoginAt: null,
    role: {
      id: `role-${roleName.toLowerCase()}`,
      name: roleName,
      permissions: [...ROLE_DEFAULTS[roleName]],
    },
    access: locationIds.map((l) => ({ locationId: l })),
  });

  interface MockPrismaPermissions {
    $connect: jest.Mock;
    $disconnect: jest.Mock;
    $queryRaw: jest.Mock;
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    location: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  }

  const prismaMock: MockPrismaPermissions = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    location: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    },
    $transaction: jest.fn(),
  };

  prismaMock.$transaction.mockImplementation(
    (callback: (tx: MockPrismaPermissions) => unknown) => callback(prismaMock),
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestPermissionController],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('STAFF cannot access endpoint requiring approval:decide (403 Forbidden)', async () => {
    const staff = createMockUser('STAFF');
    prismaMock.user.findUnique.mockResolvedValue(staff);
    const token = jwtService.sign({ sub: staff.id });

    const res = await app.inject({
      method: 'GET',
      url: '/test-permission/decide',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('Anda tidak punya izin untuk aksi ini');
  });

  it('ADMIN cannot access endpoint requiring approval:decide (403 Forbidden - Segregation of Duties)', async () => {
    const admin = createMockUser('ADMIN');
    prismaMock.user.findUnique.mockResolvedValue(admin);
    const token = jwtService.sign({ sub: admin.id });

    const res = await app.inject({
      method: 'GET',
      url: '/test-permission/decide',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('FINANCE can access endpoint requiring approval:decide (200 OK)', async () => {
    const finance = createMockUser('FINANCE');
    prismaMock.user.findUnique.mockResolvedValue(finance);
    const token = jwtService.sign({ sub: finance.id });

    const res = await app.inject({
      method: 'GET',
      url: '/test-permission/decide',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.allowed).toBe(true);
  });

  it('User without location:all is blocked from other locations (403 Forbidden)', async () => {
    // Staff with only 'loc-bogor' access
    const staff = createMockUser('STAFF', ['loc-bogor']);
    prismaMock.user.findUnique.mockResolvedValue(staff);
    const token = jwtService.sign({ sub: staff.id });

    // Access to loc-bogor -> OK
    const bogorRes = await app.inject({
      method: 'GET',
      url: '/test-permission/location/loc-bogor',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(bogorRes.statusCode).toBe(200);

    // Access to loc-nganjuk -> 403 Forbidden
    const nganjukRes = await app.inject({
      method: 'GET',
      url: '/test-permission/location/loc-nganjuk',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(nganjukRes.statusCode).toBe(403);
    const body = JSON.parse(nganjukRes.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('Anda tidak punya akses ke lokasi ini');
  });

  it('ADMIN with location:all can access any valid location (200 OK)', async () => {
    const admin = createMockUser('ADMIN', ['loc-bogor']);
    prismaMock.user.findUnique.mockResolvedValue(admin);
    prismaMock.location.count.mockResolvedValue(1); // Location exists in DB
    const token = jwtService.sign({ sub: admin.id });

    const res = await app.inject({
      method: 'GET',
      url: '/test-permission/location/loc-nganjuk',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
