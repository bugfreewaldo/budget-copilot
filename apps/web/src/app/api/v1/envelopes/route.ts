import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

// Force dynamic rendering since proxyToApi uses cookies
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/envelopes - List envelopes for a month
 * Proxies to Fastify backend which handles auth and database
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/v1/envelopes?${searchParams}` : '/v1/envelopes';
  return proxyToApi(request, path);
}

/**
 * POST /api/v1/envelopes - Create or update envelope
 * Proxies to Fastify backend which handles auth and database
 */
export async function POST(request: NextRequest) {
  return proxyToApi(request, '/v1/envelopes');
}
