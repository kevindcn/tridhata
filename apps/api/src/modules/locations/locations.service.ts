import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '@tridhata/shared';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertLocation(user: AuthUser, locationId: string): Promise<void> {
    if (user.permissions.includes('location:all')) {
      const exists = await this.prisma.location.count({ where: { id: locationId } });
      if (!exists) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Lokasi tidak ditemukan',
          details: null,
        });
      }
      return;
    }

    if (!user.locationIds.includes(locationId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Anda tidak punya akses ke lokasi ini',
        details: null,
      });
    }
  }

  async getAccessibleLocations(user: AuthUser) {
    if (user.permissions.includes('location:all')) {
      return this.prisma.location.findMany({
        orderBy: { code: 'asc' },
      });
    }

    return this.prisma.location.findMany({
      where: {
        id: { in: user.locationIds },
      },
      orderBy: { code: 'asc' },
    });
  }
}
