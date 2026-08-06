import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from './company-access.service';

describe('CompanyAccessService', () => {
  let service: CompanyAccessService;

  const mockPrisma = {
    company: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    companyMember: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyAccessService,
        {
          provide: PrismaService,
          useValue: {
            prisma: mockPrisma,
          },
        },
      ],
    }).compile();

    service = module.get<CompanyAccessService>(CompanyAccessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requireCompanyRead', () => {
    it('should allow admin to read any company without membership query', async () => {
      const result = await service.requireCompanyRead('admin-1', 'company-1', 'ADMIN');

      expect(result).toBeUndefined();
      expect(mockPrisma.company.findFirst).not.toHaveBeenCalled();
    });

    it('should allow owner to read their company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'company-1' });

      const result = await service.requireCompanyRead('owner-1', 'company-1', 'ANALYST');

      expect(result).toEqual({ id: 'company-1' });
      expect(mockPrisma.company.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'company-1',
          OR: [
            { ownerId: 'owner-1' },
            { members: { some: { userId: 'owner-1' } } },
          ],
        },
        select: { id: true },
      });
    });

    it('should allow member to read company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'company-1' });

      const result = await service.requireCompanyRead('member-1', 'company-1', 'ANALYST');

      expect(result).toEqual({ id: 'company-1' });
    });

    it('should throw NotFoundException when user has no access', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(service.requireCompanyRead('user-1', 'company-1', 'ANALYST')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for nonexistent company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(service.requireCompanyRead('user-1', 'nonexistent', 'ANALYST')).rejects.toThrow(NotFoundException);
    });
  });

  describe('requireCompanyWrite', () => {
    it('should allow admin to write any company', async () => {
      const result = await service.requireCompanyWrite('admin-1', 'company-1', 'ADMIN');

      expect(result).toBeUndefined();
      expect(mockPrisma.companyMember.findFirst).not.toHaveBeenCalled();
    });

    it('should allow owner to write their company', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ role: 'OWNER' });

      const result = await service.requireCompanyWrite('owner-1', 'company-1', 'ANALYST');

      expect(result).toEqual({ role: 'OWNER' });
      expect(mockPrisma.companyMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'owner-1',
          company: { id: 'company-1' },
        },
        select: { role: true },
      });
    });

    it('should allow editor to write company', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ role: 'EDITOR' });

      const result = await service.requireCompanyWrite('editor-1', 'company-1', 'ANALYST');

      expect(result).toEqual({ role: 'EDITOR' });
    });

    it('should throw ForbiddenException for viewer attempting write', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ role: 'VIEWER' });

      await expect(service.requireCompanyWrite('viewer-1', 'company-1', 'ANALYST')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user has no membership', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(service.requireCompanyWrite('user-1', 'company-1', 'ANALYST')).rejects.toThrow(NotFoundException);
    });
  });

  describe('requireCompanyOwnerOrAdmin', () => {
    it('should allow admin without membership query', async () => {
      const result = await service.requireCompanyOwnerOrAdmin('admin-1', 'company-1', 'ADMIN');

      expect(result).toBeUndefined();
      expect(mockPrisma.companyMember.findFirst).not.toHaveBeenCalled();
    });

    it('should allow owner to manage membership', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ role: 'OWNER' });

      const result = await service.requireCompanyOwnerOrAdmin('owner-1', 'company-1', 'ANALYST');

      expect(result).toEqual({ role: 'OWNER' });
      expect(mockPrisma.companyMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'owner-1',
          company: { id: 'company-1' },
        },
        select: { role: true },
      });
    });

    it('should throw ForbiddenException for editor attempting membership management', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ role: 'EDITOR' });

      await expect(service.requireCompanyOwnerOrAdmin('editor-1', 'company-1', 'ANALYST')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for viewer attempting membership management', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ role: 'VIEWER' });

      await expect(service.requireCompanyOwnerOrAdmin('viewer-1', 'company-1', 'ANALYST')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user has no membership', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(service.requireCompanyOwnerOrAdmin('user-1', 'company-1', 'ANALYST')).rejects.toThrow(NotFoundException);
    });
  });

  describe('buildScopedCompanyWhere', () => {
    it('should return empty where for admin', () => {
      const result = service.buildScopedCompanyWhere('admin-1', 'ADMIN');

      expect(result).toEqual({});
    });

    it('should return membership filter for non-admin', () => {
      const result = service.buildScopedCompanyWhere('user-1', 'ANALYST');

      expect(result).toEqual({
        OR: [
          { ownerId: 'user-1' },
          { members: { some: { userId: 'user-1' } } },
        ],
      });
    });

    it('should return membership filter for user role', () => {
      const result = service.buildScopedCompanyWhere('user-1', 'USER');

      expect(result).toEqual({
        OR: [
          { ownerId: 'user-1' },
          { members: { some: { userId: 'user-1' } } },
        ],
      });
    });
  });
});
