import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { AuditService } from '../audit/audit.service';
import {
  AuthUser,
  CreateRequestDto,
  DecideRequestDto,
  ReqCtx,
  RequestItem,
} from '@tridhata/shared';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locationsService: LocationsService,
    private readonly auditService: AuditService,
  ) {}

  async createRequest(
    user: AuthUser,
    dto: CreateRequestDto,
    ctx?: ReqCtx,
  ): Promise<RequestItem> {
    await this.locationsService.assertLocation(user, dto.locationId);

    const created = await this.prisma.request.create({
      data: {
        requesterId: user.id,
        locationId: dto.locationId,
        type: dto.type,
        title: dto.title,
        note: dto.note || null,
        amount: new Prisma.Decimal(dto.amount),
        status: 'PENDING',
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true } },
          },
          orderBy: { decidedAt: 'desc' },
        },
      },
    });

    await this.auditService.record({
      userId: user.id,
      action: 'request.created',
      entity: 'Request',
      entityId: created.id,
      after: {
        locationId: created.locationId,
        type: created.type,
        title: created.title,
        amount: Number(created.amount),
        status: created.status,
      },
      ctx,
    });

    return this.formatRequest(created);
  }

  async getRequests(
    user: AuthUser,
    query: {
      locationId?: string;
      status?: RequestStatus;
      type?: string;
    },
  ): Promise<RequestItem[]> {
    const hasReadAll = user.permissions.includes('approval:read_all');

    const where: Prisma.RequestWhereInput = {};

    if (query.locationId) {
      await this.locationsService.assertLocation(user, query.locationId);
      where.locationId = query.locationId;
    } else if (user.locationIds && user.locationIds.length > 0) {
      where.locationId = { in: user.locationIds };
    }

    if (!hasReadAll) {
      where.requesterId = user.id;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    const requests = await this.prisma.request.findMany({
      where,
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true } },
          },
          orderBy: { decidedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => this.formatRequest(r));
  }

  async getRequestById(user: AuthUser, id: string): Promise<RequestItem> {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true } },
          },
          orderBy: { decidedAt: 'desc' },
        },
      },
    });

    if (!req) {
      throw new NotFoundException('Pengajuan tidak ditemukan');
    }

    await this.locationsService.assertLocation(user, req.locationId);

    const hasReadAll = user.permissions.includes('approval:read_all');
    if (!hasReadAll && req.requesterId !== user.id) {
      throw new ForbiddenException(
        'Anda tidak memiliki akses untuk melihat pengajuan ini',
      );
    }

    return this.formatRequest(req);
  }

  async decide(
    user: AuthUser,
    id: string,
    dto: DecideRequestDto,
    ctx?: ReqCtx,
  ): Promise<RequestItem> {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.request.findUnique({
        where: { id },
      });

      if (!req) {
        throw new NotFoundException('Pengajuan tidak ditemukan');
      }

      await this.locationsService.assertLocation(user, req.locationId);

      if (req.requesterId === user.id) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Anda tidak dapat memutuskan pengajuan Anda sendiri',
        });
      }

      // Proteksi keputusan ganda: hanya baris yang masih PENDING yang boleh berubah
      const res = await tx.request.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: dto.decision,
          decidedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (res.count === 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Pengajuan ini sudah diputuskan',
        });
      }

      await tx.approval.create({
        data: {
          requestId: id,
          approverId: user.id,
          decision: dto.decision,
          note: dto.note || null,
        },
      });

      await this.auditService.record(
        {
          userId: user.id,
          action:
            dto.decision === 'APPROVED'
              ? 'request.approved'
              : 'request.rejected',
          entity: 'Request',
          entityId: id,
          before: { status: 'PENDING' },
          after: { status: dto.decision, note: dto.note },
          ctx,
        },
        tx,
      );

      const updated = await tx.request.findUniqueOrThrow({
        where: { id },
        include: {
          requester: {
            select: { id: true, name: true, email: true },
          },
          approvals: {
            include: {
              approver: { select: { id: true, name: true, email: true } },
            },
            orderBy: { decidedAt: 'desc' },
          },
        },
      });

      return this.formatRequest(updated);
    });
  }

  private formatRequest(
    r: Prisma.RequestGetPayload<{
      include: {
        requester: { select: { id: true; name: true; email: true } };
        approvals: {
          include: {
            approver: { select: { id: true; name: true; email: true } };
          };
        };
      };
    }>,
  ): RequestItem {
    return {
      id: r.id,
      requesterId: r.requesterId,
      requester: r.requester,
      locationId: r.locationId,
      type: r.type,
      title: r.title,
      note: r.note,
      amount: Number(r.amount),
      status: r.status,
      version: r.version,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      approvals: r.approvals.map((a) => ({
        id: a.id,
        requestId: a.requestId,
        approverId: a.approverId,
        approver: a.approver,
        level: a.level,
        decision: a.decision,
        note: a.note,
        decidedAt: a.decidedAt.toISOString(),
      })),
    };
  }
}
