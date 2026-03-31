import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Check file parsed summaries
  const summaries =
    await sql`SELECT id, file_id, parser_version, document_type, LENGTH(summary_json) as json_len FROM file_parsed_summaries ORDER BY created_at DESC LIMIT 3`;
  console.log('Parsed summaries:');
  for (const s of summaries) {
    console.log(
      `  file: ${s.file_id} | type: ${s.document_type} | json_len: ${s.json_len}`
    );
  }

  // Get the latest summary and check its transactions
  if (summaries[0]) {
    const full =
      await sql`SELECT summary_json FROM file_parsed_summaries WHERE id = ${summaries[0].id}`;
    if (full[0]) {
      const parsed = JSON.parse(full[0].summary_json);
      console.log('\nDocument type:', parsed.documentType);
      console.log('Has transactions:', !!parsed.transactions);
      console.log('Transaction count:', parsed.transactions?.length || 0);
      if (parsed.transactions?.length > 0) {
        console.log(
          'First transaction:',
          JSON.stringify(parsed.transactions[0])
        );
      }
    }
  }

  // Check accounts
  const accounts = await sql`SELECT id, name, type FROM accounts`;
  console.log('\nAccounts:', accounts.length);
  for (const a of accounts) {
    console.log(`  ${a.name} (${a.type}) | id: ${a.id}`);
  }

  // Check session conversation history for clues
  const session =
    await sql`SELECT conversation_history FROM advisor_sessions ORDER BY last_activity_at DESC LIMIT 1`;
  if (session[0]?.conversation_history) {
    const history = JSON.parse(session[0].conversation_history);
    const lastAssistant = history
      .filter((m: any) => m.role === 'assistant')
      .pop();
    if (lastAssistant) {
      try {
        const parsed = JSON.parse(lastAssistant.content);
        console.log('\nLast assistant reply:', parsed.reply?.substring(0, 200));
        console.log('Classification:', parsed.classification);
        console.log('Has pendingChanges:', !!parsed.pendingChanges);
        if (parsed.pendingChanges?.fileImport) {
          console.log(
            'fileImport.fileId:',
            parsed.pendingChanges.fileImport.fileId
          );
          console.log(
            'fileImport.itemIds count:',
            parsed.pendingChanges.fileImport.itemIds?.length
          );
        }
      } catch {
        /* non-JSON response */
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
