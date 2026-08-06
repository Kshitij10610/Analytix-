export type ParseFormat = 'CSV' | 'XLSX';

export interface ParsedRow {
  rowNumber: number;
  values: string[];
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: ParsedRow[];
}

export interface ParsedTabularFile {
  format: ParseFormat;
  sheets: ParsedSheet[];
}

export interface SheetParseResult {
  name: string;
  headers: string[];
  rows: ParsedRow[];
}

export interface ParseSummary {
  [key: string]: unknown;
  version: 1;
  format: ParseFormat;
  success: boolean;
  sheetCount: number;
  sheets: SheetSummary[];
  totalDataRows: number;
  maxColumns: number;
  delimiter?: string;
  emptySheetCount: number;
  formulaCellCount: number;
  parsedAt: string;
  error?: ParseError;
}

export interface SheetSummary {
  name: string;
  headerCount: number;
  dataRowCount: number;
}

export interface ParseError {
  code: string;
  message: string;
  detail?: string;
}

export const IMPORT_JOB_ALLOWED_STATES = ['UPLOADED'] as const;
export const IMPORT_JOB_TERMINAL_STATES = ['NEEDS_MAPPING', 'MAPPED', 'VALIDATED', 'READY', 'COMPLETED', 'FAILED'] as const;

export const MAX_DATA_ROWS = 10000;
export const MAX_COLUMNS = 200;
export const MAX_VISIBLE_SHEETS = 20;

export const PARSE_ERROR_CODES = {
  SOURCE_FILE_MISSING: 'SOURCE_FILE_MISSING',
  SOURCE_INTEGRITY_FAILED: 'SOURCE_INTEGRITY_FAILED',
  UNSUPPORTED_SOURCE_TYPE: 'UNSUPPORTED_SOURCE_TYPE',
  EMPTY_FILE: 'EMPTY_FILE',
  EMPTY_HEADER: 'EMPTY_HEADER',
  EMPTY_HEADER_CELL: 'EMPTY_HEADER_CELL',
  DUPLICATE_HEADERS: 'DUPLICATE_HEADERS',
  ROW_WIDTH_MISMATCH: 'ROW_WIDTH_MISMATCH',
  MAX_ROWS_EXCEEDED: 'MAX_ROWS_EXCEEDED',
  MAX_COLUMNS_EXCEEDED: 'MAX_COLUMNS_EXCEEDED',
  AMBIGUOUS_DELIMITER: 'AMBIGUOUS_DELIMITER',
  CSV_INVALID_ENCODING: 'CSV_INVALID_ENCODING',
  CSV_MALFORMED: 'CSV_MALFORMED',
  XLSX_INVALID_WORKBOOK: 'XLSX_INVALID_WORKBOOK',
  XLSX_NO_VISIBLE_SHEETS: 'XLSX_NO_VISIBLE_SHEETS',
  XLSX_TOO_MANY_SHEETS: 'XLSX_TOO_MANY_SHEETS',
  XLSX_AMBIGUOUS_MERGED_HEADER: 'XLSX_AMBIGUOUS_MERGED_HEADER',
  PARSER_INTERNAL_ERROR: 'PARSER_INTERNAL_ERROR',
} as const;
