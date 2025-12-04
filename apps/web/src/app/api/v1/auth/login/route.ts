import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { login, AuthError } from '@/lib/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const SESSION_COOKIE_NAME = 'session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const result = await login(validation.data);

    const response = NextResponse.json({
      user: result.user,
      message: 'Login successful',
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.session.token,
      COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === 'INVALID_CREDENTIALS') {
        return errorJson('VALIDATION_ERROR', error.message, 401);
      }
      if (error.code === 'ACCOUNT_SUSPENDED') {
        return errorJson('VALIDATION_ERROR', error.message, 403);
      }
    }
    console.error('Login error:', error);
    return errorJson('INTERNAL_ERROR', 'Login failed', 500);
  }
}
