import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../../server/index.js';
import type { FastifyInstance } from 'fastify';
import { setupIsolatedDb } from '../../../test/db.js';

/**
 * Accounts V1 Routes - Integration Tests
 * Uses isolated database file per test run
 */

// Share single server instance across all tests
let server: FastifyInstance;
let testDb: Awaited<ReturnType<typeof setupIsolatedDb>>;

beforeAll(async () => {
  testDb = await setupIsolatedDb();  // Set DB path first
  server = await buildServer();      // Then build server (will use that path)
});

afterAll(async () => {
  await server.close();
  await testDb.teardown();
  testDb.restoreEnv();
});

describe('POST /v1/accounts', () => {

  it('should create an account with valid data', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'create-test-1',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Chase Checking',
        institution: 'Chase Bank',
        type: 'checking',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data).toMatchObject({
      name: 'Chase Checking',
      institution: 'Chase Bank',
      type: 'checking',
    });
    expect(body.data.id).toBeTruthy();
    expect(body.data.createdAt).toBeTypeOf('number');
    expect(body.data.createdAt).toBeGreaterThan(0);
  });

  it('should respect type enum constraint', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'create-test-invalid-type',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
        type: 'invalid-type',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/bad-request');
    expect(body.title).toBe('Bad Request');
    expect(body.errors).toBeDefined();
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'type',
        }),
      ])
    );
  });

  it('should reject missing required fields', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'create-test-missing-name',
        'content-type': 'application/json',
      },
      payload: {
        type: 'savings',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/bad-request');
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'name',
        }),
      ])
    );
  });

  it('should handle idempotency correctly', async () => {
    const payload = {
      name: 'Idempotent Account',
      institution: 'Test Bank',
      type: 'savings' as const,
    };

    // First request
    const response1 = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'idempotency-test-1',
        'content-type': 'application/json',
      },
      payload,
    });

    expect(response1.statusCode).toBe(201);
    const body1 = JSON.parse(response1.body);
    expect(response1.headers['x-idempotency-replayed']).toBeUndefined();

    // Second request with same idempotency key
    const response2 = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'idempotency-test-1',
        'content-type': 'application/json',
      },
      payload,
    });

    expect(response2.statusCode).toBe(201);
    const body2 = JSON.parse(response2.body);
    expect(response2.headers['x-idempotency-replayed']).toBe('true');
    expect(response2.headers['x-idempotency-age']).toBeDefined();

    // Should return same resource
    expect(body2.data.id).toBe(body1.data.id);
    expect(body2.data.createdAt).toBe(body1.data.createdAt);

    // Verify no duplicate was created
    const listResponse = await server.inject({
      method: 'GET',
      url: '/v1/accounts',
    });

    const listBody = JSON.parse(listResponse.body);
    const matchingAccounts = listBody.data.filter(
      (acc: any) => acc.name === 'Idempotent Account'
    );
    expect(matchingAccounts).toHaveLength(1);
  });

  it('should require Idempotency-Key header', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
        type: 'checking',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('Idempotency-Key');
  });

  it('should default institution to empty string when omitted', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'create-test-no-institution',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Cash Wallet',
        type: 'cash',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data.institution).toBe('');
  });
});

describe('GET /v1/accounts/:id', () => {
  let accountId: string;

  beforeAll(async () => {
    // Create a test account
    const response = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'get-test-setup',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Get Test Account',
        type: 'checking',
      },
    });

    const body = JSON.parse(response.body);
    accountId = body.data.id;
  });

  it('should return account by id', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/v1/accounts/${accountId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toMatchObject({
      id: accountId,
      name: 'Get Test Account',
      type: 'checking',
    });
  });

  it('should return 404 for non-existent account', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts/non-existent-id',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/not-found');
    expect(body.title).toBe('Not Found');
    expect(body.detail).toContain('non-existent-id');
  });
});

