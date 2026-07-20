CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS log_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  log_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'failed')),
  fetched_at TIMESTAMPTZ DEFAULT Now(),
  created_at TIMESTAMPTZ DEFAULT Now()
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cron_enabled BOOLEAN DEFAULT TRUE,
  fetch_interval_minutes INTEGER DEFAULT 60,
  retention_days INTEGER DEFAULT 30,
  last_cron_run TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT Now()
);

INSERT INTO settings (id, cron_enabled, fetch_interval_minutes, retention_days)
VALUES (1, TRUE, 60, 30)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  detail JSONB,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT Now()
);

CREATE INDEX IF NOT EXISTS idx_log_records_status ON log_records(status);
CREATE INDEX IF NOT EXISTS idx_log_records_created_at ON log_records(created_at);
CREATE INDEX IF NOT EXISTS idx_log_records_deployment_id ON log_records(deployment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
