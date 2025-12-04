import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession, changePassword, AuthError } from '@/lib/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const SESSION_COOKIE_NAME = 'session';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return errorJson('VALIDATION_ERROR', 'Not authenticated', 401);
    }

    const user = await validateSession(sessionToken);

    if (!user) {
      return errorJson('VALIDATION_ERROR', 'Session expired or invalid', 401);
    }

    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    await changePassword(
      user.id,
      validation.data.currentPassword,
      validation.data.newPassword
    );

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === 'INVALID_PASSWORD') {
        return errorJson('VALIDATION_ERROR', error.message, 400);
      }
      if (error.code === 'WEAK_PASSWORD') {
        return errorJson('VALIDATION_ERROR', error.message, 400);
      }
    }
    console.error('Change password error:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to change password', 500);
  }
}
