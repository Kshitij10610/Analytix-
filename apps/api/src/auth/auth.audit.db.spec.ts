import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit/audit.constants';
import { $Enums } from '../generated/client';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-auth-audit-db-tests-only-1234567890';

describe('Auth Audit DB-backed', () => {
  let prisma: PrismaService;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, JwtService, AuthService, AuditService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthService>(AuthService);
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  const hashPassword = async (password: string) => {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 4,
    });
  };

  describe('login success audit', () => {
    it('should emit exactly one AUTH_LOGIN_SUCCESS with safe actor snapshot', async () => {
      const hashedPassword = await hashPassword('correctpassword');
      const user = await prisma.prisma.user.create({
        data: {
          email: `auth-audit-${Date.now()}@test.com`,
          password: hashedPassword,
          role: $Enums.Role.USER,
        },
      });

      const result = await authService.login(user.email, 'correctpassword');

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_LOGIN_SUCCESS, actorUserId: user.id },
      });
      expect(auditEvents).toHaveLength(1);

      const event = auditEvents[0];
      expect(event.action).toBe(AuditAction.AUTH_LOGIN_SUCCESS);
      expect(event.resourceType).toBe(AuditResourceType.AUTH_SESSION);
      expect(event.actorUserId).toBe(user.id);
      expect(event.actorEmail).toBe(user.email);
      expect(event.actorGlobalRole).toBe($Enums.Role.USER);
      expect(event.companyId).toBeNull();
      expect(event.result).toBe(AuditResult.SUCCESS);
      expect(event.resourceId).toBeTruthy();
      expect(event.failureReason).toBeNull();
      expect(event.changes).toBeNull();
      expect(event.metadata).toEqual(
        expect.objectContaining({
          email: user.email,
          role: $Enums.Role.USER,
        }),
      );

      const refreshToken = await prisma.prisma.refreshToken.findFirst({
        where: { userId: user.id },
      });
      if (refreshToken) {
        await prisma.prisma.refreshToken.delete({ where: { id: refreshToken.id } });
      }
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('login failure audit', () => {
    it('should not emit AUTH_LOGIN_SUCCESS for wrong password', async () => {
      const hashedPassword = await hashPassword('correctpassword');
      const user = await prisma.prisma.user.create({
        data: {
          email: `auth-audit-${Date.now()}@test.com`,
          password: hashedPassword,
          role: $Enums.Role.USER,
        },
      });

      await expect(
        authService.login(user.email, 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_LOGIN_SUCCESS, actorUserId: user.id },
      });
      expect(auditEvents).toHaveLength(0);

      await prisma.prisma.user.delete({ where: { id: user.id } });
    });

    it('should not emit AUTH_LOGIN_SUCCESS for nonexistent email', async () => {
      const nonexistentEmail = `nonexistent-${Date.now()}@test.com`;
      await expect(
        authService.login(nonexistentEmail, 'password'),
      ).rejects.toThrow(UnauthorizedException);

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_LOGIN_SUCCESS, actorEmail: nonexistentEmail },
      });
      expect(auditEvents).toHaveLength(0);
    });
  });

  describe('refresh success audit', () => {
    it('should emit exactly one AUTH_REFRESH_SUCCESS with token rotation', async () => {
      const user = await prisma.prisma.user.create({
        data: {
          email: `auth-audit-${Date.now()}@test.com`,
          password: 'hash',
          role: $Enums.Role.USER,
        },
      });

      const rawRefreshToken = 'test-refresh-token-1234567890abcdef';
      const tokenHash = authService.hashToken(rawRefreshToken);

      const oldToken = await prisma.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const result = await authService.refresh(rawRefreshToken);

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_REFRESH_SUCCESS, actorUserId: user.id },
      });
      expect(auditEvents).toHaveLength(1);

      const event = auditEvents[0];
      expect(event.action).toBe(AuditAction.AUTH_REFRESH_SUCCESS);
      expect(event.resourceType).toBe(AuditResourceType.AUTH_SESSION);
      expect(event.actorUserId).toBe(user.id);
      expect(event.actorEmail).toBe(user.email);
      expect(event.actorGlobalRole).toBe($Enums.Role.USER);
      expect(event.companyId).toBeNull();
      expect(event.result).toBe(AuditResult.SUCCESS);
      expect(event.resourceId).toBe(oldToken.id);
      expect(event.failureReason).toBeNull();
      expect(event.changes).toBeNull();
      expect(event.metadata).toEqual(
        expect.objectContaining({
          newTokenId: expect.any(String),
        }),
      );
      expect((event.metadata as any).newTokenId).toBeTruthy();

      const tokens = await prisma.prisma.refreshToken.findMany({
        where: { userId: user.id },
      });
      expect(tokens).toHaveLength(2);

      const revoked = tokens.find((t) => t.id === oldToken.id);
      expect(revoked?.revokedAt).not.toBeNull();
      expect(revoked?.replacedById).toBe((event.metadata as any).newTokenId);

      await prisma.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('refresh failure audit', () => {
    const uniqueEmail = `auth-audit-rf-${Date.now()}@test.com`;

    it('should emit AUTH_REFRESH_FAILURE with SYSTEM actor for unknown identity', async () => {
      const beforeCount = await prisma.prisma.auditEvent.count({
        where: { action: AuditAction.AUTH_REFRESH_FAILURE, actorType: AuditActorType.SYSTEM },
      });

      await expect(authService.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: {
          action: AuditAction.AUTH_REFRESH_FAILURE,
          actorType: AuditActorType.SYSTEM,
          occurredAt: { gte: new Date(Date.now() - 60000) },
        },
      });
      expect(auditEvents.length).toBeGreaterThanOrEqual(1);
      expect(auditEvents[auditEvents.length - 1].action).toBe(AuditAction.AUTH_REFRESH_FAILURE);
      expect(auditEvents[auditEvents.length - 1].actorType).toBe(AuditActorType.SYSTEM);
      expect(auditEvents[auditEvents.length - 1].failureReason).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should emit AUTH_REFRESH_FAILURE for expired token with known identity', async () => {
      const hashedPassword = await hashPassword('correctpassword');
      const user = await prisma.prisma.user.create({
        data: {
          email: uniqueEmail,
          password: hashedPassword,
          role: $Enums.Role.USER,
        },
      });

      const rawRefreshToken = `expired-token-${Date.now()}`;
      const tokenHash = authService.hashToken(rawRefreshToken);

      const oldToken = await prisma.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() - 86400000),
        },
      });

      await expect(authService.refresh(rawRefreshToken)).rejects.toThrow(UnauthorizedException);

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_REFRESH_FAILURE, actorUserId: user.id },
      });
      expect(auditEvents.length).toBeGreaterThanOrEqual(1);
      expect(auditEvents[auditEvents.length - 1].actorUserId).toBe(user.id);
      expect(auditEvents[auditEvents.length - 1].resourceId).toBe(oldToken.id);
      expect(auditEvents[auditEvents.length - 1].failureReason).toBe('INVALID_REFRESH_TOKEN');

      await prisma.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('logout audit', () => {
    it('should emit exactly one AUTH_LOGOUT on successful revocation', async () => {
      const user = await prisma.prisma.user.create({
        data: {
          email: `auth-audit-${Date.now()}@test.com`,
          password: 'hash',
          role: $Enums.Role.USER,
        },
      });

      const rawRefreshToken = 'logout-token-1234567890abcdef';
      const tokenHash = authService.hashToken(rawRefreshToken);

      const token = await prisma.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await authService.logout(rawRefreshToken);

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_LOGOUT, actorUserId: user.id },
      });
      expect(auditEvents).toHaveLength(1);

      const event = auditEvents[0];
      expect(event.action).toBe(AuditAction.AUTH_LOGOUT);
      expect(event.resourceType).toBe(AuditResourceType.AUTH_SESSION);
      expect(event.actorUserId).toBe(user.id);
      expect(event.actorEmail).toBe(user.email);
      expect(event.actorGlobalRole).toBe($Enums.Role.USER);
      expect(event.companyId).toBeNull();
      expect(event.result).toBe(AuditResult.SUCCESS);
      expect(event.resourceId).toBe(token.id);
      expect(event.failureReason).toBeNull();
      expect(event.changes).toBeNull();
      expect(event.metadata).toBeNull();

      const revokedToken = await prisma.prisma.refreshToken.findUnique({
        where: { id: token.id },
      });
      expect(revokedToken?.revokedAt).not.toBeNull();

      await prisma.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });

    it('should not emit AUTH_LOGOUT for nonexistent token', async () => {
      await expect(authService.logout('nonexistent-token')).resolves.toBeUndefined();

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_LOGOUT, actorEmail: null },
      });
      expect(auditEvents).toHaveLength(0);
    });
  });

  describe('audit event survival', () => {
    it('should retain auth audit events after user deletion', async () => {
      const user = await prisma.prisma.user.create({
        data: {
          email: `auth-audit-${Date.now()}@test.com`,
          password: 'hash',
          role: $Enums.Role.USER,
        },
      });

      const rawRefreshToken = 'survival-token-1234567890abcdef';
      const tokenHash = authService.hashToken(rawRefreshToken);

      const token = await prisma.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await authService.logout(rawRefreshToken);

      const auditEventsBefore = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_LOGOUT, resourceId: token.id },
      });
      expect(auditEventsBefore).toHaveLength(1);

      await prisma.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.prisma.user.delete({ where: { id: user.id } });

      const auditEventsAfter = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_LOGOUT, resourceId: token.id },
      });
      expect(auditEventsAfter).toHaveLength(1);
      expect(auditEventsAfter[0].actorUserId).toBe(user.id);
    });
  });

  describe('audit sanitization', () => {
    it('should not persist raw tokens or passwords in auth audit events', async () => {
      const hashedPassword = await hashPassword('secret-password');
      const user = await prisma.prisma.user.create({
        data: {
          email: `auth-audit-${Date.now()}@test.com`,
          password: hashedPassword,
          role: $Enums.Role.USER,
        },
      });

      const rawRefreshToken = 'secret-token-1234567890abcdef';
      const tokenHash = authService.hashToken(rawRefreshToken);

      await prisma.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await authService.login(user.email, 'secret-password');

      const auditEvents = await prisma.prisma.auditEvent.findMany({
        where: { action: AuditAction.AUTH_LOGIN_SUCCESS, actorUserId: user.id },
      });
      expect(auditEvents).toHaveLength(1);

      const event = auditEvents[0];
      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain(rawRefreshToken);
      expect(serialized).not.toContain('secret-password');
      expect(event.metadata).not.toHaveProperty('password');
      expect(event.metadata).not.toHaveProperty('accessToken');
      expect(event.metadata).not.toHaveProperty('refreshToken');

      const token = await prisma.prisma.refreshToken.findFirst({
        where: { userId: user.id },
      });
      if (token) {
        await prisma.prisma.refreshToken.delete({ where: { id: token.id } });
      }
      await prisma.prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('development DB isolation', () => {
    it('should not create audit events for failed login', async () => {
      const beforeCount = await prisma.prisma.auditEvent.count();

      await expect(authService.login('nonexistent@test.com', 'password')).rejects.toThrow(UnauthorizedException);

      const afterCount = await prisma.prisma.auditEvent.count();
      expect(afterCount).toBe(beforeCount);
    });
  });
});
