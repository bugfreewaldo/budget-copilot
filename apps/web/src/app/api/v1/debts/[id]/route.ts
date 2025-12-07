import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

// Force dynamic rendering since proxyToApi uses cookies
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/debts/[id] - Get single debt with payments
 * Proxies to Fastify backend which handles auth and database
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToApi(request, `/v1/debts/${id}`);
}

/**
 * PATCH /api/v1/debts/[id] - Update debt
 * Proxies to Fastify backend which handles auth and database
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyToApi(request, `/v1/debts/${id}`, { method: 'PATCH', body });
}

/**
 * DELETE /api/v1/debts/[id] - Delete debt
 * Proxies to Fastify backend which handles auth and database
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToApi(request, `/v1/debts/${id}`, { method: 'DELETE' });
}
