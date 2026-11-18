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
}
