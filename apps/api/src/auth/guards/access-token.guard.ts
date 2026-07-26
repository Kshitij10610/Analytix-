import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      throw new UnauthorizedException('Missing access token');
    }

    const [type, token] = authorizationHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid access token format');
    }

    const user = await this.authService.validateAccessToken(token);
    request.user = user;

    return true;
  }
}
