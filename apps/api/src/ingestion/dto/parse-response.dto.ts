export class ParseResponseDto {
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
