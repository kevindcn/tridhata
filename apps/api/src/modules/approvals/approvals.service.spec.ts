/* eslint-disable @typescript-eslint/no-explicit-any -- Deep Prisma and Audit mock objects for unit testing */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '@tridhata/shared';

describe('ApprovalsService (SPEC Section 6.8 Requirements)', () => {
  let service: ApprovalsService;
  let mockPrisma: any;
  let mockLocationsService: any;
  let mockAudit: any;

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      request: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      approval: {
        create: jest.fn(),
      },
    };

    mockLocationsService = {
      assertLocation: jest.fn().mockResolvedValue(undefined),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LocationsService, useValue: mockLocationsService },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
  });

  const mockStaff: AuthUser = {
    id: 'user-staff-1',
    name: 'Budi Staff',
    email: 'budi@tridhata.id',
    role: 'STAFF',
    permissions: ['approval:create', 'dashboard:read'],
    locationIds: ['loc-bogor'],
    defaultLocationId: 'loc-bogor',
    mustChangePassword: false,
  };

  const mockFinance: AuthUser = {
    id: 'user-finance-1',
    name: 'Siti Finance',
    email: 'siti@tridhata.id',
    role: 'FINANCE',
    permissions: ['approval:create', 'approval:read_all', 'approval:decide', 'finance:read', 'dashboard:read'],
    locationIds: ['loc-bogor'],
    defaultLocationId: 'loc-bogor',
    mustChangePassword: false,
  };

  describe('createRequest', () => {
    it('should create request with PENDING status, Decimal amount, and record audit log', async () => {
      const mockCreated = {
        id: 'req-1',
        requesterId: mockStaff.id,
        locationId: 'loc-bogor',
        type: 'Diskon Khusus',
        title: 'Diskon Klien XYZ',
        note: 'Order dalam volume besar',
        amount: 2500000,
        status: 'PENDING',
        version: 1,
        decidedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        requester: { id: mockStaff.id, name: mockStaff.name, email: mockStaff.email },
        approvals: [],
      };

      mockPrisma.request.create.mockResolvedValue(mockCreated);

      const result = await service.createRequest(mockStaff, {
        locationId: 'loc-bogor',
        type: 'Diskon Khusus',
        title: 'Diskon Klien XYZ',
        note: 'Order dalam volume besar',
        amount: 2500000,
      });

      expect(mockLocationsService.assertLocation).toHaveBeenCalledWith(mockStaff, 'loc-bogor');
      expect(mockPrisma.request.create).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockStaff.id,
          action: 'request.created',
          entity: 'Request',
          entityId: 'req-1',
        }),
      );
      expect(result.id).toBe('req-1');
      expect(result.status).toBe('PENDING');
      expect(result.amount).toBe(2500000);
    });
  });

  describe('getRequests (scoping rules)', () => {
    it('should filter only own requests for user without approval:read_all (STAFF)', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);

      await service.getRequests(mockStaff, { locationId: 'loc-bogor' });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requesterId: mockStaff.id,
            locationId: 'loc-bogor',
          }),
        }),
      );
    });

    it('should not restrict requesterId for user with approval:read_all (FINANCE/ADMIN)', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);

      await service.getRequests(mockFinance, { locationId: 'loc-bogor' });

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            requesterId: mockFinance.id,
          }),
        }),
      );
    });
  });

  describe('getRequestById', () => {
    it('should throw NotFoundException if request does not exist', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(null);

      await expect(service.getRequestById(mockStaff, 'req-not-found')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user lacks approval:read_all and is not requester', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({
        id: 'req-other',
        requesterId: 'user-different',
        locationId: 'loc-bogor',
        requester: { id: 'user-different', name: 'Other', email: 'other@tridhata.id' },
        approvals: [],
      });

      await expect(service.getRequestById(mockStaff, 'req-other')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('decide (SPEC Section 6.8 & Separation of Duties)', () => {
    it('should throw ForbiddenException when creator attempts to decide their own request (Self-Approval Guard)', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requesterId: mockFinance.id, // Finance is the requester
        locationId: 'loc-bogor',
        status: 'PENDING',
      });

      await expect(
        service.decide(mockFinance, 'req-1', {
          decision: 'APPROVED',
          note: 'Setuju',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if request was already decided (Optimistic locking protection)', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requesterId: mockStaff.id,
        locationId: 'loc-bogor',
        status: 'PENDING',
      });

      // updateMany returns count: 0 because status was no longer PENDING
      mockPrisma.request.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.decide(mockFinance, 'req-1', {
          decision: 'APPROVED',
          note: 'Setuju',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully approve request, increment version, create Approval record, and log audit', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requesterId: mockStaff.id,
        locationId: 'loc-bogor',
        status: 'PENDING',
        version: 1,
      });

      mockPrisma.request.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.approval.create.mockResolvedValue({ id: 'appr-1' });

      const mockUpdated = {
        id: 'req-1',
        requesterId: mockStaff.id,
        locationId: 'loc-bogor',
        type: 'Diskon',
        title: 'Diskon 10%',
        note: null,
        amount: 500000,
        status: 'APPROVED',
        version: 2,
        decidedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        requester: { id: mockStaff.id, name: mockStaff.name, email: mockStaff.email },
        approvals: [
          {
            id: 'appr-1',
            requestId: 'req-1',
            approverId: mockFinance.id,
            approver: { id: mockFinance.id, name: mockFinance.name, email: mockFinance.email },
            level: 1,
            decision: 'APPROVED',
            note: 'Disetujui untuk volume order besar',
            decidedAt: new Date(),
          },
        ],
      };

      mockPrisma.request.findUniqueOrThrow.mockResolvedValue(mockUpdated);

      const result = await service.decide(mockFinance, 'req-1', {
        decision: 'APPROVED',
        note: 'Disetujui untuk volume order besar',
      });

      expect(mockPrisma.request.updateMany).toHaveBeenCalledWith({
        where: { id: 'req-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'APPROVED',
          version: { increment: 1 },
        }),
      });

      expect(mockPrisma.approval.create).toHaveBeenCalledWith({
        data: {
          requestId: 'req-1',
          approverId: mockFinance.id,
          decision: 'APPROVED',
          note: 'Disetujui untuk volume order besar',
        },
      });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockFinance.id,
          action: 'request.approved',
          entity: 'Request',
          entityId: 'req-1',
          before: { status: 'PENDING' },
          after: { status: 'APPROVED', note: 'Disetujui untuk volume order besar' },
        }),
        mockPrisma,
      );

      expect(result.status).toBe('APPROVED');
      expect(result.version).toBe(2);
      expect(result.approvals).toHaveLength(1);
    });

    it('should successfully reject request with mandatory rejection reason and log request.rejected', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requesterId: mockStaff.id,
        locationId: 'loc-bogor',
        status: 'PENDING',
        version: 1,
      });

      mockPrisma.request.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.approval.create.mockResolvedValue({ id: 'appr-1' });

      const mockUpdated = {
        id: 'req-1',
        requesterId: mockStaff.id,
        locationId: 'loc-bogor',
        type: 'Diskon',
        title: 'Diskon 10%',
        note: null,
        amount: 500000,
        status: 'REJECTED',
        version: 2,
        decidedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        requester: { id: mockStaff.id, name: mockStaff.name, email: mockStaff.email },
        approvals: [
          {
            id: 'appr-1',
            requestId: 'req-1',
            approverId: mockFinance.id,
            approver: { id: mockFinance.id, name: mockFinance.name, email: mockFinance.email },
            level: 1,
            decision: 'REJECTED',
            note: 'Nominal margin tidak mencukupi untuk diskon',
            decidedAt: new Date(),
          },
        ],
      };

      mockPrisma.request.findUniqueOrThrow.mockResolvedValue(mockUpdated);

      const result = await service.decide(mockFinance, 'req-1', {
        decision: 'REJECTED',
        note: 'Nominal margin tidak mencukupi untuk diskon',
      });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockFinance.id,
          action: 'request.rejected',
        }),
        mockPrisma,
      );

      expect(result.status).toBe('REJECTED');
    });
  });
});
