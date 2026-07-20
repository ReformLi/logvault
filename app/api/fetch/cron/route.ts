import { fetchLatestLogs, getProjectConfig } from '@/lib/vercel-api';
import { getLatestRecordByDeploymentId, insertLogRecord, updateRecordBlob, getSettings } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encrypt';
import { put, readBlob } from '@/lib/blob';
import { mergeLogs, hasOverlap, normalizeLog } from '@/lib/log-utils';
import type { AccessLogEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
          await updateRecordBlob(existing.id, blob.url, merged.length);
          return Response.json({ message: 'Logs merged into existing record', record: { ...existing, blob_url: blob.url, log_count: merged.length } });
        }
      }
    }

    const logJson = JSON.stringify(newLogs.slice(0, 200));
    const encrypted = encrypt(logJson);
    const blob = await put(blobKey, encrypted, { access: 'public', contentType: 'application/octet-stream' });
    const record = await insertLogRecord({
      deployment_id: result.deploymentId,
      blob_url: blob.url,
      log_count: Math.min(newLogs.length, 200),
    });

    return Response.json({ message: 'Logs fetched successfully', record });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Cron fetch failed' },
      { status: 500 }
    );
  }
}
