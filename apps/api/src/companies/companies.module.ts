import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyMembersController } from './company-members.controller';
import { CompanyMembersService } from './company-members.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule],
  controllers: [CompaniesController, CompanyMembersController],
  providers: [CompaniesService, CompanyMembersService],
  exports: [CompaniesService, CompanyMembersService],
})
export class CompaniesModule {}
