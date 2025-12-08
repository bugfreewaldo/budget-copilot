import { NextRequest } from 'next/server';
import { validateSession, User } from '@/lib/auth';
import { errorJson } from './utils';

const SESSION_COOKIE_NAME = 'session';

export type AuthResult =
  | { success: true; user: User }
  | { success: false; response: ReturnType<typeof errorJson> };

export type AdminAuthResult =
  | { success: true; user: User & { role: 'admin' | 'superadmin' } }
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

/**
 * Get authenticated admin user from request
 * Returns user if authenticated and has admin/superadmin role, or error response if not
 */
export async function getAdminUser(
  request: NextRequest
): Promise<AdminAuthResult> {
  const auth = await getAuthenticatedUser(request);

  if (!auth.success) {
    return auth;
  }

  const { user } = auth;

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return {
      success: false,
      response: errorJson('FORBIDDEN', 'Admin access required', 403),
    };
  }

  return {
    success: true,
    user: user as User & { role: 'admin' | 'superadmin' },
  };
}

/**
 * Get authenticated superadmin user from request
 * Returns user if authenticated and has superadmin role, or error response if not
 */
export async function getSuperadminUser(
  request: NextRequest
): Promise<AdminAuthResult> {
  const auth = await getAuthenticatedUser(request);

  if (!auth.success) {
    return auth;
  }

  const { user } = auth;

  if (user.role !== 'superadmin') {
    return {
      success: false,
      response: errorJson('FORBIDDEN', 'Superadmin access required', 403),
    };
  }

  return {
    success: true,
    user: user as User & { role: 'superadmin' },
  };
}
