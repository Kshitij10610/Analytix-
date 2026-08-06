module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/test/test-env.ts'],
  testMatch: ['**/*.adversarial.spec.ts', '**/adversarial.spec.ts', '**/auth.security.spec.ts', '**/audit.service.db.spec.ts', '**/audit.history.db.spec.ts', '**/ingestion.schema.db.spec.ts', '**/ingestion.c.schema.db.spec.ts', '**/ingestion.c.staging.db.spec.ts', '**/ingestion.c.mapping.db.spec.ts', '**/ingestion.d-validation.db.spec.ts', '**/ingestion.e-normalization.db.spec.ts', '**/ingestion.e1-metadata.db.spec.ts', '**/ingestion.f-commit.db.spec.ts', '**/ingestion.a31.db.spec.ts', '**/ingestion.b.parse.db.spec.ts', '**/*.audit.db.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  maxWorkers: 1,
};
