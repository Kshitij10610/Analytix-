import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { FinancialsModule } from './financials/financials.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CompaniesModule,
    FinancialsModule,
    HealthModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000 * 60 * 15,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 1000 * 60 * 60,
        limit: 100,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
