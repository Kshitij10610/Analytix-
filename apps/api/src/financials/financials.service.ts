import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type FinancialStatementType = 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';

@Injectable()
export class FinancialsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(companyId: string, data: { type: FinancialStatementType; periodStart: Date; periodEnd: Date }) {
    if (data.periodEnd < data.periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }

    const company = await this.prismaService.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    try {
      return await this.prismaService.prisma.financialStatement.create({
        data: {
          ...data,
          companyId,
        },
        include: { company: true },
      });
    } catch {
      throw new ConflictException('Unable to create financial statement');
    }
  }

  async findByCompany(companyId: string) {
    const company = await this.prismaService.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return await this.prismaService.prisma.financialStatement.findMany({
      where: { companyId },
      orderBy: { periodStart: 'desc' },
      include: { company: true },
    });
  }

  async findOne(id: string) {
    const statement = await this.prismaService.prisma.financialStatement.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!statement) {
      throw new NotFoundException('Financial statement not found');
    }
    return statement;
  }

  async update(
    id: string,
    data: { type?: FinancialStatementType; periodStart?: Date; periodEnd?: Date },
  ) {
    if (data.periodStart && data.periodEnd && data.periodEnd < data.periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }

    try {
      return await this.prismaService.prisma.financialStatement.update({
        where: { id },
        data: {
          ...(data.type ? { type: data.type } : {}),
          ...(data.periodStart ? { periodStart: data.periodStart } : {}),
          ...(data.periodEnd ? { periodEnd: data.periodEnd } : {}),
        },
        include: { company: true },
      });
    } catch {
      throw new NotFoundException('Financial statement not found');
    }
  }

  async remove(id: string) {
    try {
      await this.prismaService.prisma.financialStatement.delete({
        where: { id },
      });
      return;
    } catch {
      throw new NotFoundException('Financial statement not found');
    }
  }
}
