import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { subscriptions } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';
import { createPayment } from '@/lib/tilopay/client';

export const dynamic = 'force-dynamic';

// Pricing configuration (in USD)
const PRICES = {
  monthly: {
    amount: 4.99,
    originalAmount: 9.99,
  },
  yearly: {
    amount: 39.99,
    originalAmount: 79.99,
    monthlyEquiv: 3.33,
  },
};

/**
 * POST /api/v1/checkout - Initiate payment checkout
 *
 * Creates a pending subscription and returns Tilopay payment URL
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[checkout] Starting checkout...');

    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const user = auth.user;
    console.log('[checkout] User authenticated:', user.id);

    const body = await request.json();
    const { billingPeriod } = body as { billingPeriod: 'monthly' | 'yearly' };
    console.log('[checkout] Billing period:', billingPeriod);

    // Validate billing period
    if (!billingPeriod || !['monthly', 'yearly'].includes(billingPeriod)) {
      return errorJson(
        'VALIDATION_ERROR',
        'Invalid billing period. Must be "monthly" or "yearly".',
        400
      );
    }

    const price = PRICES[billingPeriod];
    const amountCents = Math.round(price.amount * 100);

    // Generate unique order number
    const orderNumber = `BC-${Date.now()}-${nanoid(6)}`;
    console.log('[checkout] Order number:', orderNumber);

    // Create pending subscription record
    const db = getDb();
    const subscriptionId = nanoid();

    console.log('[checkout] Inserting subscription...');
    await db.insert(subscriptions).values({
      id: subscriptionId,
      userId: user.id,
      plan: 'pro',
      billingPeriod,
      amountCents,
      currency: 'USD',
      provider: 'tilopay',
      providerOrderNumber: orderNumber,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log('[checkout] Subscription created:', subscriptionId);

    // Get the base URL for redirect
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/api/v1/checkout/callback`;
    console.log('[checkout] Redirect URL:', redirectUrl);

    // Encode return data with subscription info
    const returnData = Buffer.from(
      JSON.stringify({
        subscriptionId,
        userId: user.id,
        billingPeriod,
      })
    ).toString('base64');

    // Parse user name
    const nameParts = (user.name || 'Usuario').split(' ');
    const firstName = nameParts[0] || 'Usuario';
    const lastName = nameParts.slice(1).join(' ') || 'BudgetCopilot';

    console.log('[checkout] Calling Tilopay createPayment...');
    // Create Tilopay payment
    const payment = await createPayment({
      orderNumber,
      amount: price.amount,
      currency: 'USD',
      email: user.email,
      firstName,
      lastName,
      redirectUrl,
      returnData,
    });

    console.log('[checkout] Payment created:', {
      subscriptionId,
      orderNumber,
      amount: price.amount,
      billingPeriod,
      paymentUrl: payment.url,
    });

    return NextResponse.json({
      data: {
        paymentUrl: payment.url,
        orderNumber: payment.orderNumber,
        subscriptionId,
      },
    });
  } catch (error) {
    console.error('Failed to create checkout:', error);
    // Return more specific error message in development
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Checkout error details:', errorMessage);
    return errorJson(
      'INTERNAL_ERROR',
      `Failed to create checkout session: ${errorMessage}`,
      500
    );
  }
}
