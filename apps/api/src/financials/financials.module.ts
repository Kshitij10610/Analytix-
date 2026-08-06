import { Module } from '@nestjs/common';
import { FinancialsController } from './financials.controller';
import { FinancialsService } from './financials.service';
import { LineItemsController } from './line-items.controller';
import { LineItemsService } from './line-items.service';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule, PrismaModule],
  controllers: [FinancialsController, LineItemsController],
  providers: [FinancialsService, LineItemsService],
  exports: [FinancialsService, LineItemsService],
})
export class FinancialsModule {}
