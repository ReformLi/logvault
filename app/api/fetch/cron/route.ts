import { fetchLatestLogs } from '@/lib/vercel-api';
import { getLogRecordByDeploymentId, insertLogRecord, getSettings } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';
import { put } from '@vercel/blob';

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

  const projectName = process.env.VERCEL_PROJECT_NAME;
  if (!projectName) {
    return Response.json({ error: 'VERCEL_PROJECT_NAME not configured' }, { status: 500 });
  }

  try {
    const result = await fetchLatestLogs(projectName);
    if (!result) {
      return Response.json({ message: 'No deployment found' });
    }

    const existing = await getLogRecordByDeploymentId(result.deploymentId);
    if (existing) {
      return Response.json({ message: 'Skipped - duplicate deployment', deploymentId: result.deploymentId });
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

    return Response.json({ message: 'Logs fetched successfully', record });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Cron fetch failed' },
      { status: 500 }
    );
  }
}
