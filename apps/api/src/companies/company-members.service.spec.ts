import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { CompanyMembersService } from './company-members.service';
import { AuditService } from '../audit/audit.service';

describe('CompanyMembersService', () => {
  let service: CompanyMembersService;
  let accessService: jest.Mocked<CompanyAccessService>;
  let auditService: jest.Mocked<AuditService>;

  const mockPrisma: any = {
    companyMember: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyMembersService,
        {
          provide: PrismaService,
          useValue: {
            prisma: mockPrisma,
          },
        },
        {
          provide: CompanyAccessService,
          useValue: accessService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    service = module.get<CompanyMembersService>(CompanyMembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listMembers', () => {
    it('should list members for authorized user', async () => {
      accessService.requireCompanyRead.mockResolvedValue({ id: 'company-1' });
      mockPrisma.companyMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          role: 'OWNER',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          user: { id: 'user-1', name: 'Owner', email: 'owner@test.com' },
        },
        {
          id: 'member-2',
          role: 'VIEWER',
          createdAt: new Date('2024-01-02T00:00:00.000Z'),
          user: { id: 'user-2', name: 'Viewer', email: 'viewer@test.com' },
        },
      ]);

      const result = await service.listMembers('user-1', 'ANALYST', 'company-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'member-1',
        user: { id: 'user-1', name: 'Owner', email: 'owner@test.com' },
        role: 'OWNER',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      expect(result[1]).toEqual({
        id: 'member-2',
        user: { id: 'user-2', name: 'Viewer', email: 'viewer@test.com' },
        role: 'VIEWER',
        createdAt: '2024-01-02T00:00:00.000Z',
      });
    });

    it('should order members by role priority then createdAt then id', async () => {
      accessService.requireCompanyRead.mockResolvedValue({ id: 'company-1' });
      mockPrisma.companyMember.findMany.mockResolvedValue([
        {
          id: 'member-viewer',
          role: 'VIEWER',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          user: { id: 'user-3', name: 'Viewer', email: 'viewer@test.com' },
        },
        {
          id: 'member-owner',
          role: 'OWNER',
          createdAt: new Date('2024-01-03T00:00:00.000Z'),
          user: { id: 'user-1', name: 'Owner', email: 'owner@test.com' },
        },
        {
          id: 'member-editor',
          role: 'EDITOR',
          createdAt: new Date('2024-01-02T00:00:00.000Z'),
          user: { id: 'user-2', name: 'Editor', email: 'editor@test.com' },
        },
      ]);

      const result = await service.listMembers('user-1', 'ANALYST', 'company-1');

      expect(result.map((m) => m.role)).toEqual(['OWNER', 'EDITOR', 'VIEWER']);
    });

    it('should throw NotFoundException when user has no company access', async () => {
      accessService.requireCompanyRead.mockRejectedValue(new NotFoundException('Company not found'));

      await expect(service.listMembers('user-1', 'ANALYST', 'company-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.companyMember.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when company has no members', async () => {
      accessService.requireCompanyRead.mockResolvedValue({ id: 'company-1' });
      mockPrisma.companyMember.findMany.mockResolvedValue([]);

      const result = await service.listMembers('user-1', 'ANALYST', 'company-1');

      expect(result).toEqual([]);
    });

    it('should not expose sensitive user fields', async () => {
      accessService.requireCompanyRead.mockResolvedValue({ id: 'company-1' });
      mockPrisma.companyMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          role: 'OWNER',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          user: {
            id: 'user-1',
            name: 'Owner',
            email: 'owner@test.com',
            password: 'secret',
            role: 'ADMIN',
            lastLoginAt: new Date('2024-01-01'),
            refreshTokens: [],
          },
        },
      ]);

      const result = await service.listMembers('user-1', 'ANALYST', 'company-1');

      expect(result[0].user).toEqual({
        id: 'user-1',
        name: 'Owner',
        email: 'owner@test.com',
      });
      expect((result[0].user as any).password).toBeUndefined();
      expect((result[0].user as any).role).toBeUndefined();
      expect((result[0].user as any).lastLoginAt).toBeUndefined();
    });
  });

  describe('addMember', () => {
    it('should allow owner to add EDITOR', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', name: 'New Member', email: 'new@test.com' });
      mockPrisma.companyMember.create.mockResolvedValue({
        id: 'member-new',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-2', name: 'New Member', email: 'new@test.com' },
      });

      const result = await service.addMember('owner-1', 'ANALYST', 'company-1', { email: 'new@test.com', role: 'EDITOR' }, 'actor@test.com');

      expect(result).toEqual({
        id: 'member-new',
        user: { id: 'user-2', name: 'New Member', email: 'new@test.com' },
        role: 'EDITOR',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      expect(accessService.requireCompanyOwnerOrAdmin).toHaveBeenCalledWith('owner-1', 'company-1', 'ANALYST');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@test.com' },
        select: { id: true, name: true, email: true },
      });
    });

    it('should allow ADMIN to add member without membership', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', name: 'New Member', email: 'new@test.com' });
      mockPrisma.companyMember.create.mockResolvedValue({
        id: 'member-new',
        role: 'VIEWER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-2', name: 'New Member', email: 'new@test.com' },
      });

      const result = await service.addMember('admin-1', 'ADMIN', 'company-1', { email: 'new@test.com', role: 'VIEWER' }, 'actor@test.com');

      expect(result.role).toBe('VIEWER');
      expect(accessService.requireCompanyOwnerOrAdmin).toHaveBeenCalledWith('admin-1', 'company-1', 'ADMIN');
    });

    it('should throw ForbiddenException when editor attempts to add member', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockRejectedValue(new ForbiddenException('Insufficient permissions'));

      await expect(
        service.addMember('editor-1', 'ANALYST', 'company-1', { email: 'new@test.com', role: 'EDITOR' }, 'actor@test.com'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown target email', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('owner-1', 'ANALYST', 'company-1', { email: 'unknown@test.com', role: 'EDITOR' }, 'actor@test.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate membership', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', name: 'Member', email: 'existing@test.com' });

      const uniqueError = new Error('Duplicate membership') as Error & { code?: string };
      uniqueError.code = 'P2002';
      mockPrisma.companyMember.create.mockRejectedValue(uniqueError);

      await expect(
        service.addMember('owner-1', 'ANALYST', 'company-1', { email: 'existing@test.com', role: 'EDITOR' }, 'actor@test.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('should normalize email before lookup', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', name: 'Member', email: 'new@test.com' });
      mockPrisma.companyMember.create.mockResolvedValue({
        id: 'member-new',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-2', name: 'Member', email: 'new@test.com' },
      });

      await service.addMember('owner-1', 'ANALYST', 'company-1', { email: '  NEW@TEST.COM  ', role: 'EDITOR' }, 'actor@test.com');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@test.com' },
        select: { id: true, name: true, email: true },
      });
    });

    it('should reject OWNER role at service layer even if DTO bypassed', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });

      await expect(
        service.addMember('owner-1', 'ANALYST', 'company-1', { email: 'new@test.com', role: 'OWNER' }, 'actor@test.com'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it('should allow owner to change EDITOR to VIEWER', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({
        id: 'member-2',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-2', name: 'Member', email: 'member@test.com' },
      });
      mockPrisma.companyMember.update.mockResolvedValue({
        id: 'member-2',
        role: 'VIEWER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-2', name: 'Member', email: 'member@test.com' },
      });

      const result = await service.updateMemberRole('owner-1', 'ANALYST', 'company-1', 'member-2', { role: 'VIEWER' }, 'actor@test.com');

      expect(result.role).toBe('VIEWER');
      expect(mockPrisma.companyMember.update).toHaveBeenCalledWith({
        where: { id: 'member-2' },
        data: { role: 'VIEWER' },
        select: expect.any(Object),
      });
    });

    it('should return current member when role is unchanged', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({
        id: 'member-2',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-2', name: 'Member', email: 'member@test.com' },
      });

      const result = await service.updateMemberRole('owner-1', 'ANALYST', 'company-1', 'member-2', { role: 'EDITOR' }, 'actor@test.com');

      expect(result.role).toBe('EDITOR');
      expect(mockPrisma.companyMember.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing member', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMemberRole('owner-1', 'ANALYST', 'company-1', 'member-missing', { role: 'EDITOR' }, 'actor@test.com'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.companyMember.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when target is OWNER', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-1', name: 'Owner', email: 'owner@test.com' },
      });

      await expect(
        service.updateMemberRole('owner-1', 'ANALYST', 'company-1', 'member-owner', { role: 'EDITOR' }, 'actor@test.com'),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.companyMember.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when editor attempts role change', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockRejectedValue(new ForbiddenException('Insufficient permissions'));

      await expect(
        service.updateMemberRole('editor-1', 'ANALYST', 'company-1', 'member-2', { role: 'VIEWER' }, 'actor@test.com'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.companyMember.findFirst).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to change role without membership', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue(undefined);
      mockPrisma.companyMember.findFirst.mockResolvedValue({
        id: 'member-2',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-2', name: 'Member', email: 'member@test.com' },
      });
      mockPrisma.companyMember.update.mockResolvedValue({
        id: 'member-2',
        role: 'VIEWER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'user-2', name: 'Member', email: 'member@test.com' },
      });

      const result = await service.updateMemberRole('admin-1', 'ADMIN', 'company-1', 'member-2', { role: 'VIEWER' }, 'actor@test.com');

      expect(result.role).toBe('VIEWER');
    });
  });

  describe('removeMember', () => {
    it('should allow owner to remove EDITOR', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({ id: 'member-2', role: 'EDITOR', user: { id: 'user-2', email: 'member@test.com' } });

      await service.removeMember('owner-1', 'ANALYST', 'company-1', 'member-2', 'actor@test.com');

      expect(mockPrisma.companyMember.delete).toHaveBeenCalledWith({ where: { id: 'member-2' } });
    });

    it('should throw ConflictException when target is OWNER', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({ id: 'member-owner', role: 'OWNER', user: { id: 'user-1', email: 'owner@test.com' } });

      await expect(
        service.removeMember('owner-1', 'ANALYST', 'company-1', 'member-owner', 'actor@test.com'),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.companyMember.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing member', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMember('owner-1', 'ANALYST', 'company-1', 'member-missing', 'actor@test.com'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.companyMember.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when editor attempts removal', async () => {
      accessService.requireCompanyOwnerOrAdmin.mockRejectedValue(new ForbiddenException('Insufficient permissions'));

      await expect(
        service.removeMember('editor-1', 'ANALYST', 'company-1', 'member-2', 'actor@test.com'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.companyMember.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('removeSelf', () => {
    it('should allow EDITOR to leave company', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ id: 'member-editor', role: 'EDITOR', user: { email: 'editor@test.com' } });

      await service.removeSelf('editor-1', 'company-1', 'actor@test.com');

      expect(mockPrisma.companyMember.delete).toHaveBeenCalledWith({ where: { id: 'member-editor' } });
    });

    it('should allow VIEWER to leave company', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ id: 'member-viewer', role: 'VIEWER', user: { email: 'viewer@test.com' } });

      await service.removeSelf('viewer-1', 'company-1', 'actor@test.com');

      expect(mockPrisma.companyMember.delete).toHaveBeenCalledWith({ where: { id: 'member-viewer' } });
    });

    it('should throw ConflictException when OWNER attempts to leave', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue({ id: 'member-owner', role: 'OWNER', user: { email: 'owner@test.com' } });

      await expect(service.removeSelf('owner-1', 'company-1', 'actor@test.com')).rejects.toThrow(ConflictException);
      expect(mockPrisma.companyMember.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user has no membership', async () => {
      mockPrisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(service.removeSelf('user-1', 'company-1', 'actor@test.com')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.companyMember.delete).not.toHaveBeenCalled();
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership from OWNER to EDITOR', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-editor',
        role: 'EDITOR',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        userId: 'editor-1',
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com' },
      });
      mockPrisma.company.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.companyMember.update.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-editor',
        role: 'OWNER',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com' },
      });

      const result = await service.transferOwnership('owner-1', 'ANALYST', 'company-1', { memberId: 'member-editor' }, 'actor@test.com');

      expect(result.company.ownerId).toBe('editor-1');
      expect(result.previousOwner.role).toBe('EDITOR');
      expect(result.newOwner.role).toBe('OWNER');
      expect(mockPrisma.company.updateMany).toHaveBeenCalledWith({
        where: { id: 'company-1', ownerId: 'owner-1' },
        data: { ownerId: 'editor-1' },
      });
    });

    it('should transfer ownership from OWNER to VIEWER', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-viewer',
        role: 'VIEWER',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        userId: 'viewer-1',
        user: { id: 'viewer-1', name: 'Viewer', email: 'viewer@test.com' },
      });
      mockPrisma.company.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.companyMember.update.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-viewer',
        role: 'OWNER',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        user: { id: 'viewer-1', name: 'Viewer', email: 'viewer@test.com' },
      });

      const result = await service.transferOwnership('owner-1', 'ANALYST', 'company-1', { memberId: 'member-viewer' }, 'actor@test.com');

      expect(result.newOwner.role).toBe('OWNER');
      expect(result.previousOwner.role).toBe('EDITOR');
    });

    it('should allow USER global role to transfer ownership', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-editor',
        role: 'EDITOR',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        userId: 'editor-1',
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com' },
      });
      mockPrisma.company.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.companyMember.update.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-editor',
        role: 'OWNER',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com' },
      });

      const result = await service.transferOwnership('owner-1', 'USER', 'company-1', { memberId: 'member-editor' }, 'actor@test.com');

      expect(result.newOwner.role).toBe('OWNER');
    });

    it('should reject ADMIN without membership', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(service.transferOwnership('admin-1', 'ADMIN', 'company-1', { memberId: 'member-editor' }, 'actor@test.com')).rejects.toThrow(ForbiddenException);
    });

    it('should reject ADMIN with EDITOR membership', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({
        id: 'member-admin',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
      });

      await expect(service.transferOwnership('admin-1', 'ADMIN', 'company-1', { memberId: 'member-editor' }, 'actor@test.com')).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN who is current OWNER to transfer', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'admin-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValueOnce({
        id: 'member-admin',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-editor',
        role: 'EDITOR',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        userId: 'editor-1',
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com' },
      });
      mockPrisma.company.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.companyMember.update.mockResolvedValueOnce({
        id: 'member-admin',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-editor',
        role: 'OWNER',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com' },
      });

      const result = await service.transferOwnership('admin-1', 'ADMIN', 'company-1', { memberId: 'member-editor' }, 'actor@test.com');

      expect(result.newOwner.role).toBe('OWNER');
      expect(result.previousOwner.role).toBe('EDITOR');
    });

    it('should reject self-transfer', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      });

      await expect(service.transferOwnership('owner-1', 'ANALYST', 'company-1', { memberId: 'member-owner' }, 'actor@test.com')).rejects.toThrow(ConflictException);
      expect(mockPrisma.company.updateMany).not.toHaveBeenCalled();
    });

    it('should reject cross-company target', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce(null);

      await expect(service.transferOwnership('owner-1', 'ANALYST', 'company-1', { memberId: 'member-other' }, 'actor@test.com')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.company.updateMany).not.toHaveBeenCalled();
    });

    it('should reject missing target', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce(null);

      await expect(service.transferOwnership('owner-1', 'ANALYST', 'company-1', { memberId: 'member-missing' }, 'actor@test.com')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.company.updateMany).not.toHaveBeenCalled();
    });

    it('should reject non-owner caller', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({
        id: 'member-editor',
        role: 'EDITOR',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com' },
      });

      await expect(service.transferOwnership('editor-1', 'ANALYST', 'company-1', { memberId: 'member-owner' }, 'actor@test.com')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.company.updateMany).not.toHaveBeenCalled();
    });

    it('should reject inconsistent ownerId and membership', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'other-user' });
      mockPrisma.companyMember.findFirst.mockResolvedValue({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      });

