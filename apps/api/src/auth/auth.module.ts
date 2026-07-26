import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard, RolesGuard],
  exports: [AuthService, AccessTokenGuard, RolesGuard],
})
export class AuthModule {}
