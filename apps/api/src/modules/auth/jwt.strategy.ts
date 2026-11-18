import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, Permission, RoleName } from '@tridhata/shared';

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'fallback-secret-for-testing-purposes-min32',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
        access: {
          select: { locationId: true },
        },
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Sesi tidak valid atau telah kedaluwarsa',
        details: null,
      });
    }

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
