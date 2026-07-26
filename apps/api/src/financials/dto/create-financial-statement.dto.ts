import { IsEnum, IsDateString } from 'class-validator';

export class CreateFinancialStatementDto {
  @IsEnum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW'])
  type!: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
