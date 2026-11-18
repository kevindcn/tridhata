import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('records an audit entry and redacts sensitive data', async () => {
    await service.record({
      userId: 'user-123',
      action: 'auth.login',
      entity: 'User',
      entityId: 'user-123',
      before: { passwordHash: '$argon2id$...', rawToken: 'abc' },
      after: { success: true },
      ctx: { ip: '127.0.0.1', userAgent: 'test-agent' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-123',
        action: 'auth.login',
        entity: 'User',
        entityId: 'user-123',
        before: { passwordHash: '[REDACTED]', rawToken: '[REDACTED]' },
        after: { success: true },
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      },
    });
  });

  it('uses the provided transaction client if supplied', async () => {
    const txMock = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-tx-1' }),
      },
    };

    await service.record(
      {
        action: 'user.created',
        entity: 'User',
      },
      txMock as never,
    );

    expect(txMock.auditLog.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
