import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prismaService: PrismaService) {}

  async check() {
    try {
      await this.prismaService.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }
}
