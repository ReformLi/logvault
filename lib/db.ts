import { sql as vercelSql } from '@vercel/postgres';
import { Pool } from 'pg';
import type { QueryResultRow, QueryResult } from '@vercel/postgres';
import type { LogRecord, SystemSettings } from './types';

type Primitive = string | number | boolean | undefined | null;

const isLocal = process.env.USE_LOCAL_DB === 'true';

function createLocalSql() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  const sqlFn = <O extends QueryResultRow>(
    strings: TemplateStringsArray,
    ...values: Primitive[]
  ): Promise<QueryResult<O>> => {
    let text = '';
    strings.forEach((str, i) => {
      text += str;
      if (i < values.length) {
        text += `$${i + 1}`;
      }
    });
    return pool.query<O>(text, values);
  };

  sqlFn.query = <O extends QueryResultRow>(text: string, params?: any[]) =>
    pool.query<O>(text, params);

  return sqlFn as typeof vercelSql;
}

const sql = isLocal ? createLocalSql() : vercelSql;

export async function getLogRecords(
  status: string = 'active',
  page: number = 1,
  pageSize: number = 20
): Promise<{ records: LogRecord[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const countResult = await sql`SELECT COUNT(*) FROM log_records WHERE status = ${status}`;
  const total = parseInt(countResult.rows[0]?.count?.toString() ?? '0', 10);
  const result = await sql<LogRecord>`
    SELECT * FROM log_records
    WHERE status = ${status}
    ORDER BY fetched_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  return { records: result.rows, total };
}

export async function getLogRecordById(id: string): Promise<LogRecord | null> {
  const result = await sql<LogRecord>`
    SELECT * FROM log_records WHERE id = ${id}
  `;
  return result.rows[0] ?? null;
}

export async function getLogRecordByDeploymentId(deploymentId: string): Promise<LogRecord | null> {
  console.log('当前 POSTGRES_URL:', process.env.POSTGRES_URL);
  const result = await sql<LogRecord>`
    SELECT * FROM log_records WHERE deployment_id = ${deploymentId}
  `;
  return result.rows[0] ?? null;
}

export async function insertLogRecord(record: {
  deployment_id: string;
  blob_url: string;
  log_count: number;
  status?: string;
}): Promise<LogRecord> {
  const result = await sql<LogRecord>`
    INSERT INTO log_records (deployment_id, blob_url, log_count, status)
    VALUES (${record.deployment_id}, ${record.blob_url}, ${record.log_count}, ${record.status ?? 'active'})
    RETURNING *
  `;
  return result.rows[0];
}

export async function getLatestRecordByDeploymentId(deploymentId: string): Promise<LogRecord | null> {
  const result = await sql<LogRecord>`
    SELECT * FROM log_records WHERE deployment_id = ${deploymentId}
    ORDER BY fetched_at DESC LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function updateRecordBlob(id: string, blob_url: string, log_count: number): Promise<void> {
  await sql`
    UPDATE log_records SET blob_url = ${blob_url}, log_count = ${log_count}, status = 'active', fetched_at = Now()
    WHERE id = ${id}
  `;
}

export async function deleteLogRecords(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql.query(
    `UPDATE log_records SET status = 'deleted' WHERE id = ANY($1::uuid[])`,
    [ids]
  );
}

export async function getSettings(): Promise<SystemSettings> {
  const result = await sql<SystemSettings>`
    SELECT * FROM settings WHERE id = 1
  `;
  return result.rows[0] ?? { cron_enabled: true, fetch_interval_minutes: 60, retention_days: 30, updated_at: new Date().toISOString() };
}

export async function updateSettings(settings: {
  cron_enabled?: boolean;
  fetch_interval_minutes?: number;
  retention_days?: number;
}): Promise<SystemSettings> {
  const result = await sql<SystemSettings>`
    UPDATE settings SET
      cron_enabled = COALESCE(${settings.cron_enabled}, cron_enabled),
      fetch_interval_minutes = COALESCE(${settings.fetch_interval_minutes}, fetch_interval_minutes),
      retention_days = COALESCE(${settings.retention_days}, retention_days),
      updated_at = Now()
    WHERE id = 1
    RETURNING *
  `;
  return result.rows[0];
}

export async function insertAuditLog(action: string, detail: unknown, userEmail: string): Promise<void> {
  await sql`
    INSERT INTO audit_logs (action, detail, user_email)
    VALUES (${action}, ${JSON.stringify(detail)}::jsonb, ${userEmail})
  `;
}

export async function getExpiredRecords(retentionDays: number): Promise<LogRecord[]> {
  const result = await sql<LogRecord>`
    SELECT * FROM log_records
    WHERE created_at < Now() - INTERVAL '1 day' * ${retentionDays}
    AND status = 'active'
  `;
  return result.rows;
}

export async function permanentlyDeleteRecord(id: string): Promise<void> {
  await sql`
    DELETE FROM log_records WHERE id = ${id}
  `;
}
