import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

// Force dynamic rendering since proxyToApi uses cookies
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyToApi(request, '/v1/uploads/create-url', {
    method: 'POST',
    body,
  });
}
