import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/envelopes/:id - Delete an envelope
 * Proxies to Fastify backend which handles auth and database
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return proxyToApi(request, `/v1/envelopes/${id}`);
}
