import { IsEnum, IsDateString, IsInt, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateFinancialStatementDto {
  @IsEnum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW'])
  type!: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW';

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsInt()
  fiscalYear!: number;

  @IsOptional()
  @IsInt()
  fiscalQuarter?: number;

  @IsEnum(['ANNUAL', 'QUARTERLY', 'TTM'])
  periodType!: 'ANNUAL' | 'QUARTERLY' | 'TTM';

  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsEnum(['ONES', 'THOUSANDS', 'MILLIONS', 'BILLIONS'])
  scale!: 'ONES' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';

  @IsOptional()
  @IsEnum(['MANUAL', 'CSV_IMPORT', 'API', 'AI_EXTRACTED'])
  sourceType?: 'MANUAL' | 'CSV_IMPORT' | 'API' | 'AI_EXTRACTED';

  @IsOptional()
  @IsString()
  sourceReference?: string;
}
