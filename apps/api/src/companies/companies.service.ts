import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: { name: string; industry?: string; website?: string }) {
    try {
      return await this.prismaService.prisma.company.create({
        data,
      });
    } catch {
      throw new ConflictException('Unable to create company');
    }
  }

  async findAll() {
    return await this.prismaService.prisma.company.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prismaService.prisma.company.findUnique({
      where: { id },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(id: string, data: { name?: string; industry?: string; website?: string }) {
    try {
      const company = await this.prismaService.prisma.company.update({
        where: { id },
        data,
      });
      return company;
    } catch {
      throw new NotFoundException('Company not found');
    }
  }

  async remove(id: string) {
    try {
      await this.prismaService.prisma.company.delete({
        where: { id },
      });
      return;
    } catch {
      throw new NotFoundException('Company not found');
    }
  }
}
