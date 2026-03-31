import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { nanoid } from 'nanoid';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const userId = '98682ce26e43a46fa634f70ca445780a'; // Your user ID

  // 1. Ensure account exists
  const accounts =
    await sql`SELECT id FROM accounts WHERE user_id = ${userId} LIMIT 1`;
  let accountId: string;

  if (accounts.length === 0) {
    accountId = nanoid();
    await sql`INSERT INTO accounts (id, user_id, name, type, created_at) VALUES (${accountId}, ${userId}, 'Cash', 'cash', ${Date.now()})`;
    console.log('Created Cash account:', accountId);
  } else {
    accountId = accounts[0]!.id;
    console.log('Using existing account:', accountId);
  }

  // 2. Get the latest parsed file summary
  const summaries = await sql`
    SELECT fps.id, fps.file_id, fps.summary_json
    FROM file_parsed_summaries fps
    JOIN uploaded_files uf ON uf.id = fps.file_id
    WHERE uf.user_id = ${userId}
    ORDER BY fps.created_at DESC LIMIT 1
  `;

  if (summaries.length === 0) {
    console.log('No parsed summaries found');
    return;
  }

  const summary = JSON.parse(summaries[0]!.summary_json);
  const fileId = summaries[0]!.file_id;
  console.log(`\nFile: ${fileId}`);
  console.log(`Transactions in file: ${summary.transactions?.length || 0}`);

  if (!summary.transactions || summary.transactions.length === 0) {
    console.log('No transactions to recover');
    return;
  }

  // 3. Check what's already imported
  const imported =
    await sql`SELECT parsed_item_id FROM file_imported_items WHERE file_id = ${fileId}`;
  const importedIds = new Set(imported.map((r: any) => r.parsed_item_id));
  console.log(`Already imported: ${importedIds.size}`);

  // 4. Import missing transactions
  let count = 0;
  const now = Date.now();

  for (const tx of summary.transactions) {
    if (importedIds.has(tx.id)) continue;

    const txType = tx.isCredit ? 'income' : 'expense';
    const amountCents = Math.round(Math.abs(tx.amount) * 100);
    const finalAmount = txType === 'expense' ? -amountCents : amountCents;
    const date = tx.date || summary.period?.from || '2026-03-30';

    const transactionId = nanoid();
    const importId = nanoid();

    await sql`
      INSERT INTO transactions (id, user_id, account_id, date, description, amount_cents, type, cleared, sensitive, created_at, updated_at)
      VALUES (${transactionId}, ${userId}, ${accountId}, ${date}, ${tx.description}, ${finalAmount}, ${txType}, false, false, ${now}, ${now})
    `;

    await sql`
      INSERT INTO file_imported_items (id, file_id, parsed_item_id, transaction_id, created_at)
      VALUES (${importId}, ${fileId}, ${tx.id}, ${transactionId}, ${now})
    `;

    count++;
  }

  console.log(`\nRecovered ${count} transactions!`);

  // Verify
  const total =
    await sql`SELECT COUNT(*) as cnt FROM transactions WHERE user_id = ${userId}`;
  console.log(`Total transactions now: ${total[0]?.cnt}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
