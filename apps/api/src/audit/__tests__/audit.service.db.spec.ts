import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit.service';
import { AuditActorType, AuditAction, AuditResourceType, AuditResult } from '../audit.constants';

describe('AuditService DB-backed', () => {
  let prisma: PrismaService;
  let auditService: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, PrismaService],
    }).compile();

    auditService = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  describe('transaction atomicity', () => {
    it('should roll back domain write when audit insert fails in transaction', async () => {
      const companyId = `audit-tx-${Date.now()}`;

      let auditFailed = false;
      try {
        await prisma.prisma.$transaction(async (tx) => {
          await tx.company.create({
            data: {
              id: companyId,
              name: 'Audit Tx Company',
            },
          });

          await auditService.recordInTransaction(
            {
              actorType: AuditActorType.USER,
              actorUserId: 'user-audit-tx',
              action: AuditAction.COMPANY_CREATE,
              resourceType: AuditResourceType.COMPANY,
              resourceId: companyId,
              result: AuditResult.SUCCESS,
              changes: { name: { before: null, after: 'Audit Tx Company' } },
            },
            tx,
          );

          throw new Error('Simulated audit failure');
        });
      } catch {
        auditFailed = true;
      }

      expect(auditFailed).toBe(true);

      const company = await prisma.prisma.company.findUnique({
        where: { id: companyId },
      });
      expect(company).toBeNull();

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { resourceId: companyId },
      });
      expect(auditEvent).toBeNull();
    });

    it('should commit both domain write and audit event on success', async () => {
      const companyId = `audit-ok-${Date.now()}`;

      await prisma.prisma.$transaction(async (tx) => {
        await tx.company.create({
          data: {
            id: companyId,
            name: 'Audit Ok Company',
          },
        });

        await auditService.recordInTransaction(
          {
            actorType: AuditActorType.USER,
            actorUserId: 'user-audit-ok',
            action: AuditAction.COMPANY_CREATE,
            resourceType: AuditResourceType.COMPANY,
            resourceId: companyId,
            result: AuditResult.SUCCESS,
            changes: { name: { before: null, after: 'Audit Ok Company' } },
          },
          tx,
        );
      });

      const company = await prisma.prisma.company.findUnique({
        where: { id: companyId },
      });
      expect(company).not.toBeNull();

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { resourceId: companyId },
      });
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.COMPANY_CREATE);
    });
  });

  describe('deletion survival', () => {
    it('should preserve audit event after referenced user is deleted', async () => {
      const userId = `audit-user-${Date.now()}`;
      await prisma.prisma.user.create({
        data: {
          id: userId,
          email: `audit-user-${Date.now()}@test.com`,
          password: 'hash',
          role: 'USER',
        },
      });

      const result = await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        actorEmail: 'audit-user@test.com',
        actorGlobalRole: 'USER',
        action: AuditAction.AUTH_LOGIN_SUCCESS,
        resourceType: AuditResourceType.AUTH_SESSION,
        result: AuditResult.SUCCESS,
      });

      await prisma.prisma.user.delete({ where: { id: userId } });

      const auditEvent = await prisma.prisma.auditEvent.findUnique({
        where: { id: result.id },
      });
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.actorUserId).toBe(userId);
    });

    it('should preserve audit event after referenced company is deleted', async () => {
      const companyId = `audit-company-${Date.now()}`;
      await prisma.prisma.company.create({
        data: {
          id: companyId,
          name: 'Audit Company',
        },
      });

      const result = await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: 'user-audit-company',
        action: AuditAction.COMPANY_UPDATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: companyId,
        result: AuditResult.SUCCESS,
        changes: { name: { before: 'Audit Company', after: 'Audit Company Updated' } },
      });

      await prisma.prisma.company.delete({ where: { id: companyId } });

      const auditEvent = await prisma.prisma.auditEvent.findUnique({
        where: { id: result.id },
      });
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.resourceId).toBe(companyId);
    });
  });

  describe('JSON persistence', () => {
    it('should persist nested changes and metadata', async () => {
      const result = await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: 'user-json',
        action: AuditAction.LINE_ITEMS_REPLACE,
        resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
        resourceId: 'statement-1',
        result: AuditResult.SUCCESS,
        changes: {
          replacedCount: { before: 2, after: 4 },
        },
        metadata: {
          statementId: 'statement-1',
          lineItemIds: {
            before: ['li-1', 'li-2'],
            after: ['li-3', 'li-4', 'li-5', 'li-6'],
          },
        },
      });

      const auditEvent = await prisma.prisma.auditEvent.findUnique({
        where: { id: result.id },
      });

      expect(auditEvent!.changes).toEqual({
        replacedCount: { before: 2, after: 4 },
      });
      expect(auditEvent!.metadata).toEqual({
        statementId: 'statement-1',
        lineItemIds: {
          before: ['li-1', 'li-2'],
          after: ['li-3', 'li-4', 'li-5', 'li-6'],
        },
      });
    });

    it('should preserve exact decimal strings in changes', async () => {
      const result = await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: 'user-decimal',
        action: AuditAction.LINE_ITEM_CREATE,
        resourceType: AuditResourceType.FINANCIAL_LINE_ITEM,
        resourceId: 'li-decimal',
        result: AuditResult.SUCCESS,
        changes: {
          value: '1250000000.500000',
        },
      });

      const auditEvent = await prisma.prisma.auditEvent.findUnique({
        where: { id: result.id },
      });

      expect(auditEvent!.changes).toEqual({
        value: '1250000000.500000',
      });
    });
  });
});
