import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  return proxyToApi(request, `/v1/files/${fileId}/summary`);
}
