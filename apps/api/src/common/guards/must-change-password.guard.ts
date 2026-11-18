import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { AuthUser } from '@tridhata/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthUser }>();
    const path = request.url || '';

    // Endpoint yang diizinkan saat mustChangePassword=true
    if (path.startsWith('/auth/') || path === '/me' || path.startsWith('/me?')) {
      return true;
    }

    const user = request.user;
    if (user && user.mustChangePassword) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Anda wajib mengubah kata sandi sebelum melanjutkan',
        details: null,
      });
    }

    return true;
  }
}
