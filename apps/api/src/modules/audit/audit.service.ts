import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { redact } from '../../common/utils/redact';
import { ReqCtx } from '@tridhata/shared';

export interface AuditEntry {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ctx?: ReqCtx;
}

export interface GetAuditLogsParams {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;

    const sanitizedBefore = entry.before !== undefined ? redact(entry.before) : undefined;
    const sanitizedAfter = entry.after !== undefined ? redact(entry.after) : undefined;

    return client.auditLog.create({
      data: {
        userId: entry.userId || null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ? String(entry.entityId) : null,
        before: (sanitizedBefore as Prisma.InputJsonValue) || Prisma.JsonNull,
        after: (sanitizedAfter as Prisma.InputJsonValue) || Prisma.JsonNull,
        ip: entry.ctx?.ip || null,
        userAgent: entry.ctx?.userAgent || null,
      },
    });
  }

  async getAuditLogs(params: GetAuditLogsParams) {
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);

    const where: Prisma.AuditLogWhereInput = {};

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.action) {
      where.action = params.action;
    }

    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) {
        where.createdAt.gte = new Date(`${params.from}T00:00:00+07:00`);
      }
      if (params.to) {
        where.createdAt.lte = new Date(`${params.to}T23:59:59.999+07:00`);
      }
    }

    const items = await this.prisma.auditLog.findMany({
      where,
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return {
      items,
      nextCursor,
    };
  }
}
