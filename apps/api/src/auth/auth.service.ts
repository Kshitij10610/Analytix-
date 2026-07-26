import { createHmac, randomBytes } from 'node:crypto';
import { Injectable, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name?: string | null) {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await this.prismaService.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.hashPassword(password);

    try {
      const user = await this.prismaService.prisma.user.create({
        data: {
          email: normalizedEmail,
          password: passwordHash,
          name: name ?? null,
          role: 'USER',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch {
      throw new ConflictException('Unable to register user');
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.prismaService.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await this.verifyPassword(user.password, password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });

    const { raw: refreshToken, hash: tokenHash } = this.generateRefreshToken();

    await this.prismaService.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await this.prismaService.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      accessToken,
      expiresIn: 900,
      user: safeUser,
      refreshToken,
    };
  }

  async refresh(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    return await this.prismaService.prisma.$transaction(async (tx) => {
      const existingToken = await tx.refreshToken.findFirst({
        where: { tokenHash },
        include: { user: true },
      });

      if (!existingToken || existingToken.revokedAt || existingToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const { raw: newRefreshToken, hash: newTokenHash } = this.generateRefreshToken();

      const newToken = await tx.refreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });

      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: existingToken.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date(), replacedById: newToken.id },
      });

      if (revoked.count === 0) {
        await tx.refreshToken.delete({
          where: { id: newToken.id },
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokenPayload = {
        sub: existingToken.user.id,
        email: existingToken.user.email,
        role: existingToken.user.role,
      };

      const accessToken = await this.jwtService.signAsync(tokenPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      });

      const safeUser = {
        id: existingToken.user.id,
        email: existingToken.user.email,
        name: existingToken.user.name,
        role: existingToken.user.role,
        createdAt: existingToken.user.createdAt,
        updatedAt: existingToken.user.updatedAt,
      };

      return {
        accessToken,
        expiresIn: 900,
        user: safeUser,
        refreshToken: newRefreshToken,
      };
    });
  }

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const existingToken = await this.prismaService.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });

    if (existingToken && !existingToken.revokedAt) {
      await this.prismaService.prisma.refreshToken.update({
        where: { id: existingToken.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  async validateAccessToken(token: string): Promise<{ userId: string; email: string; role: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      if (payload.role === undefined) {
        throw new UnauthorizedException('Invalid token claims');
      }

      const user = await this.prismaService.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid token claims');
      }

      return { userId: user.id, email: user.email, role: user.role };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    return user;
  }

  generateRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('hex');
    const hash = this.hashToken(raw);
    return { raw, hash };
  }

  hashToken(token: string): string {
    const secret = process.env.JWT_REFRESH_SECRET as string;
    return createHmac('sha256', secret).update(token).digest('hex');
  }

  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 4,
      });
    } catch {
      throw new BadRequestException('Unable to process password');
    }
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
