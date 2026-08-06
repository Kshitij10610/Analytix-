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

export class MappingItemDto {
  code: string;
  label: string;
  category: string;
  statementType: string;
}

export class RowMappingConfirmDto {
  rowNumber: number;
  metricCode: string;
}

export class SheetMappingConfirmDto {
  sheetIndex: number;
  rowMappings: RowMappingConfirmDto[];
}

export class MappingConfirmRequestDto {
  statementType?: string;
  sheets: SheetMappingConfirmDto[];
}

export class MappingConfirmResponseDto {
  importJobId: string;
  status: string;
  mapping: Record<string, unknown>;
}
