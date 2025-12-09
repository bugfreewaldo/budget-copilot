import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { errorJson } from '@/lib/api/utils';

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'session';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    console.log('[auth/me] Checking session...');

    if (!sessionToken) {
      console.log('[auth/me] No session token found');
      return errorJson('VALIDATION_ERROR', 'Not authenticated', 401);
    }

    const user = await validateSession(sessionToken);

    if (!user) {
      console.log('[auth/me] Session invalid or expired');
      const response = errorJson(
        'VALIDATION_ERROR',
        'Session expired or invalid',
        401
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    console.log('[auth/me] User found:', {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Session validation error:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to validate session', 500);
  }
}
