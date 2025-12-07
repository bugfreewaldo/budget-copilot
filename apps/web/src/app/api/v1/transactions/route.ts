import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

/**
 * GET /api/v1/transactions - List transactions with filters
 * Proxies to Fastify backend which handles auth and database
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/v1/transactions?${searchParams}` : '/v1/transactions';
  return proxyToApi(request, path);
}

/**
 * POST /api/v1/transactions - Create new transaction
 * Proxies to Fastify backend which handles auth and database
 */
export async function POST(request: NextRequest) {
  return proxyToApi(request, '/v1/transactions');
}
