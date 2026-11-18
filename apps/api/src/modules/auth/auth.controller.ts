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
  LoginDto,
  loginSchema,
  ReqCtx,
} from '@tridhata/shared';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContext } from '../../common/decorators/req-ctx.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
