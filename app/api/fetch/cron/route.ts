import { fetchLatestLogs, getProjectConfig } from '@/lib/vercel-api';
import { getLatestRecordByDeploymentId, insertLogRecord, updateRecordBlob, getSettings } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encrypt';
import { put, readBlob, del } from '@/lib/blob';
import { recordAudit } from '@/lib/audit';
import { mergeLogs, hasOverlap, normalizeLog } from '@/lib/log-utils';
import type { AccessLogEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.cron_enabled) {
    return Response.json({ message: 'Cron is disabled' });
  }

  let project;
  try {
    project = getProjectConfig();
  } catch {
    return Response.json({ error: 'VERCEL_PROJECT_NAME or VERCEL_PROJECT_ID not configured' }, { status: 500 });
  }

  let createdBlobUrl: string | null = null;

  try {
    const result = await fetchLatestLogs(project.name, project.id);
    if (!result) {
      return Response.json({ message: 'No deployment found' });
    }

    const newLogs = result.logs;
    const blobKey = `logs_${Date.now()}_${result.deploymentId}.enc`;
    const existing = await getLatestRecordByDeploymentId(result.deploymentId);

    if (existing) {
      let oldLogs: AccessLogEntry[];
      try {
        const encrypted = await readBlob(existing.blob_url);
        const decrypted = decrypt(encrypted);
        oldLogs = JSON.parse(decrypted).map(normalizeLog);
      } catch {
        oldLogs = [];
      }

      if (hasOverlap(oldLogs, newLogs)) {
        const { merged, exceedsMax } = mergeLogs(oldLogs, newLogs);
        if (!exceedsMax) {
          const encrypted = encrypt(JSON.stringify(merged));
          const blob = await put(blobKey, encrypted, { access: 'public', contentType: 'application/octet-stream' });
          createdBlobUrl = blob.url;
          await del(existing.blob_url);
          await updateRecordBlob(existing.id, blob.url, merged.length);
          createdBlobUrl = null;
          recordAudit('fetch_cron', { deploymentId: result.deploymentId, logCount: merged.length, merge: true }, 'system').catch(() => {});
          return Response.json({ message: 'Logs merged into existing record', record: { ...existing, blob_url: blob.url, log_count: merged.length } });
        }
      }
    }

    const logJson = JSON.stringify(newLogs.slice(0, 200));
    const encrypted = encrypt(logJson);
    const blob = await put(blobKey, encrypted, { access: 'public', contentType: 'application/octet-stream' });
    createdBlobUrl = blob.url;
    const record = await insertLogRecord({
      deployment_id: result.deploymentId,
      blob_url: blob.url,
      log_count: Math.min(newLogs.length, 200),
    });
    createdBlobUrl = null;

    recordAudit('fetch_cron', { deploymentId: result.deploymentId, logCount: Math.min(newLogs.length, 200), merge: false }, 'system').catch(() => {});
    return Response.json({ message: 'Logs fetched successfully', record });
  } catch (error) {
    if (createdBlobUrl) {
      try { await del(createdBlobUrl); } catch {}
    }
    return Response.json(
      { error: error instanceof Error ? error.message : 'Cron fetch failed' },
      { status: 500 }
    );
  }
}
