const dotenv = require('dotenv');
dotenv.config({ path: '.env.test' });
dotenv.config({ path: '.env' });

const { validateTestDatabaseUrl } = require('./test-db.guard');

const testDatabaseUrl = validateTestDatabaseUrl();

process.env.DATABASE_URL = testDatabaseUrl;

export {};
