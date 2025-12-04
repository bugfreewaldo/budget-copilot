import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { register, AuthError } from '@/lib/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().max(100).optional(),
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
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const result = await register(validation.data);

    const response = NextResponse.json(
      {
        user: result.user,
        message: 'Registration successful',
      },
      { status: 201 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, result.session.token, COOKIE_OPTIONS);

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === 'EMAIL_EXISTS') {
        return errorJson('VALIDATION_ERROR', error.message, 409);
      }
      if (error.code === 'WEAK_PASSWORD') {
        return errorJson('VALIDATION_ERROR', error.message, 400);
      }
    }
    console.error('Registration error:', error);
    return errorJson('INTERNAL_ERROR', 'Registration failed', 500);
  }
}
