import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/goals/[id] - Get single goal
 * Proxies to Fastify backend which handles auth and database
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToApi(request, `/v1/goals/${id}`);
}

/**
 * PATCH /api/v1/goals/[id] - Update goal
 * Proxies to Fastify backend which handles auth and database
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyToApi(request, `/v1/goals/${id}`, { method: 'PATCH', body });
}

/**
 * DELETE /api/v1/goals/[id] - Delete goal
 * Proxies to Fastify backend which handles auth and database
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToApi(request, `/v1/goals/${id}`, { method: 'DELETE' });
}
