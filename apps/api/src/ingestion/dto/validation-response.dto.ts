export interface ValidationErrorDto {
  code: string;
  message: string;
  metricCode?: string;
  sheetIndex?: number;
  rowNumber?: number;
  sourceIndex?: number;
}

export class ValidationResponseDto {
  importJobId: string;
  status: string;
  valid: boolean;
  totalErrorCount: number;
  truncated: boolean;
  errors: ValidationErrorDto[];
  statementType: string | null;
}
