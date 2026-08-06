import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AuditAction, AuditResourceType, AuditResult, AuditActorType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { $Enums } from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CompanyMemberResponse } from './dto/company-member.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

export interface TransferOwnershipResult {
  company: { id: string; ownerId: string };
  previousOwner: CompanyMemberResponse;
  newOwner: CompanyMemberResponse;
}

@Injectable()
export class CompanyMembersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {}

  async listMembers(userId: string, userRole: string, companyId: string): Promise<CompanyMemberResponse[]> {
    await this.companyAccessService.requireCompanyRead(userId, companyId, userRole);

    const memberships = await this.prismaService.prisma.companyMember.findMany({
      where: { companyId },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const roleOrder: Record<string, number> = { OWNER: 0, EDITOR: 1, VIEWER: 2 };

    return memberships
      .map((m) => ({
        id: m.id,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
        },
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      }))
      .sort((a, b) => {
        const roleDiff = (roleOrder[a.role] ?? 999) - (roleOrder[b.role] ?? 999);
        if (roleDiff !== 0) return roleDiff;
        const dateDiff = a.createdAt.localeCompare(b.createdAt);
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });
  }

  async addMember(userId: string, userRole: string, companyId: string, dto: AddMemberDto, actorEmail: string): Promise<CompanyMemberResponse> {
    await this.companyAccessService.requireCompanyOwnerOrAdmin(userId, companyId, userRole);

    if (dto.role === 'OWNER') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    const targetUser = await this.prismaService.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    try {
      return await this.prismaService.prisma.$transaction(async (tx) => {
        const membership = await tx.companyMember.create({
          data: {
            userId: targetUser.id,
            companyId,
            role: dto.role as $Enums.CompanyMemberRole,
          },
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId,
          action: AuditAction.MEMBER_ADD,
          resourceType: AuditResourceType.COMPANY_MEMBER,
          resourceId: membership.id,
          result: AuditResult.SUCCESS,
          changes: {
            targetUserId: { before: null, after: targetUser.id },
            targetEmail: { before: null, after: targetUser.email },
            assignedRole: { before: null, after: membership.role },
          },
        }, tx);

        return {
          id: membership.id,
          user: {
            id: membership.user.id,
            name: membership.user.name,
            email: membership.user.email,
          },
          role: membership.role,
          createdAt: membership.createdAt.toISOString(),
        };
      });
    } catch (error) {
      const code = (error as unknown as { code?: string }).code;
      if (code === 'P2002') {
        throw new ConflictException('User is already a member of this company');
      }
      throw error;
    }
  }

  async updateMemberRole(
    userId: string,
    userRole: string,
    companyId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
    actorEmail: string,
  ): Promise<CompanyMemberResponse> {
    await this.companyAccessService.requireCompanyOwnerOrAdmin(userId, companyId, userRole);

    const targetMembership = await this.prismaService.prisma.companyMember.findFirst({
      where: {
        id: memberId,
        companyId,
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found');
    }

    if (targetMembership.role === 'OWNER') {
      throw new ConflictException('Company owner role can only be changed through ownership transfer');
    }

    if (targetMembership.role === dto.role) {
      return {
        id: targetMembership.id,
        user: {
          id: targetMembership.user.id,
          name: targetMembership.user.name,
          email: targetMembership.user.email,
        },
        role: targetMembership.role,
        createdAt: targetMembership.createdAt.toISOString(),
      };
    }

    try {
      return await this.prismaService.prisma.$transaction(async (tx) => {
        const updated = await tx.companyMember.update({
          where: { id: memberId },
          data: {
            role: dto.role as $Enums.CompanyMemberRole,
          },
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId,
          action: AuditAction.MEMBER_ROLE_UPDATE,
          resourceType: AuditResourceType.COMPANY_MEMBER,
          resourceId: memberId,
          result: AuditResult.SUCCESS,
          changes: {
            role: {
              before: targetMembership.role,
              after: updated.role,
            },
          },
        }, tx);

        return {
          id: updated.id,
          user: {
            id: updated.user.id,
            name: updated.user.name,
            email: updated.user.email,
          },
          role: updated.role,
          createdAt: updated.createdAt.toISOString(),
        };
      });
    } catch {
      throw new NotFoundException('Member not found');
    }
  }

  async removeMember(userId: string, userRole: string, companyId: string, memberId: string, actorEmail: string): Promise<void> {
    await this.companyAccessService.requireCompanyOwnerOrAdmin(userId, companyId, userRole);

    const targetMembership = await this.prismaService.prisma.companyMember.findFirst({
      where: {
        id: memberId,
        companyId,
      },
      select: { id: true, role: true, user: { select: { id: true, email: true } } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found');
    }

    if (targetMembership.role === 'OWNER') {
      throw new ConflictException('Company owner cannot be removed before ownership is transferred');
    }

    await this.prismaService.prisma.$transaction(async (tx) => {
      await tx.companyMember.delete({
        where: { id: memberId },
      });

      await this.auditService.recordInTransaction({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        actorEmail,
        actorGlobalRole: userRole,
        companyId,
        action: AuditAction.MEMBER_REMOVE,
        resourceType: AuditResourceType.COMPANY_MEMBER,
        resourceId: memberId,
        result: AuditResult.SUCCESS,
        changes: {
          targetUserId: { before: targetMembership.user.id, after: null },
          targetEmail: { before: targetMembership.user.email, after: null },
          previousRole: { before: targetMembership.role, after: null },
        },
      }, tx);
    });
  }

  async removeSelf(userId: string, companyId: string, actorEmail: string): Promise<void> {
    const membership = await this.prismaService.prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
      },
      select: { id: true, role: true, user: { select: { email: true } } },
    });

    if (!membership) {
      throw new NotFoundException('Company not found');
    }

    if (membership.role === 'OWNER') {
      throw new ConflictException('Company owner cannot leave before ownership is transferred');
    }

    await this.prismaService.prisma.$transaction(async (tx) => {
      await tx.companyMember.delete({
        where: { id: membership.id },
      });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          companyId,
          action: AuditAction.MEMBER_SELF_LEAVE,
          resourceType: AuditResourceType.COMPANY_MEMBER,
          resourceId: membership.id,
          result: AuditResult.SUCCESS,
          changes: {
            targetUserId: { before: userId, after: null },
            targetEmail: { before: membership.user.email, after: null },
            previousRole: { before: membership.role, after: null },
          },
        }, tx);
    });
  }

  async transferOwnership(
    userId: string,
    userRole: string,
    companyId: string,
    dto: TransferOwnershipDto,
    actorEmail: string,
  ): Promise<TransferOwnershipResult> {
    const result = await this.prismaService.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, ownerId: true },
      });

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      const callerMembership = await tx.companyMember.findFirst({
        where: { userId, companyId },
        select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
      });

      if (!callerMembership || callerMembership.role !== $Enums.CompanyMemberRole.OWNER) {
        throw new ForbiddenException('Insufficient permissions');
      }

      if (company.ownerId !== userId) {
        throw new ConflictException('Company ownership is in an inconsistent state');
      }

      const targetMembership = await tx.companyMember.findFirst({
        where: { id: dto.memberId, companyId },
        select: { id: true, role: true, createdAt: true, userId: true, user: { select: { id: true, name: true, email: true } } },
      });

      if (!targetMembership) {
        throw new NotFoundException('Member not found');
      }

      if (targetMembership.userId === userId) {
        throw new ConflictException('Target member is already the company owner');
      }

      if (targetMembership.role === $Enums.CompanyMemberRole.OWNER) {
        throw new ConflictException('Target member is already an owner');
      }

      const ownerUpdate = await tx.company.updateMany({
        where: { id: companyId, ownerId: userId },
        data: { ownerId: targetMembership.userId },
      });

      if (ownerUpdate.count !== 1) {
        throw new ConflictException('Ownership transfer failed due to concurrent modification');
      }

      await tx.companyMember.update({
        where: { id: callerMembership.id },
        data: { role: $Enums.CompanyMemberRole.EDITOR },
      });

      const newOwnerMembership = await tx.companyMember.update({
        where: { id: targetMembership.id },
        data: { role: $Enums.CompanyMemberRole.OWNER },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await this.auditService.recordInTransaction({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        actorEmail,
        actorGlobalRole: userRole,
        companyId,
        action: AuditAction.OWNERSHIP_TRANSFER,
        resourceType: AuditResourceType.COMPANY,
        resourceId: companyId,
        result: AuditResult.SUCCESS,
        changes: {
          ownerId: {
            before: userId,
            after: targetMembership.userId,
          },
        },
        metadata: {
          companyName: null,
          previousOwnerEmail: callerMembership.user.email,
          newOwnerEmail: targetMembership.user.email,
          previousOwnerMemberId: callerMembership.id,
          newOwnerMemberId: targetMembership.id,
        },
      }, tx);

      const previousOwnerResponse: CompanyMemberResponse = {
        id: callerMembership.id,
        user: { id: callerMembership.user.id, name: callerMembership.user.name, email: callerMembership.user.email },
        role: 'EDITOR',
        createdAt: callerMembership.createdAt.toISOString(),
      };

      const newOwnerResponse: CompanyMemberResponse = {
        id: newOwnerMembership.id,
        user: { id: newOwnerMembership.user.id, name: newOwnerMembership.user.name, email: newOwnerMembership.user.email },
        role: newOwnerMembership.role,
        createdAt: newOwnerMembership.createdAt.toISOString(),
      };

      return {
        company: { id: company.id, ownerId: targetMembership.userId },
        previousOwner: previousOwnerResponse,
        newOwner: newOwnerResponse,
      };
    });

    return result;
  }
}
