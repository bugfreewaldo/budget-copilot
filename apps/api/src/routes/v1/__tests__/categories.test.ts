import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../../server/index.js';
import type { FastifyInstance } from 'fastify';
import { setupIsolatedDb } from '../../../test/db.js';
import { getDb } from '../../../db/client.js';
import { envelopes, transactions } from '../../../db/schema.js';
import { nanoid } from 'nanoid';

/**
 * Categories V1 Routes - Integration Tests
 * Uses isolated database file per test run
 */

// Share single server instance across all tests
let server: FastifyInstance;
let testDb: Awaited<ReturnType<typeof setupIsolatedDb>>;

beforeAll(async () => {
  testDb = await setupIsolatedDb(); // Set DB path first
  server = await buildServer(); // Then build server (will use that path)
});

afterAll(async () => {
  await server.close();
  await testDb.teardown();
  testDb.restoreEnv();
});

describe('POST /v1/categories', () => {
  it('should create a category with valid data', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'create-test-1',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Groceries',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data.name).toBe('Groceries');
    expect(body.data.parentId).toBeNull();
    expect(body.data.id).toBeTruthy();
    expect(body.data.createdAt).toBeTypeOf('number');
    expect(body.data.createdAt).toBeGreaterThan(0);
  });

  it('should create a category with parent_id', async () => {
    // First create parent
    const parentResponse = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'create-parent-1',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Food',
      },
    });

    const parentBody = JSON.parse(parentResponse.body);
    const parentId = parentBody.data.id;

    // Create child
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'create-child-1',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Restaurants',
        parent_id: parentId,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data.name).toBe('Restaurants');
    expect(body.data.parentId).toBe(parentId);
  });

  it('should reject empty name', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'create-test-empty',
        'content-type': 'application/json',
      },
      payload: {
        name: '',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/bad-request');
  });

  it('should reject name longer than 64 chars', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'create-test-long',
        'content-type': 'application/json',
      },
      payload: {
        name: 'a'.repeat(65),
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should reject invalid parent_id', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'create-test-bad-parent',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test',
        parent_id: 'non-existent-id',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('parent_id');
  });

  it('should handle idempotency correctly', async () => {
    const payload = {
      name: 'Idempotency Test',
    };

    // First request
    const response1 = await server.inject({
      method: 'POST',
      url: '/v1/categories',
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
      url: '/v1/categories',
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
  });

  it('should require idempotency-key header', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('Idempotency-Key');
  });
});

describe('GET /v1/categories/:id', () => {
  let categoryId: string;

  beforeAll(async () => {
    // Create a test category
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'get-test-setup',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Get Test Category',
      },
    });

    const body = JSON.parse(response.body);
    categoryId = body.data.id;
  });

  it('should return category by id', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/v1/categories/${categoryId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.id).toBe(categoryId);
    expect(body.data.name).toBe('Get Test Category');
  });

  it('should return 404 for non-existent id', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/categories/non-existent-id',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/not-found');
    expect(body.title).toBe('Not Found');
    expect(body.detail).toContain('non-existent-id');
  });
});

