import { auth } from '@/lib/auth';
import { fetchLatestLogs, getProjectConfig } from '@/lib/vercel-api';
import { getLatestRecordByDeploymentId, insertLogRecord, updateRecordBlob } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encrypt';
import { put, readBlob, del } from '@/lib/blob';
import { recordAudit } from '@/lib/audit';
import { mergeLogs, hasOverlap, normalizeLog } from '@/lib/log-utils';
import type { AccessLogEntry } from '@/lib/types';

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
      return Response.json({ error: 'No deployment found' }, { status: 404 });
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
          await del(existing.blob_url);
          const encrypted = encrypt(JSON.stringify(merged));
          const blob = await put(blobKey, encrypted, { access: 'public', contentType: 'application/octet-stream' });
          await updateRecordBlob(existing.id, blob.url, merged.length);
          await recordAudit('fetch', { deploymentId: result.deploymentId, logCount: merged.length }, session.user.email);
          return Response.json({ message: 'Logs merged into existing record', record: { ...existing, blob_url: blob.url, log_count: merged.length } });
        }
        // exceeds max → fall through to create new record, keeping old intact
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

    await recordAudit('fetch', { deploymentId: result.deploymentId, logCount: Math.min(newLogs.length, 200) }, session.user.email);

    return Response.json({ message: 'Logs fetched and stored successfully', record });
  } catch (error) {
    console.error("=== /api/fetch/manual 发生错误 ===");
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}
