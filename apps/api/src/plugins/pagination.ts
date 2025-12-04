import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Cursor-based pagination plugin
 * Encodes/decodes opaque cursors based on created_at + id
 */

export interface CursorData {
  createdAt: number; // Unix timestamp in ms
  id: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  count: number;
}

/**
 * Encode cursor from timestamp and ID
 */
export function encodeCursor(createdAt: number | Date, id: string): string {
  const timestamp = createdAt instanceof Date ? createdAt.getTime() : createdAt;
  const payload = JSON.stringify({ createdAt: timestamp, id });
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decode cursor to timestamp and ID
 * Returns null if invalid
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const payload = Buffer.from(cursor, 'base64url').toString('utf-8');
    const data = JSON.parse(payload);

    if (
      typeof data.createdAt === 'number' &&
      typeof data.id === 'string' &&
      data.createdAt > 0
    ) {
      return data as CursorData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  items: T[],
  limit: number,
  getCreatedAt: (item: T) => number | Date,
  getId: (item: T) => string
): PaginatedResponse<T> {
  // If we got more items than requested, we have a next page
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1];
    nextCursor = encodeCursor(getCreatedAt(lastItem), getId(lastItem));
  }

  return {
    data,
    nextCursor,
    count: data.length,
  };
}

/**
 * Parse and validate pagination query params
 */
export function parsePaginationParams(query: {
  limit?: string | number;
  cursor?: string;
}): {
  limit: number;
  cursor: CursorData | null;
} {
  // Parse limit (1-100, default 25)
  let limit = 25;
  if (query.limit !== undefined) {
    const parsed =
      typeof query.limit === 'string' ? parseInt(query.limit, 10) : query.limit;
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100) {
      limit = parsed;
    }
  }

  // Parse cursor
  let cursor: CursorData | null = null;
  if (query.cursor && typeof query.cursor === 'string') {
    cursor = decodeCursor(query.cursor);
  }

  return { limit, cursor };
}

const paginationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('encodeCursor', encodeCursor);
  fastify.decorate('decodeCursor', decodeCursor);
  fastify.decorate('createPaginatedResponse', createPaginatedResponse);
  fastify.decorate('parsePaginationParams', parsePaginationParams);
};

export default fp(paginationPlugin, {
  name: 'pagination',
  fastify: '4.x',
});

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    encodeCursor: typeof encodeCursor;
    decodeCursor: typeof decodeCursor;
    createPaginatedResponse: typeof createPaginatedResponse;
    parsePaginationParams: typeof parsePaginationParams;
  }
}
