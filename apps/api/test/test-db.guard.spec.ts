import { validateTestDatabaseUrl, isApprovedTestDatabase, isDevelopmentDatabase, parseDatabaseName } from '../test/test-db.guard';

describe('test-db.guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateTestDatabaseUrl', () => {
    it('should reject when NODE_ENV is not test', () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_DATABASE_URL = 'postgresql://analytix:pass@localhost:5433/analytix_test?schema=public';

      expect(() => validateTestDatabaseUrl()).toThrow('NODE_ENV=test');
    });

    it('should reject when TEST_DATABASE_URL is missing', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.TEST_DATABASE_URL;

      expect(() => validateTestDatabaseUrl()).toThrow('TEST_DATABASE_URL is required');
    });

    it('should reject when TEST_DATABASE_URL equals DATABASE_URL', () => {
      process.env.NODE_ENV = 'test';
      const url = 'postgresql://analytix:pass@localhost:5433/analytix?schema=public';
      process.env.TEST_DATABASE_URL = url;
      process.env.DATABASE_URL = url;

      expect(() => validateTestDatabaseUrl()).toThrow('must not point to the development database');
    });

    it('should reject when database name is not analytix_test', () => {
      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = 'postgresql://analytix:pass@localhost:5433/analytix?schema=public';
      process.env.DATABASE_URL = 'postgresql://analytix:pass@localhost:5433/other?schema=public';

      expect(() => validateTestDatabaseUrl()).toThrow('must be "analytix_test"');
    });

    it('should accept valid analytix_test URL', () => {
      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = 'postgresql://analytix:pass@localhost:5433/analytix_test?schema=public';
      process.env.DATABASE_URL = 'postgresql://analytix:pass@localhost:5433/analytix?schema=public';

      const result = validateTestDatabaseUrl();
      expect(result).toBe('postgresql://analytix:pass@localhost:5433/analytix_test?schema=public');
    });
  });

  describe('isApprovedTestDatabase', () => {
    it('should return true for analytix_test', () => {
      expect(isApprovedTestDatabase('analytix_test')).toBe(true);
    });

    it('should return false for other names', () => {
      expect(isApprovedTestDatabase('analytix')).toBe(false);
      expect(isApprovedTestDatabase('analytix_test_1')).toBe(false);
      expect(isApprovedTestDatabase('production')).toBe(false);
    });
  });

  describe('isDevelopmentDatabase', () => {
    it('should return true for analytix', () => {
      expect(isDevelopmentDatabase('analytix')).toBe(true);
    });

    it('should return false for other names', () => {
      expect(isDevelopmentDatabase('analytix_test')).toBe(false);
      expect(isDevelopmentDatabase('other')).toBe(false);
    });
  });

  describe('parseDatabaseName', () => {
    it('should extract database name from URL', () => {
      expect(parseDatabaseName('postgresql://user:pass@host:5432/analytix_test?schema=public')).toBe('analytix_test');
    });

    it('should handle URL without query params', () => {
      expect(parseDatabaseName('postgresql://user:pass@host:5432/analytix_test')).toBe('analytix_test');
    });

    it('should return empty string for invalid URL', () => {
      expect(parseDatabaseName('not-a-url')).toBe('');
    });
  });
});
