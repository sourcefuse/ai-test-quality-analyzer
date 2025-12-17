/**
 * Clear PostgreSQL Database
 * Deletes all data from confluence_documents and document_chunks tables
 */

import * as dotenv from 'dotenv';
import {Pool} from 'pg';

dotenv.config();

async function main() {
  console.log('='.repeat(70));
  console.log('CLEAR POSTGRESQL DATABASE');
  console.log('='.repeat(70));

  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'postgres-pgvector',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'admin',
  });

  try {
    // Connect
    console.log('\n[1/3] Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('   ✅ Connected');

    // Count before deletion
    console.log('\n[2/3] Checking current data...');
    const countDocs = await client.query('SELECT COUNT(*) FROM confluence_documents');
    const countChunks = await client.query('SELECT COUNT(*) FROM document_chunks');

    const docsBefore = parseInt(countDocs.rows[0].count);
    const chunksBefore = parseInt(countChunks.rows[0].count);

    console.log(`   📊 Current: ${docsBefore} documents, ${chunksBefore} chunks`);

    // Delete all data (CASCADE will delete chunks automatically)
    console.log('\n[3/3] Deleting all data...');

    const deleteChunks = await client.query('DELETE FROM document_chunks');
    const deleteDocs = await client.query('DELETE FROM confluence_documents');

    console.log(`   ✅ Deleted ${deleteChunks.rowCount} chunks`);
    console.log(`   ✅ Deleted ${deleteDocs.rowCount} documents`);

    // Verify
    const verifyDocs = await client.query('SELECT COUNT(*) FROM confluence_documents');
    const verifyChunks = await client.query('SELECT COUNT(*) FROM document_chunks');

    console.log(`\n   ✅ Verification: ${verifyDocs.rows[0].count} documents, ${verifyChunks.rows[0].count} chunks remaining`);

    client.release();

    console.log('\n' + '='.repeat(70));
    console.log('✅ DATABASE CLEARED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('');

    await pool.end();

  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ ERROR OCCURRED');
    console.error('='.repeat(70));
    console.error(`\nMessage: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    console.error('');
    await pool.end();
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
