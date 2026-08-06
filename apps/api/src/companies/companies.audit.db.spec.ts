import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { CompanyMembersService } from '../companies/company-members.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit/audit.constants';
import { $Enums } from '../generated/client';

describe('Company/Membership Audit DB-backed', () => {
  let prisma: PrismaService;
  let companiesService: CompaniesService;
  let companyMembersService: CompanyMembersService;
  let accessService: jest.Mocked<CompanyAccessService>;

  beforeEach(async () => {
    accessService = {
      requireCompanyRead: jest.fn(),
      requireCompanyWrite: jest.fn(),
      requireCompanyOwnerOrAdmin: jest.fn(),
      buildScopedCompanyWhere: jest.fn(),
    } as unknown as jest.Mocked<CompanyAccessService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        CompaniesService,
        CompanyMembersService,
        { provide: CompanyAccessService, useValue: accessService },
        AuditService,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    companiesService = module.get<CompaniesService>(CompaniesService);
    companyMembersService = module.get<CompanyMembersService>(CompanyMembersService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  describe('company create audit', () => {
    it('should create company and audit event atomically', async () => {
      const userId = `audit-user-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-user-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });

      const company = await companiesService.create(
        { name: 'Audit Create Co', industry: 'Tech' },
        userId,
        `audit-user-${Date.now()}@test.com`,
        'USER',
      );

      const membership = await prisma.prisma.companyMember.findFirst({
        where: { companyId: company.id, userId },
      });

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.COMPANY_CREATE, resourceId: company.id },
      });

      expect(company.ownerId).toBe(userId);
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe($Enums.CompanyMemberRole.OWNER);
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.action).toBe(AuditAction.COMPANY_CREATE);
      expect(auditEvent!.resourceType).toBe(AuditResourceType.COMPANY);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.result).toBe(AuditResult.SUCCESS);
      expect(auditEvent!.changes).toEqual({
        name: { before: null, after: 'Audit Create Co' },
        industry: { before: null, after: 'Tech' },
      });
    });

    it('should roll back company creation on audit failure', async () => {
      const userId = `audit-user-fail-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-user-fail-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });

      const originalRecordInTransaction = companiesService['auditService'].recordInTransaction.bind(companiesService['auditService']);
      companiesService['auditService'].recordInTransaction = jest.fn(async () => {
        throw new Error('Simulated audit failure');
      });

      await expect(
        companiesService.create(
          { name: 'Audit Fail Co' },
          userId,
          `audit-user-fail-${Date.now()}@test.com`,
          'USER',
        ),
      ).rejects.toThrow('Unable to create company');

      const company = await prisma.prisma.company.findFirst({
        where: { name: 'Audit Fail Co' },
      });
      expect(company).toBeNull();

      const membership = await prisma.prisma.companyMember.findFirst({
        where: { userId },
      });
      expect(membership).toBeNull();

      companiesService['auditService'].recordInTransaction = originalRecordInTransaction;
    });
  });

  describe('company update audit', () => {
    it('should update company and create audit event atomically', async () => {
      const userId = `audit-user-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-user-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Old Name', industry: 'Tech', ownerId: userId },
      });

      await prisma.prisma.companyMember.create({
        data: { userId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      accessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const updated = await companiesService.update(
        userId,
        'USER',
        company.id,
        { name: 'New Name' },
        `audit-user-${Date.now()}@test.com`,
      );

      expect(updated.name).toBe('New Name');

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.COMPANY_UPDATE, resourceId: company.id },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.changes).toEqual({
        name: { before: 'Old Name', after: 'New Name' },
      });
    });

    it('should not create audit event when no changes', async () => {
      const userId = `audit-user-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-user-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Same Name', industry: 'Tech', ownerId: userId },
      });

      await prisma.prisma.companyMember.create({
        data: { userId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      accessService.requireCompanyWrite.mockResolvedValue({ role: 'OWNER' });

      const updated = await companiesService.update(
        userId,
        'USER',
        company.id,
        { name: 'Same Name' },
        `audit-user-${Date.now()}@test.com`,
      );

      expect(updated.name).toBe('Same Name');

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.COMPANY_UPDATE, resourceId: company.id },
      });

      expect(auditEvent).toBeNull();
    });
  });

  describe('company delete audit', () => {
    it('should delete company and preserve audit event', async () => {
      const userId = `audit-user-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-user-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Delete Co', industry: 'Tech', ownerId: userId },
      });

      await prisma.prisma.companyMember.create({
        data: { userId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await companiesService.remove(userId, 'ADMIN', company.id, `audit-user-${Date.now()}@test.com`);

      const deletedCompany = await prisma.prisma.company.findUnique({
        where: { id: company.id },
      });
      expect(deletedCompany).toBeNull();

      const members = await prisma.prisma.companyMember.findMany({
        where: { companyId: company.id },
      });
      expect(members).toHaveLength(0);

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.COMPANY_DELETE, resourceId: company.id },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.metadata).toEqual({
        companyName: 'Delete Co',
        memberCount: 1,
        statementCount: 0,
      });
    });

    it('should roll back delete on audit failure', async () => {
      const userId = `audit-user-fail-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-user-fail-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Delete Fail Co', industry: 'Tech', ownerId: userId },
      });

      await prisma.prisma.companyMember.create({
        data: { userId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      const originalRecordInTransaction = companiesService['auditService'].recordInTransaction.bind(companiesService['auditService']);
      companiesService['auditService'].recordInTransaction = jest.fn(async () => {
        throw new Error('Simulated audit failure');
      });

      await expect(
        companiesService.remove(userId, 'ADMIN', company.id, `audit-user-fail-${Date.now()}@test.com`),
      ).rejects.toThrow('Company not found');

      const deletedCompany = await prisma.prisma.company.findUnique({
        where: { id: company.id },
      });
      expect(deletedCompany).not.toBeNull();

      companiesService['auditService'].recordInTransaction = originalRecordInTransaction;
    });
  });

  describe('member add audit', () => {
    it('should add member and create audit event atomically', async () => {
      const now = Date.now();
      const ownerId = `audit-owner-${now}`;
      const memberId = `audit-member-${now}`;
      await prisma.prisma.user.create({
        data: { id: ownerId, email: `audit-owner-${now}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Member Add Co', industry: 'Tech', ownerId: ownerId },
      });

      await prisma.prisma.companyMember.create({
        data: { userId: ownerId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await prisma.prisma.user.create({
        data: { id: memberId, email: `member-${now}@test.com`, password: 'hash', role: 'USER' },
      });

      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });

      const membership = await companyMembersService.addMember(
        ownerId,
        'USER',
        company.id,
        { email: `member-${now}@test.com`, role: 'EDITOR' },
        `audit-owner-${now}@test.com`,
      );

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.MEMBER_ADD, resourceId: membership.id },
      });

      expect(membership.role).toBe('EDITOR');
      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.changes).toEqual({
        targetUserId: { before: null, after: memberId },
        targetEmail: { before: null, after: `member-${now}@test.com` },
        assignedRole: { before: null, after: 'EDITOR' },
      });
    });
  });

  describe('member role update audit', () => {
    it('should update role and create audit event atomically', async () => {
      const ownerId = `audit-owner-${Date.now()}`;
      const memberId = `audit-member-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: ownerId, email: `audit-owner-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Role Update Co', industry: 'Tech', ownerId: ownerId },
      });

      const ownerMembership = await prisma.prisma.companyMember.create({
        data: { userId: ownerId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await prisma.prisma.user.create({
        data: { id: memberId, email: `member-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });

      const memberMembership = await prisma.prisma.companyMember.create({
        data: { userId: memberId, companyId: company.id, role: $Enums.CompanyMemberRole.EDITOR },
      });

      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });

      const updated = await companyMembersService.updateMemberRole(
        ownerId,
        'USER',
        company.id,
        memberMembership.id,
        { role: 'VIEWER' },
        `audit-owner-${Date.now()}@test.com`,
      );

      expect(updated.role).toBe('VIEWER');

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.MEMBER_ROLE_UPDATE, resourceId: memberMembership.id },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.changes).toEqual({
        role: { before: 'EDITOR', after: 'VIEWER' },
      });
    });
  });

  describe('member remove audit', () => {
    it('should remove member and create audit event atomically', async () => {
      const now = Date.now();
      const ownerId = `audit-owner-${now}`;
      const memberId = `audit-member-${now}`;
      await prisma.prisma.user.create({
        data: { id: ownerId, email: `audit-owner-${now}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Remove Member Co', industry: 'Tech', ownerId: ownerId },
      });

      await prisma.prisma.companyMember.create({
        data: { userId: ownerId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await prisma.prisma.user.create({
        data: { id: memberId, email: `member-${now}@test.com`, password: 'hash', role: 'USER' },
      });

      const memberMembership = await prisma.prisma.companyMember.create({
        data: { userId: memberId, companyId: company.id, role: $Enums.CompanyMemberRole.EDITOR },
      });

      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });

      await companyMembersService.removeMember(
        ownerId,
        'USER',
        company.id,
        memberMembership.id,
        `audit-owner-${now}@test.com`,
      );

      const deletedMembership = await prisma.prisma.companyMember.findUnique({
        where: { id: memberMembership.id },
      });
      expect(deletedMembership).toBeNull();

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.MEMBER_REMOVE, resourceId: memberMembership.id },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.changes).toEqual({
        targetUserId: { before: memberId, after: null },
        targetEmail: { before: `member-${now}@test.com`, after: null },
        previousRole: { before: 'EDITOR', after: null },
      });
    });
  });

  describe('self-leave audit', () => {
    it('should allow EDITOR to leave and create audit event', async () => {
      const now = Date.now();
      const userId = `audit-user-${now}`;
      const ownerId = `audit-owner-${now}`;
      await prisma.prisma.user.create({
        data: { id: ownerId, email: `audit-owner-${now}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Self Leave Co', industry: 'Tech', ownerId },
      });

      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-user-${now}@test.com`, password: 'hash', role: 'USER' },
      });

      const editorMembership = await prisma.prisma.companyMember.create({
        data: { userId, companyId: company.id, role: $Enums.CompanyMemberRole.EDITOR },
      });

      await companyMembersService.removeSelf(userId, company.id, `audit-user-${now}@test.com`);

      const deletedMembership = await prisma.prisma.companyMember.findUnique({
        where: { id: editorMembership.id },
      });
      expect(deletedMembership).toBeNull();

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.MEMBER_SELF_LEAVE, resourceId: editorMembership.id },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.changes).toEqual({
        targetUserId: { before: userId, after: null },
        targetEmail: { before: `audit-user-${now}@test.com`, after: null },
        previousRole: { before: 'EDITOR', after: null },
      });
    });
  });

  describe('ownership transfer audit', () => {
    it('should transfer ownership and create audit event atomically', async () => {
      const now = Date.now();
      const ownerId = `audit-owner-${now}`;
      const targetId = `audit-target-${now}`;
      await prisma.prisma.user.create({
        data: { id: ownerId, email: `audit-owner-${now}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Transfer Co', industry: 'Tech', ownerId: ownerId },
      });

      const ownerMembership = await prisma.prisma.companyMember.create({
        data: { userId: ownerId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await prisma.prisma.user.create({
        data: { id: targetId, email: `target-${now}@test.com`, password: 'hash', role: 'USER' },
      });

      const targetMembership = await prisma.prisma.companyMember.create({
        data: { userId: targetId, companyId: company.id, role: $Enums.CompanyMemberRole.EDITOR },
      });

      const result = await companyMembersService.transferOwnership(
        ownerId,
        'USER',
        company.id,
        { memberId: targetMembership.id },
        `audit-owner-${now}@test.com`,
      );

      expect(result.company.ownerId).toBe(targetId);
      expect(result.previousOwner.role).toBe('EDITOR');
      expect(result.newOwner.role).toBe('OWNER');

      const updatedCompany = await prisma.prisma.company.findUnique({
        where: { id: company.id },
      });
      expect(updatedCompany!.ownerId).toBe(targetId);

      const updatedOwnerMembership = await prisma.prisma.companyMember.findUnique({
        where: { id: ownerMembership.id },
      });
      expect(updatedOwnerMembership!.role).toBe($Enums.CompanyMemberRole.EDITOR);

      const updatedTargetMembership = await prisma.prisma.companyMember.findUnique({
        where: { id: targetMembership.id },
      });
      expect(updatedTargetMembership!.role).toBe($Enums.CompanyMemberRole.OWNER);

      const ownerCount = await prisma.prisma.companyMember.count({
        where: { companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });
      expect(ownerCount).toBe(1);

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.OWNERSHIP_TRANSFER, resourceId: company.id },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.changes).toEqual({
        ownerId: { before: ownerId, after: targetId },
      });
      expect(auditEvent!.metadata).toEqual({
        companyName: null,
        previousOwnerEmail: `audit-owner-${now}@test.com`,
        newOwnerEmail: `target-${now}@test.com`,
        previousOwnerMemberId: ownerMembership.id,
        newOwnerMemberId: targetMembership.id,
      });
    });
  });

  describe('actor snapshots', () => {
    it('should record actor identity in audit events', async () => {
      const now = Date.now();
      const userId = `audit-actor-${now}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-actor-${now}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Actor Co', industry: 'Tech', ownerId: userId },
      });

      await prisma.prisma.companyMember.create({
        data: { userId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      const memberId = `audit-member-${now}`;
      await prisma.prisma.user.create({
        data: { id: memberId, email: `member-${now}@test.com`, password: 'hash', role: 'USER' },
      });

      accessService.requireCompanyOwnerOrAdmin.mockResolvedValue({ role: 'OWNER' });

      const membership = await companyMembersService.addMember(
        userId,
        'USER',
        company.id,
        { email: `member-${now}@test.com`, role: 'VIEWER' },
        `actor-${now}@test.com`,
      );

      const auditEvent = await prisma.prisma.auditEvent.findFirst({
        where: { action: AuditAction.MEMBER_ADD, resourceId: membership.id },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditEvent).not.toBeNull();
      expect(auditEvent!.actorType).toBe(AuditActorType.USER);
      expect(auditEvent!.actorUserId).toBe(userId);
      expect(auditEvent!.actorEmail).toBe(`actor-${now}@test.com`);
      expect(auditEvent!.actorGlobalRole).toBe('USER');
    });
  });

  describe('one event per operation', () => {
    it('should create exactly one COMPANY_CREATE event', async () => {
      const userId = `audit-one-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-one-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });

      const company = await companiesService.create(
        { name: 'One Event Co' },
        userId,
        `audit-one-${Date.now()}@test.com`,
        'USER',
      );

      const count = await prisma.prisma.auditEvent.count({
        where: { action: AuditAction.COMPANY_CREATE, resourceId: company.id },
      });

      expect(count).toBe(1);
    });

    it('should not create MEMBER_ADD for auto-OWNER creation', async () => {
      const userId = `audit-one-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: userId, email: `audit-one-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });

      const company = await companiesService.create(
        { name: 'One Event Co 2' },
        userId,
        `audit-one-${Date.now()}@test.com`,
        'USER',
      );

      const memberAddCount = await prisma.prisma.auditEvent.count({
        where: { action: AuditAction.MEMBER_ADD, companyId: company.id },
      });

      expect(memberAddCount).toBe(0);
    });
  });

  describe('owner invariant', () => {
    it('should preserve exactly one OWNER after transfer', async () => {
      const ownerId = `audit-owner-${Date.now()}`;
      const targetId = `audit-target-${Date.now()}`;
      await prisma.prisma.user.create({
        data: { id: ownerId, email: `audit-owner-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Invariant Co', industry: 'Tech', ownerId: ownerId },
      });

      await prisma.prisma.companyMember.create({
        data: { userId: ownerId, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await prisma.prisma.user.create({
        data: { id: targetId, email: `target-${Date.now()}@test.com`, password: 'hash', role: 'USER' },
      });

      const targetMembership = await prisma.prisma.companyMember.create({
        data: { userId: targetId, companyId: company.id, role: $Enums.CompanyMemberRole.EDITOR },
      });

      await companyMembersService.transferOwnership(
        ownerId,
        'USER',
        company.id,
        { memberId: targetMembership.id },
        `audit-owner-${Date.now()}@test.com`,
      );

      const ownerCount = await prisma.prisma.companyMember.count({
        where: { companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });
      expect(ownerCount).toBe(1);
    });
  });
});
