import { NextRequest } from 'next/server';
import { validateSession, User } from './index';

export const SESSION_COOKIE_NAME = 'session';

/**
 * Extract the authenticated user from a NextRequest.
 * Returns null if not authenticated or session is invalid.
 */
export async function getUserFromRequest(
  request: NextRequest
): Promise<User | null> {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return validateSession(sessionToken);
}

/**
 * Require authentication for an API route.
 * Returns the user if authenticated, throws an error response if not.
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: User } | { error: Response }> {
  const user = await getUserFromRequest(request);

  if (!user) {
    return {
      error: new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return { user };
}

/**
 * Type guard to check if auth result is an error
 */
export function isAuthError(
  result: { user: User } | { error: Response }
): result is { error: Response } {
  return 'error' in result;
}

export type { User };
