import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let prismaService: PrismaService;

  const mockPrismaService = {
    prisma: {
      user: {
        findUnique: jest.fn(),
      },
    },
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access when no roles required', async () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);
    const context = createExecutionContext({ userId: '1', role: 'USER' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(prismaService.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should allow access with matching role', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    mockPrismaService.prisma.user.findUnique.mockResolvedValue({ id: '1', role: 'ADMIN' });
    const context = createExecutionContext({ userId: '1' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(prismaService.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '1' },
      select: { role: true },
    });
  });

  it('should throw ForbiddenException for unauthenticated user', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createExecutionContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(prismaService.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException for mismatched role', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    mockPrismaService.prisma.user.findUnique.mockResolvedValue({ id: '1', role: 'USER' });
    const context = createExecutionContext({ userId: '1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException for missing user in database', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);
    const context = createExecutionContext({ userId: '1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow multiple roles', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['USER', 'ANALYST', 'ADMIN']);
    mockPrismaService.prisma.user.findUnique.mockResolvedValue({ id: '1', role: 'ANALYST' });
    const context = createExecutionContext({ userId: '1' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });
});

function createExecutionContext(user: { userId?: string; role?: string } | undefined): ExecutionContext {
  const request: any = {
    user,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}
