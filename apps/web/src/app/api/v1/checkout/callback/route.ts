import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { subscriptions, users } from '@/lib/db/schema';
import { parseCallbackParams, isPaymentApproved } from '@/lib/tilopay/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/checkout/callback - Handle Tilopay payment redirect
 *
 * Tilopay redirects here after payment attempt with query params:
 * - code: "1" = approved, anything else = rejected
 * - description: Status description
 * - auth: Authorization code
 * - order: Order number
 * - tilopaytransaction: Transaction ID
 * - returnData: Base64 encoded data we sent
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const params = parseCallbackParams(request.nextUrl.searchParams);

    console.log('[checkout/callback] Received callback:', {
      code: params.code,
      description: params.description,
      order: params.order,
      transaction: params.tilopaytransaction,
    });

    // Parse return data
    let returnData: {
      subscriptionId: string;
      userId: string;
      billingPeriod: 'monthly' | 'yearly';
    } | null = null;

    if (params.returnData) {
      try {
        returnData = JSON.parse(
          Buffer.from(params.returnData, 'base64').toString()
        );
      } catch (e) {
        console.error('[checkout/callback] Failed to parse returnData:', e);
      }
    }

    const db = getDb();

    // Check if payment was approved
    if (isPaymentApproved(params)) {
      console.log('[checkout/callback] Payment approved!');

      if (returnData) {
        // Calculate subscription period
        const now = Date.now();
        const periodMs =
          returnData.billingPeriod === 'yearly'
            ? 365 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000;
        const endDate = now + periodMs;

        // Update subscription to active
        await db
          .update(subscriptions)
          .set({
            status: 'active',
            providerTransactionId: params.tilopaytransaction,
            providerAuth: params.auth,
            startDate: now,
            endDate,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, returnData.subscriptionId));

        // Update user plan
        await db
          .update(users)
          .set({
            plan: 'pro',
            planExpiresAt: endDate,
            updatedAt: now,
          })
          .where(eq(users.id, returnData.userId));

        console.log('[checkout/callback] User upgraded to pro:', {
          userId: returnData.userId,
          subscriptionId: returnData.subscriptionId,
          endDate: new Date(endDate).toISOString(),
        });
      }

      // Redirect to success page
      return NextResponse.redirect(`${baseUrl}/checkout/success`);
    } else {
      console.log('[checkout/callback] Payment rejected:', params.description);

      // Update subscription to failed
      if (returnData) {
        await db
          .update(subscriptions)
          .set({
            status: 'failed',
            updatedAt: Date.now(),
          })
          .where(eq(subscriptions.id, returnData.subscriptionId));
      }

      // Redirect to failure page with reason
      const failureUrl = new URL(`${baseUrl}/checkout/failed`);
      failureUrl.searchParams.set(
        'reason',
        params.description || 'payment_rejected'
      );
      return NextResponse.redirect(failureUrl.toString());
    }
  } catch (error) {
    console.error('[checkout/callback] Error processing callback:', error);
    return NextResponse.redirect(
      `${baseUrl}/checkout/failed?reason=processing_error`
    );
  }
}
