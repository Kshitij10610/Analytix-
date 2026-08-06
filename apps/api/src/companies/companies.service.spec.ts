import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { AuditService } from '../audit/audit.service';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let accessService: jest.Mocked<CompanyAccessService>;
  let auditService: jest.Mocked<AuditService>;

  const mockPrisma: any = {
    company: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    companyMember: {
      create: jest.fn(),
      count: jest.fn(),
    },
    financialStatement: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    accessService = {
      requireCompanyRead: jest.fn(),
      requireCompanyWrite: jest.fn(),
      requireCompanyOwnerOrAdmin: jest.fn(),
      buildScopedCompanyWhere: jest.fn(),
    } as unknown as jest.Mocked<CompanyAccessService>;

    auditService = {
      record: jest.fn(),
      recordInTransaction: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: {
            prisma: mockPrisma,
          },
        },
        { provide: CompanyAccessService, useValue: accessService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a company with owner setup and audit', async () => {
    const createdCompany = {
      id: '1',
      name: 'Test Corp',
      industry: 'Tech',
      website: 'https://test.com',
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.company.create.mockResolvedValue(createdCompany);

    const result = await service.create(
      { name: 'Test Corp', industry: 'Tech', website: 'https://test.com' },
      'user-1',
      'user@test.com',
      'USER',
    );

    expect(result).toEqual(createdCompany);
    expect(mockPrisma.company.create).toHaveBeenCalledWith({
      data: { name: 'Test Corp', industry: 'Tech', website: 'https://test.com', ownerId: 'user-1' },
    });
    expect(mockPrisma.companyMember.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', companyId: createdCompany.id, role: 'OWNER' },
    });
    expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
    expect(auditService.recordInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANY_CREATE',
        resourceType: 'COMPANY',
        actorUserId: 'user-1',
        actorEmail: 'user@test.com',
        actorGlobalRole: 'USER',
        companyId: createdCompany.id,
      }),
      expect.anything(),
    );
  });

  it('should throw ConflictException on create failure', async () => {
    mockPrisma.company.create.mockRejectedValue(new Error('DB error'));

    await expect(
      service.create({ name: 'Test Corp' }, 'user-1', 'user@test.com', 'USER'),
    ).rejects.toThrow(ConflictException);
  });

  it('should return all companies scoped by tenant', async () => {
    const where = { OR: [{ ownerId: 'user-1' }, { members: { some: { userId: 'user-1' } } }] };
    accessService.buildScopedCompanyWhere.mockReturnValue(where);
    const companies = [
      { id: '1', name: 'A', industry: 'Tech', website: null },
      { id: '2', name: 'B', industry: 'Finance', website: null },
    ];
    mockPrisma.company.findMany.mockResolvedValue(companies);

    const result = await service.findAll('user-1', 'ANALYST');

    expect(result).toEqual(companies);
    expect(accessService.buildScopedCompanyWhere).toHaveBeenCalledWith('user-1', 'ANALYST');
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { name: 'asc' },
    });
  });

  it('should return all companies as ADMIN (no scoping)', async () => {
    accessService.buildScopedCompanyWhere.mockReturnValue({});
    const companies = [
      { id: '1', name: 'A', industry: 'Tech', website: null },
      { id: '2', name: 'B', industry: 'Finance', website: null },
    ];
    mockPrisma.company.findMany.mockResolvedValue(companies);

    const result = await service.findAll('admin-1', 'ADMIN');

    expect(result).toEqual(companies);
    expect(accessService.buildScopedCompanyWhere).toHaveBeenCalledWith('admin-1', 'ADMIN');
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { name: 'asc' },
    });
  });

  it('should return one company after access check', async () => {
    const company = { id: '1', name: 'Test Corp', industry: 'Tech', website: 'https://test.com' };
    accessService.requireCompanyRead.mockResolvedValue({ id: '1' });
    mockPrisma.company.findUnique.mockResolvedValue(company);

    const result = await service.findOne('user-1', 'ANALYST', '1');

    expect(result).toEqual(company);
    expect(accessService.requireCompanyRead).toHaveBeenCalledWith('user-1', '1', 'ANALYST');
    expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('should throw NotFoundException when company not found', async () => {
    accessService.requireCompanyRead.mockResolvedValue({ id: '1' });
    mockPrisma.company.findUnique.mockResolvedValue(null);

    await expect(service.findOne('user-1', 'ANALYST', '999')).rejects.toThrow(NotFoundException);
  });

  it('should update a company with audit and tenant check', async () => {
    const existingCompany = { id: '1', name: 'Old Name', industry: 'Tech', website: null };
    const updatedCompany = { id: '1', name: 'Updated', industry: 'Tech', website: 'https://updated.com', ownerId: 'user-1' };
    accessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
    mockPrisma.company.findUnique.mockResolvedValue(existingCompany);
    mockPrisma.company.update.mockResolvedValue(updatedCompany);

    const result = await service.update('user-1', 'USER', '1', { name: 'Updated', website: 'https://updated.com' }, 'user@test.com');

    expect(result).toEqual(updatedCompany);
    expect(accessService.requireCompanyWrite).toHaveBeenCalledWith('user-1', '1', 'USER');
    expect(mockPrisma.company.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { name: 'Updated', website: 'https://updated.com' },
    });
    expect(auditService.recordInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANY_UPDATE',
        changes: {
          name: { before: 'Old Name', after: 'Updated' },
          website: { before: null, after: 'https://updated.com' },
        },
      }),
      expect.anything(),
    );
  });

  it('should not create audit event when no changes', async () => {
    const existingCompany = { id: '1', name: 'Same Name', industry: 'Tech', website: null };
    accessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });
    mockPrisma.company.findUnique.mockResolvedValue(existingCompany);

    const result = await service.update('user-1', 'USER', '1', { name: 'Same Name' }, 'user@test.com');

    expect(result).toEqual(existingCompany);
    expect(mockPrisma.company.update).not.toHaveBeenCalled();
    expect(auditService.recordInTransaction).not.toHaveBeenCalled();
  });

  it('should delete a company with audit and ownership check', async () => {
    accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
    mockPrisma.company.findUnique.mockResolvedValue({ name: 'Test Corp' });
    mockPrisma.companyMember.count.mockResolvedValue(1);
    mockPrisma.financialStatement.count.mockResolvedValue(0);
    mockPrisma.company.delete.mockResolvedValue({ id: '1' });

    await service.remove('user-1', 'ADMIN', '1', 'user@test.com');

    expect(accessService.requireCompanyOwnerOrAdmin).toHaveBeenCalledWith('user-1', '1', 'ADMIN');
    expect(mockPrisma.company.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(auditService.recordInTransaction).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when deleting non-existent company', async () => {
    accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
    mockPrisma.company.findUnique.mockResolvedValue(null);

    await expect(service.remove('user-1', 'ADMIN', '999', 'user@test.com')).rejects.toThrow(NotFoundException);
  });
});
