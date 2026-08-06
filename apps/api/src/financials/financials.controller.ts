import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFinancialStatementDto } from './dto/create-financial-statement.dto';
import { CreateStatementWithLineItemsDto } from './dto/create-statement-with-line-items.dto';
import { UpdateFinancialStatementDto } from './dto/update-financial-statement.dto';
import { FinancialsService } from './financials.service';

type FinancialStatementType = 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';
type FinancialPeriodType = 'ANNUAL' | 'QUARTERLY' | 'TTM';
type FinancialScale = 'ONES' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';
type FinancialDataSourceType = 'MANUAL' | 'CSV_IMPORT' | 'API' | 'AI_EXTRACTED';

type StatementData = {
  type: FinancialStatementType;
  periodStart: Date;
  periodEnd: Date;
  fiscalYear: number;
  fiscalQuarter?: number;
  periodType: FinancialPeriodType;
  currency: string;
  scale: FinancialScale;
  sourceType?: FinancialDataSourceType;
  sourceReference?: string;
  importedAt?: Date;
  importedBy?: string | null;
};

type UpdateData = Partial<StatementData>;

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class FinancialsController {
  constructor(private readonly financialsService: FinancialsService) {}

  @Post('companies/:companyId/financial-statements')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async createForCompany(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Body() dto: CreateStatementWithLineItemsDto,
  ) {
    const data: StatementData = {
      type: dto.type,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      fiscalYear: dto.fiscalYear,
      periodType: dto.periodType,
      currency: dto.currency,
      scale: dto.scale,
    };
    if (dto.fiscalQuarter !== undefined) data.fiscalQuarter = dto.fiscalQuarter;
    if (dto.sourceType !== undefined) data.sourceType = dto.sourceType;
    if (dto.sourceReference !== undefined) data.sourceReference = dto.sourceReference;

    const lineItems = dto.lineItems ?? [];

    return this.financialsService.createWithLineItems(companyId, data, lineItems, user.userId, user.role, user.email);
  }

  @Post('companies/:companyId/financial-statements/simple')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async createSimple(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
    @Body() dto: CreateFinancialStatementDto,
  ) {
    const data: StatementData = {
      type: dto.type,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      fiscalYear: new Date(dto.periodStart).getFullYear(),
      periodType: 'ANNUAL',
      currency: 'USD',
      scale: 'ONES',
    };
    return this.financialsService.create(companyId, data, user.userId, user.role, user.email);
  }

  @Get('companies/:companyId/financial-statements')
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findByCompany(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('companyId') companyId: string,
  ) {
    return this.financialsService.findByCompany(companyId, user.userId, user.role);
  }

  @Get('financial-statements/:id')
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findOne(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('id') id: string,
  ) {
    return this.financialsService.findOne(id, user.userId, user.role);
  }

  @Get('financial-statements/:id/line-items/view')
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findOneWithLineItems(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('id') id: string,
  ) {
    return this.financialsService.findOneWithLineItems(id, user.userId, user.role);
  }

  @Patch('financial-statements/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async update(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateFinancialStatementDto,
  ) {
    const data: UpdateData = {};
    if (dto.type) data.type = dto.type;
    if (dto.periodStart) data.periodStart = new Date(dto.periodStart);
    if (dto.periodEnd) data.periodEnd = new Date(dto.periodEnd);
    if (dto.fiscalYear !== undefined) data.fiscalYear = dto.fiscalYear;
    if (dto.periodType) data.periodType = dto.periodType;
    if (dto.currency) data.currency = dto.currency;
    if (dto.scale) data.scale = dto.scale;
    if (dto.sourceType) data.sourceType = dto.sourceType;
    if (dto.sourceReference !== undefined) data.sourceReference = dto.sourceReference;
    return this.financialsService.update(id, data, user.userId, user.role, user.email);
  }

  @Delete('financial-statements/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN')
  async remove(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('id') id: string,
  ) {
    await this.financialsService.remove(id, user.userId, user.role, user.email);
  }
}
