import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

// Force dynamic rendering since proxyToApi uses cookies
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/goals - List goals with summary
 * Proxies to Fastify backend which handles auth and database
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/v1/goals?${searchParams}` : '/v1/goals';
  return proxyToApi(request, path);
}

/**
 * POST /api/v1/goals - Create new goal
 * Proxies to Fastify backend which handles auth and database
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyToApi(request, '/v1/goals', { body });
}
