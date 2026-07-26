import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtAccessSecret || jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET is not configured or is too weak');
  }

  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET is not configured or is too weak');
  }

  if (jwtAccessSecret === jwtRefreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  app.getHttpAdapter().getInstance().disable('x-powered-by');

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
}
bootstrap();
