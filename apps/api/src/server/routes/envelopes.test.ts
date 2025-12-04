import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { setupIsolatedDb } from '../../test/db.js';
import { createTestUser, type TestUser } from '../../test/auth.js';

describe('Envelope Routes', () => {
  let server: FastifyInstance;
  let testDb: Awaited<ReturnType<typeof setupIsolatedDb>>;
  let _testUser: TestUser;
  let accountId: string;
  let categoryId: string;
  const testMonth = '2024-01';

  beforeAll(async () => {
    testDb = await setupIsolatedDb();
    server = await buildServer();

    // Create a test user with the fixed test-user-id
    _testUser = await createTestUser({ id: 'test-user-id' });

    // Create test account
    const accountResponse = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'envelope-test-account-1',
        'content-type': 'application/json',
      },
      payload: { name: 'Test Account', type: 'checking' },
    });
    accountId = JSON.parse(accountResponse.body).data.id;

    // Create test category
    const categoryResponse = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'envelope-test-category-1',
        'content-type': 'application/json',
      },
      payload: { name: 'Test Category' },
    });
    categoryId = JSON.parse(categoryResponse.body).data.id;
  });

  afterAll(async () => {
    await server.close();
    await testDb.teardown();
    testDb.restoreEnv();
  });

  it('POST /v1/envelopes should create an envelope', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/envelopes',
      headers: {
        'idempotency-key': 'envelope-create-1',
        'content-type': 'application/json',
      },
      payload: {
        categoryId,
        month: testMonth,
        budgetCents: 50000, // $500
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body);
    expect(body.data).toHaveProperty('id');
    expect(body.data.budgetCents).toBe(50000);
    expect(body.data.month).toBe(testMonth);
  });

  it('GET /v1/envelopes should return envelopes with spending', async () => {
    // Create a transaction in the category
    await server.inject({
      method: 'POST',
      url: '/v1/transactions',
      headers: {
        'idempotency-key': 'envelope-test-transaction-1',
        'content-type': 'application/json',
      },
      payload: {
        date: '2024-01-15',
        description: 'Test Expense',
        amountCents: -10000, // -$100
        type: 'expense',
        categoryId,
        accountId,
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/v1/envelopes?month=${testMonth}`,
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);

    const envelope = body.data[0];
    expect(envelope).toHaveProperty('budgetCents', 50000);
    expect(envelope).toHaveProperty('spentCents', 10000); // Absolute value
    expect(envelope).toHaveProperty('remainingCents', 40000); // 50000 - 10000
  });

  it('POST /v1/envelopes should upsert (update existing)', async () => {
    // Update the same envelope
    const response = await server.inject({
      method: 'POST',
      url: '/v1/envelopes',
      headers: {
        'idempotency-key': 'envelope-upsert-1',
        'content-type': 'application/json',
      },
      payload: {
        categoryId,
        month: testMonth,
        budgetCents: 60000, // Updated to $600
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body);
    expect(body.data.budgetCents).toBe(60000);

    // Verify only one envelope exists
    const listResponse = await server.inject({
      method: 'GET',
      url: `/v1/envelopes?month=${testMonth}`,
    });

    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data.length).toBe(1);
  });
});
