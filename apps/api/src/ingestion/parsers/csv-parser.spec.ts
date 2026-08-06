import { CsvParser, CsvParseError } from './csv-parser';
import { PARSE_ERROR_CODES } from './parse.types';

describe('CsvParser', () => {
  let parser: CsvParser;

  beforeEach(() => {
    parser = new CsvParser();
  });

  describe('simple valid comma CSV', () => {
    it('should parse basic CSV correctly', async () => {
      const buffer = Buffer.from('name,age,city\nAlice,30,NYC\nBob,25,LA');
      const result = await parser.parse(buffer);

      expect(result.format).toBe('CSV');
      expect(result.sheets).toHaveLength(1);
      expect(result.sheets[0].name).toBe('CSV');
      expect(result.sheets[0].headers).toEqual(['name', 'age', 'city']);
      expect(result.sheets[0].rows).toHaveLength(2);
      expect(result.sheets[0].rows[0]).toEqual({ rowNumber: 2, values: ['Alice', '30', 'NYC'] });
      expect(result.sheets[0].rows[1]).toEqual({ rowNumber: 3, values: ['Bob', '25', 'LA'] });
    });
  });

  describe('UTF-8 BOM CSV', () => {
    it('should handle BOM correctly', async () => {
      const buffer = Buffer.from('\uFEFFname,age\nAlice,30');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].headers).toEqual(['name', 'age']);
      expect(result.sheets[0].rows).toHaveLength(1);
    });
  });

  describe('tab-delimited CSV', () => {
    it('should detect tab delimiter', async () => {
      const buffer = Buffer.from('name\tage\nAlice\t30\nBob\t25');
      const result = await parser.parse(buffer);

      expect(result.format).toBe('CSV');
      expect(result.sheets[0].headers).toEqual(['name', 'age']);
      expect(result.sheets[0].rows).toHaveLength(2);
    });
  });

  describe('semicolon policy', () => {
    it('should detect semicolon when unambiguous', async () => {
      const buffer = Buffer.from('name;age\nAlice;30\nBob;25');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].headers).toEqual(['name', 'age']);
      expect(result.sheets[0].rows).toHaveLength(2);
    });

    it('should reject genuinely ambiguous delimiter', async () => {
      const buffer = Buffer.from('a,b;c\nd,e;f');
      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
      try {
        await parser.parse(buffer);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CsvParseError);
        expect((e as CsvParseError).code).toBe(PARSE_ERROR_CODES.AMBIGUOUS_DELIMITER);
      }
    });

    it('should accept single-column CSV with no delimiter', async () => {
      const buffer = Buffer.from('Header\nValue1\nValue2');
      const result = await parser.parse(buffer);
      expect(result.sheets[0].headers).toEqual(['Header']);
      expect(result.sheets[0].rows).toHaveLength(2);
      expect(result.sheets[0].rows[0].values).toEqual(['Value1']);
    });

    it('should choose structurally dominant delimiter over weaker candidate', async () => {
      const buffer = Buffer.from('a,b,c;d\ne,f,g;h');
      const result = await parser.parse(buffer);
      expect(result.sheets[0].headers).toHaveLength(3);
      expect(result.sheets[0].headers[0]).toBe('a');
      expect(result.sheets[0].headers[1]).toBe('b');
      expect(result.sheets[0].headers[2]).toBe('c;d');
    });
  });

  describe('quoted comma value', () => {
    it('should handle quoted fields with commas', async () => {
      const buffer = Buffer.from('name,value\n"1,000",123');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].headers).toEqual(['name', 'value']);
      expect(result.sheets[0].rows[0].values).toEqual(['1,000', '123']);
    });
  });

  describe('escaped quote', () => {
    it('should handle escaped quotes', async () => {
      const buffer = Buffer.from('name\n"Company ""A"""');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].headers).toEqual(['name']);
      expect(result.sheets[0].rows[0].values).toEqual(['Company "A"']);
    });
  });

  describe('quoted multiline field', () => {
    it('should handle multiline quoted fields', async () => {
      const buffer = Buffer.from('name,address\n"Alice","123 Main St\nApt 4"');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].headers).toEqual(['name', 'address']);
      expect(result.sheets[0].rows).toHaveLength(1);
      expect(result.sheets[0].rows[0].values).toEqual(['Alice', '123 Main St\nApt 4']);
    });
  });

  describe('empty file rejected', () => {
    it('should reject empty buffer', async () => {
      const buffer = Buffer.alloc(0);
      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });

  describe('invalid UTF-8 rejected', () => {
    it('should reject invalid UTF-8', async () => {
      const buffer = Buffer.from([0xFF, 0xFE, 0xFD]);
      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });

  describe('duplicate headers rejected', () => {
    it('should reject duplicate headers', async () => {
      const buffer = Buffer.from('name,name,age\nAlice,30,NYC');
      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });

  describe('empty header rejected', () => {
    it('should reject header row with empty cells within non-empty row', async () => {
      const buffer = Buffer.from('name,,age\nAlice,30,NYC');
      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });

  describe('empty header cell rejected', () => {
    it('should reject empty header cells', async () => {
      const buffer = Buffer.from('name,,age\nAlice,30,NYC');
      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });

  describe('inconsistent row width rejected', () => {
    it('should reject mismatched row width', async () => {
      const buffer = Buffer.from('name,age\nAlice,30,NYC');
      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });

  describe('column limits', () => {
    it('should accept exactly 200 columns', async () => {
      const headers = Array.from({ length: 200 }, (_, i) => `col${i}`).join(',');
      const row = Array.from({ length: 200 }, () => 'x').join(',');
      const buffer = Buffer.from(`${headers}\n${row}`);
      const result = await parser.parse(buffer);

      expect(result.sheets[0].headers).toHaveLength(200);
      expect(result.sheets[0].rows[0].values).toHaveLength(200);
    });

    it('should reject 201 columns', async () => {
      const headers = Array.from({ length: 201 }, (_, i) => `col${i}`).join(',');
      const row = Array.from({ length: 201 }, () => 'x').join(',');
      const buffer = Buffer.from(`${headers}\n${row}`);

      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });

  describe('row limits', () => {
    it('should accept exactly 10000 data rows', async () => {
      const headers = 'id,name';
      const rows = Array.from({ length: 10000 }, (_, i) => `${i},name${i}`).join('\n');
      const buffer = Buffer.from(`${headers}\n${rows}`);
      const result = await parser.parse(buffer);

      expect(result.sheets[0].rows).toHaveLength(10000);
    });

    it('should reject 10001 data rows', async () => {
      const headers = 'id,name';
      const rows = Array.from({ length: 10001 }, (_, i) => `${i},name${i}`).join('\n');
      const buffer = Buffer.from(`${headers}\n${rows}`);

      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });

  describe('blank vs zero preservation', () => {
    it('should preserve blank cells', async () => {
      const buffer = Buffer.from('name,value\nAlice,\nBob,0');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].rows[0].values[1]).toBe('');
      expect(result.sheets[0].rows[1].values[1]).toBe('0');
    });
  });

  describe('decimal string preservation', () => {
    it('should not round decimals', async () => {
      const buffer = Buffer.from('value\n123.1234567');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].rows[0].values[0]).toBe('123.1234567');
    });
  });

  describe('formula-like text', () => {
    it('should treat formula text as plain text', async () => {
      const buffer = Buffer.from('formula\n=SUM(A1:A10)');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].rows[0].values[0]).toBe('=SUM(A1:A10)');
    });
  });

  describe('original row numbers', () => {
    it('should preserve original row numbers', async () => {
      const buffer = Buffer.from('a,b\n1,2\n3,4');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].rows[0].rowNumber).toBe(2);
      expect(result.sheets[0].rows[1].rowNumber).toBe(3);
    });
  });

  describe('no financial mapping', () => {
    it('should not map headers to metric codes', async () => {
      const buffer = Buffer.from('Total Revenue,Net Income\n1000,500');
      const result = await parser.parse(buffer);

      expect(result.sheets[0].headers).toEqual(['Total Revenue', 'Net Income']);
      expect(result.sheets[0].rows[0].values).toEqual(['1000', '500']);
    });
  });

  describe('null byte rejection', () => {
    it('should reject null bytes', async () => {
      const buffer = Buffer.from('name,age\nAlice\x00,30');
      await expect(parser.parse(buffer)).rejects.toThrow(CsvParseError);
    });
  });
});
