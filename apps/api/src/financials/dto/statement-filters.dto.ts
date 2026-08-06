import { IsEnum, IsInt, IsOptional } from 'class-validator';

export class StatementFiltersDto {
  @IsOptional()
  @IsEnum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW'])
  type?: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';

  @IsOptional()
  @IsEnum(['ANNUAL', 'QUARTERLY', 'TTM'])
  periodType?: 'ANNUAL' | 'QUARTERLY' | 'TTM';

  @IsOptional()
  @IsInt()
  fiscalYear?: number;

  @IsOptional()
  @IsInt()
  fiscalQuarter?: number;
}
