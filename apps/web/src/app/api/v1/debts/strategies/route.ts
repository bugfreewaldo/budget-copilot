import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

/**
 * GET /api/v1/debts/strategies - Get debt payoff strategies
 * Proxies to Fastify backend which handles auth and database
 */
export async function GET(request: NextRequest) {
  return proxyToApi(request, '/v1/debts/strategies');
}
