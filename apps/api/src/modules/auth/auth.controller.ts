import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import {
  AuthUser,
  ChangePasswordDto,
  changePasswordSchema,
  GoogleExchangeDto,
  googleExchangeSchema,
  LoginDto,
  loginSchema,
  ReqCtx,
} from '@tridhata/shared';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContext } from '../../common/decorators/req-ctx.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  @Public()
  @Throttle(
    process.env.NODE_ENV === 'production'
      ? { default: { limit: 5, ttl: 900000 } }
      : { default: { limit: 50, ttl: 60000 } },
  )
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @RequestContext() ctx: ReqCtx,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(dto, ctx);

    this.setRefreshTokenCookie(reply, result.rawRefreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @RequestContext() ctx: ReqCtx,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.authService.validateCsrfOrigin(req.headers.origin);

    const rawToken = (req.cookies as Record<string, string | undefined>)?.rt;
    if (!rawToken) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Token penyegar tidak ditemukan di cookie',
        details: null,
      });
    }

    const result = await this.authService.refresh(rawToken, ctx);

    this.setRefreshTokenCookie(reply, result.rawRefreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: FastifyRequest,
    @RequestContext() ctx: ReqCtx,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.authService.validateCsrfOrigin(req.headers.origin);

    const rawToken = (req.cookies as Record<string, string | undefined>)?.rt;
    await this.authService.logout(rawToken, ctx);

    this.clearRefreshTokenCookie(reply);

    return { success: true };
  }

  @Post('auth/change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordDto,
    @RequestContext() ctx: ReqCtx,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.changePassword(user, dto, ctx);

    // Cabut cookie saat ini
    this.clearRefreshTokenCookie(reply);

    return result;
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user);
  }

  @Public()
  @Get('auth/google')
  async googleLogin(@Res() reply: FastifyReply) {
    const { url, state } = this.googleOAuthService.getAuthorizationUrl();

    reply.setCookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: 600, // 10 menit
    });

    return reply.redirect(url);
  }

  @Public()
  @Get('auth/google/callback')
  async googleCallback(
    @Req() req: FastifyRequest,
    @RequestContext() ctx: ReqCtx,
    @Res() reply: FastifyReply,
  ) {
    const frontendOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const query = (req.query || {}) as { code?: string; state?: string; error?: string };
    const cookies = (req.cookies || {}) as Record<string, string | undefined>;
    const cookieState = cookies.oauth_state;

    // Bersihkan cookie oauth_state setelah diterima
    reply.clearCookie('oauth_state', { path: '/auth' });

    if (query.error) {
      return reply.redirect(
        `${frontendOrigin}/login?error=GOOGLE_AUTH_CANCELLED`,
      );
    }

    if (!query.code || !query.state) {
      return reply.redirect(
        `${frontendOrigin}/login?error=STATE_MISMATCH`,
      );
    }

    try {
      const result = await this.googleOAuthService.handleCallback(
        query.code,
        query.state,
        cookieState,
        ctx,
      );

      this.setRefreshTokenCookie(reply, result.rawRefreshToken);

      return reply.redirect(
        `${frontendOrigin}/auth/callback?ticket=${encodeURIComponent(result.ticket)}`,
      );
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { code?: string; details?: { email?: string } };
      };
      const code = errorObj?.response?.code || 'AUTH_FAILED';
      const email = errorObj?.response?.details?.email;
      const emailParam = email ? `&email=${encodeURIComponent(email)}` : '';

      return reply.redirect(`${frontendOrigin}/login?error=${code}${emailParam}`);
    }
  }

  @Public()
  @Post('auth/google/exchange')
  @HttpCode(HttpStatus.OK)
  async googleExchange(
    @Body(new ZodValidationPipe(googleExchangeSchema)) dto: GoogleExchangeDto,
  ) {
    return this.googleOAuthService.exchangeTicket(dto.ticket);
  }

  private setRefreshTokenCookie(reply: FastifyReply, rawToken: string) {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = process.env.COOKIE_DOMAIN ? process.env.COOKIE_DOMAIN : undefined;

    reply.setCookie('rt', rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/auth',
      domain,
      maxAge: 7 * 24 * 60 * 60, // 7 hari dalam detik untuk fastify cookie
    });
  }

  private clearRefreshTokenCookie(reply: FastifyReply) {
    const domain = process.env.COOKIE_DOMAIN ? process.env.COOKIE_DOMAIN : undefined;
    reply.clearCookie('rt', {
      path: '/auth',
      domain,
    });
  }
}
