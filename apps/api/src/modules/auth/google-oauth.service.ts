import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { google } from 'googleapis';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { AuthUser, ReqCtx } from '@tridhata/shared';

export interface ExchangeTicketData {
  accessToken: string;
  user: AuthUser;
  expiresAt: number;
}

@Injectable()
export class GoogleOAuthService {
  private readonly ticketStore = new Map<string, ExchangeTicketData>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  private getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

    if (!clientId || !clientSecret) {
      throw new BadRequestException({
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google SSO belum dikonfigurasi di server (GOOGLE_CLIENT_ID / SECRET belum diisi)',
        details: null,
      });
    }

    return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
  }

  getAuthorizationUrl(): { url: string; state: string } {
    const oauth2Client = this.getOAuth2Client();
    const state = randomBytes(32).toString('hex');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });

    return { url, state };
  }

  async handleCallback(
    code: string,
    state: string,
    cookieState: string | undefined,
    ctx: ReqCtx,
  ): Promise<{ ticket: string; rawRefreshToken: string; user: AuthUser }> {
    if (!state || !cookieState || state !== cookieState) {
      throw new BadRequestException({
        code: 'STATE_MISMATCH',
        message: 'Parameter state CSRF tidak valid atau sesi login Google telah kedaluwarsa',
        details: null,
      });
    }

    const { email, emailVerified, sub } = await this.verifyGoogleCode(code);

    if (!emailVerified || !email) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email akun Google Anda belum diverifikasi',
        details: null,
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        access: {
          select: { locationId: true },
        },
      },
    });

    if (!user) {
      await this.audit.record({
        action: 'auth.google_login_failed',
        entity: 'User',
        before: { email: normalizedEmail, reason: 'USER_NOT_FOUND', sub },
        ctx,
      });
      throw new UnauthorizedException({
        code: 'UNREGISTERED_ACCOUNT',
        message: `Akun Google (${normalizedEmail}) belum terdaftar dalam sistem Tridhata. Silakan hubungi Administrator.`,
        details: { email: normalizedEmail },
      });
    }

    if (!user.active) {
      await this.audit.record({
        userId: user.id,
        action: 'auth.google_login_failed',
        entity: 'User',
        entityId: user.id,
        before: { email: normalizedEmail, reason: 'USER_INACTIVE', sub },
        ctx,
      });
      throw new UnauthorizedException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Akun Anda sedang dinonaktifkan. Silakan hubungi Administrator.',
        details: { email: normalizedEmail },
      });
    }

    // Sesi login Google berhasil
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
          mustChangePassword: false, // User yang login via SSO tidak dipaksa ubah password
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
          action: 'auth.google_login',
          entity: 'User',
          entityId: user.id,
          after: { lastLoginAt: new Date(), sub },
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

    const authUser = this.authService.buildAuthUser({
      ...user,
      mustChangePassword: false,
    });

    const ticket = this.createExchangeTicket({
      accessToken,
      user: authUser,
    });

    return {
      ticket,
      rawRefreshToken,
      user: authUser,
    };
  }

  protected async verifyGoogleCode(
    code: string,
  ): Promise<{ email?: string; emailVerified?: boolean; sub?: string }> {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.id_token) {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google tidak mengembalikan token ID yang valid',
        details: null,
      });
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    return {
      email: payload?.email,
      emailVerified: payload?.email_verified,
      sub: payload?.sub,
    };
  }

  private createExchangeTicket(session: { accessToken: string; user: AuthUser }): string {
    this.cleanupExpiredTickets();
    const ticket = randomUUID();
    this.ticketStore.set(ticket, {
      ...session,
      expiresAt: Date.now() + 60000, // 60 detik berlaku
    });
    return ticket;
  }

  exchangeTicket(ticket: string): { accessToken: string; user: AuthUser } {
    this.cleanupExpiredTickets();

    const data = this.ticketStore.get(ticket);
    if (!data) {
      throw new UnauthorizedException({
        code: 'INVALID_TICKET',
        message: 'Tiket autentikasi tidak valid atau telah digunakan/kedaluwarsa',
        details: null,
      });
    }

    // Tiket langsung dihapus (single-use constraint)
    this.ticketStore.delete(ticket);

    if (Date.now() > data.expiresAt) {
      throw new UnauthorizedException({
        code: 'EXPIRED_TICKET',
        message: 'Tiket autentikasi telah kedaluwarsa',
        details: null,
      });
    }

    return {
      accessToken: data.accessToken,
      user: data.user,
    };
  }

  private cleanupExpiredTickets() {
    const now = Date.now();
    for (const [key, value] of this.ticketStore.entries()) {
      if (now > value.expiresAt) {
        this.ticketStore.delete(key);
      }
    }
  }
}

