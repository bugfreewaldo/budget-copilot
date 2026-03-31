import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const count = await sql`SELECT COUNT(*) as cnt FROM transactions`;
  console.log('Total transactions:', count[0]?.cnt);

  const recent =
    await sql`SELECT id, description, date, amount_cents, type, category_id, created_at FROM transactions ORDER BY created_at DESC LIMIT 5`;
  console.log('\nRecent transactions:');
  for (const t of recent) {
    console.log(
      `  ${t.date} | ${t.description} | ${t.amount_cents} cents | ${t.type} | cat: ${t.category_id || 'none'}`
    );
  }

  // Check uploaded files
  const files =
    await sql`SELECT id, filename, status, created_at FROM uploaded_files ORDER BY created_at DESC LIMIT 3`;
  console.log('\nRecent files:');
  for (const f of files) {
    console.log(`  ${f.filename} | status: ${f.status} | ${f.id}`);
  }

  // Check file_imported_items
  const imports = await sql`SELECT COUNT(*) as cnt FROM file_imported_items`;
  console.log('\nImported items:', imports[0]?.cnt);

  // Check advisor sessions for pending changes
  const sessions =
    await sql`SELECT id, pending_changes, last_confirmed_at FROM advisor_sessions ORDER BY last_activity_at DESC LIMIT 1`;
  if (sessions[0]) {
    console.log('\nLatest session:', sessions[0].id);
    console.log(
      'Has pending changes:',
      sessions[0].pending_changes ? 'YES' : 'NO'
    );
    console.log('Last confirmed:', sessions[0].last_confirmed_at);
    if (sessions[0].pending_changes) {
      const pc = JSON.parse(sessions[0].pending_changes);
      console.log('Pending changes keys:', Object.keys(pc));
      if (pc.fileImport) {
        console.log('File import fileId:', pc.fileImport.fileId);
        console.log(
          'File import itemIds count:',
          pc.fileImport.itemIds?.length
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
