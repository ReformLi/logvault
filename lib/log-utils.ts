import type { AccessLogEntry } from './types';

const MAX_LOGS_PER_RECORD = 200;

export function mergeLogs(
  oldLogs: AccessLogEntry[],
  newLogs: AccessLogEntry[],
): { merged: AccessLogEntry[]; exceedsMax: boolean } {
  const seen = new Set<string>();
  const result: AccessLogEntry[] = [];

  const all = [...newLogs, ...oldLogs].sort((a, b) => b.timestamp - a.timestamp);

  let exceeded = false;
  for (const log of all) {
    if (seen.has(log.id)) continue;
    if (result.length >= MAX_LOGS_PER_RECORD) {
      exceeded = true;
      break;
    }
    seen.add(log.id);
    result.push(log);
  }

  return { merged: result, exceedsMax: exceeded };
}

export function hasOverlap(oldLogs: AccessLogEntry[], newLogs: AccessLogEntry[]): boolean {
  const oldIds = new Set(oldLogs.map(l => l.id));
  return newLogs.some(l => oldIds.has(l.id));
}

export function normalizeLog(log: any): AccessLogEntry {
  if (log.timestamp) return log as AccessLogEntry;
  // Old format: { id, date, text, deploymentId }
  return {
    id: log.id,
    timestamp: new Date(log.date).getTime(),
    deploymentId: log.deploymentId || '',
    requestMethod: '',
    requestPath: '',
    responseStatusCode: 0,
    level: 'info',
    message: log.text || '',
    source: '',
    domain: '',
    environment: '',
  };
}
