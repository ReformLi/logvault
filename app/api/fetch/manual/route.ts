import { auth } from '@/lib/auth';
import { fetchLatestLogs } from '@/lib/vercel-api';
import { getLogRecordByDeploymentId, insertLogRecord } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';
import { put } from '@vercel/blob';
import { recordAudit } from '@/lib/audit';

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectName = process.env.VERCEL_PROJECT_NAME;
  if (!projectName) {
    return Response.json({ error: 'VERCEL_PROJECT_NAME not configured' }, { status: 500 });
  }

  try {
    const result = await fetchLatestLogs(projectName);
    if (!result) {
      return Response.json({ error: 'No deployment found' }, { status: 404 });
    }

    const existing = await getLogRecordByDeploymentId(result.deploymentId);
    if (existing) {
      return Response.json({ message: 'Logs already exist for this deployment', record: existing });
    }

    const logJson = JSON.stringify(result.logs);
    const encrypted = encrypt(logJson);
    const blobKey = `logs_${Date.now()}_${result.deploymentId}.enc`;

    const blob = await put(blobKey, encrypted, {
      access: 'public',
      contentType: 'application/octet-stream',
    });

    const record = await insertLogRecord({
      deployment_id: result.deploymentId,
      blob_url: blob.url,
      log_count: result.logCount,
    });

    await recordAudit('fetch', { deploymentId: result.deploymentId, logCount: result.logCount }, session.user.email);

    return Response.json({ message: 'Logs fetched and stored successfully', record });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}
