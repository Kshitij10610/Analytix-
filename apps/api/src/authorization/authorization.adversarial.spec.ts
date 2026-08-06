import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialsService } from '../financials/financials.service';
import { LineItemsService } from '../financials/line-items.service';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from './company-access.service';
import { $Enums } from '../generated/client';

describe('FinancialsService adversarial authorization', () => {
  let service: FinancialsService;
  let lineItemsService: LineItemsService;
  let prisma: PrismaService;

  const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const auditService = {
    record: jest.fn(),
    recordInTransaction: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialsService,
        LineItemsService,
        PrismaService,
        CompanyAccessService,
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<FinancialsService>(FinancialsService);
    lineItemsService = module.get<LineItemsService>(LineItemsService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  describe('cross-company statement access', () => {
    it('should reject statement read for user with no company membership', async () => {
      const companyA = await prisma.prisma.company.create({
        data: { id: uniqueId('adv-co-a'), name: 'Adversarial Co A' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { id: uniqueId('adv-co-b'), name: 'Adversarial Co B' },
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
        service.findOneWithLineItems(statementB.id, 'user-no-membership', 'ANALYST'),
      ).rejects.toThrow('Company not found');

      await prisma.prisma.financialStatement.delete({ where: { id: statementB.id } });
      await prisma.prisma.company.delete({ where: { id: companyB.id } });
      await prisma.prisma.company.delete({ where: { id: companyA.id } });
    });

    it('should reject statement update for user with no company membership', async () => {
      const companyA = await prisma.prisma.company.create({
        data: { id: uniqueId('adv-co-a2'), name: 'Adversarial Co A2' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { id: uniqueId('adv-co-b2'), name: 'Adversarial Co B2' },
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
        service.update(statementB.id, { scale: 'THOUSANDS' }, 'user-no-membership', 'ANALYST', 'actor@example.com'),
      ).rejects.toThrow('Company not found');

      await prisma.prisma.financialStatement.delete({ where: { id: statementB.id } });
      await prisma.prisma.company.delete({ where: { id: companyB.id } });
      await prisma.prisma.company.delete({ where: { id: companyA.id } });
    });

    it('should reject line item update for user with no company membership', async () => {
      const companyA = await prisma.prisma.company.create({
        data: { id: uniqueId('adv-co-a3'), name: 'Adversarial Co A3' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { id: uniqueId('adv-co-b3'), name: 'Adversarial Co B3' },
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

      const lineItemB = await prisma.prisma.financialLineItem.create({
        data: {
          financialStatementId: statementB.id,
          metricDefinitionId: (await prisma.prisma.metricDefinition.findFirst())!.id,
          statementType: 'INCOME_STATEMENT',
          value: '1000.500000',
        },
      });

      await expect(
        lineItemsService.update(lineItemB.id, { value: '2000.000000' }, 'user-no-membership', 'ANALYST', 'actor@example.com'),
      ).rejects.toThrow('Company not found');

      await prisma.prisma.financialLineItem.delete({ where: { id: lineItemB.id } });
      await prisma.prisma.financialStatement.delete({ where: { id: statementB.id } });
      await prisma.prisma.company.delete({ where: { id: companyB.id } });
      await prisma.prisma.company.delete({ where: { id: companyA.id } });
    });
  });

  describe('VIEWER write rejection', () => {
    it('should reject statement creation for VIEWER member', async () => {
      const viewerUid = uniqueId('adv-viewer');
      const viewerUser = await prisma.prisma.user.create({
        data: { id: viewerUid, email: `${viewerUid}@test.com`, password: 'hash', role: 'ANALYST' },
      });

      const company = await prisma.prisma.company.create({
        data: {
          id: uniqueId('adv-co-viewer'),
          name: 'Adversarial Co Viewer',
          members: {
            create: {
              userId: viewerUser.id,
              role: $Enums.CompanyMemberRole.VIEWER,
            },
          },
        },
      });

      await expect(
        service.createWithLineItems(company.id, {
          type: 'INCOME_STATEMENT',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          periodType: 'ANNUAL',
          currency: 'USD',
          scale: 'ONES',
        }, [], viewerUser.id, 'ANALYST', 'actor@example.com'),
      ).rejects.toThrow('Insufficient permissions');

      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: viewerUser.id } });
    });

    it('should reject line item creation for VIEWER member', async () => {
      const viewerUid2 = uniqueId('adv-viewer2');
      const viewerUser2 = await prisma.prisma.user.create({
        data: { id: viewerUid2, email: `${viewerUid2}@test.com`, password: 'hash', role: 'ANALYST' },
      });

      const company = await prisma.prisma.company.create({
        data: {
          id: uniqueId('adv-co-viewer2'),
          name: 'Adversarial Co Viewer2',
          members: {
            create: {
              userId: viewerUser2.id,
              role: $Enums.CompanyMemberRole.VIEWER,
            },
          },
        },
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

      await expect(
        lineItemsService.create(statement.id, 'REVENUE', { value: '1000.500000' }, viewerUser2.id, 'ANALYST', 'actor@example.com'),
      ).rejects.toThrow('Insufficient permissions');

      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: viewerUser2.id } });
    });
  });

  describe('global role restriction', () => {
    it('should allow OWNER membership to grant write access at service layer', async () => {
      const uid = uniqueId('adv-user-owner');
      const userOwner = await prisma.prisma.user.create({
        data: { id: uid, email: `${uid}@test.com`, password: 'hash', role: 'USER' },
      });

      const company = await prisma.prisma.company.create({
        data: {
          id: uniqueId('adv-co-user'),
          name: 'Adversarial Co User',
          members: {
            create: {
              userId: userOwner.id,
              role: $Enums.CompanyMemberRole.OWNER,
            },
          },
        },
      });

      const result = await service.createWithLineItems(company.id, {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        fiscalYear: 2024,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }, [], userOwner.id, 'USER', 'actor@example.com');

      expect(result).toBeDefined();
      expect(result.companyId).toBe(company.id);

      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: userOwner.id } });
    });
  });

  describe('ADMIN bypass without membership', () => {
    it('should allow ADMIN to read any statement', async () => {
      const company = await prisma.prisma.company.create({
        data: { id: uniqueId('adv-co-admin'), name: 'Adversarial Co Admin' },
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

      const result = await service.findOneWithLineItems(statement.id, 'admin-no-member', 'ADMIN');
      expect(result.id).toBe(statement.id);

      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('should not create membership side effect for ADMIN operations', async () => {
      const company = await prisma.prisma.company.create({
        data: { id: uniqueId('adv-co-admin2'), name: 'Adversarial Co Admin2' },
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

      await service.findOneWithLineItems(statement.id, 'admin-no-member', 'ADMIN');

      const members = await prisma.prisma.companyMember.findMany({
        where: { userId: 'admin-no-member' },
      });
      expect(members).toHaveLength(0);

      await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });
});
