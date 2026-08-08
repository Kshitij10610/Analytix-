export interface UploadResponseDto {
  importJobId: string;
  sourceFileId: string;
  status: string;
  statementType: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
}

export interface ParseResponseDto {
  importJobId: string;
  status: string;
  parseSummary: {
    version: number;
    format: string;
    success: boolean;
    sheetCount: number;
    sheets: { name: string; headerCount: number; dataRowCount: number }[];
    totalDataRows: number;
    maxColumns: number;
    delimiter?: string;
    emptySheetCount: number;
    formulaCellCount: number;
    parsedAt: string;
    error?: {
      code: string;
      message: string;
      detail?: string;
    };
  };
}

export interface StageResponseDto {
  importJobId: string;
  status: string;
  stagedRowCount: number;
  sheetCount: number;
  mapping: Record<string, unknown>;
}

export interface ColumnMappingDto {
  sourceIndex: number;
  sourceHeader: string;
  role: string;
  status: string;
}

export interface RowMappingDto {
  rowNumber: number;
  sourceLabel: string;
  metricCode: string | null;
  statementType: string | null;
  status: string;
  candidates: Array<{ code: string; label: string; category: string; statementType: string }>;
}

export interface SheetMappingDto {
  sheetIndex: number;
  sheetName: string;
  headers: string[];
  columns: ColumnMappingDto[];
  rowMappings: RowMappingDto[];
}

export interface MappingItemDto {
  code: string;
  label: string;
  category: string;
  statementType: string;
}

export interface RowMappingConfirmDto {
  rowNumber: number;
  metricCode: string;
}

export interface SheetMappingConfirmDto {
  sheetIndex: number;
  rowMappings: RowMappingConfirmDto[];
}

export interface MappingConfirmRequestDto {
  statementType?: string;
  sheets: SheetMappingConfirmDto[];
}

export interface MappingConfirmResponseDto {
  importJobId: string;
  status: string;
  mapping: Record<string, unknown>;
}

export interface ValidationErrorDto {
  code: string;
  message: string;
  metricCode?: string;
  sheetIndex?: number;
  rowNumber?: number;
  sourceIndex?: number;
}

export interface ValidationResponseDto {
  importJobId: string;
  status: string;
  valid: boolean;
  totalErrorCount: number;
  truncated: boolean;
  errors: ValidationErrorDto[];
  statementType: string | null;
}

export interface NormalizationResponseDto {
  importJobId: string;
  status: string;
  valid: boolean;
  normalizedRowCount: number;
  statementType: string | null;
  readyBlockedReason: string | null;
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

export interface CommitResponse {
  importJobId: string;
  status: string;
  statementId: string;
  lineItemCount: number;
  statementType: string;
  periodStart: string;
  periodEnd: string;
  fiscalYear: number;
  periodType: string;
  currency: string;
  scale: string;
  sourceType: string;
  sourceReference: string;
}

export type ImportJobStatus = "UPLOADED" | "PARSED" | "NEEDS_MAPPING" | "MAPPED" | "VALIDATED" | "READY" | "COMPLETED" | "FAILED";

export interface ImportJobState {
  importJobId: string | null;
  status: ImportJobStatus | null;
  upload: UploadResponseDto | null;
  parse: ParseResponseDto | null;
  stage: StageResponseDto | null;
  mapping: MappingConfirmResponseDto | null;
  validation: ValidationResponseDto | null;
  normalization: NormalizationResponseDto | null;
  metadata: StatementMetadataResponse | null;
  commit: CommitResponse | null;
}
