export interface LogRecord {
  id: string;
  deployment_id: string;
  blob_url: string;
  log_count: number;
  status: 'active' | 'deleted' | 'failed';
  fetched_at: string;
  created_at: string;
}

export interface SystemSettings {
  cron_enabled: boolean;
  fetch_interval_minutes: number;
  retention_days: number;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  detail: unknown;
  user_email: string;
  created_at: string;
}

export interface VercelLogEntry {
  id: string;
  date: string;
  text: string;
  deploymentId: string;
}
