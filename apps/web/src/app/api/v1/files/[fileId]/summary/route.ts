import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';

// Force dynamic rendering since proxyToApi uses cookies
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  return proxyToApi(request, `/v1/files/${fileId}/summary`);
}