await expect(service.transferOwnership('owner-1', 'ANALYST', 'company-1', { memberId: 'member-editor' }, 'actor@test.com')).rejects.toThrow(ConflictException);
       expect(mockPrisma.company.updateMany).not.toHaveBeenCalled();
     });

     it('should fail safely when concurrent transfer changes ownerId', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-editor',
        role: 'EDITOR',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        userId: 'editor-1',
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com' },
      });
      mockPrisma.company.updateMany.mockResolvedValue({ count: 0 });

await expect(service.transferOwnership('owner-1', 'ANALYST', 'company-1', { memberId: 'member-editor' }, 'actor@test.com')).rejects.toThrow(ConflictException);
       expect(mockPrisma.companyMember.update).not.toHaveBeenCalled();
     });

     it('should reject target who is already OWNER', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1', ownerId: 'owner-1' });
      mockPrisma.companyMember.findFirst.mockResolvedValueOnce({
        id: 'member-owner',
        role: 'OWNER',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: { id: 'owner-1', name: 'Owner', email: 'owner@test.com' },
      }).mockResolvedValueOnce({
        id: 'member-coowner',
        role: 'OWNER',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        userId: 'co-owner-1',
        user: { id: 'co-owner-1', name: 'CoOwner', email: 'coowner@test.com' },
      });

      await expect(service.transferOwnership('owner-1', 'ANALYST', 'company-1', { memberId: 'member-coowner' }, 'actor@test.com')).rejects.toThrow(ConflictException);
      expect(mockPrisma.company.updateMany).not.toHaveBeenCalled();
    });
  });
});

