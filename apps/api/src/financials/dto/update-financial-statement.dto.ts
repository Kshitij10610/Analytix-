import { IsEnum, IsDateString, IsOptional } from 'class-validator';

export class UpdateFinancialStatementDto {
  @IsOptional()
  @IsEnum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW'])
  type?: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