describe('PATCH /v1/accounts/:id', () => {
  let accountId: string;

  beforeAll(async () => {
    // Create a test account
    const response = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'patch-test-setup',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Original Name',
        institution: 'Original Bank',
        type: 'checking',
      },
    });

    const body = JSON.parse(response.body);
    accountId = body.data.id;
  });

  it('should update account name and type', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/accounts/${accountId}`,
      headers: {
        'idempotency-key': 'patch-test-1',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Updated Name',
        type: 'savings',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toMatchObject({
      id: accountId,
      name: 'Updated Name',
      type: 'savings',
      institution: 'Original Bank', // Should remain unchanged
    });
  });

  it('should reject invalid type', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/accounts/${accountId}`,
      headers: {
        'idempotency-key': 'patch-test-invalid-type',
        'content-type': 'application/json',
      },
      payload: {
        type: 'invalid-type',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/bad-request');
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'type',
        }),
      ])
    );
  });

  it('should return 404 for non-existent account', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: '/v1/accounts/non-existent-id',
      headers: {
        'idempotency-key': 'patch-test-404',
        'content-type': 'application/json',
      },
      payload: {
        name: 'New Name',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/not-found');
  });

  it('should allow partial updates', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/accounts/${accountId}`,
      headers: {
        'idempotency-key': 'patch-test-partial',
        'content-type': 'application/json',
      },
      payload: {
        institution: 'New Bank',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.institution).toBe('New Bank');
    // Name and type should remain from previous update
    expect(body.data.name).toBe('Updated Name');
    expect(body.data.type).toBe('savings');
  });
});

describe('DELETE /v1/accounts/:id', () => {
  let accountId: string;

  beforeAll(async () => {
    // Create a test account
    const response = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'delete-test-setup',
        'content-type': 'application/json',
      },
      payload: {
        name: 'To Be Deleted',
        type: 'checking',
      },
    });

    const body = JSON.parse(response.body);
    accountId = body.data.id;
  });

  it('should delete account and return 204', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: `/v1/accounts/${accountId}`,
      headers: {
        'idempotency-key': 'delete-test-1',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('should return 404 when getting deleted account', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/v1/accounts/${accountId}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 404 when deleting non-existent account', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: '/v1/accounts/non-existent-id',
      headers: {
        'idempotency-key': 'delete-test-404',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/not-found');
  });
});

describe('GET /v1/accounts (pagination)', () => {
  const accountIds: string[] = [];

  beforeAll(async () => {
    // Create 30 accounts with controlled timing to ensure stable ordering
    for (let i = 1; i <= 30; i++) {
      const response = await server.inject({
        method: 'POST',
        url: '/v1/accounts',
        headers: {
          'idempotency-key': `pagination-setup-${i}`,
          'content-type': 'application/json',
        },
        payload: {
          name: `Account ${i.toString().padStart(2, '0')}`,
          institution: `Bank ${i}`,
          type: i % 4 === 0 ? 'credit' : i % 3 === 0 ? 'savings' : i % 2 === 0 ? 'cash' : 'checking',
        },
      });

      const body = JSON.parse(response.body);
      accountIds.push(body.data.id);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  });

  it('should return first page with limit=10', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts?limit=10',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(10);
    expect(body.count).toBe(10);
    expect(body.nextCursor).toBeTruthy();

    // Verify ordering: created_at DESC, then id DESC
    // Most recent accounts should be first
    expect(body.data[0].name).toBe('Account 30');
  });

  it('should paginate through all records with stable ordering', async () => {
    const allAccounts: any[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    do {
      const url = cursor
        ? `/v1/accounts?limit=10&cursor=${encodeURIComponent(cursor)}`
        : '/v1/accounts?limit=10';

      const response = await server.inject({
        method: 'GET',
        url,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      allAccounts.push(...body.data);
      cursor = body.nextCursor;
      pageCount++;

      // Prevent infinite loops in case of bug
      expect(pageCount).toBeLessThanOrEqual(4);
    } while (cursor);

    // Should have fetched all 30 accounts plus the ones from other tests
    expect(allAccounts.length).toBeGreaterThanOrEqual(30);

    // Verify no duplicates
    const ids = allAccounts.map((acc) => acc.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // Verify stable ordering (DESC by createdAt, then id)
    for (let i = 1; i < allAccounts.length; i++) {
      const prev = allAccounts[i - 1];
      const curr = allAccounts[i];

      if (prev.createdAt === curr.createdAt) {
        // If same timestamp, id should be DESC
        expect(prev.id > curr.id).toBe(true);
      } else {
        // Otherwise, createdAt should be DESC
        expect(prev.createdAt > curr.createdAt).toBe(true);
      }
    }
  });

  it('should handle limit parameter validation', async () => {
    // Limit too high
    const response1 = await server.inject({
      method: 'GET',
      url: '/v1/accounts?limit=101',
    });

    expect(response1.statusCode).toBe(400);

    // Limit too low
    const response2 = await server.inject({
      method: 'GET',
      url: '/v1/accounts?limit=0',
    });

    expect(response2.statusCode).toBe(400);

    // Valid limit
    const response3 = await server.inject({
      method: 'GET',
      url: '/v1/accounts?limit=50',
    });

    expect(response3.statusCode).toBe(200);
  });

  it('should return empty nextCursor on last page', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts?limit=100',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.nextCursor).toBeNull();
  });

  it('should reject invalid cursor', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts?cursor=invalid-cursor',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('cursor');
  });
});

describe('GET /v1/accounts (search)', () => {
  beforeAll(async () => {
    // Create accounts with distinct names and institutions
    const testAccounts = [
      { name: 'Chase Freedom', institution: 'Chase Bank', type: 'credit' },
      { name: 'Ally Savings', institution: 'Ally Bank', type: 'savings' },
      { name: 'Wells Checking', institution: 'Wells Fargo', type: 'checking' },
      { name: 'Capital One', institution: 'Capital One Bank', type: 'credit' },
      { name: 'Cash Wallet', institution: '', type: 'cash' },
    ];

    for (let i = 0; i < testAccounts.length; i++) {
      await server.inject({
        method: 'POST',
        url: '/v1/accounts',
        headers: {
          'idempotency-key': `search-setup-${i}`,
          'content-type': 'application/json',
        },
        payload: testAccounts[i],
      });
    }
  });

  it('should filter by name (case-insensitive)', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts?q=chase',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBeGreaterThan(0);

    // All results should contain 'chase' in name or institution (case-insensitive)
    for (const account of body.data) {
      const nameMatch = account.name.toLowerCase().includes('chase');
      const institutionMatch = account.institution.toLowerCase().includes('chase');
      expect(nameMatch || institutionMatch).toBe(true);
    }
  });

  it('should filter by institution (case-insensitive)', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts?q=FARGO',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBeGreaterThan(0);

    for (const account of body.data) {
      const nameMatch = account.name.toLowerCase().includes('fargo');
      const institutionMatch = account.institution.toLowerCase().includes('fargo');
      expect(nameMatch || institutionMatch).toBe(true);
    }
  });

  it('should return empty array for no matches', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts?q=NonExistentBank',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.count).toBe(0);
    expect(body.nextCursor).toBeNull();
  });

  it('should combine search with pagination', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts?q=bank&limit=2',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBeLessThanOrEqual(2);

    // If there are more than 2 results, nextCursor should be present
    if (body.nextCursor) {
      // Fetch next page
      const response2 = await server.inject({
        method: 'GET',
        url: `/v1/accounts?q=bank&limit=2&cursor=${encodeURIComponent(body.nextCursor)}`,
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);

      // Verify no duplicates across pages
      const page1Ids = body.data.map((a: any) => a.id);
      const page2Ids = body2.data.map((a: any) => a.id);
      const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    }
  });

  it('should handle special characters in search query', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/accounts?q=one%20bank',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    // Should match "Capital One Bank"
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('should respect query length limit', async () => {
    const longQuery = 'a'.repeat(101);
    const response = await server.inject({
      method: 'GET',
      url: `/v1/accounts?q=${longQuery}`,
    });

    expect(response.statusCode).toBe(400);
  });
});
