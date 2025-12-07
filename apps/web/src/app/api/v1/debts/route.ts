import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

/**
 * GET /api/v1/debts - List debts with summary
 * Proxies to Fastify backend which handles auth and database
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/v1/debts?${searchParams}` : '/v1/debts';
  return proxyToApi(request, path);
}

/**
 * POST /api/v1/debts - Create new debt
 * Proxies to Fastify backend which handles auth and database
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyToApi(request, '/v1/debts', { body });
}
