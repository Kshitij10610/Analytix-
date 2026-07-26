import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialsService } from './financials.service';

describe('FinancialsService', () => {
  let service: FinancialsService;

  const mockPrisma = {
    company: {
      findUnique: jest.fn(),
    },
    financialStatement: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialsService,
        {
          provide: PrismaService,
          useValue: {
            prisma: mockPrisma,
          },
        },
      ],
    }).compile();

    service = module.get<FinancialsService>(FinancialsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a financial statement', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ id: '1', name: 'Test' });
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
    });

    expect(result).toBeDefined();
    expect(mockPrisma.financialStatement.create).toHaveBeenCalled();
  });

  it('should throw NotFoundException when company does not exist', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(null);

    await expect(
      service.create('999', {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when periodEnd is before periodStart', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ id: '1' });

    await expect(
      service.create('1', {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2024-12-31'),
        periodEnd: new Date('2024-01-01'),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw ConflictException on create failure', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ id: '1' });
    mockPrisma.financialStatement.create.mockRejectedValue(new Error('DB error'));

    await expect(
      service.create('1', {
        type: 'INCOME_STATEMENT',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should return financial statements for a company', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ id: '1' });
    mockPrisma.financialStatement.findMany.mockResolvedValue([
      { id: '1', companyId: '1', type: 'INCOME_STATEMENT' },
    ]);

    const result = await service.findByCompany('1');

    expect(result).toHaveLength(1);
    expect(mockPrisma.financialStatement.findMany).toHaveBeenCalledWith({
      where: { companyId: '1' },
      orderBy: { periodStart: 'desc' },
      include: { company: true },
    });
  });

  it('should throw NotFoundException when company not found for list', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(null);

    await expect(service.findByCompany('999')).rejects.toThrow(NotFoundException);
  });

  it('should return one financial statement', async () => {
    const statement = { id: '1', companyId: '1', type: 'INCOME_STATEMENT' };
    mockPrisma.financialStatement.findUnique.mockResolvedValue(statement);

    const result = await service.findOne('1');

    expect(result).toEqual(statement);
  });

  it('should throw NotFoundException when statement not found', async () => {
    mockPrisma.financialStatement.findUnique.mockResolvedValue(null);

    await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
  });

  it('should update a financial statement', async () => {
    mockPrisma.financialStatement.update.mockResolvedValue({
      id: '1',
      type: 'BALANCE_SHEET',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
    });

    const result = await service.update('1', { type: 'BALANCE_SHEET' });

    expect(result).toBeDefined();
    expect(mockPrisma.financialStatement.update).toHaveBeenCalled();
  });

  it('should throw BadRequestException when update periodEnd is before periodStart', async () => {
    mockPrisma.financialStatement.update.mockResolvedValue({ id: '1' });

    await expect(
      service.update('1', {
        periodStart: new Date('2024-12-31'),
        periodEnd: new Date('2024-01-01'),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when updating non-existent statement', async () => {
    mockPrisma.financialStatement.update.mockRejectedValue(new Error('Not found'));

    await expect(service.update('999', { type: 'BALANCE_SHEET' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should delete a financial statement', async () => {
    mockPrisma.financialStatement.delete.mockResolvedValue({
      id: '1',
      companyId: '1',
      type: 'INCOME_STATEMENT',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
    });

    await service.remove('1');

    expect(mockPrisma.financialStatement.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('should throw NotFoundException when deleting non-existent statement', async () => {
    mockPrisma.financialStatement.delete.mockRejectedValue(new Error('Not found'));

    await expect(service.remove('999')).rejects.toThrow(NotFoundException);
  });
});
