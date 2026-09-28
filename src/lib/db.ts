import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __kargoPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __kargoSchemaReady: Promise<void> | undefined;
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local (see README — Neon setup).");
  }
  if (!global.__kargoPool) {
    global.__kargoPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    // Neon can drop an idle pooled connection (scale-to-zero, pooler recycling); without
    // this listener that surfaces as an uncaught 'error' event on the Pool and kills the
    // whole process. pg discards the broken client internally — we just need to not crash.
    global.__kargoPool.on("error", (err) => {
      console.error("[pg pool] idle client error (recovered):", err.message);
    });
  }
  return global.__kargoPool;
}

/** Runs a query, returns all rows. */
export async function all<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const res = await getPool().query<T>(sql, params);
  return res.rows;
}

/** Runs a query, returns the first row (or undefined). */
export async function one<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, params);
  return rows[0];
}

/** Runs a query for its side effect (INSERT/UPDATE/DELETE). */
export async function exec(sql: string, params: unknown[] = []): Promise<void> {
  await ensureSchema();
  await getPool().query(sql, params);
}

/**
 * Runs a query written with @name placeholders (kept from the original SQLite version
 * for readability with wide upserts) by compiling them to Postgres $1style params.
 */
export async function named(sql: string, paramsObj: Record<string, unknown>): Promise<void> {
  const order: string[] = [];
  const text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
    let idx = order.indexOf(name);
    if (idx === -1) {
      order.push(name);
      idx = order.length - 1;
    }
    return `$${idx + 1}`;
  });
  const values = order.map((name) => paramsObj[name] ?? null);
  await ensureSchema();
  await getPool().query(text, values);
}

export async function logAudit(candidateId: string | null, event: string, detail?: unknown): Promise<void> {
  await exec(`INSERT INTO audit_log (candidate_id, event, detail) VALUES ($1, $2, $3)`, [
    candidateId,
    event,
    detail ? JSON.stringify(detail) : null,
  ]);
}

function ensureSchema(): Promise<void> {
  if (!global.__kargoSchemaReady) {
    global.__kargoSchemaReady = getPool().query(`
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  filename TEXT NOT NULL,
  source TEXT NOT NULL,
  applied_role TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  scrubbed_text TEXT NOT NULL,
  pipeline_status TEXT NOT NULL DEFAULT 'pending',
  pipeline_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scores (
  candidate_id TEXT PRIMARY KEY REFERENCES candidates(id),
  raw_json TEXT NOT NULL,
  pattern_score DOUBLE PRECISION NOT NULL,
  role_score_pm DOUBLE PRECISION,
  composite_pm DOUBLE PRECISION,
  tier_pm TEXT,
  role_score_spm DOUBLE PRECISION,
  composite_spm DOUBLE PRECISION,
  tier_spm TEXT,
  recommended_role TEXT NOT NULL,
  reroute_suggested INTEGER NOT NULL DEFAULT 0,
  experience_band_pm TEXT,
  experience_band_spm TEXT,
  why_ranked_here TEXT,
  probes_json TEXT,
  final_tier TEXT NOT NULL,
  potential_flag INTEGER NOT NULL DEFAULT 0,
  potential_reason TEXT,
  guardrail_json TEXT,
  best_composite DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefs (
  candidate_id TEXT PRIMARY KEY REFERENCES candidates(id),
  content_md TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafted',
  to_email TEXT,
  resend_id TEXT,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decisions (
  candidate_id TEXT PRIMARY KEY REFERENCES candidates(id),
  decision TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  candidate_id TEXT,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`).then(() => undefined);
  }
  return global.__kargoSchemaReady;
}
