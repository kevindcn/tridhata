import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, HttpException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '@tridhata/shared';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let audit: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
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
            $transaction: jest.fn((cb) =>
              cb({
                user: {
                  update: jest.fn(),
                },
                refreshToken: {
                  create: jest.fn().mockResolvedValue({ id: 'new-token-id' }),
                  update: jest.fn(),
                  updateMany: jest.fn(),
                },
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
            sign: jest.fn().mockReturnValue('mocked-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);

    await service.onModuleInit();
  });

  const ctx = { ip: '127.0.0.1', userAgent: 'test-agent' };

  describe('login', () => {
    it('throws 401 when user is not found and records audit log', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'password123' }, ctx),
      ).rejects.toThrow(UnauthorizedException);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login_failed' }),
      );
    });

    it('throws 429 when account is locked', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        email: 'locked@example.com',
        active: true,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 menit ke depan
      });

      await expect(
        service.login({ email: 'locked@example.com', password: 'password123' }, ctx),
      ).rejects.toThrow(HttpException);
    });

    it('locks account for 15 minutes on 5th failed attempt', async () => {
      const passwordHash = await argon2.hash('correct_password');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        passwordHash,
        active: true,
        failedLogins: 4, // Percobaan ke-5 yang gagal
        lockedUntil: null,
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong_password' }, ctx),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLogins: 0,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('successfully logs in, resets failed count, creates tokens and audits', async () => {
      const passwordHash = await argon2.hash('secret123');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        name: 'Admin',
        email: 'admin@tridhata.com',
        passwordHash,
        active: true,
        failedLogins: 2,
        lockedUntil: null,
        role: { name: 'ADMIN', permissions: ['dashboard:read'] },
        extraPermissions: [],
        access: [{ locationId: 'loc-1' }],
        defaultLocationId: 'loc-1',
        mustChangePassword: true,
      });

      const res = await service.login(
        { email: 'admin@tridhata.com', password: 'secret123' },
        ctx,
      );

      expect(res.accessToken).toBe('mocked-jwt-token');
      expect(res.rawRefreshToken).toBeDefined();
      expect(res.user.email).toBe('admin@tridhata.com');
      expect(res.user.mustChangePassword).toBe(true);
    });
  });

  describe('refresh', () => {
    it('revokes entire token family when rotated token is reused (token theft detection)', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-old',
        userId: 'u-1',
        familyId: 'family-xyz',
        revokedAt: new Date(Date.now() - 1000), // Sudah dicabut sebelumnya
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.refresh('reused_raw_token', ctx)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-xyz', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.token_theft_detected' }),
      );
    });

    it('successfully rotates refresh token and returns new access token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-active',
        userId: 'u-1',
        familyId: 'family-xyz',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        name: 'Finance User',
        email: 'finance@tridhata.com',
        active: true,
        role: { name: 'FINANCE', permissions: ['dashboard:read', 'finance:read'] },
        extraPermissions: [],
        access: [{ locationId: 'loc-1' }],
        defaultLocationId: 'loc-1',
        mustChangePassword: false,
      });

      const res = await service.refresh('valid_token', ctx);

      expect(res.accessToken).toBe('mocked-jwt-token');
      expect(res.rawRefreshToken).toBeDefined();
      expect(res.user.email).toBe('finance@tridhata.com');
    });
  });

  describe('changePassword', () => {
    const authUser: AuthUser = {
      id: 'u-1',
      name: 'User',
      email: 'user@tridhata.com',
      role: 'STAFF',
      permissions: ['dashboard:read'],
      locationIds: ['loc-1'],
      defaultLocationId: 'loc-1',
      mustChangePassword: true,
    };

    it('throws error if current password does not match', async () => {
      const hash = await argon2.hash('real_password');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        passwordHash: hash,
      });

      await expect(
        service.changePassword(
          authUser,
          { currentPassword: 'wrong_password', newPassword: 'NewPassword2026!' },
          ctx,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password, revokes all tokens, and sets mustChangePassword to false', async () => {
      const hash = await argon2.hash('old_password123');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        passwordHash: hash,
      });

      const res = await service.changePassword(
        authUser,
        { currentPassword: 'old_password123', newPassword: 'NewPassword2026!' },
        ctx,
      );

      expect(res.message).toBe('Kata sandi berhasil diperbarui');
    });
  });
});
