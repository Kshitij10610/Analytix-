import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { $Enums } from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanyAccessService {
  constructor(private readonly prismaService: PrismaService) {}

  async requireCompanyRead(userId: string, companyId: string, userRole: string) {
    if (userRole === 'ADMIN') {
      return;
    }

    const isOwner = await this.prismaService.prisma.company.findFirst({
      where: { id: companyId, ownerId: userId },
      select: { id: true },
    });

    if (isOwner) {
      return isOwner;
    }

    const membership = await this.prismaService.prisma.companyMember.findFirst({
      where: { userId, companyId },
    });

    if (!membership) {
      throw new NotFoundException('Company not found');
    }

    return { id: companyId };
  }

  async requireCompanyWrite(userId: string, companyId: string, userRole: string) {
    if (userRole === 'ADMIN') {
      return;
    }

    const membership = await this.prismaService.prisma.companyMember.findFirst({
      where: {
        userId,
        company: {
          id: companyId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Company not found');
    }

    if (membership.role === $Enums.CompanyMemberRole.VIEWER) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return membership;
  }

  async requireCompanyOwnerOrAdmin(userId: string, companyId: string, userRole: string) {
    if (userRole === 'ADMIN') {
      return;
    }

    const membership = await this.prismaService.prisma.companyMember.findFirst({
      where: {
        userId,
        company: {
          id: companyId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Company not found');
    }

    if (membership.role !== $Enums.CompanyMemberRole.OWNER) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return membership;
  }

  buildScopedCompanyWhere(userId: string, userRole: string) {
    if (userRole === 'ADMIN') {
      return {};
    }

    return {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: { userId },
          },
        },
      ],
    } as any;
  }
}