describe('PATCH /v1/categories/:id', () => {
  let categoryId: string;

  beforeAll(async () => {
    // Create a test category
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'patch-test-setup',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Patch Test Category',
      },
    });

    const body = JSON.parse(response.body);
    categoryId = body.data.id;
  });

  it('should update category name', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/categories/${categoryId}`,
      headers: {
        'idempotency-key': 'patch-test-1',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Updated Name',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.name).toBe('Updated Name');
    expect(body.data.id).toBe(categoryId);
  });

  it('should update parent_id', async () => {
    // Create parent category
    const parentResponse = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'patch-parent-setup',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Parent Category',
      },
    });

    const parentBody = JSON.parse(parentResponse.body);
    const parentId = parentBody.data.id;

    // Update with parent
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/categories/${categoryId}`,
      headers: {
        'idempotency-key': 'patch-test-2',
        'content-type': 'application/json',
      },
      payload: {
        parent_id: parentId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.parentId).toBe(parentId);
  });

  it('should clear parent_id with null', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/categories/${categoryId}`,
      headers: {
        'idempotency-key': 'patch-test-3',
        'content-type': 'application/json',
      },
      payload: {
        parent_id: null,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.parentId).toBeNull();
  });

  it('should reject setting self as parent', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/categories/${categoryId}`,
      headers: {
        'idempotency-key': 'patch-test-cycle-1',
        'content-type': 'application/json',
      },
      payload: {
        parent_id: categoryId,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('circular');
  });

  it('should reject creating circular reference', async () => {
    // Create A -> B -> C hierarchy
    const responseA = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'cycle-a',
        'content-type': 'application/json',
      },
      payload: { name: 'Category A' },
    });
    const idA = JSON.parse(responseA.body).data.id;

    const responseB = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'cycle-b',
        'content-type': 'application/json',
      },
      payload: { name: 'Category B', parent_id: idA },
    });
    const idB = JSON.parse(responseB.body).data.id;

    const responseC = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'cycle-c',
        'content-type': 'application/json',
      },
      payload: { name: 'Category C', parent_id: idB },
    });
    const idC = JSON.parse(responseC.body).data.id;

    // Try to set A's parent to C (would create cycle)
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/categories/${idA}`,
      headers: {
        'idempotency-key': 'cycle-test',
        'content-type': 'application/json',
      },
      payload: {
        parent_id: idC,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('circular');
  });

  it('should reject empty name', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: `/v1/categories/${categoryId}`,
      headers: {
        'idempotency-key': 'patch-test-empty',
        'content-type': 'application/json',
      },
      payload: {
        name: '',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 for non-existent category', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: '/v1/categories/non-existent-id',
      headers: {
        'idempotency-key': 'patch-test-404',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Updated',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/not-found');
  });
});

describe('DELETE /v1/categories/:id', () => {
  let categoryId: string;

  beforeAll(async () => {
    // Create a test category
    const response = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'delete-test-setup',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Delete Test Category',
      },
    });

    const body = JSON.parse(response.body);
    categoryId = body.data.id;
  });

  it('should delete category and return 204', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: `/v1/categories/${categoryId}`,
      headers: {
        'idempotency-key': 'delete-test-1',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    // Verify deletion
    const getResponse = await server.inject({
      method: 'GET',
      url: `/v1/categories/${categoryId}`,
    });

    expect(getResponse.statusCode).toBe(404);
  });

  it('should return 404 for non-existent category', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: '/v1/categories/non-existent-id',
      headers: {
        'idempotency-key': 'delete-test-404',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/not-found');
  });

  it('should return 409 when category has children', async () => {
    // Create parent
    const parentResponse = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'delete-parent-with-children',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Parent With Children',
      },
    });

    const parentId = JSON.parse(parentResponse.body).data.id;

    // Create child
    await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'delete-child',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Child',
        parent_id: parentId,
      },
    });

    // Try to delete parent
    const response = await server.inject({
      method: 'DELETE',
      url: `/v1/categories/${parentId}`,
      headers: {
        'idempotency-key': 'delete-test-conflict',
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://budget-copilot.dev/problems/conflict');
    expect(body.detail).toContain('child categories');
  });

  it('should return 409 when referenced by envelope', async () => {
    // Create category
    const categoryResponse = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'delete-with-envelope',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Category With Envelope',
      },
    });

    const testCategoryId = JSON.parse(categoryResponse.body).data.id;

    // Create envelope directly in DB
    const db = await getDb();
    await db.insert(envelopes).values({
      id: nanoid(),
      categoryId: testCategoryId,
      month: '2024-01',
      budgetCents: 10000,
      createdAt: Date.now(),
    });

    // Try to delete category
    const response = await server.inject({
      method: 'DELETE',
      url: `/v1/categories/${testCategoryId}`,
      headers: {
        'idempotency-key': 'delete-test-envelope-conflict',
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('envelopes or transactions');
  });

  it('should return 409 when referenced by transaction', async () => {
    // Create category and account
    const categoryResponse = await server.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        'idempotency-key': 'delete-with-transaction',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Category With Transaction',
      },
    });

    const testCategoryId = JSON.parse(categoryResponse.body).data.id;

    const accountResponse = await server.inject({
      method: 'POST',
      url: '/v1/accounts',
      headers: {
        'idempotency-key': 'delete-test-account',
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test Account',
        type: 'checking',
      },
    });

    const accountId = JSON.parse(accountResponse.body).data.id;

    // Create transaction directly in DB
    const db = await getDb();
    await db.insert(transactions).values({
      id: nanoid(),
      date: '2024-01-15',
      description: 'Test transaction',
      amountCents: -5000,
      type: 'expense',
      categoryId: testCategoryId,
      accountId: accountId,
      cleared: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Try to delete category
    const response = await server.inject({
      method: 'DELETE',
      url: `/v1/categories/${testCategoryId}`,
      headers: {
        'idempotency-key': 'delete-test-transaction-conflict',
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('envelopes or transactions');
  });
});

describe('GET /v1/categories (pagination)', () => {
  beforeAll(async () => {
    // Create 20 categories with controlled timing
    for (let i = 1; i <= 20; i++) {
      await server.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: {
          'idempotency-key': `pagination-setup-${i}`,
          'content-type': 'application/json',
        },
        payload: {
          name: `Category ${i}`,
        },
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  });

  it('should return first page with limit=10', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/categories?limit=10',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(10);
    expect(body.count).toBe(10);
    expect(body.nextCursor).toBeTruthy();

    // Should be in ASC order (oldest first)
    // ASC order verified by stable ordering test
  });

  it('should paginate through all records with stable ordering', async () => {
    const allCategories: any[] = [];
    let cursor: string | undefined = undefined;

    // Fetch first page
    const response1 = await server.inject({
      method: 'GET',
      url: '/v1/categories?limit=10',
    });

    expect(response1.statusCode).toBe(200);
    const body1 = JSON.parse(response1.body);
    allCategories.push(...body1.data);
    cursor = body1.nextCursor;

    // Fetch second page
    const response2 = await server.inject({
      method: 'GET',
      url: `/v1/categories?limit=10&cursor=${cursor}`,
    });

    expect(response2.statusCode).toBe(200);
    const body2 = JSON.parse(response2.body);
    allCategories.push(...body2.data);

    // Verify no duplicates
    const ids = allCategories.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // Verify ordering (ASC by createdAt, then id)
    for (let i = 1; i < allCategories.length; i++) {
      const prev = allCategories[i - 1];
      const curr = allCategories[i];

      if (prev.createdAt === curr.createdAt) {
        expect(curr.id > prev.id).toBe(true);
      } else {
        expect(curr.createdAt >= prev.createdAt).toBe(true);
      }
    }
  });

  it('should return empty cursor when no more results', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/categories?limit=100',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.nextCursor).toBeNull();
  });

  it('should reject invalid cursor', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/categories?cursor=invalid-base64',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain('cursor');
  });
});

describe('GET /v1/categories (search)', () => {
  beforeAll(async () => {
    // Create categories with distinct names
    const testCategories = [
      { name: 'Grocery Store' },
      { name: 'Gas Station' },
      { name: 'Restaurant Dining' },
      { name: 'Online Shopping' },
      { name: 'Utilities' },
    ];

    for (let i = 0; i < testCategories.length; i++) {
      await server.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: {
          'idempotency-key': `search-setup-${i}`,
          'content-type': 'application/json',
        },
        payload: testCategories[i],
      });
    }
  });

  it('should filter by name (case-insensitive)', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/categories?q=grocery',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].name).toContain('Grocery');
  });

  it('should support partial matches', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/categories?q=shop',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.some((c: any) => c.name.includes('Shopping'))).toBe(true);
  });

  it('should combine search with pagination', async () => {
    // Search with limit
    const response = await server.inject({
      method: 'GET',
      url: '/v1/categories?q=category&limit=5',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBeLessThanOrEqual(5);

    if (body.nextCursor) {
      // Fetch next page
      const response2 = await server.inject({
        method: 'GET',
        url: `/v1/categories?q=category&limit=5&cursor=${body.nextCursor}`,
      });

      expect(response2.statusCode).toBe(200);
    }
  });

  it('should return empty array when no matches', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/categories?q=nonexistent',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });

  it('should reject search query longer than 100 chars', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/v1/categories?q=${'a'.repeat(101)}`,
    });

    expect(response.statusCode).toBe(400);
  });
});
