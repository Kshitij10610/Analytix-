import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialsService } from './financials.service';
import { LineItemsService } from './line-items.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyAccessService } from '../authorization/company-access.service';

describe('FinancialsService adversarial', () => {
  let service: FinancialsService;
  let prisma: PrismaService;
  let accessService: jest.Mocked<CompanyAccessService>;

  beforeEach(async () => {
    accessService = {
      requireCompanyRead: jest.fn().mockResolvedValue({ id: '1' }),
      requireCompanyWrite: jest.fn().mockResolvedValue({ role: 'OWNER' }),
      buildScopedCompanyWhere: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<CompanyAccessService>;

    const auditService = {
      record: jest.fn(),
      recordInTransaction: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialsService,
        PrismaService,
        { provide: CompanyAccessService, useValue: accessService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<FinancialsService>(FinancialsService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('createWithLineItems should reject duplicate metricCodes in payload', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-dup'), name: 'Adversarial Co Dup' },
    });

    await expect(
      service.createWithLineItems(company.id, {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }, [
        { metricCode: 'REVENUE', value: '1000.500000' },
        { metricCode: 'REVENUE', value: '200.000000' },
      ], 'test-user', 'ANALYST', 'actor@example.com'),
    ).rejects.toThrow(BadRequestException);

    const count = await prisma.prisma.financialStatement.count({
      where: { companyId: company.id },
    });
    expect(count).toBe(0);

    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should reject unknown metricCode', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-unk'), name: 'Adversarial Co Unk' },
    });

    await expect(
      service.createWithLineItems(company.id, {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }, [
        { metricCode: 'DEFINITELY_NOT_A_METRIC', value: '1000.500000' },
      ], 'test-user', 'ANALYST', 'actor@example.com'),
    ).rejects.toThrow(BadRequestException);

    const count = await prisma.prisma.financialStatement.count({
      where: { companyId: company.id },
    });
    expect(count).toBe(0);

    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should reject incompatible statement-type metric', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-incompat'), name: 'Adversarial Co Incompat' },
    });

    await expect(
      service.createWithLineItems(company.id, {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }, [
        { metricCode: 'CASH_AND_CASH_EQUIVALENTS', value: '1000.500000' },
      ], 'test-user', 'ANALYST', 'actor@example.com'),
    ).rejects.toThrow(BadRequestException);

    const count = await prisma.prisma.financialStatement.count({
      where: { companyId: company.id },
    });
    expect(count).toBe(0);

    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should reject invalid decimal', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-dec'), name: 'Adversarial Co Dec' },
    });

    await expect(
      service.createWithLineItems(company.id, {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }, [
        { metricCode: 'REVENUE', value: 'abc' },
      ], 'test-user', 'ANALYST', 'actor@example.com'),
    ).rejects.toThrow(BadRequestException);

    const count = await prisma.prisma.financialStatement.count({
      where: { companyId: company.id },
    });
    expect(count).toBe(0);

    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should preserve large and small decimals exactly', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-prec'), name: 'Adversarial Co Prec' },
    });

    const result = await service.createWithLineItems(company.id, {
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-12-31'),
      fiscalYear: 2026,
      periodType: 'ANNUAL',
      currency: 'USD',
      scale: 'ONES',
    }, [
      { metricCode: 'REVENUE', value: '1250000000.500000' },
      { metricCode: 'OPERATING_INCOME', value: '0.123456' },
    ], 'test-user', 'ANALYST', 'actor@example.com');

    const withItems = await service.findOneWithLineItems(result.id, 'test-user', 'ANALYST');
    const revenue = withItems.lineItems.find((li: any) => li.metricCode === 'REVENUE');
    const income = withItems.lineItems.find((li: any) => li.metricCode === 'OPERATING_INCOME');

    expect(revenue?.value).toBe('1250000000.500000');
    expect(income?.value).toBe('0.123456');

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: result.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: result.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should allow zero values distinctly from absent metrics', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-zero'), name: 'Adversarial Co Zero' },
    });

    const result = await service.createWithLineItems(company.id, {
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-12-31'),
      fiscalYear: 2026,
      periodType: 'ANNUAL',
      currency: 'USD',
      scale: 'ONES',
    }, [
      { metricCode: 'REVENUE', value: '1000.500000' },
      { metricCode: 'OPERATING_INCOME', value: '0.000000' },
    ], 'test-user', 'ANALYST', 'actor@example.com');

    const withItems = await service.findOneWithLineItems(result.id, 'test-user', 'ANALYST');
    const revenue = withItems.lineItems.find((li: any) => li.metricCode === 'REVENUE');
    const income = withItems.lineItems.find((li: any) => li.metricCode === 'OPERATING_INCOME');
    const missing = withItems.lineItems.find((li: any) => li.metricCode === 'NET_INCOME');

    expect(revenue?.value).toBe('1000.500000');
    expect(income?.value).toBe('0.000000');
    expect(missing).toBeUndefined();

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: result.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: result.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should pass through explicit sourceType', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-prov'), name: 'Adversarial Co Prov' },
    });

    const result = await service.createWithLineItems(company.id, {
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-12-31'),
      fiscalYear: 2026,
      periodType: 'ANNUAL',
      currency: 'USD',
      scale: 'ONES',
      sourceType: 'MANUAL',
    }, [
      { metricCode: 'REVENUE', value: '1000.500000' },
    ], 'test-user', 'ANALYST', 'actor@example.com');

    expect(result.sourceType).toBe('MANUAL');
    expect(result.importedBy).toBeNull();

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: result.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: result.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should handle negative canonical values', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-neg'), name: 'Adversarial Co Neg' },
    });

    const result = await service.createWithLineItems(company.id, {
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-12-31'),
      fiscalYear: 2026,
      periodType: 'ANNUAL',
      currency: 'USD',
      scale: 'ONES',
    }, [
      { metricCode: 'REVENUE', value: '-125.500000' },
    ], 'test-user', 'ANALYST', 'actor@example.com');

    const withItems = await service.findOneWithLineItems(result.id, 'test-user', 'ANALYST');
    expect(withItems.lineItems[0].value).toBe('-125.500000');

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: result.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: result.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should allow creation without line items', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-empty-create'), name: 'Adversarial Co Empty Create' },
    });

    const result = await service.createWithLineItems(company.id, {
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-12-31'),
      fiscalYear: 2026,
      periodType: 'ANNUAL',
      currency: 'USD',
      scale: 'ONES',
    }, [], 'test-user', 'ANALYST', 'actor@example.com');

    expect(result).toBeDefined();

    const withItems = await service.findOneWithLineItems(result.id, 'test-user', 'ANALYST');
    expect(withItems.lineItems).toHaveLength(0);

    await prisma.prisma.financialStatement.delete({ where: { id: result.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('findOneWithLineItems should preserve labelOverride over metric label', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-label'), name: 'Adversarial Co Label' },
    });

    const statement = await prisma.prisma.financialStatement.create({
      data: {
        companyId: company.id,
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      },
    });

    const revenue = await prisma.prisma.metricDefinition.findFirst({
      where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
    });

    await prisma.prisma.financialLineItem.create({
      data: {
        financialStatementId: statement.id,
        metricDefinitionId: revenue!.id,
        statementType: statement.type,
        value: '1000.500000',
        labelOverride: 'Custom Revenue',
        displayOrder: 5,
      },
    });

    const result = await service.findOneWithLineItems(statement.id, 'test-user', 'ANALYST');
    const lineItem = result.lineItems[0];

    expect(lineItem.label).toBe('Custom Revenue');
    expect(lineItem.displayOrder).toBe(5);

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('createWithLineItems should roll back on invalid decimal inside transaction', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-roll'), name: 'Adversarial Co Roll' },
    });

    await expect(
      service.createWithLineItems(company.id, {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }, [
        { metricCode: 'REVENUE', value: '1000.500000' },
        { metricCode: 'OPERATING_INCOME', value: 'bad' },
      ], 'test-user', 'ANALYST', 'actor@example.com'),
    ).rejects.toThrow(BadRequestException);

    const count = await prisma.prisma.financialStatement.count({
      where: { companyId: company.id },
    });
    expect(count).toBe(0);

    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('findOneWithLineItems should order by effective displayOrder with metric fallback', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-order'), name: 'Adversarial Co Order' },
    });

    const statement = await prisma.prisma.financialStatement.create({
      data: {
        companyId: company.id,
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      },
    });

    const revenue = await prisma.prisma.metricDefinition.findFirst({
      where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
    });
    const cogs = await prisma.prisma.metricDefinition.findFirst({
      where: { code: 'COST_OF_REVENUE', statementType: 'INCOME_STATEMENT' },
    });

    await prisma.prisma.financialLineItem.createMany({
      data: [
        {
          financialStatementId: statement.id,
          metricDefinitionId: revenue!.id,
          statementType: statement.type,
          value: '1000.000000',
          displayOrder: 10,
        },
        {
          financialStatementId: statement.id,
          metricDefinitionId: cogs!.id,
          statementType: statement.type,
          value: '400.000000',
        },
      ],
    });

    const result = await service.findOneWithLineItems(statement.id, 'test-user', 'ANALYST');
    expect(result.lineItems.map((li: any) => li.metricCode)).toEqual(['REVENUE', 'COST_OF_REVENUE']);

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('findOneWithLineItems should expose only public fields', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-expose'), name: 'Adversarial Co Expose' },
    });

    const statement = await prisma.prisma.financialStatement.create({
      data: {
        companyId: company.id,
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      },
    });

    const revenue = await prisma.prisma.metricDefinition.findFirst({
      where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
    });

    await prisma.prisma.financialLineItem.create({
      data: {
        financialStatementId: statement.id,
        metricDefinitionId: revenue!.id,
        statementType: statement.type,
        value: '1000.500000',
        labelOverride: 'Custom Revenue',
        displayOrder: 5,
      },
    });

    const result = await service.findOneWithLineItems(statement.id, 'test-user', 'ANALYST');
    const lineItem = result.lineItems[0];

    expect(lineItem.metricCode).toBe('REVENUE');
    expect(lineItem.label).toBe('Custom Revenue');
    expect(lineItem.value).toBe('1000.500000');
    expect(lineItem.displayOrder).toBe(5);
    expect(lineItem.isStandard).toBe(true);
    expect(lineItem).not.toHaveProperty('metricDefinitionId');
    expect(lineItem).not.toHaveProperty('statementType');
    expect(lineItem).not.toHaveProperty('id');

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });
});

