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

export interface AccessLogEntry {
  id: string;
  timestamp: number;
  deploymentId: string;
  requestMethod: string;
  requestPath: string;
  responseStatusCode: number;
  level: string;
  message: string;
  source: string;
  domain: string;
  environment: string;
  cache?: string;
  traceId?: string;
}
