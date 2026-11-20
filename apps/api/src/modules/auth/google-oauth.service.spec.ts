import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GoogleOAuthService } from './google-oauth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { AuthUser, ReqCtx } from '@tridhata/shared';

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockUser = {
    id: 'user-uuid-1',
    name: 'Budi Santoso',
    email: 'budi@tridhata.com',
    passwordHash: 'dummy',
    active: true,
    mustChangePassword: true,
    failedLogins: 0,
    lockedUntil: null,
    roleId: 'role-1',
    role: { id: 'role-1', name: 'STAFF', permissions: ['penjualan:baca'] },
    access: [{ locationId: 'loc-1' }],
    defaultLocationId: 'loc-1',
    extraPermissions: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
            },
            $transaction: jest.fn((cb) =>
              cb({
                user: { update: jest.fn() },
                refreshToken: { create: jest.fn() },
              }),
            ),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mocked-google-access-token'),
          },
        },
        {
          provide: AuthService,
          useValue: {
            buildAuthUser: jest.fn((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role.name,
              permissions: u.role.permissions,
              locationIds: ['loc-1'],
              defaultLocationId: 'loc-1',
              mustChangePassword: false,
            })),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleOAuthService>(GoogleOAuthService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  describe('getAuthorizationUrl', () => {
    it('throws error when Google client ID or Secret is not configured', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      expect(() => service.getAuthorizationUrl()).toThrow(BadRequestException);
    });

    it('generates a URL containing Google OAuth endpoint and returns anti-CSRF state', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';

      const result = service.getAuthorizationUrl();
      expect(result.state).toBeDefined();
      expect(result.state.length).toBeGreaterThanOrEqual(32);
      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('test-client-id');
      expect(result.url).toContain(result.state);
    });
  });

  describe('handleCallback', () => {
    const ctx: ReqCtx = { ip: '127.0.0.1', userAgent: 'Jest' };

    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
    });

    it('rejects when state does not match cookie state', async () => {
      await expect(
        service.handleCallback('code-123', 'state-from-google', 'different-cookie-state', ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when email is not registered in the database (Pre-provisioned policy)', async () => {
      jest.spyOn(service as any, 'verifyGoogleCode').mockResolvedValue({
        email: 'unregistered@tridhata.com',
        emailVerified: true,
        sub: 'google-sub-456',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.handleCallback('valid-code', 'match-state', 'match-state', ctx),
      ).rejects.toThrow(UnauthorizedException);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.google_login_failed',
          before: expect.objectContaining({
            email: 'unregistered@tridhata.com',
            reason: 'USER_NOT_FOUND',
          }),
        }),
      );
    });

    it('rejects when user account is inactive', async () => {
      jest.spyOn(service as any, 'verifyGoogleCode').mockResolvedValue({
        email: 'inactive@tridhata.com',
        emailVerified: true,
        sub: 'google-sub-789',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'inactive@tridhata.com',
        active: false,
      });

      await expect(
        service.handleCallback('valid-code', 'match-state', 'match-state', ctx),
      ).rejects.toThrow(UnauthorizedException);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.google_login_failed',
          before: expect.objectContaining({
            reason: 'USER_INACTIVE',
          }),
        }),
      );
    });

    it('successfully authenticates registered active user and creates a single-use exchange ticket', async () => {
      jest.spyOn(service as any, 'verifyGoogleCode').mockResolvedValue({
        email: 'budi@tridhata.com',
        emailVerified: true,
        sub: 'google-sub-1',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.handleCallback('valid-code', 'match-state', 'match-state', ctx);

      expect(result.ticket).toBeDefined();
      expect(result.rawRefreshToken).toBeDefined();
      expect(result.user.email).toBe('budi@tridhata.com');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.google_login',
          userId: mockUser.id,
        }),
        expect.anything(),
      );
    });
  });

  describe('exchangeTicket', () => {
    it('exchanges ticket successfully on first call and rejects reuse', () => {
      const ticket = (service as any).createExchangeTicket({
        accessToken: 'access-jwt-token-123',
        user: { id: 'u1', email: 'budi@tridhata.com' } as AuthUser,
      });

      const firstExchange = service.exchangeTicket(ticket);
      expect(firstExchange.accessToken).toBe('access-jwt-token-123');
      expect(firstExchange.user.email).toBe('budi@tridhata.com');

      // Second exchange with same ticket MUST fail (single-use constraint)
      expect(() => service.exchangeTicket(ticket)).toThrow(UnauthorizedException);
    });

    it('rejects an invalid or non-existent ticket', () => {
      expect(() => service.exchangeTicket('non-existent-ticket-id')).toThrow(UnauthorizedException);
    });
  });
});
