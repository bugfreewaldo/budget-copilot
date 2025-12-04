import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { runMigrations } from '../../db/migrate.js';

describe('Transaction Routes', () => {
  let server: FastifyInstance;
  let accountId: string;

  beforeAll(async () => {
    // Use in-memory database for tests
    process.env.DATABASE_URL = ':memory:';
    server = await buildServer();
    await runMigrations();

    // Create a test account
    const accountResponse = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      payload: {
        name: 'Test Account',
        type: 'checking',
      },
    });

    const accountData = JSON.parse(accountResponse.body);
    accountId = accountData.data.id;
  });

  afterAll(async () => {
    await server.close();
  });

  it('POST /v1/transactions should create a transaction', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/transactions',
      payload: {
        date: '2024-01-15',
        description: 'Test Transaction',
        amountCents: -5000,
        type: 'expense',
        accountId,
        cleared: false,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body);
    expect(body.data).toHaveProperty('id');
    expect(body.data.description).toBe('Test Transaction');
    expect(body.data.amountCents).toBe(-5000);
  });

  it('GET /v1/transactions should list transactions', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/transactions',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET /v1/transactions with filters should work', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/transactions?from=2024-01-01&to=2024-01-31',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.data).toBeInstanceOf(Array);
  });

  it('POST /v1/transactions with invalid data should return 400', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/transactions',
      payload: {
        // Missing required fields
        description: 'Invalid',
      },
    });

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
