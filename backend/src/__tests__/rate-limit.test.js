const express = require('express');
const request = require('supertest');
const { buildLoginRateLimiter } = require('../config/rate-limit');

describe('login rate limiter', () => {
  test('blocks repeated failed login attempts', async () => {
    const app = express();

    app.use(express.json());
    app.post(
      '/login',
      buildLoginRateLimiter({
        limit: 2,
        windowMs: 60 * 1000
      }),
      (request, response) => {
        response.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid email or password.'
        });
      }
    );

    const firstResponse = await request(app).post('/login').send({
      email: 'rate-limit@example.com',
      password: 'bad-password'
    });
    const secondResponse = await request(app).post('/login').send({
      email: 'rate-limit@example.com',
      password: 'bad-password'
    });
    const thirdResponse = await request(app).post('/login').send({
      email: 'rate-limit@example.com',
      password: 'bad-password'
    });

    expect(firstResponse.status).toBe(401);
    expect(secondResponse.status).toBe(401);
    expect(thirdResponse.status).toBe(429);
    expect(thirdResponse.body).toEqual({
      error: 'Too Many Requests',
      message: 'Too many login attempts. Please try again later.'
    });
  });
});
