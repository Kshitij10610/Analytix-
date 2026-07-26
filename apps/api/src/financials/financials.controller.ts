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
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFinancialStatementDto } from './dto/create-financial-statement.dto';
import { UpdateFinancialStatementDto } from './dto/update-financial-statement.dto';
import { FinancialsService } from './financials.service';

type FinancialStatementType = 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';

type UpdateData = {
  type?: FinancialStatementType;
  periodStart?: Date;
  periodEnd?: Date;
};

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
export class FinancialsController {
  constructor(private readonly financialsService: FinancialsService) {}

  @Post('companies/:companyId/financial-statements')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async createForCompany(
    @Param('companyId') companyId: string,
    @Body() dto: CreateFinancialStatementDto,
  ) {
    return this.financialsService.create(companyId, {
      ...dto,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
    });
  }

  @Get('companies/:companyId/financial-statements')
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findByCompany(@Param('companyId') companyId: string) {
    return this.financialsService.findByCompany(companyId);
  }

  @Get('financial-statements/:id')
  @Roles('USER', 'ANALYST', 'ADMIN')
  async findOne(@Param('id') id: string) {
    return this.financialsService.findOne(id);
  }

  @Patch('financial-statements/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Roles('ANALYST', 'ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateFinancialStatementDto) {
    const data: UpdateData = {};
    if (dto.type) data.type = dto.type;
    if (dto.periodStart) data.periodStart = new Date(dto.periodStart);
    if (dto.periodEnd) data.periodEnd = new Date(dto.periodEnd);
    return this.financialsService.update(id, data);
  }

  @Delete('financial-statements/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    await this.financialsService.remove(id);
  }
}
