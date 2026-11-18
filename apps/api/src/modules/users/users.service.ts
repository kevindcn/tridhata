import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuthUser,
  CreateUserDto,
  CreateUserResponse,
  Permission,
  ReqCtx,
  ResetPasswordResponse,
  RoleName,
  UpdateUserDto,
  UserResponse,
} from '@tridhata/shared';

export function generateTemporaryPassword(length = 12): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getUsers(): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        role: true,
        access: {
          include: {
            location: true,
          },
        },
      },
    });

    return users.map((user) => this.mapUserResponse(user));
  }

  async getUserById(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        access: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    return this.mapUserResponse(user);
  }

  async createUser(
    dto: CreateUserDto,
    ctx: ReqCtx,
    actorId: string,
  ): Promise<CreateUserResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });
    if (!role) {
      throw new BadRequestException('Peran tidak valid');
    }

    const locations = await this.prisma.location.findMany({
      where: { id: { in: dto.locationIds } },
    });
    if (locations.length !== dto.locationIds.length) {
      throw new BadRequestException('Satu atau lebih lokasi tidak valid');
    }

    const defaultLocationId =
      dto.defaultLocationId && dto.locationIds.includes(dto.defaultLocationId)
        ? dto.defaultLocationId
        : dto.locationIds[0];

    const tempPassword = generateTemporaryPassword(12);
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email: normalizedEmail,
          passwordHash,
          division: dto.division?.trim() || null,
          roleId: role.id,
          defaultLocationId,
          extraPermissions: dto.extraPermissions || [],
          active: true,
          mustChangePassword: true,
          access: {
            create: dto.locationIds.map((locId) => ({
              locationId: locId,
            })),
          },
        },
        include: {
          role: true,
          access: {
            include: {
              location: true,
            },
          },
        },
      });

      await this.auditService.record(
        {
          userId: actorId,
          action: 'user.created',
          entity: 'User',
          entityId: createdUser.id,
          after: {
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            role: role.name,
            division: createdUser.division,
            locationIds: dto.locationIds,
            defaultLocationId,
            extraPermissions: createdUser.extraPermissions,
            active: createdUser.active,
            mustChangePassword: createdUser.mustChangePassword,
          },
          ctx,
        },
        tx,
      );

      return createdUser;
    });

    return {
      user: this.mapUserResponse(user),
      temporaryPassword: tempPassword,
    };
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    ctx: ReqCtx,
    actorUser: AuthUser,
  ): Promise<UserResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        access: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    // Safety checks for self
    if (id === actorUser.id) {
      if (dto.active === false) {
        throw new BadRequestException('Tidak dapat menonaktifkan akun sendiri');
      }
      if (dto.role && dto.role !== actorUser.role) {
        throw new BadRequestException('Tidak dapat mengubah peran akun sendiri');
      }
    }

    // Safety check: at least one active ADMIN must remain in the system
    if (existing.role.name === 'ADMIN') {
      const willDeactivate = dto.active === false;
      const willDemote = dto.role && dto.role !== 'ADMIN';
      if (willDeactivate || willDemote) {
        const activeAdminCount = await this.prisma.user.count({
          where: {
            role: { name: 'ADMIN' },
            active: true,
            id: { not: id },
          },
        });
        if (activeAdminCount === 0) {
          throw new BadRequestException(
            'Sistem harus memiliki minimal satu akun Admin yang aktif',
          );
        }
      }
    }

    let roleId = existing.roleId;
    if (dto.role && dto.role !== existing.role.name) {
      const newRole = await this.prisma.role.findUnique({
        where: { name: dto.role },
      });
      if (!newRole) {
        throw new BadRequestException('Peran tidak valid');
      }
      roleId = newRole.id;
    }

    let normalizedEmail = existing.email;
    if (dto.email && dto.email.trim().toLowerCase() !== existing.email) {
      normalizedEmail = dto.email.trim().toLowerCase();
      const duplicate = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (duplicate) {
        throw new ConflictException('Email sudah terdaftar');
      }
    }

    if (dto.locationIds) {
      const locations = await this.prisma.location.findMany({
        where: { id: { in: dto.locationIds } },
      });
      if (locations.length !== dto.locationIds.length) {
        throw new BadRequestException('Satu atau lebih lokasi tidak valid');
      }
    }

    let defaultLocationId = existing.defaultLocationId;
    if (dto.defaultLocationId !== undefined) {
      defaultLocationId = dto.defaultLocationId;
    } else if (dto.locationIds && defaultLocationId && !dto.locationIds.includes(defaultLocationId)) {
      defaultLocationId = dto.locationIds[0];
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      if (dto.locationIds) {
        await tx.locationAccess.deleteMany({
          where: { userId: id },
        });
        await tx.locationAccess.createMany({
          data: dto.locationIds.map((locId) => ({
            userId: id,
            locationId: locId,
          })),
        });
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          email: dto.email !== undefined ? normalizedEmail : undefined,
          division: dto.division !== undefined ? dto.division?.trim() || null : undefined,
          roleId: dto.role !== undefined ? roleId : undefined,
          defaultLocationId,
          extraPermissions: dto.extraPermissions !== undefined ? dto.extraPermissions : undefined,
          active: dto.active !== undefined ? dto.active : undefined,
        },
        include: {
          role: true,
          access: {
            include: {
              location: true,
            },
          },
        },
      });

      await this.auditService.record(
        {
          userId: actorUser.id,
          action: 'user.updated',
          entity: 'User',
          entityId: id,
          before: {
            name: existing.name,
            email: existing.email,
            role: existing.role.name,
            division: existing.division,
            locationIds: existing.access.map((a) => a.locationId),
            defaultLocationId: existing.defaultLocationId,
            extraPermissions: existing.extraPermissions,
            active: existing.active,
          },
          after: {
            name: updated.name,
            email: updated.email,
            role: updated.role.name,
            division: updated.division,
            locationIds: updated.access.map((a) => a.locationId),
            defaultLocationId: updated.defaultLocationId,
            extraPermissions: updated.extraPermissions,
            active: updated.active,
          },
          ctx,
        },
        tx,
      );

      return updated;
    });

    return this.mapUserResponse(updatedUser);
  }

  async resetPassword(
    id: string,
    ctx: ReqCtx,
    actorId: string,
  ): Promise<ResetPasswordResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    const tempPassword = generateTemporaryPassword(12);
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLogins: 0,
          lockedUntil: null,
        },
      });

      // Revoke all active refresh tokens
      await tx.refreshToken.updateMany({
        where: {
          userId: id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await this.auditService.record(
        {
          userId: actorId,
          action: 'user.password_reset',
          entity: 'User',
          entityId: id,
          after: {
            mustChangePassword: true,
            tokensRevoked: true,
          },
          ctx,
        },
        tx,
      );
    });

    return {
      temporaryPassword: tempPassword,
    };
  }

  private mapUserResponse(user: {
    id: string;
    name: string;
    email: string;
    division: string | null;
    active: boolean;
    mustChangePassword: boolean;
    defaultLocationId: string | null;
    extraPermissions: string[];
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    role: { name: string };
    access: Array<{ location: { id: string; code: string; name: string } }>;
  }): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name as RoleName,
      division: user.division,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      defaultLocationId: user.defaultLocationId,
      locations: user.access.map((a) => a.location),
      extraPermissions: user.extraPermissions as Permission[],
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
