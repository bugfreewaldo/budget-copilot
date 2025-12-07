import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

// Force dynamic rendering since proxyToApi uses cookies
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/copilot/chat - Process a chat message
 * Proxies to Fastify backend which handles auth and database
 */
export async function POST(request: NextRequest) {
  return proxyToApi(request, '/v1/copilot/chat');
}
