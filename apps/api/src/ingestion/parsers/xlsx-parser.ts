import * as XLSX from 'xlsx';
import {
  ParsedTabularFile,
  ParsedSheet,
  ParsedRow,
  MAX_DATA_ROWS,
  MAX_COLUMNS,
  MAX_VISIBLE_SHEETS,
  PARSE_ERROR_CODES,
} from './parse.types';

export class XlsxParseError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'XlsxParseError';
  }
}

export class XlsxParser {
  async parse(buffer: Buffer): Promise<ParsedTabularFile> {
    if (!buffer || buffer.length === 0) {
      throw new XlsxParseError(
        PARSE_ERROR_CODES.EMPTY_FILE,
        'XLSX file is empty'
      );
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: true,
        cellDates: true,
      });
    } catch (error) {
      throw new XlsxParseError(
        PARSE_ERROR_CODES.XLSX_INVALID_WORKBOOK,
        'XLSX file is not a valid workbook',
        error instanceof Error ? error.message : 'Unknown parse error'
      );
    }

    const visibleSheets = this.getVisibleSheets(workbook);
    
    if (visibleSheets.length === 0) {
      throw new XlsxParseError(
        PARSE_ERROR_CODES.XLSX_NO_VISIBLE_SHEETS,
        'XLSX workbook has no visible worksheets'
      );
    }

    if (visibleSheets.length > MAX_VISIBLE_SHEETS) {
      throw new XlsxParseError(
        PARSE_ERROR_CODES.XLSX_TOO_MANY_SHEETS,
        `XLSX workbook exceeds maximum visible sheet limit of ${MAX_VISIBLE_SHEETS}`,
        `Found ${visibleSheets.length} visible sheets`
      );
    }

    const sheets: ParsedSheet[] = [];

    for (const sheetName of visibleSheets) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        continue;
      }

      const range = worksheet['!ref'];
      if (!range) {
        continue;
      }

      const sheetResult = this.parseSheet(worksheet, sheetName);
      
      if (sheetResult.headers.length === 0 || sheetResult.rows.length === 0) {
        continue;
      }

      if (sheetResult.headers.length > MAX_COLUMNS) {
        throw new XlsxParseError(
          PARSE_ERROR_CODES.MAX_COLUMNS_EXCEEDED,
          `XLSX sheet "${sheetName}" exceeds maximum column limit of ${MAX_COLUMNS}`,
          `Found ${sheetResult.headers.length} columns`
        );
      }

      if (sheetResult.rows.length > MAX_DATA_ROWS) {
        throw new XlsxParseError(
          PARSE_ERROR_CODES.MAX_ROWS_EXCEEDED,
          `XLSX sheet "${sheetName}" exceeds maximum row limit of ${MAX_DATA_ROWS}`,
          `Found ${sheetResult.rows.length} data rows`
        );
      }

      sheets.push({
        name: sheetName,
        headers: sheetResult.headers,
        rows: sheetResult.rows,
      });
    }

    if (sheets.length === 0) {
      throw new XlsxParseError(
        PARSE_ERROR_CODES.XLSX_NO_VISIBLE_SHEETS,
        'XLSX workbook has no data in visible worksheets'
      );
    }

    return {
      format: 'XLSX',
      sheets,
    };
  }

  private getVisibleSheets(workbook: XLSX.WorkBook): string[] {
    const sheetNames = workbook.SheetNames || [];
    const visible: string[] = [];

    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;

      const visibility = (sheet as any)['!sheet']?.visibility;
      if (visibility === 'hidden' || visibility === 'veryHidden') {
        continue;
      }

      visible.push(name);
    }

    return visible;
  }

  private parseSheet(worksheet: XLSX.WorkSheet, sheetName: string): {
    headers: string[];
    rows: ParsedRow[];
    formulaCount: number;
  } {
    const range = worksheet['!ref'];
    if (!range) {
      return { headers: [], rows: [], formulaCount: 0 };
    }

    const sheetRange = XLSX.utils.decode_range(range);
    const startRow = sheetRange.s.r;
    const endRow = sheetRange.e.r;
    const startCol = sheetRange.s.c;
    const endCol = sheetRange.e.c;

    let headers: string[] = [];
    let headerRow = -1;
    let formulaCount = 0;
    const rows: ParsedRow[] = [];

    for (let row = startRow; row <= endRow; row++) {
      const rowValues: string[] = [];
      let hasNonEmpty = false;
      let hasEmptyInMiddle = false;

      for (let col = startCol; col <= endCol; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];

        if (!cell) {
          if (hasNonEmpty) {
            hasEmptyInMiddle = true;
          }
          rowValues.push('');
          continue;
        }

        const value = this.getCellValue(cell);
        
        if ((cell as any).f) {
          formulaCount++;
        }

        if (value !== '') {
          hasNonEmpty = true;
        }

        if (hasNonEmpty && value === '') {
          hasEmptyInMiddle = true;
        }

        rowValues.push(value);
      }

      if (!hasNonEmpty) {
        continue;
      }

      if (headerRow === -1) {
        headers = rowValues;
        headerRow = row;

        if (this.hasMergedHeader(worksheet, headerRow)) {
          throw new XlsxParseError(
            PARSE_ERROR_CODES.XLSX_AMBIGUOUS_MERGED_HEADER,
            'XLSX header row contains merged cells',
            `Merged cells in header row of sheet "${sheetName}" would produce ambiguous column headers`,
          );
        }

        if (headers.length === 0) {
          continue;
        }

        if (headers.length > MAX_COLUMNS) {
          throw new XlsxParseError(
            PARSE_ERROR_CODES.MAX_COLUMNS_EXCEEDED,
            `XLSX sheet "${sheetName}" exceeds maximum column limit of ${MAX_COLUMNS}`,
            `Found ${headers.length} columns`
          );
        }

        const emptyIndex = headers.findIndex(h => h.trim() === '');
        if (emptyIndex !== -1) {
          throw new XlsxParseError(
            PARSE_ERROR_CODES.EMPTY_HEADER_CELL,
            'XLSX header contains empty cell',
            `Column ${emptyIndex + 1} is empty in sheet "${sheetName}"`
          );
        }

        const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
        const seen = new Set<string>();
        for (const header of normalizedHeaders) {
          if (seen.has(header)) {
            throw new XlsxParseError(
              PARSE_ERROR_CODES.DUPLICATE_HEADERS,
              'XLSX contains duplicate headers',
              `Duplicate header: ${header} in sheet "${sheetName}"`
            );
          }
          seen.add(header);
        }

        if (hasEmptyInMiddle) {
          throw new XlsxParseError(
            PARSE_ERROR_CODES.EMPTY_HEADER_CELL,
            'XLSX header row has empty cells in used range',
            `Sheet "${sheetName}" has inconsistent header row`
          );
        }
      } else {
        const trimmedRow = rowValues.slice(0, headers.length);
        while (trimmedRow.length < headers.length) {
          trimmedRow.push('');
        }

        if (trimmedRow.length !== headers.length) {
          throw new XlsxParseError(
            PARSE_ERROR_CODES.ROW_WIDTH_MISMATCH,
            'XLSX row width does not match header',
            `Expected ${headers.length} columns, got ${trimmedRow.length} at row ${row + 1} in sheet "${sheetName}"`
          );
        }

        rows.push({
          rowNumber: row + 1,
          values: trimmedRow,
        });
      }
    }

    if (headers.length === 0) {
      return { headers: [], rows: [], formulaCount: 0 };
    }

    return { headers, rows, formulaCount };
  }

  private hasMergedHeader(worksheet: XLSX.WorkSheet, headerRow: number): boolean {
    const merges = (worksheet as any)['!merges'];
    if (!merges || !Array.isArray(merges)) {
      return false;
    }

    for (const merge of merges) {
      if (merge.s && merge.e) {
        const mergeStartRow = merge.s.r;
        const mergeEndRow = merge.e.r;
        if (headerRow >= mergeStartRow && headerRow <= mergeEndRow) {
          return true;
        }
      }
    }

    return false;
  }

  private getCellValue(cell: XLSX.CellObject): string {
    const isFormula = !!(cell as any).f;
    
    if (isFormula) {
      return `=${(cell as any).f || ''}`;
    }

    if (cell.t === 'n') {
      if (typeof cell.v === 'number') {
        if (Number.isInteger(cell.v) && Math.abs(cell.v) < 2**53) {
          return cell.v.toString();
        }
        return cell.v.toString();
      }
      return String(cell.v);
    }

    if (cell.t === 'b') {
      return cell.v ? 'TRUE' : 'FALSE';
    }

    if (cell.t === 's') {
      return String(cell.v);
    }

    if (cell.t === 'd') {
      const date = cell.v as Date;
      if (date instanceof Date && !isNaN(date.getTime())) {
        return date.toISOString();
      }
      return String(cell.v);
    }

    if (cell.w) {
      return String(cell.w);
    }

    return String(cell.v ?? '');
  }
}