describe('LineItemsService adversarial', () => {
  let lineItemsService: LineItemsService;
  let financialsService: FinancialsService;
  let prisma: PrismaService;
  let accessService: jest.Mocked<CompanyAccessService>;

  beforeEach(async () => {
    accessService = {
      requireCompanyRead: jest.fn().mockResolvedValue({ id: '1' }),
      requireCompanyWrite: jest.fn().mockResolvedValue({ role: 'OWNER' }),
      buildScopedCompanyWhere: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<CompanyAccessService>;

    const auditService = {
      record: jest.fn(),
      recordInTransaction: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LineItemsService,
        FinancialsService,
        PrismaService,
        { provide: CompanyAccessService, useValue: accessService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    lineItemsService = module.get<LineItemsService>(LineItemsService);
    financialsService = module.get<FinancialsService>(FinancialsService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('replaceLineItems should reject duplicate metricCodes', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-rep-dup'), name: 'Adversarial Co Rep Dup' },
    });

    const statement = await prisma.prisma.financialStatement.create({
      data: {
        companyId: company.id,
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      },
    });

    const revenue = await prisma.prisma.metricDefinition.findFirst({
      where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
    });

    await prisma.prisma.financialLineItem.create({
      data: {
        financialStatementId: statement.id,
        metricDefinitionId: revenue!.id,
        statementType: statement.type,
        value: '1000.000000',
      },
    });

    await expect(
      lineItemsService.replaceLineItems(statement.id, [
        { metricCode: 'REVENUE', value: '1000.500000' },
        { metricCode: 'REVENUE', value: '200.000000' },
      ], 'test-user', 'ANALYST', 'actor@example.com'),
    ).rejects.toThrow(BadRequestException);

    const items = await prisma.prisma.financialLineItem.findMany({
      where: { financialStatementId: statement.id },
    });
    expect(items).toHaveLength(1);
    expect(items[0].value.toFixed(6)).toBe('1000.000000');

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('replaceLineItems should clear all items when given empty array', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-empty'), name: 'Adversarial Co Empty' },
    });

    const statement = await prisma.prisma.financialStatement.create({
      data: {
        companyId: company.id,
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
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
        statementType: statement.type,
        value: '1000.000000',
      },
    });

    const result = await lineItemsService.replaceLineItems(statement.id, [], 'test-user', 'ANALYST', 'actor@example.com');
    expect(result).toEqual([]);

    const remaining = await prisma.prisma.financialLineItem.findMany({
      where: { financialStatementId: statement.id },
    });
    expect(remaining).toHaveLength(0);

    const withItems = await financialsService.findOneWithLineItems(statement.id, 'test-user', 'ANALYST');
    expect(withItems.lineItems).toHaveLength(0);

    await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('replaceLineItems should replace the complete set', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-rep'), name: 'Adversarial Co Rep' },
    });

    const statement = await prisma.prisma.financialStatement.create({
      data: {
        companyId: company.id,
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      },
    });

    const revenue = await prisma.prisma.metricDefinition.findFirst({
      where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
    });
    const income = await prisma.prisma.metricDefinition.findFirst({
      where: { code: 'NET_INCOME', statementType: 'INCOME_STATEMENT' },
    });

    await prisma.prisma.financialLineItem.create({
      data: {
        financialStatementId: statement.id,
        metricDefinitionId: revenue!.id,
        statementType: statement.type,
        value: '1000.000000',
      },
    });

    const result = await lineItemsService.replaceLineItems(statement.id, [
      { metricCode: 'NET_INCOME', value: '250.000000' },
    ], 'test-user', 'ANALYST', 'actor@example.com');

    expect(result).toHaveLength(1);
    expect(result[0].metric_definitions.code).toBe('NET_INCOME');

    const withItems = await financialsService.findOneWithLineItems(statement.id, 'test-user', 'ANALYST');
    expect(withItems.lineItems).toHaveLength(1);
    expect(withItems.lineItems[0].metricCode).toBe('NET_INCOME');
    expect(withItems.lineItems[0].value).toBe('250.000000');

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });

  it('replaceLineItems should reject unknown metricCode', async () => {
    const company = await prisma.prisma.company.create({
      data: { id: uniqueId('adv-co-rep-unk'), name: 'Adversarial Co Rep Unk' },
    });

    const statement = await prisma.prisma.financialStatement.create({
      data: {
        companyId: company.id,
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        fiscalYear: 2026,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      },
    });

    const revenue = await prisma.prisma.metricDefinition.findFirst({
      where: { code: 'REVENUE', statementType: 'INCOME_STATEMENT' },
    });

    await prisma.prisma.financialLineItem.create({
      data: {
        financialStatementId: statement.id,
        metricDefinitionId: revenue!.id,
        statementType: statement.type,
        value: '1000.000000',
      },
    });

    await expect(
      lineItemsService.replaceLineItems(statement.id, [
        { metricCode: 'DEFINITELY_NOT_A_METRIC', value: '250.000000' },
      ], 'test-user', 'ANALYST', 'actor@example.com'),
    ).rejects.toThrow(BadRequestException);

    const items = await prisma.prisma.financialLineItem.findMany({
      where: { financialStatementId: statement.id },
    });
    expect(items).toHaveLength(1);
    expect(items[0].value.toFixed(6)).toBe('1000.000000');

    await prisma.prisma.financialLineItem.deleteMany({ where: { financialStatementId: statement.id } });
    await prisma.prisma.financialStatement.delete({ where: { id: statement.id } });
    await prisma.prisma.company.delete({ where: { id: company.id } });
  });
});
