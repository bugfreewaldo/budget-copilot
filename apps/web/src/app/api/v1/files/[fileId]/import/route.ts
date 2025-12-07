import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const body = await request.text();
  return proxyToApi(request, `/v1/files/${fileId}/import`, {
    method: 'POST',
    body,
  });
}
