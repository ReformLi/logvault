import { insertAuditLog } from './db';

export function recordAudit(action: string, detail: Record<string, unknown>, userEmail: string, ipAddress?: string): Promise<void> {
  if (ipAddress) {
    detail = { ...detail, ipAddress };
  }
  return insertAuditLog(action, detail, userEmail);
}
