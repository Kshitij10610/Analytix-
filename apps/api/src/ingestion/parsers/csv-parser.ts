import { StringDecoder } from 'string_decoder';
import { parse } from 'csv-parse';
import {
  ParsedTabularFile,
  ParsedSheet,
  ParsedRow,
  ParseSummary,
  MAX_DATA_ROWS,
  MAX_COLUMNS,
  PARSE_ERROR_CODES,
} from './parse.types';

export class CsvParseError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export class CsvParser {
  private readonly DELIMITERS = [',', '\t', ';'];
  private readonly SAMPLE_LINES = 20;
  private readonly MIN_CONFIDENCE_LINES = 1;

  async parse(buffer: Buffer): Promise<ParsedTabularFile> {
    this.validateBuffer(buffer);

    const text = this.decodeBuffer(buffer);
    const delimiter = this.detectDelimiter(text);
    
    const sheets: ParsedSheet[] = [];
    const rows: ParsedRow[] = [];
    const headers: string[] = [];
    let rowNumber = 0;
    let headerFound = false;
    let dataRowCount = 0;
    let columnCount = 0;
    let duplicateHeaders: string[] = [];

    const parser = parse(text, {
      delimiter: [Buffer.from(delimiter)],
      relax_column_count: true,
      relax: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    } as any);

    for await (const record of parser) {
      const values = record as string[];
      rowNumber++;

      if (!headerFound) {
        if (values.every(v => v.trim() === '')) {
          continue;
        }
        
        headers.length = 0;
        for (const value of values) {
          headers.push(value.trim());
        }

        if (headers.length === 0) {
          throw new CsvParseError(
            PARSE_ERROR_CODES.EMPTY_HEADER,
            'CSV file has no header row'
          );
        }

        if (headers.length > MAX_COLUMNS) {
          throw new CsvParseError(
            PARSE_ERROR_CODES.MAX_COLUMNS_EXCEEDED,
            `CSV exceeds maximum column limit of ${MAX_COLUMNS}`,
            `Found ${headers.length} columns`
          );
        }

        const emptyIndex = headers.findIndex(h => h === '');
        if (emptyIndex !== -1) {
          throw new CsvParseError(
            PARSE_ERROR_CODES.EMPTY_HEADER_CELL,
            'CSV header contains empty cell',
            `Column ${emptyIndex + 1} is empty`
          );
        }

        const normalizedHeaders = headers.map(h => h.toLowerCase());
        const seen = new Set<string>();
        for (const header of normalizedHeaders) {
          if (seen.has(header)) {
            duplicateHeaders.push(header);
          }
          seen.add(header);
        }

        if (duplicateHeaders.length > 0) {
          throw new CsvParseError(
            PARSE_ERROR_CODES.DUPLICATE_HEADERS,
            'CSV contains duplicate headers',
            `Duplicate headers: ${duplicateHeaders.join(', ')}`
          );
        }

        columnCount = headers.length;
        headerFound = true;
        continue;
      }

      dataRowCount++;

      if (dataRowCount > MAX_DATA_ROWS) {
        throw new CsvParseError(
          PARSE_ERROR_CODES.MAX_ROWS_EXCEEDED,
          `CSV exceeds maximum row limit of ${MAX_DATA_ROWS}`,
          `Found ${dataRowCount} data rows`
        );
      }

      const normalizedValues = values.map(v => v.trim());
      while (normalizedValues.length < columnCount) {
        normalizedValues.push('');
      }

      if (normalizedValues.length !== columnCount) {
        throw new CsvParseError(
          PARSE_ERROR_CODES.ROW_WIDTH_MISMATCH,
          'CSV row width does not match header',
          `Expected ${columnCount} columns, got ${normalizedValues.length} at row ${rowNumber}`
        );
      }

      rows.push({
        rowNumber,
        values: normalizedValues,
      });
    }

    if (!headerFound) {
      throw new CsvParseError(
        PARSE_ERROR_CODES.EMPTY_HEADER,
        'CSV file has no header row'
      );
    }

    sheets.push({
      name: 'CSV',
      headers,
      rows,
    });

    return {
      format: 'CSV',
      sheets,
    };
  }

  buildSummary(result: ParsedTabularFile, _startTime: number): ParseSummary {
    const totalDataRows = result.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
    const maxColumns = result.sheets.reduce((max, sheet) => Math.max(max, sheet.headers.length), 0);

    return {
      version: 1,
      format: result.format,
      success: true,
      sheetCount: result.sheets.length,
      sheets: result.sheets.map(sheet => ({
        name: sheet.name,
        headerCount: sheet.headers.length,
        dataRowCount: sheet.rows.length,
      })),
      totalDataRows,
      maxColumns,
      emptySheetCount: 0,
      formulaCellCount: 0,
      parsedAt: new Date().toISOString(),
    };
  }

  private validateBuffer(buffer: Buffer): void {
    if (!buffer || buffer.length === 0) {
      throw new CsvParseError(
        PARSE_ERROR_CODES.EMPTY_FILE,
        'CSV file is empty'
      );
    }

    if (buffer.includes(0)) {
      throw new CsvParseError(
        PARSE_ERROR_CODES.CSV_INVALID_ENCODING,
        'CSV file contains null bytes'
      );
    }

    const text = buffer.toString('utf-8');
    if (text.includes('\uFFFD')) {
      throw new CsvParseError(
        PARSE_ERROR_CODES.CSV_INVALID_ENCODING,
        'CSV file contains invalid UTF-8 sequences'
      );
    }
  }

  private decodeBuffer(buffer: Buffer): string {
    const decoder = new StringDecoder('utf8');
    return decoder.write(buffer) + decoder.end();
  }

  private detectDelimiter(text: string): string {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '').slice(0, this.SAMPLE_LINES);
    
    if (lines.length < this.MIN_CONFIDENCE_LINES) {
      return ',';
    }

    const scores: Record<string, { count: number; consistent: boolean }> = {};

    for (const delimiter of this.DELIMITERS) {
      const counts = lines.map(line => this.countFields(line, delimiter));
      const firstCount = counts[0];
      const consistent = counts.every(c => c === firstCount && c > 1);
      scores[delimiter] = {
        count: consistent ? firstCount : 0,
        consistent,
      };
    }

    const candidates = Object.entries(scores)
      .filter(([, s]) => s.consistent)
      .sort((a, b) => b[1].count - a[1].count);

    if (candidates.length === 0) {
      return ',';
    }

    if (candidates.length > 1) {
      const topCount = candidates[0][1].count;
      const nextCount = candidates[1][1].count;
      if (topCount === nextCount) {
        throw new CsvParseError(
          PARSE_ERROR_CODES.AMBIGUOUS_DELIMITER,
          'Multiple delimiters produce equally plausible column structures',
          `Ambiguous delimiters: ${candidates.map(([d]) => d).join(', ')}`,
        );
      }
      return candidates[0][0];
    }

    return candidates[0][0];
  }

  private countFields(line: string, delimiter: string): number {
    let count = 0;
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === delimiter && !inQuotes) {
        count++;
      }
    }
    
    return count + 1;
  }
}
