import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenGuard } from './guards/access-token.guard';

function parseCookieHeader(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';').map((c) => c.trim().split('='));
  for (const [key, value] of cookies) {
    if (key === name) return value;
  }
  return undefined;
}

function buildCookieOptions(): { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number } {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ medium: { limit: 5 } })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto.email, registerDto.password, registerDto.name);
  }

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5 } })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto.email, loginDto.password);
    const { refreshToken, ...response } = result;
    res.cookie('refreshToken', refreshToken, buildCookieOptions());
    return response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 20 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = parseCookieHeader(req.headers.cookie, 'refreshToken');
    const result = await this.authService.refresh(rawRefreshToken);
    const { refreshToken, ...response } = result;
    res.cookie('refreshToken', refreshToken, buildCookieOptions());
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = parseCookieHeader(req.headers.cookie, 'refreshToken');
    await this.authService.logout(rawRefreshToken);
    res.clearCookie('refreshToken', { path: '/auth' });
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(AccessTokenGuard)
  async me(@CurrentUser() user: { userId: string; email: string; role: string }) {
    return this.authService.getCurrentUser(user.userId);
  }
}
