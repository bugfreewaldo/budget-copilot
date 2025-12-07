import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

// Force dynamic rendering since proxyToApi uses cookies
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/goals/[id]/contribute - Add contribution to goal
 * Proxies to Fastify backend which handles auth and database
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyToApi(request, `/v1/goals/${id}/contribute`, { body });
}
