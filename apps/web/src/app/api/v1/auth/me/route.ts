import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { errorJson } from '@/lib/api/utils';

const SESSION_COOKIE_NAME = 'session';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return errorJson('VALIDATION_ERROR', 'Not authenticated', 401);
    }

    const user = await validateSession(sessionToken);

    if (!user) {
      const response = errorJson('VALIDATION_ERROR', 'Session expired or invalid', 401);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Session validation error:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to validate session', 500);
  }
}
