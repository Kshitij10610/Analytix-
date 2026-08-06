import { IsEnum, IsDateString, IsOptional, IsInt, IsString, Length } from 'class-validator';

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

  @IsOptional()
  @IsInt()
  fiscalYear?: number;

  @IsOptional()
  @IsEnum(['ANNUAL', 'QUARTERLY', 'TTM'])
  periodType?: 'ANNUAL' | 'QUARTERLY' | 'TTM';

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsEnum(['ONES', 'THOUSANDS', 'MILLIONS', 'BILLIONS'])
  scale?: 'ONES' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';

  @IsOptional()
  @IsEnum(['MANUAL', 'CSV_IMPORT', 'API', 'AI_EXTRACTED'])
  sourceType?: 'MANUAL' | 'CSV_IMPORT' | 'API' | 'AI_EXTRACTED';

  @IsOptional()
  @IsString()
  sourceReference?: string;
}
