import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../index.js';
import type { FastifyInstance } from 'fastify';

describe('Health Routes', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    // Use in-memory database for tests
    process.env.DATABASE_URL = ':memory:';
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('GET /health should return status ok', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('dbFile');
    expect(body).toHaveProperty('timestamp');
  });
});
