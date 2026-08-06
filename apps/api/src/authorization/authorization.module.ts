import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompanyAccessService } from './company-access.service';

@Module({
  imports: [PrismaModule],
  providers: [CompanyAccessService],
  exports: [CompanyAccessService],
})
export class AuthorizationModule {}
