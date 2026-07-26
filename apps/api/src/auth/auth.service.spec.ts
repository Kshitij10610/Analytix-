import { ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import * as argon2 from 'argon2';

process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-unit-tests-only-1234567890';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  mockPrisma.$transaction = jest.fn((callback: any) => callback(mockPrisma));

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            prisma: mockPrisma,
          },
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Login tests

  it('should register a user with hashed password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const createdUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.user.create.mockResolvedValue(createdUser);

    const result = await service.register('test@example.com', 'password123', 'Test User');

    expect(result).toEqual(createdUser);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'test@example.com',
          role: 'USER',
          name: 'Test User',
        }),
      }),
    );
  });

  it('should hash password with Argon2id', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const plaintextPassword = 'testpassword123';
    await service.register('test@example.com', plaintextPassword);

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    const storedHash = createCall.data.password;

    expect(storedHash).not.toBe(plaintextPassword);
    expect(storedHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(storedHash, plaintextPassword)).toBe(true);
    expect(await argon2.verify(storedHash, 'wrongpassword')).toBe(false);
  });

  it('should normalize email to lowercase', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.register('TEST@EXAMPLE.COM', 'password123');

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'test@example.com',
        }),
      }),
    );
  });

  it('should throw ConflictException on duplicate email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
    });

    await expect(service.register('test@example.com', 'password123')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw ConflictException on create failure', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(new Error('DB error'));

    await expect(service.register('test@example.com', 'password123')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should not expose password in response', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      name: 'Test',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register('test@example.com', 'password123', 'Test');

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('should always assign USER role, ignoring client input', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.register('test@example.com', 'password123', 'Test');

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'USER',
        }),
      }),
    );
  });

  it('should handle optional name', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      name: null,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register('test@example.com', 'password123');

    expect(result.name).toBeNull();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should login successfully with valid credentials', async () => {
    const hashedPassword = '$argon2id$v=19$m=65536,p=4,t=3$test$test';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockJwtService.signAsync.mockResolvedValue('mock-jwt-token');
    mockPrisma.user.update.mockResolvedValue({
      id: '1',
      lastLoginAt: new Date(),
    });
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt-1',
      userId: '1',
      tokenHash: 'hash',
      expiresAt: new Date(),
    });
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);

    const result = await service.login('test@example.com', 'correctpassword');

    expect(result.accessToken).toBe('mock-jwt-token');
    expect(result.expiresIn).toBe(900);
    expect(result.user).toEqual({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(result.user).not.toHaveProperty('password');
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).toHaveLength(64);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: '1',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('should throw UnauthorizedException for wrong password', async () => {
    const hashedPassword = '$argon2id$v=19$m=65536,p=4,t=3$test$test';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'USER',
    });
    jest.spyOn(argon2, 'verify').mockResolvedValue(false);

    await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException for nonexistent email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('nonexistent@example.com', 'password123')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should normalize email during login', async () => {
    const hashedPassword = '$argon2id$v=19$m=65536,p=4,t=3$test$test';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'USER',
    });
    mockJwtService.signAsync.mockResolvedValue('mock-jwt-token');
    mockPrisma.user.update.mockResolvedValue({
      id: '1',
      lastLoginAt: new Date(),
    });
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt-1',
      userId: '1',
      tokenHash: 'hash',
      expiresAt: new Date(),
    });
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);

    await service.login('TEST@EXAMPLE.COM', 'correctpassword');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
      select: expect.any(Object),
    });
  });

  it('should not update lastLoginAt on failed login', async () => {
    const hashedPassword = '$argon2id$v=19$m=65536,p=4,t=3$test$test';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'USER',
    });
    jest.spyOn(argon2, 'verify').mockResolvedValue(false);

    await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should refresh successfully and rotate token', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      userId: '1',
      tokenHash: 'oldhash',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      replacedById: null,
      createdAt: new Date(),
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockJwtService.signAsync.mockResolvedValue('new-mock-jwt-token');
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt-2',
      userId: '1',
      tokenHash: 'newhash',
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.refresh('old-raw-token');

    expect(result.accessToken).toBe('new-mock-jwt-token');
    expect(result.expiresIn).toBe(900);
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).toHaveLength(64);
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: '1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-1', revokedAt: null },
      data: { revokedAt: expect.any(Date), replacedById: 'rt-2' },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException for invalid refresh token', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

    await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for expired refresh token', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      expiresAt: new Date(Date.now() - 86400000),
      revokedAt: null,
    });

    await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for revoked refresh token', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(),
    });

    await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should logout and revoke refresh token', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      revokedAt: null,
    });
    mockPrisma.refreshToken.update.mockResolvedValue({
      id: 'rt-1',
      revokedAt: new Date(),
    });

    await service.logout('some-raw-token');

    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('should handle logout when token does not exist', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

    await expect(service.logout('nonexistent-token')).resolves.toBeUndefined();
  });

  it('should validate access token and return user context', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      role: 'USER',
    });
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: '1',
      email: 'test@example.com',
      role: 'USER',
    });

    const result = await service.validateAccessToken('valid-token');

    expect(result).toEqual({ userId: '1', email: 'test@example.com', role: 'USER' });
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
      secret: process.env.JWT_ACCESS_SECRET,
    });
  });

  it('should throw UnauthorizedException for invalid access token', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(service.validateAccessToken('invalid-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when access token user does not exist', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({ sub: 'missing' });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.validateAccessToken('token-for-missing-user')).rejects.toThrow(UnauthorizedException);
  });

  it('should get current user safely', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getCurrentUser('1');

    expect(result).toEqual({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('should throw UnauthorizedException when current user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getCurrentUser('missing')).rejects.toThrow(UnauthorizedException);
  });
});