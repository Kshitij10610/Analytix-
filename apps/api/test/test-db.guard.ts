export interface TestDbGuardOptions {
  env?: NodeJS.ProcessEnv;
}

export function validateTestDatabaseUrl(options: TestDbGuardOptions = {}): string {
  const env = options.env ?? process.env;

  if (env.NODE_ENV !== 'test') {
    throw new Error('Real database tests require NODE_ENV=test');
  }

  const testDatabaseUrl = env.TEST_DATABASE_URL;
  if (!testDatabaseUrl || typeof testDatabaseUrl !== 'string' || testDatabaseUrl.trim() === '') {
    throw new Error('TEST_DATABASE_URL is required for database tests');
  }

  const developmentUrl = env.DATABASE_URL;
  if (developmentUrl && normalizeDatabaseName(testDatabaseUrl) === normalizeDatabaseName(developmentUrl)) {
    throw new Error('TEST_DATABASE_URL must not point to the development database');
  }

  const testDbName = normalizeDatabaseName(testDatabaseUrl);
  if (testDbName !== 'analytix_test') {
    throw new Error(`Test database name must be "analytix_test", got: ${testDbName}`);
  }

  if (developmentUrl && normalizeDatabaseName(developmentUrl) === 'analytix') {
    // Development target is the real dev DB - this is expected, we just need to ensure test != dev
  }

  return testDatabaseUrl;
}

export function isApprovedTestDatabase(databaseName: string): boolean {
  return databaseName === 'analytix_test';
}

export function isDevelopmentDatabase(databaseName: string): boolean {
  return databaseName === 'analytix';
}

function normalizeDatabaseName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const dbName = pathname.split('/').filter(Boolean).pop() ?? '';
    const queryIndex = dbName.indexOf('?');
    return queryIndex >= 0 ? dbName.substring(0, queryIndex) : dbName;
  } catch {
    return '';
  }
}

export function parseDatabaseName(url: string): string {
  return normalizeDatabaseName(url);
}
