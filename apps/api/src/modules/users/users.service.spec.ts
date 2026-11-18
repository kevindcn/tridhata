import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService, generateTemporaryPassword } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '@tridhata/shared';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    role: {
      findUnique: jest.Mock;
    };
    location: {
      findMany: jest.Mock;
    };
    locationAccess: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    refreshToken: {
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let audit: {
    record: jest.Mock;
  };

  const mockAdminUser: AuthUser = {
    id: 'admin-uuid-1',
    name: 'Admin Utama',
    email: 'admin@tridhata.com',
    role: 'ADMIN',
    permissions: ['user:manage'],
    locationIds: ['loc-bogor-uuid'],
    defaultLocationId: 'loc-bogor-uuid',
    mustChangePassword: false,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      location: {
        findMany: jest.fn(),
      },
      locationAccess: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('generateTemporaryPassword', () => {
    it('should generate a 12-character alphanumeric password', () => {
      const password = generateTemporaryPassword(12);
      expect(password).toHaveLength(12);
      expect(password).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('getUsers', () => {
    it('should return mapped users without passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          name: 'Staff 1',
          email: 'staff1@tridhata.com',
          division: 'PPIC',
          active: true,
          mustChangePassword: false,
          defaultLocationId: 'loc-1',
          extraPermissions: [],
          lastLoginAt: new Date('2026-11-18T10:00:00Z'),
          createdAt: new Date('2026-11-18T00:00:00Z'),
          updatedAt: new Date('2026-11-18T00:00:00Z'),
          role: { name: 'STAFF' },
          access: [
            {
              location: { id: 'loc-1', code: 'BOGOR', name: 'Pabrik Bogor' },
            },
          ],
        },
      ]);

      const result = await service.getUsers();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      expect(result[0].role).toBe('STAFF');
      expect(result[0].locations[0].code).toBe('BOGOR');
      expect((result[0] as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped user when found', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Staff 1',
        email: 'staff1@tridhata.com',
        division: 'PPIC',
        active: true,
        mustChangePassword: false,
        defaultLocationId: 'loc-1',
        extraPermissions: [],
        lastLoginAt: new Date('2026-11-18T10:00:00Z'),
        createdAt: new Date('2026-11-18T00:00:00Z'),
        updatedAt: new Date('2026-11-18T00:00:00Z'),
        role: { name: 'STAFF' },
        access: [
          {
            location: { id: 'loc-1', code: 'BOGOR', name: 'Pabrik Bogor' },
          },
        ],
      });

      const result = await service.getUserById('user-1');
      expect(result.id).toBe('user-1');
      expect(result.role).toBe('STAFF');
    });
  });

  describe('createUser', () => {
    it('should throw ConflictException if email already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createUser(
          {
            name: 'Staff Baru',
            email: 'existing@tridhata.com',
            role: 'STAFF',
            locationIds: ['loc-1'],
          },
          {},
          mockAdminUser.id,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if role not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.createUser(
          {
            name: 'Staff Baru',
            email: 'new@tridhata.com',
            role: 'STAFF',
            locationIds: ['loc-1'],
          },
          {},
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if locationIds invalid', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-staff', name: 'STAFF' });
      prisma.location.findMany.mockResolvedValue([]); // 0 locations found

      await expect(
        service.createUser(
          {
            name: 'Staff Baru',
            email: 'new@tridhata.com',
            role: 'STAFF',
            locationIds: ['loc-invalid'],
          },
          {},
          mockAdminUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create user with 12-char temp password and record audit', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-staff', name: 'STAFF' });
      prisma.location.findMany.mockResolvedValue([{ id: 'loc-1', code: 'BOGOR', name: 'Bogor' }]);

      prisma.user.create.mockResolvedValue({
        id: 'new-user-uuid',
        name: 'Staff Baru',
        email: 'staff.baru@tridhata.com',
        division: 'Gudang',
        roleId: 'role-staff',
        defaultLocationId: 'loc-1',
        extraPermissions: [],
        active: true,
        mustChangePassword: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: { name: 'STAFF' },
        access: [{ location: { id: 'loc-1', code: 'BOGOR', name: 'Bogor' } }],
      });

      const res = await service.createUser(
        {
          name: 'Staff Baru',
          email: 'Staff.Baru@tridhata.com',
          role: 'STAFF',
          division: 'Gudang',
          locationIds: ['loc-1'],
        },
        { ip: '127.0.0.1' },
        mockAdminUser.id,
      );

      expect(res.user.email).toBe('staff.baru@tridhata.com');
      expect(res.user.mustChangePassword).toBe(true);
      expect(res.temporaryPassword).toHaveLength(12);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.created',
          userId: mockAdminUser.id,
        }),
        expect.anything(),
      );
    });
  });

  describe('updateUser', () => {
    it('should prevent admin from deactivating own account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminUser.id,
        role: { name: 'ADMIN' },
        access: [],
      });

      await expect(
        service.updateUser(
          mockAdminUser.id,
          { active: false },
          {},
          mockAdminUser,
        ),
      ).rejects.toThrow(new BadRequestException('Tidak dapat menonaktifkan akun sendiri'));
    });

    it('should prevent admin from demoting own role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminUser.id,
        role: { name: 'ADMIN' },
        access: [],
      });

      await expect(
        service.updateUser(
          mockAdminUser.id,
          { role: 'STAFF' },
          {},
          mockAdminUser,
        ),
      ).rejects.toThrow(new BadRequestException('Tidak dapat mengubah peran akun sendiri'));
    });

    it('should prevent deactivating the last active admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'other-admin',
        role: { name: 'ADMIN' },
        access: [],
      });
      prisma.user.count.mockResolvedValue(0); // 0 other active admins

      await expect(
        service.updateUser(
          'other-admin',
          { active: false },
          {},
          mockAdminUser,
        ),
      ).rejects.toThrow(new BadRequestException('Sistem harus memiliki minimal satu akun Admin yang aktif'));
    });

    it('should update user and record audit log', async () => {
      const existing = {
        id: 'target-staff',
        name: 'Staff Lama',
        email: 'staff@tridhata.com',
        division: 'Produksi',
        roleId: 'role-staff',
        defaultLocationId: 'loc-1',
        extraPermissions: [],
        active: true,
        mustChangePassword: false,
        role: { id: 'role-staff', name: 'STAFF' },
        access: [{ locationId: 'loc-1', location: { id: 'loc-1', code: 'BOGOR', name: 'Bogor' } }],
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(existing);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({
        ...existing,
        name: 'Staff Baru Nama',
      });

      const result = await service.updateUser(
        'target-staff',
        { name: 'Staff Baru Nama' },
        { ip: '127.0.0.1' },
        mockAdminUser,
      );

      expect(result.name).toBe('Staff Baru Nama');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.updated',
          userId: mockAdminUser.id,
        }),
        expect.anything(),
      );
    });
  });

  describe('resetPassword', () => {
    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('non-existent', {}, mockAdminUser.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should generate new temp password, set mustChangePassword and revoke refresh tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target-user',
        email: 'target@tridhata.com',
      });

      const res = await service.resetPassword(
        'target-user',
        { ip: '127.0.0.1' },
        mockAdminUser.id,
      );

      expect(res.temporaryPassword).toHaveLength(12);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-user' },
          data: expect.objectContaining({
            mustChangePassword: true,
            failedLogins: 0,
            lockedUntil: null,
          }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'target-user', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.password_reset',
          userId: mockAdminUser.id,
        }),
        expect.anything(),
      );
    });
  });
});
