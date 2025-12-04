import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/auth';

const SESSION_COOKIE_NAME = 'session';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionToken) {
      await logout(sessionToken);
    }

    const response = NextResponse.json({ message: 'Logout successful' });
    response.cookies.delete(SESSION_COOKIE_NAME);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear the cookie even if there's an error
    const response = NextResponse.json({ message: 'Logout successful' });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}
