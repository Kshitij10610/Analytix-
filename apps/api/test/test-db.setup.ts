import { spawnSync } from 'child_process';
import { PrismaClient } from '../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const dotenv = require('dotenv');
dotenv.config();

export async function prepareTestDatabase(): Promise<void> {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for database preparation');
  }

  const testDbName = parseDatabaseName(testDatabaseUrl);
  if (testDbName !== 'analytix_test') {
    throw new Error(`Database preparation is only allowed for "analytix_test", got: ${testDbName}`);
  }

  const adminUrl = buildAdminConnectionUrl(testDatabaseUrl);

  console.log(`Preparing test database: ${testDbName}`);

  const pg = require('pg');
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();

  try {
    await client.query('DROP DATABASE IF EXISTS analytix_test;');
    await client.query('CREATE DATABASE analytix_test;');
    console.log('Test database created');
  } finally {
    await client.end();
  }

  console.log('Running migrations...');
  runPrismaCommand('prisma migrate deploy', testDatabaseUrl);

  console.log('Running seed...');
  runPrismaCommand('prisma db seed', testDatabaseUrl);

  console.log('Test database preparation complete');
}

function buildAdminConnectionUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  return url.toString();
}

function runPrismaCommand(command: string, databaseUrl: string): void {
  const args = command.split(' ');
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npxCommand, args, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, TEST_DATABASE_URL: databaseUrl },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

function parseDatabaseName(url: string): string {
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

prepareTestDatabase().catch((e) => {
  console.error('Test database preparation failed:', e);
  process.exit(1);
});
