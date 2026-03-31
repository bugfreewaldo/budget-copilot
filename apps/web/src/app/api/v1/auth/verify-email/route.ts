import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyEmail } from '@/lib/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = verifyEmailSchema.safeParse(body);

    console.log('[verify-email] Processing verification request');

    if (!validation.success) {
      console.log('[verify-email] Validation failed');
      return json(formatZodError(validation.error), 400);
    }

    console.log('[verify-email] Token received, calling verifyEmail...');
    const success = await verifyEmail(validation.data.token);
    console.log('[verify-email] verifyEmail returned:', success);

    if (!success) {
      return errorJson(
        'INVALID_TOKEN',
        'The verification link is invalid or has expired',
        400
      );
    }

    console.log('[verify-email] Verification successful!');
    return NextResponse.json({
      message: 'Your email has been verified!',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to verify email', 500);
  }
}
