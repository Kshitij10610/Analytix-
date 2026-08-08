import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { FinancialsModule } from './financials/financials.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { PrismaModule } from './prisma/prisma.module';

const isDev = process.env.NODE_ENV === 'development';

const throttlerOptions = isDev
  ? [
      {
        name: 'short',
        ttl: 1000,
        limit: 100000,
      },
      {
        name: 'medium',
        ttl: 1000,
        limit: 100000,
      },
    ]
  : [
      {
        name: 'short',
        ttl: 60,
        limit: 100,
      },
      {
        name: 'medium',
        ttl: 3600,
        limit: 1000,
      },
    ];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    AuthModule,
    CompaniesModule,
    FinancialsModule,
    IngestionModule,
    HealthModule,

    ThrottlerModule.forRoot(throttlerOptions),
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }