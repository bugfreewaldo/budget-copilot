import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Just test Banco General mortgage
  const debts =
    await sql`SELECT * FROM debts WHERE name = 'Banco General' AND type = 'mortgage'`;
  const d = debts[0]!;

  const balanceCents = Number(d.current_balance_cents);
  const aprPercent = Number(d.apr_percent);
  const minPayment =
    Number(d.minimum_payment_cents) || Math.ceil(balanceCents * 0.02);

  console.log('Balance cents:', balanceCents, typeof balanceCents);
  console.log('APR:', aprPercent, typeof aprPercent);
  console.log('Min payment:', minPayment, typeof minPayment);
  console.log('Monthly rate:', aprPercent / 100 / 12);

  const monthlyRate = aprPercent / 100 / 12;
  let balance = balanceCents;
  let months = 0;

  for (let i = 0; i < 5; i++) {
    const interest = Math.round(balance * monthlyRate);
    console.log(
      `  Month ${i + 1}: balance=${balance}, interest=${interest}, payment=${minPayment}, new_balance=${balance + interest - minPayment}`
    );
    balance = balance + interest - minPayment;
    months++; // eslint-disable-line @typescript-eslint/no-unused-vars
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
