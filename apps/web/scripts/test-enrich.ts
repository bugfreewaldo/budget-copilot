import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

function calculatePayoff(
  balanceCents: number,
  aprPercent: number,
  minimumPaymentCents: number | null
): { monthsToPayoff: number; totalInterestCents: number } {
  const minPayment = minimumPaymentCents || Math.ceil(balanceCents * 0.02);

  if (minPayment <= 0 || balanceCents <= 0) {
    return { monthsToPayoff: 0, totalInterestCents: 0 };
  }

  const monthlyRate = aprPercent / 100 / 12;
  let balance = balanceCents;
  let months = 0;
  let totalInterest = 0;

  while (balance > 0 && months < 600) {
    const interest = Math.round(balance * monthlyRate);
    totalInterest += interest;
    balance = balance + interest - minPayment;
    months++;
  }

  if (months >= 600) {
    return { monthsToPayoff: -1, totalInterestCents: -1 };
  }

  return { monthsToPayoff: months, totalInterestCents: totalInterest };
}

async function main() {
  const debts = await sql`SELECT * FROM debts WHERE status = 'active'`;

  for (const d of debts) {
    console.log(`\n--- ${d.name} (${d.type}) ---`);
    console.log(`  Balance: $${(d.current_balance_cents / 100).toFixed(2)}`);
    console.log(`  APR: ${d.apr_percent}%`);

    // Calculate effective min payment
    let effectiveMin: number | null = null;
    if (
      d.minimum_payment_type === 'percent' &&
      d.minimum_payment_percent !== null
    ) {
      effectiveMin = Math.ceil(
        d.current_balance_cents * (d.minimum_payment_percent / 100)
      );
    } else {
      effectiveMin = d.minimum_payment_cents;
    }
    console.log(
      `  Effective min payment: $${effectiveMin ? (effectiveMin / 100).toFixed(2) : 'null'}`
    );

    // Use actual payment if set
    const paymentForProjection =
      d.actual_payment_cents && d.actual_payment_cents > 0
        ? d.actual_payment_cents
        : effectiveMin;
    console.log(
      `  Payment for projection: $${paymentForProjection ? (paymentForProjection / 100).toFixed(2) : 'null'}`
    );

    // Calculate payoff
    const payoff = calculatePayoff(
      d.current_balance_cents,
      d.apr_percent,
      paymentForProjection
    );
    console.log(`  Months to payoff: ${payoff.monthsToPayoff}`);
    console.log(
      `  Total interest: $${payoff.totalInterestCents >= 0 ? (payoff.totalInterestCents / 100).toFixed(2) : 'unpayable'}`
    );

    if (payoff.monthsToPayoff > 0) {
      const deathDate = new Date();
      deathDate.setMonth(deathDate.getMonth() + payoff.monthsToPayoff);
      console.log(`  Death date: ${deathDate.toISOString().split('T')[0]}`);
    } else {
      console.log(`  Death date: N/A`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
