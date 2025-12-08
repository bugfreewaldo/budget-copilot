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
        message: 'Tu correo electrónico ya está verificado',
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
        'Si tu correo no está verificado, te hemos enviado un enlace de verificación',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    const message =
      error instanceof Error ? error.message : 'Error al enviar el correo';
    return errorJson('INTERNAL_ERROR', message, 500);
  }
}
