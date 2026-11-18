import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '@tridhata/shared';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        {
          provide: PrismaService,
          useValue: {
            location: {
              count: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const baseUser: AuthUser = {
    id: 'user-1',
    name: 'Staff User',
    email: 'staff@example.com',
    role: 'STAFF',
    permissions: ['dashboard:read'],
    locationIds: ['loc-bogor'],
    defaultLocationId: 'loc-bogor',
    mustChangePassword: false,
  };

  it('allows access if locationId is in user.locationIds', async () => {
    await expect(service.assertLocation(baseUser, 'loc-bogor')).resolves.not.toThrow();
  });

  it('throws ForbiddenException if locationId is NOT in user.locationIds', async () => {
    await expect(service.assertLocation(baseUser, 'loc-nganjuk')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows access to any existing location if user has location:all', async () => {
    const adminUser: AuthUser = {
      ...baseUser,
      permissions: ['location:all'],
      locationIds: [],
    };

    (prisma.location.count as jest.Mock).mockResolvedValue(1);

    await expect(service.assertLocation(adminUser, 'loc-any')).resolves.not.toThrow();
  });

  it('throws NotFoundException if location does not exist even with location:all', async () => {
    const adminUser: AuthUser = {
      ...baseUser,
      permissions: ['location:all'],
      locationIds: [],
    };

    (prisma.location.count as jest.Mock).mockResolvedValue(0);

    await expect(service.assertLocation(adminUser, 'loc-invalid')).rejects.toThrow(
      NotFoundException,
    );
  });
});
