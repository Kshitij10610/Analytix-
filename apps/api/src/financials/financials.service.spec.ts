import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { AuditService } from '../audit/audit.service';
import { FinancialsService } from './financials.service';

describe('FinancialsService', () => {
  let service: FinancialsService;
  let accessService: jest.Mocked<CompanyAccessService>;
  let auditService: jest.Mocked<AuditService>;

  const mockPrisma: any = {
    financialStatement: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    metricDefinition: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    accessService = {
      requireCompanyRead: jest.fn().mockResolvedValue({ id: '1' }),
      requireCompanyWrite: jest.fn().mockResolvedValue({ role: 'OWNER' }),
      requireCompanyOwnerOrAdmin: jest.fn(),
      buildScopedCompanyWhere: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<CompanyAccessService>;

    auditService = {
      record: jest.fn(),
      recordInTransaction: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialsService,
        {
          provide: PrismaService,
          useValue: { prisma: mockPrisma },
        },
        { provide: CompanyAccessService, useValue: accessService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<FinancialsService>(FinancialsService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a financial statement', async () => {
    mockPrisma.financialStatement.create.mockResolvedValue({
      id: '1',
      companyId: '1',
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
    });

    const result = await service.create('1', {
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
      fiscalYear: 2024,
      periodType: 'ANNUAL',
      currency: 'USD',
      scale: 'ONES',
    }, 'user-1', 'ANALYST', 'user@test.com');

    expect(result).toBeDefined();
    expect(mockPrisma.financialStatement.create).toHaveBeenCalled();
    expect(accessService.requireCompanyWrite).toHaveBeenCalledWith('user-1', '1', 'ANALYST');
    expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when company does not exist', async () => {
    accessService.requireCompanyWrite.mockRejectedValue(new NotFoundException('Company not found'));

    await expect(
      service.create('999', {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        fiscalYear: 2024,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }, 'user-1', 'ANALYST', 'user@test.com'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when periodEnd is before periodStart', async () => {
    await expect(
      service.create('1', {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2024-12-31'),
        periodEnd: new Date('2024-01-01'),
        fiscalYear: 2024,
        periodType: 'ANNUAL',
        currency: 'USD',
        scale: 'ONES',
      }, 'user-1', 'ANALYST', 'user@test.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return financial statements for a company', async () => {
    mockPrisma.financialStatement.findMany.mockResolvedValue([
      { id: '1', companyId: '1', type: 'INCOME_STATEMENT' },
    ]);

    const result = await service.findByCompany('1', 'user-1', 'ANALYST');

    expect(result).toHaveLength(1);
    expect(mockPrisma.financialStatement.findMany).toHaveBeenCalledWith({
      where: { companyId: '1' },
      orderBy: { periodStart: 'desc' },
    });
  });

  it('should throw NotFoundException when company not found for list', async () => {
    accessService.requireCompanyRead.mockRejectedValue(new NotFoundException('Company not found'));

    await expect(service.findByCompany('999', 'user-1', 'ANALYST')).rejects.toThrow(NotFoundException);
  });

  it('should return one financial statement', async () => {
    const statement = { id: '1', companyId: '1', type: 'INCOME_STATEMENT' };
    mockPrisma.financialStatement.findUnique.mockResolvedValue(statement);

    const result = await service.findOne('1', 'user-1', 'ANALYST');

    expect(result).toEqual(statement);
  });

  it('should throw NotFoundException when statement not found', async () => {
    mockPrisma.financialStatement.findUnique.mockResolvedValue(null);

    await expect(service.findOne('999', 'user-1', 'ANALYST')).rejects.toThrow(NotFoundException);
  });

  it('should update a financial statement', async () => {
    mockPrisma.financialStatement.findUnique.mockResolvedValue({
      id: '1',
      companyId: '1',
      type: 'INCOME_STATEMENT',
      fiscalYear: 2024,
      periodType: 'ANNUAL',
      currency: 'USD',
      scale: 'ONES',
      sourceType: null,
      sourceReference: null,
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
    });
    mockPrisma.financialStatement.update.mockResolvedValue({
      id: '1',
      type: 'BALANCE_SHEET',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
    });

    const result = await service.update('1', { type: 'BALANCE_SHEET' }, 'user-1', 'ANALYST', 'user@test.com');

    expect(result).toBeDefined();
    expect(mockPrisma.financialStatement.update).toHaveBeenCalled();
    expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
  });

  it('should throw BadRequestException when update periodEnd is before periodStart', async () => {
    mockPrisma.financialStatement.findUnique.mockResolvedValue({
      id: '1',
      companyId: '1',
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
    });

    await expect(
      service.update('1', { periodStart: new Date('2024-12-31'), periodEnd: new Date('2024-01-01') }, 'user-1', 'ANALYST', 'user@test.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when updating non-existent statement', async () => {
    mockPrisma.financialStatement.findUnique.mockResolvedValue(null);

    await expect(service.update('999', { type: 'BALANCE_SHEET' }, 'user-1', 'ANALYST', 'user@test.com')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should delete a financial statement', async () => {
    mockPrisma.financialStatement.findUnique.mockResolvedValue({
      id: '1',
      companyId: '1',
      company: { name: 'Test Co' },
    });
    mockPrisma.financialStatement.delete.mockResolvedValue({
      id: '1',
      companyId: '1',
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
    });

    await service.remove('1', 'user-1', 'ADMIN', 'user@test.com');

    expect(mockPrisma.financialStatement.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when deleting non-existent statement', async () => {
    mockPrisma.financialStatement.findUnique.mockResolvedValue(null);

    await expect(service.remove('999', 'user-1', 'ADMIN', 'user@test.com')).rejects.toThrow(NotFoundException);
  });
});
