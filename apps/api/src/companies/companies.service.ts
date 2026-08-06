import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { AuditActorType, AuditAction, AuditResourceType, AuditResult } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompanyAccessService } from '../authorization/company-access.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly companyAccessService: CompanyAccessService,
    private readonly auditService: AuditService,
  ) {}

  async create(data: { name: string; industry?: string; website?: string }, actorId: string, actorEmail: string, actorGlobalRole: string) {
    try {
      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (data.name !== undefined) changes.name = { before: null, after: data.name };
      if (data.industry !== undefined) changes.industry = { before: null, after: data.industry };
      if (data.website !== undefined) changes.website = { before: null, after: data.website };

      return await this.prismaService.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            ...data,
            ownerId: actorId,
          },
        });

        await tx.companyMember.create({
          data: {
            userId: actorId,
            companyId: company.id,
            role: 'OWNER',
          },
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: actorId,
          actorEmail,
          actorGlobalRole,
          companyId: company.id,
          action: AuditAction.COMPANY_CREATE,
          resourceType: AuditResourceType.COMPANY,
          resourceId: company.id,
          result: AuditResult.SUCCESS,
          changes,
        }, tx as any);

        return company;
      });
    } catch {
      throw new ConflictException('Unable to create company');
    }
  }

  async findAll(userId: string, userRole: string) {
    const where = this.companyAccessService.buildScopedCompanyWhere(userId, userRole);

    return await this.prismaService.prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, userRole: string, id: string) {
    await this.companyAccessService.requireCompanyRead(userId, id, userRole);

    const company = await this.prismaService.prisma.company.findUnique({
      where: { id },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(userId: string, userRole: string, id: string, data: { name?: string; industry?: string; website?: string }, actorEmail: string) {
    await this.companyAccessService.requireCompanyWrite(userId, id, userRole);

    const existing = await this.prismaService.prisma.company.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (data.name !== undefined && data.name !== existing.name) {
      changes.name = { before: existing.name, after: data.name };
    }
    if (data.industry !== undefined && data.industry !== existing.industry) changes.industry = { before: existing.industry, after: data.industry };
    if (data.website !== undefined && data.website !== existing.website) changes.website = { before: existing.website, after: data.website };

    if (Object.keys(changes).length === 0) {
      return existing;
    }

    try {
      return await this.prismaService.prisma.$transaction(async (tx) => {
        const updated = await tx.company.update({
          where: { id },
          data,
        });

        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId: id,
          action: AuditAction.COMPANY_UPDATE,
          resourceType: AuditResourceType.COMPANY,
          resourceId: id,
          result: AuditResult.SUCCESS,
          changes,
        }, tx as any);

        return updated;
      });
    } catch {
      throw new NotFoundException('Company not found');
    }
  }

  async remove(userId: string, userRole: string, id: string, actorEmail: string) {
    try {
      await this.companyAccessService.requireCompanyOwnerOrAdmin(userId, id, userRole);

      const company = await this.prismaService.prisma.company.findUnique({
        where: { id },
        select: { name: true },
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      const memberCount = await this.prismaService.prisma.companyMember.count({
        where: { companyId: id },
      });

      const statementCount = await this.prismaService.prisma.financialStatement.count({
        where: { companyId: id },
      });

      await this.prismaService.prisma.$transaction(async (tx) => {
        await this.auditService.recordInTransaction({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          actorEmail,
          actorGlobalRole: userRole,
          companyId: id,
          action: AuditAction.COMPANY_DELETE,
          resourceType: AuditResourceType.COMPANY,
          resourceId: id,
          result: AuditResult.SUCCESS,
          metadata: {
            companyName: company.name,
            memberCount,
            statementCount,
          },
        }, tx as any);

        await tx.company.delete({
          where: { id },
        });
      });
    } catch {
      throw new NotFoundException('Company not found');
    }
  }

  async getCompanyOwner(userId: string, companyId: string, userRole: string): Promise<string | null> {
    await this.companyAccessService.requireCompanyRead(userId, companyId, userRole);

    const company = await this.prismaService.prisma.company.findUnique({
      where: { id: companyId },
      select: { ownerId: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company.ownerId;
  }

  async isCompanyMember(userId: string, companyId: string, userRole: string): Promise<boolean> {
    if (userRole === 'ADMIN') {
      return true;
    }

    const company = await this.prismaService.prisma.company.findUnique({
      where: { id: companyId },
      select: { ownerId: true },
    });
    if (!company) {
      return false;
    }

    if (company.ownerId === userId) {
      return true;
    }

    const membership = await this.prismaService.prisma.companyMember.findFirst({
      where: { userId, companyId },
    });
    return !!membership;
  }
}
