import { auth } from '@/lib/auth';
import { fetchLatestLogs, getProjectConfig } from '@/lib/vercel-api';
import { getLatestRecordByDeploymentId, insertLogRecord, updateRecordBlob } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encrypt';
import { put, readBlob, del } from '@/lib/blob';
import { recordAudit } from '@/lib/audit';
import { mergeLogs, hasOverlap, normalizeLog } from '@/lib/log-utils';
import type { AccessLogEntry } from '@/lib/types';

function getIp(request?: Request): string | undefined {
  if (!request) return undefined;
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getIp(request);

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
          const encrypted = encrypt(JSON.stringify(merged));
          const blob = await put(blobKey, encrypted, { contentType: 'application/octet-stream' });
          createdBlobUrl = blob.url;
          await del(existing.blob_url);
          await updateRecordBlob(existing.id, blob.url, merged.length);
          createdBlobUrl = null;
          await recordAudit('fetch', { deploymentId: result.deploymentId, logCount: merged.length }, session.user.email, ip);
          return Response.json({ message: 'Logs merged into existing record', record: { ...existing, blob_url: blob.url, log_count: merged.length } });
        }
      }
    }

    const logJson = JSON.stringify(newLogs.slice(0, 200));
    const encrypted = encrypt(logJson);
    const blob = await put(blobKey, encrypted, { contentType: 'application/octet-stream' });
    createdBlobUrl = blob.url;
    const record = await insertLogRecord({
      deployment_id: result.deploymentId,
      blob_url: blob.url,
      log_count: Math.min(newLogs.length, 200),
    });
    createdBlobUrl = null;

    await recordAudit('fetch', { deploymentId: result.deploymentId, logCount: Math.min(newLogs.length, 200) }, session.user.email, ip);

    return Response.json({ message: 'Logs fetched and stored successfully', record });
  } catch (error) {
    if (createdBlobUrl) {
      try { await del(createdBlobUrl); } catch {}
    }
    console.error("=== /api/fetch/manual 发生错误 ===");
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}
