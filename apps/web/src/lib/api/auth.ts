import { NextRequest } from 'next/server';
import { validateSession, User } from '@/lib/auth';
import { errorJson } from './utils';

const SESSION_COOKIE_NAME = 'session';

export type AuthResult =
  | { success: true; user: User }
  | { success: false; response: ReturnType<typeof errorJson> };

/**
 * Get authenticated user from request
 * Returns user if authenticated, or error response if not
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthResult> {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return {
      success: false,
      response: errorJson('UNAUTHORIZED', 'Not authenticated', 401),
    };
  }

  const user = await validateSession(sessionToken);

  if (!user) {
    return {
      success: false,
      response: errorJson('UNAUTHORIZED', 'Session expired or invalid', 401),
    };
  }

  return { success: true, user };
}
