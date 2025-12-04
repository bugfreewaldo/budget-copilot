import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resetPassword, AuthError } from '@/lib/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const success = await resetPassword(
      validation.data.token,
      validation.data.password
    );

    if (!success) {
      return errorJson('VALIDATION_ERROR', 'Invalid or expired reset token', 400);
    }

    return NextResponse.json({
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error) {
    if (error instanceof AuthError && error.code === 'WEAK_PASSWORD') {
      return errorJson('VALIDATION_ERROR', error.message, 400);
    }
    console.error('Reset password error:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to reset password', 500);
  }
}
