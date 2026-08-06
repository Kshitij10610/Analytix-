import { IsDateString, IsEnum, IsInt, Length, Matches } from 'class-validator';

export class StatementMetadataDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsInt()
  fiscalYear!: number;

  @IsEnum(['ANNUAL', 'QUARTERLY', 'TTM'])
  periodType!: 'ANNUAL' | 'QUARTERLY' | 'TTM';

  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsEnum(['ONES', 'THOUSANDS', 'MILLIONS', 'BILLIONS'])
  scale!: 'ONES' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';
}

export interface StatementMetadataResponse {
  importJobId: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  fiscalYear: number;
  periodType: string;
  currency: string;
  scale: string;
  normalizedRowCount: number;
  statementType: string;
}
