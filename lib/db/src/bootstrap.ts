import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

async function bootstrap() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    console.log("pgvector extension ensured");

    // D-01: Questionnaires compatibility view
    // Maps new assessments tables to legacy questionnaires column names
    // so existing vendor routes continue to work without code changes.
    // NOTE: This is a READ-ONLY view. The INSERT path at
    // artifacts/api-server/src/routes/vendors.ts:437 must be updated
    // in Phase 10 to use assessmentsTable directly before the
    // questionnaires table can be dropped (D-02).
    //
    // Guard: only create the view if the assessments and assessment_templates
    // tables already exist (i.e., drizzle-kit push has been run at least once).
    const tablesExist = await client.query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('assessments', 'assessment_templates')
    `);
    const tableCount = parseInt(tablesExist.rows[0].cnt, 10);
    if (tableCount === 2) {
      await client.query(`
        CREATE OR REPLACE VIEW questionnaires_v2 AS
          SELECT
            a.id,
            a.tenant_id,
            a.context_id AS vendor_id,
            at.title,
            a.assessment_status::text AS questionnaire_status,
            at.questions AS template,
            a.responses,
            NULL::text AS magic_link_token,
            NULL::timestamptz AS magic_link_expires_at,
            a.created_at,
            a.updated_at
          FROM assessments a
          JOIN assessment_templates at ON at.id = a.template_id
          WHERE a.context_type = 'vendor'
      `);
      console.log("questionnaires_v2 compatibility view ensured");
    } else {
      console.log("questionnaires_v2 view deferred — assessments tables not yet created (run pnpm push again after first push)");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrap().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
