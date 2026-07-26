import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            validateAccessToken: jest.fn(),
            getCurrentUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should register a user', async () => {
    const dto = { email: 'test@example.com', password: 'password123', name: 'Test' };
    const result = { id: '1', email: 'test@example.com', name: 'Test', role: 'USER' };
    jest.spyOn(service, 'register').mockResolvedValue(result as any);

    expect(await controller.register(dto)).toBe(result);
    expect(service.register).toHaveBeenCalledWith('test@example.com', 'password123', 'Test');
  });

  it('should throw ConflictException on duplicate email', async () => {
    jest.spyOn(service, 'register').mockRejectedValue(new ConflictException('Email already registered'));

    await expect(controller.register({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('should login successfully and strip refreshToken from response', async () => {
    const dto = { email: 'test@example.com', password: 'password123' };
    const result = {
      accessToken: 'mock-token',
      expiresIn: 900,
      user: { id: '1', email: 'test@example.com', name: 'Test', role: 'USER' },
      refreshToken: 'mock-refresh-token',
    };
    jest.spyOn(service, 'login').mockResolvedValue(result as any);

    const response = await controller.login(dto, mockResponse as any);

    expect(response.accessToken).toBe('mock-token');
    expect(response).not.toHaveProperty('refreshToken');
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'mock-refresh-token',
      expect.any(Object),
    );
  });

  it('should throw UnauthorizedException on invalid credentials', async () => {
    jest.spyOn(service, 'login').mockRejectedValue(new UnauthorizedException('Invalid email or password'));

    await expect(controller.login({ email: 'test@example.com', password: 'wrong' }, mockResponse as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should refresh successfully', async () => {
    const result = {
      accessToken: 'new-mock-token',
      expiresIn: 900,
      user: { id: '1', email: 'test@example.com', name: 'Test', role: 'USER' },
      refreshToken: 'new-mock-refresh-token',
    };
    jest.spyOn(service, 'refresh').mockResolvedValue(result as any);

    const req = { headers: { cookie: 'refreshToken=old-token' } };
    const response = await controller.refresh(req as any, mockResponse as any);

    expect(response.accessToken).toBe('new-mock-token');
    expect(response).not.toHaveProperty('refreshToken');
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'new-mock-refresh-token',
      expect.any(Object),
    );
  });

  it('should throw UnauthorizedException on missing refresh cookie', async () => {
    jest.spyOn(service, 'refresh').mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

    const req = { headers: {} };
    await expect(controller.refresh(req as any, mockResponse as any)).rejects.toThrow(UnauthorizedException);
  });

  it('should logout successfully', async () => {
    jest.spyOn(service, 'logout').mockResolvedValue(undefined);

    const req = { headers: { cookie: 'refreshToken=some-token' } };
    const response = await controller.logout(req as any, mockResponse as any);

    expect(response).toEqual({ message: 'Logged out successfully' });
    expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/auth' });
  });

  it('should return current user with valid access token', async () => {
    jest.spyOn(service, 'getCurrentUser').mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test', role: 'USER', createdAt: new Date(), updatedAt: new Date() });

    const result = await controller.me({ userId: '1', email: 'test@example.com', role: 'USER' } as any);

    expect(result).toEqual({ id: '1', email: 'test@example.com', name: 'Test', role: 'USER', createdAt: expect.any(Date), updatedAt: expect.any(Date) });
    expect(service.getCurrentUser).toHaveBeenCalledWith('1');
  });
});
