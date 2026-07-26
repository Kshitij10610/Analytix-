import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from '../auth.service';

describe('AccessTokenGuard', () => {
  let guard: AccessTokenGuard;
  let authService: AuthService;

  const mockAuthService = {
    validateAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenGuard,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    guard = module.get<AccessTokenGuard>(AccessTokenGuard);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should authenticate request with valid access token', async () => {
    mockAuthService.validateAccessToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'USER' });

    const context = createExecutionContext('Bearer valid-token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual({ userId: '1', email: 'test@example.com', role: 'USER' });
    expect(mockAuthService.validateAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    const context = createExecutionContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(mockAuthService.validateAccessToken).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException on malformed Bearer header', async () => {
    const context = createExecutionContext('Token invalid-token');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(mockAuthService.validateAccessToken).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException on empty bearer token', async () => {
    const context = createExecutionContext('Bearer ');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(mockAuthService.validateAccessToken).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    mockAuthService.validateAccessToken.mockRejectedValue(new UnauthorizedException('Invalid access token'));

    const context = createExecutionContext('Bearer invalid-token');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});

function createExecutionContext(authorizationHeader: string | undefined): ExecutionContext {
  const request: any = {
    headers: {
      authorization: authorizationHeader,
    },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
}
