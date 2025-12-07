import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/files - List uploaded files
 * Currently returns empty list - file upload feature is not configured
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    // File storage is not configured yet
    // Return empty list for now
    return NextResponse.json({ data: [] });
  } catch (error) {
    console.error('Failed to list files:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list files', 500);
  }
}
