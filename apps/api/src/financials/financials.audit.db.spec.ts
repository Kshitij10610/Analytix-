import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialsService } from '../financials/financials.service';
import { LineItemsService } from '../financials/line-items.service';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit/audit.constants';
import { $Enums } from '../generated/client';

describe('Financials Audit DB-backed', () => {
  let prisma: PrismaService;
  let financialsService: FinancialsService;
  let lineItemsService: LineItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, CompanyAccessService, FinancialsService, LineItemsService, AuditService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    financialsService = module.get<FinancialsService>(FinancialsService);
    lineItemsService = module.get<LineItemsService>(LineItemsService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  describe('statement create audit', () => {
    it('should create statement and audit event atomically', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co', industry: 'Tech' },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const statement = await financialsService.create(
        company.id,
        {
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.FINANCIAL_STATEMENT_CREATE, resourceId: statement.id },
      });

      expect(statement).toBeDefined();
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.FINANCIAL_STATEMENT_CREATE);
      expect(auditEvent!.resourceType).toBe(AuditResourceType.FINANCIAL_STATEMENT);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.actorEmail).toBe(`${userId}@test.com`);
      expect(auditEvent!.companyId).toBe(company.id);
      expect(auditEvent!.result).toBe(AuditResult.SUCCESS);
      expect(auditEvent!.metadata).toEqual(
        expect.objectContaining({
          statementType: 'INCOME_STATEMENT',
          fiscalYear: 2024,
          currency: 'USD',
          scale: 'ONES',
          lineItemCount: 0,
        }),
      );

      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('statement create with line items audit', () => {
    it('should create statement, line items, and aggregate audit event', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co2', industry: 'Tech' },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const statement = await financialsService.createWithLineItems(
        company.id,
        {
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
        [
          { metricCode: 'REVENUE', value: '1000.500000' },
          { metricCode: 'OPERATING_INCOME', value: '0.123456' },
        ],
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      const lineItems = await prisma.prisma.financialLineItem.findMany({
        where: { financialStatementId: statement.id },
        include: { metric_definitions: true },
      });

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.FINANCIAL_STATEMENT_CREATE, resourceId: statement.id },
      });

      expect(lineItems).toHaveLength(2);
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.FINANCIAL_STATEMENT_CREATE);
      expect(auditEvent!.resourceType).toBe(AuditResourceType.FINANCIAL_STATEMENT);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.actorEmail).toBe(`${userId}@test.com`);
      expect(auditEvent!.companyId).toBe(company.id);
      expect(auditEvent!.result).toBe(AuditResult.SUCCESS);
      expect(auditEvent!.metadata).toEqual(
        expect.objectContaining({
          statementType: 'INCOME_STATEMENT',
          fiscalYear: 2024,
          currency: 'USD',
          scale: 'ONES',
          lineItemCount: 2,
        }),
      );

      const revenueLine = lineItems.find((li) => li.metric_definitions.code === 'REVENUE');
      expect(revenueLine!.value.toFixed(6)).toBe('1000.500000');

      const incomeLine = lineItems.find((li) => li.metric_definitions.code === 'OPERATING_INCOME');
      expect(incomeLine!.value.toFixed(6)).toBe('0.123456');

      await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('statement update audit', () => {
    it('should update statement and emit audit event with safe changes', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co3', industry: 'Tech' },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const statement = await prisma.prisma.financialStatement.create({
        data: {
          companyId: company.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });

      const updated = await financialsService.update(
        statement.id,
        { type: 'BALANCE_SHEET' },
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.FINANCIAL_STATEMENT_UPDATE, resourceId: statement.id },
      });

      expect(updated.type).toBe('BALANCE_SHEET');
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.FINANCIAL_STATEMENT_UPDATE);
      expect(auditEvent!.resourceType).toBe(AuditResourceType.FINANCIAL_STATEMENT);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.actorEmail).toBe(`${userId}@test.com`);
      expect(auditEvent!.companyId).toBe(company.id);
      expect(auditEvent!.result).toBe(AuditResult.SUCCESS);
      expect(auditEvent!.changes).toEqual(
        expect.objectContaining({
          type: { before: 'INCOME_STATEMENT', after: 'BALANCE_SHEET' },
        }),
      );

      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('statement delete audit', () => {
    it('should delete statement and emit audit event that survives deletion', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co4', industry: 'Tech' },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ADMIN' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const statement = await prisma.prisma.financialStatement.create({
        data: {
          companyId: company.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });

      await financialsService.remove(statement.id, userId, 'ADMIN', `${userId}@test.com`);

      const exists = await prisma.prisma.financialStatement.findUnique({
        where: { id: statement.id },
      });
      expect(exists).toBeNull();

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.FINANCIAL_STATEMENT_DELETE, resourceId: statement.id },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.FINANCIAL_STATEMENT_DELETE);
      expect(auditEvent!.resourceType).toBe(AuditResourceType.FINANCIAL_STATEMENT);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.actorEmail).toBe(`${userId}@test.com`);
      expect(auditEvent!.companyId).toBe(company.id);
      expect(auditEvent!.result).toBe(AuditResult.SUCCESS);

      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('line item create audit', () => {
    it('should create line item and emit LINE_ITEM_CREATE with exact decimal', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co5', industry: 'Tech' },
      });
      const statement = await prisma.prisma.financialStatement.create({
        data: {
          companyId: company.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const lineItem = await lineItemsService.create(
        statement.id,
        'REVENUE',
        { value: '1250000000.500000' },
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.LINE_ITEM_CREATE, resourceId: lineItem.id },
      });

      expect(lineItem.value.toFixed(6)).toBe('1250000000.500000');
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.LINE_ITEM_CREATE);
      expect(auditEvent!.resourceType).toBe(AuditResourceType.FINANCIAL_LINE_ITEM);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.actorEmail).toBe(`${userId}@test.com`);
      expect(auditEvent!.companyId).toBe(company.id);
      expect(auditEvent!.result).toBe(AuditResult.SUCCESS);
      expect(auditEvent!.changes).toEqual(
        expect.objectContaining({
          value: { before: null, after: '1250000000.500000' },
        }),
      );

      await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('line item update audit', () => {
    it('should update line item and emit LINE_ITEM_UPDATE with before/after', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co6', industry: 'Tech' },
      });
      const statement = await prisma.prisma.financialStatement.create({
        data: {
          companyId: company.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });
      const lineItem = await prisma.prisma.financialLineItem.create({
        data: {
          financialStatementId: statement.id,
          metricDefinitionId: (await prisma.prisma.metricDefinition.findFirst())!.id,
          statementType: 'INCOME_STATEMENT',
          value: '1000.500000',
        },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const updated = await lineItemsService.update(
        lineItem.id,
        { value: '-125.500000' },
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.LINE_ITEM_UPDATE, resourceId: lineItem.id },
      });

      expect(updated.value.toFixed(6)).toBe('-125.500000');
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.LINE_ITEM_UPDATE);
      expect(auditEvent!.resourceType).toBe(AuditResourceType.FINANCIAL_LINE_ITEM);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.actorEmail).toBe(`${userId}@test.com`);
      expect(auditEvent!.companyId).toBe(company.id);
      expect(auditEvent!.result).toBe(AuditResult.SUCCESS);
      expect(auditEvent!.changes).toEqual(
        expect.objectContaining({
          value: { before: '1000.500000', after: '-125.500000' },
        }),
      );

      await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('line item delete audit', () => {
    it('should delete line item and emit LINE_ITEM_DELETE that survives', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co7', industry: 'Tech' },
      });
      const statement = await prisma.prisma.financialStatement.create({
        data: {
          companyId: company.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });
      const lineItem = await prisma.prisma.financialLineItem.create({
        data: {
          financialStatementId: statement.id,
          metricDefinitionId: (await prisma.prisma.metricDefinition.findFirst())!.id,
          statementType: 'INCOME_STATEMENT',
          value: '1000.500000',
        },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ADMIN' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      await lineItemsService.remove(lineItem.id, userId, 'ADMIN', `${userId}@test.com`);

      const exists = await prisma.prisma.financialLineItem.findUnique({
        where: { id: lineItem.id },
      });
      expect(exists).toBeNull();

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.LINE_ITEM_DELETE, resourceId: lineItem.id },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.LINE_ITEM_DELETE);
      expect(auditEvent!.resourceType).toBe(AuditResourceType.FINANCIAL_LINE_ITEM);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.actorEmail).toBe(`${userId}@test.com`);
      expect(auditEvent!.companyId).toBe(company.id);
      expect(auditEvent!.result).toBe(AuditResult.SUCCESS);

      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('bulk replace audit', () => {
    it('should replace line items and emit exactly one LINE_ITEMS_REPLACE', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co8', industry: 'Tech' },
      });
      const statement = await prisma.prisma.financialStatement.create({
        data: {
          companyId: company.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });
      const metric = await prisma.prisma.metricDefinition.findFirst({
        where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
      });
      await prisma.prisma.financialLineItem.create({
        data: {
          financialStatementId: statement.id,
          metricDefinitionId: metric!.id,
          statementType: 'INCOME_STATEMENT',
          value: '1000.000000',
        },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const result = await lineItemsService.replaceLineItems(
        statement.id,
        [
          { metricCode: 'REVENUE', value: '2000.500000' },
          { metricCode: 'NET_INCOME', value: '500.000000' },
        ],
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      expect(result).toHaveLength(2);

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.LINE_ITEMS_REPLACE, resourceId: statement.id },
      });
      expect(auditEvents).toHaveLength(1);

      const auditEvent = auditEvents[0];
      expect(auditEvent.action).toBe(AuditAction.LINE_ITEMS_REPLACE);
      expect(auditEvent.resourceType).toBe(AuditResourceType.FINANCIAL_STATEMENT);
      expect(auditEvent.actorUserId).toBe(userId);
      expect(auditEvent.actorEmail).toBe(`${userId}@test.com`);
      expect(auditEvent.companyId).toBe(company.id);
      expect(auditEvent.result).toBe(AuditResult.SUCCESS);
      expect(auditEvent.metadata).toEqual(
        expect.objectContaining({
          beforeCount: 1,
          afterCount: 2,
          addedMetricCodes: ['NET_INCOME'],
          removedMetricCodes: [],
          updatedMetricCodes: ['REVENUE'],
        }),
      );

      await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('bulk replace with empty array', () => {
    it('should clear all line items and emit one replacement event', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co9', industry: 'Tech' },
      });
      const statement = await prisma.prisma.financialStatement.create({
        data: {
          companyId: company.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });
      const metric = await prisma.prisma.metricDefinition.findFirst({
        where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
      });
      await prisma.prisma.financialLineItem.create({
        data: {
          financialStatementId: statement.id,
          metricDefinitionId: metric!.id,
          statementType: 'INCOME_STATEMENT',
          value: '1000.000000',
        },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const result = await lineItemsService.replaceLineItems(
        statement.id,
        [],
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      expect(result).toEqual([]);

      const remaining = await prisma.prisma.financialLineItem.findMany({
        where: { financialStatementId: statement.id },
      });
      expect(remaining).toHaveLength(0);

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.LINE_ITEMS_REPLACE, resourceId: statement.id },
      });
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0].metadata).toEqual(
        expect.objectContaining({
          beforeCount: 1,
          afterCount: 0,
          addedMetricCodes: [],
          removedMetricCodes: ['REVENUE'],
          updatedMetricCodes: [],
        }),
      );

      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('unauthorized mutation', () => {
    it('should not emit SUCCESS audit for unauthorized statement creation', async () => {
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co10', industry: 'Tech' },
      });

      await expect(
        financialsService.create(
          company.id,
          {
            type: 'INCOME_STATEMENT',
            periodStart: new Date('2024-01-01'),
            periodEnd: new Date('2024-12-31'),
            fiscalYear: 2024,
            periodType: 'ANNUAL',
            currency: 'USD',
            scale: 'ONES',
          },
          'no-membership-user',
          'ANALYST',
          'no-membership@test.com',
        ),
      ).rejects.toThrow();

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.FINANCIAL_STATEMENT_CREATE, actorUserId: 'no-membership-user' },
      });
      expect(auditEvents).toHaveLength(0);

      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });

  describe('cross-company isolation', () => {
    it('should not emit audit for cross-company statement access', async () => {
      const userA = await prisma.prisma.user.create({
        data: { id: `audit-user-${Date.now()}`, email: `audit-user-${Date.now()}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      const companyA = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co11', industry: 'Tech' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}-b`, name: 'Audit Co11b', industry: 'Tech' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: companyA.id, userId: userA.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      const statementB = await prisma.prisma.financialStatement.create({
        data: {
          companyId: companyB.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });

      await expect(
        financialsService.update(statementB.id, { scale: 'THOUSANDS' }, userA.id, 'ANALYST', userA.email),
      ).rejects.toThrow('Company not found');

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.FINANCIAL_STATEMENT_UPDATE, actorUserId: userA.id },
      });
      expect(auditEvents).toHaveLength(0);

      await prisma.prisma.financialStatement.delete({ where: { id: statementB.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: companyA.id, userId: userA.id } });
      await prisma.prisma.company.delete({ where: { id: companyA.id } });
      await prisma.prisma.company.delete({ where: { id: companyB.id } });
      await prisma.prisma.user.delete({ where: { id: userA.id } });
    });
  });

  describe('audit sanitization', () => {
    it('should not persist sensitive keys in audit metadata', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co12', industry: 'Tech' },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      const statement = await financialsService.create(
        company.id,
        {
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.FINANCIAL_STATEMENT_CREATE, resourceId: statement.id },
      });

      expect(auditEvent!.metadata).toEqual(
        expect.objectContaining({
          statementType: 'INCOME_STATEMENT',
          fiscalYear: 2024,
          currency: 'USD',
          scale: 'ONES',
        }),
      );
      expect(auditEvent!.metadata).not.toHaveProperty('password');
      expect(auditEvent!.metadata).not.toHaveProperty('passwordHash');
      expect(auditEvent!.metadata).not.toHaveProperty('accessToken');
      expect(auditEvent!.metadata).not.toHaveProperty('jwtSecret');

      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('decimal precision', () => {
    it('should preserve exact decimal strings in audit changes', async () => {
      const userId = `audit-user-${Date.now()}`;
      const company = await prisma.prisma.company.create({
        data: { id: `audit-co-${Date.now()}`, name: 'Audit Co13', industry: 'Tech' },
      });
      const statement = await prisma.prisma.financialStatement.create({
        data: {
          companyId: company.id,
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        },
      });
      const metric = await prisma.prisma.metricDefinition.findFirst({
        where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
      });
      const lineItem = await prisma.prisma.financialLineItem.create({
        data: {
          financialStatementId: statement.id,
          metricDefinitionId: metric!.id,
          statementType: 'INCOME_STATEMENT',
          value: '1000.500000',
        },
      });
      await prisma.prisma.user.create({
        data: { id: userId, email: `${userId}@test.com`, password: 'hash', role: 'ANALYST' },
      });
      await prisma.prisma.companyMember.create({
        data: { companyId: company.id, userId, role: $Enums.CompanyMemberRole.OWNER },
      });

      await lineItemsService.update(
        lineItem.id,
        { value: '0.000000' },
        userId,
        'ANALYST',
        `${userId}@test.com`,
      );

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.LINE_ITEM_UPDATE, resourceId: lineItem.id },
      });

      expect(auditEvent!.changes).toEqual(
        expect.objectContaining({
          value: { before: '1000.500000', after: '0.000000' },
        }),
      );

      await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id, userId } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userId } });
    });
  });
});
