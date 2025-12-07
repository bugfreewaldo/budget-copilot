import { NextRequest } from 'next/server';
import { errorJson } from '@/lib/api/utils';
import { getAuthenticatedUser } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/uploads/complete - Register completed uploads
 * Currently returns feature not configured - S3 storage needs to be set up
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    // S3 storage is not configured yet
    // TODO: Migrate storage service to work with Next.js serverless
    return errorJson(
      'INTERNAL_ERROR',
      'La función de subir archivos no está disponible en este momento. Por favor, usa el chat de texto.',
      503
    );
  } catch (error) {
    console.error('Failed to complete upload:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to complete upload', 500);
  }
}
