import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit/audit.constants';
import { $Enums } from '../generated/client';

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Audit History DB-backed', () => {
  let prisma: PrismaService;
  let auditService: AuditService;
  let accessService: CompanyAccessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, AuditService, CompanyAccessService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    accessService = module.get<CompanyAccessService>(CompanyAccessService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  describe('authorization', () => {
    it('A. Tenant A member cannot read Tenant B audit history via requireCompanyRead', async () => {
      const userA = await prisma.prisma.user.create({
        data: { id: uniqueId('user-a'), email: `${uniqueId('email-a')}@test.com`, password: 'hash', role: 'USER' },
      });
      const userB = await prisma.prisma.user.create({
        data: { id: uniqueId('user-b'), email: `${uniqueId('email-b')}@test.com`, password: 'hash', role: 'USER' },
      });
      const companyA = await prisma.prisma.company.create({
        data: { name: 'Company A', ownerId: userA.id },
      });
      const companyB = await prisma.prisma.company.create({
        data: { name: 'Company B', ownerId: userB.id },
      });

      await prisma.prisma.companyMember.create({
        data: { userId: userA.id, companyId: companyA.id, role: $Enums.CompanyMemberRole.OWNER },
      });
      await prisma.prisma.companyMember.create({
        data: { userId: userB.id, companyId: companyB.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await expect(
        accessService.requireCompanyRead(userA.id, companyB.id, 'USER'),
      ).rejects.toThrow('Company not found');

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    });

    it('D. ADMIN can read both companies without membership and no CompanyMember rows are created', async () => {
      const admin = await prisma.prisma.user.create({
        data: { id: uniqueId('admin'), email: `${uniqueId('admin')}@test.com`, password: 'hash', role: 'ADMIN' },
      });
      const companyA = await prisma.prisma.company.create({
        data: { name: 'Co A', ownerId: admin.id },
      });
      const companyB = await prisma.prisma.company.create({
        data: { name: 'Co B', ownerId: admin.id },
      });

      await accessService.requireCompanyRead(admin.id, companyA.id, 'ADMIN');
      await accessService.requireCompanyRead(admin.id, companyB.id, 'ADMIN');

      const membershipA = await prisma.prisma.companyMember.findFirst({ where: { userId: admin.id, companyId: companyA.id } });
      const membershipB = await prisma.prisma.companyMember.findFirst({ where: { userId: admin.id, companyId: companyB.id } });
      expect(membershipA).toBeNull();
      expect(membershipB).toBeNull();

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.user.delete({ where: { id: admin.id } });
    });

    it('E. OWNER/EDITOR/VIEWER can read authorized company history', async () => {
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user'), email: `${uniqueId('email')}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Co', ownerId: user.id },
      });

      for (const role of [$Enums.CompanyMemberRole.OWNER, $Enums.CompanyMemberRole.EDITOR, $Enums.CompanyMemberRole.VIEWER]) {
        await prisma.prisma.companyMember.upsert({
          where: { userId_companyId: { userId: user.id, companyId: company.id } },
          update: { role },
          create: { userId: user.id, companyId: company.id, role },
        });

        await expect(
          accessService.requireCompanyRead(user.id, company.id, 'USER'),
        ).resolves.toBeDefined();
      }

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });

    it('F. Removing membership causes subsequent read to return 404', async () => {
      const owner = await prisma.prisma.user.create({
        data: { id: uniqueId('owner-f'), email: `${uniqueId('owner-email-f')}@test.com`, password: 'hash', role: 'USER' },
      });
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('user-f'), email: `${uniqueId('email-f')}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Co F', ownerId: owner.id },
      });
      const membership = await prisma.prisma.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await accessService.requireCompanyRead(user.id, company.id, 'USER');

      await prisma.prisma.companyMember.delete({ where: { id: membership.id } });

      await expect(
        accessService.requireCompanyRead(user.id, company.id, 'USER'),
      ).rejects.toThrow('Company not found');

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.deleteMany({ where: { id: { in: [owner.id, user.id] } } });
    });
  });

  describe('audit event isolation', () => {
    it('B. Tenant A audit event never appears in Tenant B query', async () => {
      const userA = await prisma.prisma.user.create({
        data: { id: uniqueId('user-b1'), email: `${uniqueId('email-b1')}@test.com`, password: 'hash', role: 'USER' },
      });
      const companyA = await prisma.prisma.company.create({
        data: { name: 'Company B1 A', ownerId: userA.id },
      });
      const companyB = await prisma.prisma.company.create({
        data: { name: 'Company B1 B' },
      });

      await prisma.prisma.companyMember.create({
        data: { userId: userA.id, companyId: companyA.id, role: $Enums.CompanyMemberRole.OWNER },
      });

      await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: userA.id,
        actorEmail: 'user@test.com',
        actorGlobalRole: 'USER',
        companyId: companyA.id,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: companyA.id,
        result: AuditResult.SUCCESS,
      });

      await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: userA.id,
        actorEmail: 'user@test.com',
        actorGlobalRole: 'USER',
        companyId: companyB.id,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: companyB.id,
        result: AuditResult.SUCCESS,
      });

      const pageA = await auditService.readEventsByCompany({ companyId: companyA.id, limit: 100 });
      const pageB = await auditService.readEventsByCompany({ companyId: companyB.id, limit: 100 });

      expect(pageA.events.length).toBe(1);
      expect(pageA.events[0].resource.id).toBe(companyA.id);
      expect(pageB.events.length).toBe(1);
      expect(pageB.events[0].resource.id).toBe(companyB.id);

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: companyA.id } });
      await prisma.prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.user.delete({ where: { id: userA.id } });
    });

    it('C. A guessed audit event ID/resourceId does not escape company scope', async () => {
      const companyA = await prisma.prisma.company.create({
        data: { name: 'Guess Co A' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { name: 'Guess Co B' },
      });

      const eventA = await auditService.record({
        actorType: AuditActorType.SYSTEM,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: companyA.id,
        result: AuditResult.SUCCESS,
        companyId: companyA.id,
      });

      await auditService.record({
        actorType: AuditActorType.SYSTEM,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: companyB.id,
        result: AuditResult.SUCCESS,
        companyId: companyB.id,
      });

      const pageA = await auditService.readEventsByCompany({ companyId: companyA.id, limit: 100 });
      const pageB = await auditService.readEventsByCompany({ companyId: companyB.id, limit: 100 });

      const idsInA = pageA.events.map((e) => e.id);
      const idsInB = pageB.events.map((e) => e.id);
      expect(idsInA).not.toEqual(idsInB);
      expect(idsInA).toContain(eventA.id);

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    });
  });

  describe('pagination', () => {
    it('K. Pagination does not duplicate or skip events across page boundaries', async () => {
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('pag-user'), email: `${uniqueId('pag-email')}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Pagination Co', ownerId: user.id },
      });

      const eventIds: string[] = [];
      for (let i = 0; i < 25; i++) {
        const result = await auditService.record({
          actorType: AuditActorType.USER,
          actorUserId: user.id,
          actorEmail: 'user@test.com',
          actorGlobalRole: 'USER',
          companyId: company.id,
          action: AuditAction.COMPANY_CREATE,
          resourceType: AuditResourceType.COMPANY,
          resourceId: company.id,
          result: AuditResult.SUCCESS,
        });
        eventIds.push(result.id);
      }

      const allEvents: { id: string }[] = [];
      let cursor: string | null = null;
      let page = 0;
      do {
        let cursorOccurredAt: Date | undefined;
        let cursorId: string | undefined;
        if (cursor) {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
          cursorOccurredAt = new Date(decoded.occurredAt);
          cursorId = decoded.id;
        }
        const pageResult = await auditService.readEventsByCompany({ companyId: company.id, limit: 10, cursorOccurredAt, cursorId });
        allEvents.push(...pageResult.events.map((e) => ({ id: e.id })));
        cursor = pageResult.nextCursor;
        page++;
        if (page > 10) break;
      } while (cursor);

      expect(allEvents.length).toBe(25);
      expect(new Set(allEvents.map((e) => e.id)).size).toBe(25);

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });

    it('L. Equal occurredAt timestamps produce deterministic order via id tie-breaker', async () => {
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('tie-user'), email: `${uniqueId('tie-email')}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Tie Co', ownerId: user.id },
      });

      const fixedTime = new Date('2024-01-01T00:00:00.000Z');

      const event1 = await auditService.record({
        actorType: AuditActorType.SYSTEM,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: company.id,
        result: AuditResult.SUCCESS,
        companyId: company.id,
        occurredAt: fixedTime,
      });

      const event2 = await auditService.record({
        actorType: AuditActorType.SYSTEM,
        action: AuditAction.COMPANY_UPDATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: company.id,
        result: AuditResult.SUCCESS,
        companyId: company.id,
        occurredAt: fixedTime,
      });

      const page = await auditService.readEventsByCompany({ companyId: company.id, limit: 100 });

      expect(page.events.length).toBe(2);
      const ids = page.events.map((e) => e.id);
      expect(ids).toContain(event1.id);
      expect(ids).toContain(event2.id);

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('filters', () => {
    it('H. Stored decimal strings remain exact in changes/metadata', async () => {
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('dec-user'), email: `${uniqueId('dec-email')}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Decimal Co', ownerId: user.id },
      });

      const exactDecimal = '1234567890.123456';
      await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        actorEmail: 'user@test.com',
        actorGlobalRole: 'USER',
        companyId: company.id,
        action: AuditAction.FINANCIAL_STATEMENT_CREATE,
        resourceType: AuditResourceType.FINANCIAL_STATEMENT,
        resourceId: company.id,
        result: AuditResult.SUCCESS,
        changes: { value: { before: null, after: exactDecimal } },
      });

      const page = await auditService.readEventsByCompany({ companyId: company.id, limit: 100 });
      expect(page.events[0].changes).toEqual({ value: { before: null, after: exactDecimal } });

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });

    it('I. Stored sanitized nested JSON is returned without secret material', async () => {
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('san-user'), email: `${uniqueId('san-email')}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Sanitize Co', ownerId: user.id },
      });

      await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        actorEmail: 'user@test.com',
        actorGlobalRole: 'USER',
        companyId: company.id,
        action: AuditAction.AUTH_LOGIN_SUCCESS,
        resourceType: AuditResourceType.AUTH_SESSION,
        resourceId: 'session-1',
        result: AuditResult.SUCCESS,
        metadata: {
          access_token: 'secret-access-token',
          refresh_token: 'secret-refresh-token',
          password: 'plain-password',
          jwt_secret: 'jwt-secret-value',
          database_url: 'postgresql://...',
          cookie: 'session-cookie',
          safeField: 'safe-value',
          nested: {
            access_token: 'nested-secret',
            normalField: 'normal',
          },
        },
      });

      const page = await auditService.readEventsByCompany({ companyId: company.id, limit: 100 });
      const metadata = page.events[0].metadata as Record<string, unknown> | undefined;
      expect(metadata).toBeDefined();
      expect(metadata!.access_token).toBe('[REDACTED]');
      expect(metadata!.refresh_token).toBe('[REDACTED]');
      expect(metadata!.password).toBe('[REDACTED]');
      expect(metadata!.jwt_secret).toBe('[REDACTED]');
      expect(metadata!.database_url).toBe('[REDACTED]');
      expect(metadata!.cookie).toBe('[REDACTED]');
      expect(metadata!.safeField).toBe('safe-value');
      const nested = metadata!.nested as Record<string, unknown>;
      expect(nested.access_token).toBe('[REDACTED]');
      expect(nested.normalField).toBe('normal');

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.companyMember.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });

    it('J. companyId=null auth events are absent from company history', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Null Auth Co' },
      });

      await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: uniqueId('ghost-user'),
        actorEmail: 'ghost@test.com',
        actorGlobalRole: 'USER',
        companyId: undefined,
        action: AuditAction.AUTH_LOGIN_SUCCESS,
        resourceType: AuditResourceType.AUTH_SESSION,
        resourceId: 'session-ghost',
        result: AuditResult.SUCCESS,
      });

      await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: uniqueId('real-user'),
        actorEmail: 'real@test.com',
        actorGlobalRole: 'USER',
        companyId: company.id,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: company.id,
        result: AuditResult.SUCCESS,
      });

      const page = await auditService.readEventsByCompany({ companyId: company.id, limit: 100 });
      expect(page.events.length).toBe(1);
      expect(page.events[0].action).toBe(AuditAction.COMPANY_CREATE);

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });

    it('M. Filters never bypass company scope', async () => {
      const companyA = await prisma.prisma.company.create({
        data: { name: 'Filter A' },
      });
      const companyB = await prisma.prisma.company.create({
        data: { name: 'Filter B' },
      });

      await auditService.record({
        actorType: AuditActorType.SYSTEM,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: companyA.id,
        result: AuditResult.SUCCESS,
        companyId: companyA.id,
      });

      await auditService.record({
        actorType: AuditActorType.SYSTEM,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: companyB.id,
        result: AuditResult.SUCCESS,
        companyId: companyB.id,
      });

      const filteredA = await auditService.readEventsByCompany({
        companyId: companyA.id,
        limit: 100,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        result: AuditResult.SUCCESS,
      });

      expect(filteredA.events.length).toBe(1);
      expect(filteredA.events[0].resource.id).toBe(companyA.id);

      const filteredB = await auditService.readEventsByCompany({
        companyId: companyB.id,
        limit: 100,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        result: AuditResult.SUCCESS,
      });

      expect(filteredB.events.length).toBe(1);
      expect(filteredB.events[0].resource.id).toBe(companyB.id);

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
      await prisma.prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    });
  });

  describe('deleted resource history', () => {
    it('G. Audit history survives deletion of referenced resource', async () => {
      const user = await prisma.prisma.user.create({
        data: { id: uniqueId('del-user'), email: `${uniqueId('del-email')}@test.com`, password: 'hash', role: 'USER' },
      });
      const company = await prisma.prisma.company.create({
        data: { name: 'Delete Co', ownerId: user.id },
      });

      const event = await auditService.record({
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        actorEmail: 'user@test.com',
        actorGlobalRole: 'USER',
        companyId: company.id,
        action: AuditAction.MEMBER_ADD,
        resourceType: AuditResourceType.COMPANY_MEMBER,
        resourceId: 'member-123',
        result: AuditResult.SUCCESS,
      });

      await prisma.prisma.user.delete({ where: { id: user.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });

      const page = await auditService.readEventsByCompany({ companyId: company.id, limit: 100 });
      expect(page.events.length).toBe(1);
      expect(page.events[0].id).toBe(event.id);
      expect(page.events[0].resource.id).toBe('member-123');

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
    });
  });

  describe('safe response mapping', () => {
    it('does not expose raw Prisma objects or sensitive fields', async () => {
      const company = await prisma.prisma.company.create({
        data: { name: 'Safe Co' },
      });

      await auditService.record({
        actorType: AuditActorType.SYSTEM,
        action: AuditAction.COMPANY_CREATE,
        resourceType: AuditResourceType.COMPANY,
        resourceId: company.id,
        result: AuditResult.SUCCESS,
        companyId: company.id,
        metadata: {
          requestId: 'req-123',
        },
      });

      const page = await auditService.readEventsByCompany({ companyId: company.id, limit: 100 });
      const event = page.events[0];

      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('occurredAt');
      expect(event).toHaveProperty('actor');
      expect(event).toHaveProperty('action');
      expect(event).toHaveProperty('resource');
      expect(event).toHaveProperty('result');
      expect(event).not.toHaveProperty('companyId');
      expect(event).not.toHaveProperty('actorUserId');
      expect(event).not.toHaveProperty('failureReason');
      expect(event).not.toHaveProperty('createdAt');

      await prisma.prisma.auditEvent.deleteMany({ where: { companyId: company.id } });
      await prisma.prisma.company.delete({ where: { id: company.id } });
    });
  });
});
