import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

/**
 * GET /api/v1/accounts - List all accounts
 * Proxies to Fastify backend which handles auth and database
 */
export async function GET(request: NextRequest) {
  return proxyToApi(request, '/v1/accounts');
}

/**
 * POST /api/v1/accounts - Create new account
 * Proxies to Fastify backend which handles auth and database
 */
export async function POST(request: NextRequest) {
  return proxyToApi(request, '/v1/accounts');
}
