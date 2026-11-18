import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth Endpoints (e2e)', () => {
  let app: NestFastifyApplication;
  let testPasswordHash: string;

  const mockUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Admin Tridhata',
    email: 'admin@tridhata.com',
    passwordHash: '',
    roleId: '22222222-2222-2222-2222-222222222222',
    defaultLocationId: '33333333-3333-3333-3333-333333333333',
    extraPermissions: [],
    active: true,
    mustChangePassword: true,
    failedLogins: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: '22222222-2222-2222-2222-222222222222',
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
    access: [{ locationId: '33333333-3333-3333-3333-333333333333' }],
  };

  interface MockPrismaAuth {
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
    auditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  }

  const prismaMock: MockPrismaAuth = {
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
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    },
    $transaction: jest.fn(),
  };

  prismaMock.$transaction.mockImplementation((callback: (tx: MockPrismaAuth) => unknown) =>
    callback(prismaMock),
  );

  beforeAll(async () => {
    testPasswordHash = await argon2.hash('Secret12345!', { type: argon2.argon2id });
    mockUser.passwordHash = testPasswordHash;

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /auth/login - fails on invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'invalid-email',
        password: 'password',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/login - fails on incorrect password and logs failed attempt', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.user.update.mockResolvedValue(mockUser);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'admin@tridhata.com',
        password: 'wrong_password',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.message).toBe('Email atau kata sandi salah');
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });

  it('POST /auth/login - succeeds with correct credentials and returns JWT + cookie', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.user.update.mockResolvedValue(mockUser);
    prismaMock.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'admin@tridhata.com',
        password: 'Secret12345!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe('admin@tridhata.com');
    expect(body.user.role).toBe('ADMIN');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });

  it('GET /me - returns authenticated user profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    // Login first to get access token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'admin@tridhata.com',
        password: 'Secret12345!',
      },
    });
    const { accessToken } = JSON.parse(loginRes.body);

    const meRes = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.body);
    expect(meBody.email).toBe('admin@tridhata.com');
    expect(meBody.permissions).toContain('dashboard:read');
    expect(meBody.mustChangePassword).toBe(true);
  });

  it('POST /auth/logout - revokes refresh token and clears cookie', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: mockUser.id,
      familyId: 'fam-1',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: {
        cookie: 'rt=sample_refresh_token_123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalled();
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });
});
