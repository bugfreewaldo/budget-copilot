import { NextRequest, NextResponse } from 'next/server';
import { createEmailVerificationToken } from '@/lib/auth';
import { getUserFromRequest } from '@/lib/auth/getUser';
import { errorJson } from '@/lib/api/utils';
import { sendEmailVerification } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    console.log('[resend-verification] Starting...');
    const user = await getUserFromRequest(request);
    console.log('[resend-verification] User:', user?.id, user?.email);

    if (!user) {
      return errorJson('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (user.emailVerified) {
      return NextResponse.json({
        message: 'Your email is already verified',
      });
    }

    console.log('[resend-verification] Creating token for user:', user.id);
    const token = await createEmailVerificationToken(user.id);
    console.log('[resend-verification] Token created:', !!token);

    if (token) {
      const baseUrl =
        request.headers.get('origin') || 'https://budgetcopilot.app';
      console.log('[resend-verification] Sending email to:', user.email);
      sendEmailVerification(user.email, token, baseUrl).catch((err) => {
        console.error('Failed to send verification email:', err);
      });
    }

    return NextResponse.json({
      message:
        'If your email is not verified, we have sent you a verification link',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to send email';
    return errorJson('INTERNAL_ERROR', message, 500);
  }
}
