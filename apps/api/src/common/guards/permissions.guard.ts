import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, AuthUser } from '@tridhata/shared';
import { PERMS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const required =
      this.reflector.getAllAndOverride<Permission[]>(PERMS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (required.length === 0) {
      return true;
    }

    const { user } = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();

    if (!user || !user.permissions || !required.every((p) => user.permissions.includes(p))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Anda tidak punya izin untuk aksi ini',
        details: null,
      });
    }

    return true;
  }
}
