import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Auth Security Hardening', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('Auth Endpoint Behavior', () => {
    it('should return generic error for invalid login', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrongpassword12' })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 for unauthorized access to protected routes', async () => {
      await request(app.getHttpServer())
        .get('/api/companies')
        .expect(401);
    });

    it('should return auth error without stack traces', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('Cookie Security', () => {
    it('should not return refresh token in login response', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrongpassword12' })
        .expect(401);

      expect(response.body).not.toHaveProperty('refreshToken');
    });
  });
});
