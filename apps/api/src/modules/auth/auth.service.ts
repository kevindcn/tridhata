import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuthUser,
  ChangePasswordDto,
  LoginDto,
  Permission,
  ReqCtx,
  RoleName,
} from '@tridhata/shared';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash('tridhata_dummy_hash_for_timing_mitigation', {
      type: argon2.argon2id,
    });
  }

  async login(dto: LoginDto, ctx: ReqCtx) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        access: {
          select: { locationId: true },
        },
      },
    });

    if (!user || !user.active) {
      // Menyamakan waktu respons (timing attack mitigation)
      await argon2.verify(this.dummyHash, dto.password).catch(() => false);
      await this.audit.record({
        action: 'auth.login_failed',
        entity: 'User',
        before: { email, reason: 'USER_NOT_FOUND_OR_INACTIVE' },
        ctx,
      });
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Email atau kata sandi salah',
        details: null,
      });
    }

    // Periksa apakah akun sedang dikunci
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Akun dikunci sementara. Coba lagi beberapa menit lagi',
          details: null,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.password).catch(() => false);

    if (!isMatch) {
      const failed = user.failedLogins + 1;
      let lockedUntil: Date | null = null;
      let failedLogins = failed;

      if (failed >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Kunci 15 menit
        failedLogins = 0; // Reset hitungan setelah dikunci
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins,
          lockedUntil,
        },
      });

      await this.audit.record({
        userId: user.id,
        action: 'auth.login_failed',
        entity: 'User',
        entityId: user.id,
        before: { failedLogins: user.failedLogins },
        after: { failedLogins, lockedUntil },
        ctx,
      });

      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Email atau kata sandi salah',
        details: null,
      });
    }

    // Berhasil login
    const familyId = randomUUID();
    const rawRefreshToken = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
    const refreshTtlDays = Number(process.env.REFRESH_TTL_DAYS) || 7;
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLogins: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          familyId,
          tokenHash,
          expiresAt,
          ip: ctx.ip || null,
          userAgent: ctx.userAgent || null,
        },
      });

      await this.audit.record(
        {
          userId: user.id,
          action: 'auth.login',
          entity: 'User',
          entityId: user.id,
          after: { lastLoginAt: new Date() },
          ctx,
        },
        tx,
      );
    });

    const accessToken = this.jwtService.sign(
      { sub: user.id },
      {
        expiresIn: (process.env.JWT_ACCESS_TTL as never) || '15m',
      },
    );

    const authUser = this.buildAuthUser(user);

    return {
      accessToken,
      rawRefreshToken,
      user: authUser,
    };
  }

  async refresh(rawToken: string, ctx: ReqCtx) {
    if (!rawToken) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Token penyegar tidak ditemukan',
        details: null,
      });
    }

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!row) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Sesi tidak valid atau telah kedaluwarsa',
        details: null,
      });
    }

    // Indikasi pencurian token: token yang sudah dicabut/dirotasi dipakai lagi!
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.record({
        userId: row.userId,
        action: 'auth.token_theft_detected',
        entity: 'RefreshToken',
        entityId: row.id,
        before: { familyId: row.familyId },
        ctx,
      });

      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Indikasi penyalahgunaan token terdeteksi. Silakan login kembali.',
        details: null,
      });
    }

    // Periksa apakah token kedaluwarsa
    if (row.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Sesi telah kedaluwarsa',
        details: null,
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      include: {
        role: true,
        access: {
          select: { locationId: true },
        },
      },
    });

    if (!user || !user.active) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Pengguna dinonaktifkan atau tidak ditemukan',
        details: null,
      });
    }

    // Terbitkan pengganti dalam satu transaksi (rotasi)
    const newRawToken = randomBytes(48).toString('base64url');
    const newTokenHash = createHash('sha256').update(newRawToken).digest('hex');
    const refreshTtlDays = Number(process.env.REFRESH_TTL_DAYS) || 7;
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      const newRow = await tx.refreshToken.create({
        data: {
          userId: user.id,
          familyId: row.familyId,
          tokenHash: newTokenHash,
          expiresAt,
          ip: ctx.ip || null,
          userAgent: ctx.userAgent || null,
        },
      });

      await tx.refreshToken.update({
        where: { id: row.id },
        data: {
          revokedAt: new Date(),
          replacedById: newRow.id,
        },
      });
    });

    const accessToken = this.jwtService.sign(
      { sub: user.id },
      {
        expiresIn: (process.env.JWT_ACCESS_TTL as never) || '15m',
      },
    );

    const authUser = this.buildAuthUser(user);

    return {
      accessToken,
      rawRefreshToken: newRawToken,
      user: authUser,
    };
  }

  async logout(rawToken: string | undefined, ctx: ReqCtx) {
    if (rawToken) {
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const row = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (row) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await this.audit.record({
          userId: row.userId,
          action: 'auth.logout',
          entity: 'RefreshToken',
          entityId: row.id,
          before: { familyId: row.familyId },
          ctx,
        });
      }
    }
    return { success: true };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto, ctx: ReqCtx) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Pengguna tidak ditemukan',
        details: null,
      });
    }

    const isMatch = await argon2.verify(dbUser.passwordHash, dto.currentPassword).catch(() => false);
    if (!isMatch) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Kata sandi saat ini salah',
        details: { currentPassword: ['Kata sandi saat ini salah'] },
      });
    }

    const newPasswordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
        },
      });

      // Cabut seluruh refresh token pengguna
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.record(
        {
          userId: user.id,
          action: 'auth.password_changed',
          entity: 'User',
          entityId: user.id,
          after: { mustChangePassword: false },
          ctx,
        },
        tx,
      );
    });

    return { message: 'Kata sandi berhasil diperbarui' };
  }

  async getMe(user: AuthUser): Promise<AuthUser> {
    return user;
  }

  validateCsrfOrigin(originHeader: string | undefined) {
    const allowedOrigin = process.env.CORS_ORIGIN;
    if (originHeader && allowedOrigin && originHeader !== allowedOrigin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Permintaan ditolak (Origin tidak diizinkan)',
        details: null,
      });
    }
  }

  private buildAuthUser(user: {
    id: string;
    name: string;
    email: string;
    role: { name: string; permissions: string[] };
    extraPermissions: string[];
    access: { locationId: string }[];
    defaultLocationId: string | null;
    mustChangePassword: boolean;
  }): AuthUser {
    const rolePermissions = (user.role.permissions as Permission[]) || [];
    const extraPermissions = (user.extraPermissions as Permission[]) || [];
    const combinedPermissions = Array.from(
      new Set([...rolePermissions, ...extraPermissions]),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name as RoleName,
      permissions: combinedPermissions,
      locationIds: user.access.map((a) => a.locationId),
      defaultLocationId: user.defaultLocationId,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
