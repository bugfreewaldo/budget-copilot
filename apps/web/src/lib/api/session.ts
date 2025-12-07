import { cookies } from 'next/headers';

/**
 * Session utilities for Next.js API routes
 * Validates session by calling the Fastify backend
 */

const API_BACKEND_URL =
  process.env.API_BACKEND_URL || 'http://localhost:4000';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'pro' | 'premium';
  emailVerified: boolean;
}

/**
 * Get the current user from session
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    // Call a Fastify endpoint to validate the session
    const response = await fetch(`${API_BACKEND_URL}/v1/auth/me`, {
      headers: {
        Cookie: `session=${sessionToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Require authentication - throws/returns error response if not authenticated
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}
