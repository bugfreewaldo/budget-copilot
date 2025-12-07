import { NextRequest, NextResponse } from 'next/server';
import { createEmailVerificationToken } from '@/lib/auth';
import { getUserFromRequest } from '@/lib/auth/getUser';
import { errorJson } from '@/lib/api/utils';
import { sendEmailVerification } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return errorJson('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (user.emailVerified) {
      return NextResponse.json({
        message: 'Tu correo electrónico ya está verificado',
      });
    }

    const token = await createEmailVerificationToken(user.id);

    if (token) {
      const baseUrl =
        request.headers.get('origin') || 'https://budgetcopilot.app';
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
    return errorJson('INTERNAL_ERROR', 'Error al enviar el correo', 500);
  }
}
