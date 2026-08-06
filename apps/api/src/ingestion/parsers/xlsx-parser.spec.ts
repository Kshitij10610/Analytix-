import * as XLSX from 'xlsx';
import { XlsxParser, XlsxParseError } from './xlsx-parser';
import { PARSE_ERROR_CODES } from './parse.types';

describe('XlsxParser', () => {
  let parser: XlsxParser;

  beforeEach(() => {
    parser = new XlsxParser();
  });

  const createWorkbook = (sheets: Record<string, any[][]>): Buffer => {
    const workbook = XLSX.utils.book_new();
    
    for (const [sheetName, rows] of Object.entries(sheets)) {
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  };

  describe('valid single-sheet XLSX', () => {
    it('should parse basic XLSX correctly', async () => {
      const buffer = createWorkbook({
        Sheet1: [
          ['name', 'age'],
          ['Alice', 30],
          ['Bob', 25],
        ],
      });

      const result = await parser.parse(buffer);

      expect(result.format).toBe('XLSX');
      expect(result.sheets).toHaveLength(1);
      expect(result.sheets[0].name).toBe('Sheet1');
      expect(result.sheets[0].headers).toEqual(['name', 'age']);
      expect(result.sheets[0].rows).toHaveLength(2);
      expect(result.sheets[0].rows[0]).toEqual({ rowNumber: 2, values: ['Alice', '30'] });
      expect(result.sheets[0].rows[1]).toEqual({ rowNumber: 3, values: ['Bob', '25'] });
    });
  });

  describe('valid multiple visible sheets', () => {
    it('should parse multiple sheets', async () => {
      const buffer = createWorkbook({
        Sheet1: [['a', 'b'], ['1', '2']],
        Sheet2: [['c', 'd'], ['3', '4']],
      });

      const result = await parser.parse(buffer);

      expect(result.sheets).toHaveLength(2);
      expect(result.sheets[0].name).toBe('Sheet1');
      expect(result.sheets[1].name).toBe('Sheet2');
    });
  });

  describe('empty workbook rejected', () => {
    it('should reject empty buffer', async () => {
      const buffer = Buffer.alloc(0);
      await expect(parser.parse(buffer)).rejects.toThrow(XlsxParseError);
    });
  });

  describe('hidden sheet ignored', () => {
    it('should skip hidden sheets', async () => {
      const workbook = XLSX.utils.book_new();
      const visibleSheet = XLSX.utils.aoa_to_sheet([['a', 'b'], ['1', '2']]);
      const hiddenSheet = XLSX.utils.aoa_to_sheet([['hidden']]);
      (hiddenSheet as any)['!sheet'] = { visibility: 'hidden' };
      
      XLSX.utils.book_append_sheet(workbook, visibleSheet, 'Visible');
      XLSX.utils.book_append_sheet(workbook, hiddenSheet, 'Hidden');
      
      const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
      const result = await parser.parse(buffer);

      expect(result.sheets).toHaveLength(1);
      expect(result.sheets[0].name).toBe('Visible');
    });
  });

  describe('all visible sheets empty rejected', () => {
    it('should reject workbook with only empty visible sheets', async () => {
      const buffer = createWorkbook({
        Empty1: [[]],
        Empty2: [[]],
      });

      await expect(parser.parse(buffer)).rejects.toThrow(XlsxParseError);
    });
  });

  describe('empty sheet ignored', () => {
    it('should ignore empty sheets when valid sheets exist', async () => {
      const buffer = createWorkbook({
        Empty: [],
        Data: [['a', 'b'], ['1', '2']],
      });

      const result = await parser.parse(buffer);

      expect(result.sheets).toHaveLength(1);
      expect(result.sheets[0].name).toBe('Data');
    });
  });

  describe('duplicate headers rejected', () => {
    it('should reject duplicate headers', async () => {
      const buffer = createWorkbook({
        Sheet1: [
          ['name', 'name', 'age'],
          ['Alice', 'X', '30'],
        ],
      });

      await expect(parser.parse(buffer)).rejects.toThrow(XlsxParseError);
    });
  });

  describe('empty header cell rejected', () => {
    it('should reject empty header cells', async () => {
      const buffer = createWorkbook({
        Sheet1: [
          ['name', '', 'age'],
          ['Alice', 'X', '30'],
        ],
      });

      await expect(parser.parse(buffer)).rejects.toThrow(XlsxParseError);
    });
  });

  describe('inconsistent row width behavior', () => {
    it('should reject inconsistent row width', async () => {
      const buffer = createWorkbook({
        Sheet1: [
          ['name', 'age'],
          ['Alice', '30', 'NYC'],
        ],
      });

      await expect(parser.parse(buffer)).rejects.toThrow(XlsxParseError);
    });
  });

  describe('column limits', () => {
    it('should reject >200 columns', async () => {
      const headers = Array.from({ length: 201 }, (_, i) => `col${i}`);
      const rows = [headers, ...Array.from({ length: 1 }, () => Array.from({ length: 201 }, () => 'x'))];
      
      const buffer = createWorkbook({ Sheet1: rows });
      await expect(parser.parse(buffer)).rejects.toThrow(XlsxParseError);
    });
  });

  describe('row limits', () => {
    it('should reject >10000 data rows', async () => {
      const headers = ['id', 'name'];
      const rows = [headers, ...Array.from({ length: 10001 }, (_, i) => [i, `name${i}`])];
      
      const buffer = createWorkbook({ Sheet1: rows });
      await expect(parser.parse(buffer)).rejects.toThrow(XlsxParseError);
    });
  });

  describe('sheet count limits', () => {
    it('should reject >20 visible sheets', async () => {
      const sheets: Record<string, any[][]> = {};
      for (let i = 0; i < 21; i++) {
        sheets[`Sheet${i}`] = [['a'], ['1']];
      }
      
      const buffer = createWorkbook(sheets);
      await expect(parser.parse(buffer)).rejects.toThrow(XlsxParseError);
    });
  });

  describe('formula handling', () => {
    it('should preserve formulas as text', async () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([['formula'], ['=SUM(1,2)']]);
      worksheet['A2'].f = 'SUM(1,2)';
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
      const result = await parser.parse(buffer);

      expect(result.sheets[0].rows[0].values[0]).toBe('=SUM(1,2)');
    });
  });

  describe('numeric precision', () => {
    it('should not round decimals', async () => {
      const buffer = createWorkbook({
        Sheet1: [
          ['value'],
          [123.1234567],
        ],
      });

      const result = await parser.parse(buffer);

      expect(result.sheets[0].rows[0].values[0]).toBe('123.1234567');
    });
  });

  describe('zero vs blank preservation', () => {
    it('should distinguish zero from blank', async () => {
      const buffer = createWorkbook({
        Sheet1: [
          ['a', 'b'],
          ['', 0],
        ],
      });

      const result = await parser.parse(buffer);

      expect(result.sheets[0].rows[0].values[0]).toBe('');
      expect(result.sheets[0].rows[0].values[1]).toBe('0');
    });
  });

  describe('sheet name preservation', () => {
    it('should preserve original sheet names', async () => {
      const buffer = createWorkbook({
        'Income Statement': [['Revenue'], ['1000']],
        'Balance Sheet': [['Assets'], ['5000']],
      });

      const result = await parser.parse(buffer);

      expect(result.sheets[0].name).toBe('Income Statement');
      expect(result.sheets[1].name).toBe('Balance Sheet');
    });
  });

  describe('merged header detection', () => {
    it('should reject merged cells in header row', async () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Merged', null, 'Col3'],
        ['1', '2', '3'],
      ]);
      (worksheet as any)['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

      const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
      await expect(parser.parse(buffer)).rejects.toThrow('merged cells');
    });

    it('should accept XLSX with no merged cells', async () => {
      const buffer = createWorkbook({
        Sheet1: [
          ['name', 'age', 'city'],
          ['Alice', 30, 'NYC'],
        ],
      });

      const result = await parser.parse(buffer);
      expect(result.sheets[0].headers).toEqual(['name', 'age', 'city']);
    });

    it('should reject merged cells spanning header row', async () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['A', 'B', 'C'],
        ['1', '2', '3'],
      ]);
      (worksheet as any)['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

      const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
      await expect(parser.parse(buffer)).rejects.toThrow('merged cells');
    });
  });

  describe('no statement type inference', () => {
    it('should not infer statement type from sheet name', async () => {
      const buffer = createWorkbook({
        'Balance Sheet': [['Assets'], ['5000']],
      });

      const result = await parser.parse(buffer);

      expect(result.sheets[0].name).toBe('Balance Sheet');
      expect(result.sheets[0].headers).toEqual(['Assets']);
      expect(result.sheets[0].rows[0].values).toEqual(['5000']);
    });
  });
});
