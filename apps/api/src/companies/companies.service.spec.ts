import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const mockPrisma = {
    company: {
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
        CompaniesService,
        {
          provide: PrismaService,
          useValue: {
            prisma: mockPrisma,
          },
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a company', async () => {
    const createdCompany = {
      id: '1',
      name: 'Test Corp',
      industry: 'Tech',
      website: 'https://test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.company.create.mockResolvedValue(createdCompany);

    const result = await service.create({
      name: 'Test Corp',
      industry: 'Tech',
      website: 'https://test.com',
    });

    expect(result).toEqual(createdCompany);
    expect(mockPrisma.company.create).toHaveBeenCalledWith({
      data: { name: 'Test Corp', industry: 'Tech', website: 'https://test.com' },
    });
  });

  it('should throw ConflictException on create failure', async () => {
    mockPrisma.company.create.mockRejectedValue(new Error('DB error'));

    await expect(
      service.create({ name: 'Test Corp', industry: 'Tech', website: 'https://test.com' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should return all companies', async () => {
    const companies = [
      { id: '1', name: 'A', industry: 'Tech', website: null },
      { id: '2', name: 'B', industry: 'Finance', website: null },
    ];
    mockPrisma.company.findMany.mockResolvedValue(companies);

    const result = await service.findAll();

    expect(result).toEqual(companies);
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });

  it('should return one company', async () => {
    const company = { id: '1', name: 'Test Corp', industry: 'Tech', website: 'https://test.com' };
    mockPrisma.company.findUnique.mockResolvedValue(company);

    const result = await service.findOne('1');

    expect(result).toEqual(company);
    expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('should throw NotFoundException when company not found', async () => {
    mockPrisma.company.findUnique.mockResolvedValue(null);

    await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
  });

  it('should update a company', async () => {
    const updatedCompany = { id: '1', name: 'Updated', industry: 'Tech', website: 'https://updated.com' };
    mockPrisma.company.update.mockResolvedValue(updatedCompany);

    const result = await service.update('1', { name: 'Updated', website: 'https://updated.com' });

    expect(result).toEqual(updatedCompany);
    expect(mockPrisma.company.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { name: 'Updated', website: 'https://updated.com' },
    });
  });

  it('should delete a company', async () => {
    mockPrisma.company.delete.mockResolvedValue({
      id: '1',
      name: 'Test Corp',
      industry: 'Tech',
      website: 'https://test.com',
    });

    await service.remove('1');

    expect(mockPrisma.company.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('should throw NotFoundException when deleting non-existent company', async () => {
    mockPrisma.company.delete.mockRejectedValue(new Error('Not found'));

    await expect(service.remove('999')).rejects.toThrow(NotFoundException);
  });
});
