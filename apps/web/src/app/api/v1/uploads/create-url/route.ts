import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyToApi(request, '/v1/uploads/create-url', {
    method: 'POST',
    body,
  });
}
