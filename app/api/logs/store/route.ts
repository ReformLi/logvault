import { parseRequestLogRows } from '@/lib/vercel-api';
import { getLatestRecordByDeploymentId, insertLogRecord, updateRecordBlob } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encrypt';
import { put, readBlob, del } from '@/lib/blob';
import { recordAudit } from '@/lib/audit';
import { mergeLogs, hasOverlap, normalizeLog } from '@/lib/log-utils';
import type { AccessLogEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let createdBlobUrl: string | null = null;

  try {
    const body = await request.json();
    const { deploymentId, rows } = body as { deploymentId: string; rows: any[] };

    if (!deploymentId || !Array.isArray(rows)) {
      return Response.json({ error: 'deploymentId and rows are required' }, { status: 400 });
    }

    const newLogs = parseRequestLogRows(rows);
    if (newLogs.length === 0) {
      return Response.json({ message: 'No logs in provided data', logCount: 0 });
    }

    const blobKey = `logs_${Date.now()}_${deploymentId}.enc`;
    const existing = await getLatestRecordByDeploymentId(deploymentId);

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
          const blob = await put(blobKey, encrypted, { access: 'private', contentType: 'application/octet-stream' });
          createdBlobUrl = blob.url;
          await del(existing.blob_url);
          await updateRecordBlob(existing.id, blob.url, merged.length);
          createdBlobUrl = null;
          return Response.json({ message: 'Logs merged into existing record', record: { ...existing, blob_url: blob.url, log_count: merged.length } });
        }
      }
    }

    const logJson = JSON.stringify(newLogs.slice(0, 200));
    const encrypted = encrypt(logJson);
    const blob = await put(blobKey, encrypted, { access: 'private', contentType: 'application/octet-stream' });
    createdBlobUrl = blob.url;
    const record = await insertLogRecord({
      deployment_id: deploymentId,
      blob_url: blob.url,
      log_count: Math.min(newLogs.length, 200),
    });
    createdBlobUrl = null;

    return Response.json({ message: 'Logs stored successfully', record });
  } catch (error) {
    if (createdBlobUrl) {
      try { await del(createdBlobUrl); } catch {}
    }
    return Response.json(
      { error: error instanceof Error ? error.message : 'Store failed' },
      { status: 500 }
    );
  }
}
