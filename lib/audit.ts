import { insertAuditLog } from './db';

export function recordAudit(action: string, detail: unknown, userEmail: string): Promise<void> {
  return insertAuditLog(action, detail, userEmail);
}
