import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPasswordResetToken } from '@/lib/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const token = await createPasswordResetToken(validation.data.email);

    // In development, log the token
    if (token && process.env.NODE_ENV === 'development') {
      console.log(`Password reset token for ${validation.data.email}: ${token}`);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message:
        'If an account exists with this email, a password reset link has been sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to process request', 500);
  }
}
