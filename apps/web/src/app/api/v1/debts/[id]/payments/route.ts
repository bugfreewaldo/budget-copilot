import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/debts/[id]/payments - Record a payment
 * Proxies to Fastify backend which handles auth and database
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyToApi(request, `/v1/debts/${id}/payments`, { body });
}
