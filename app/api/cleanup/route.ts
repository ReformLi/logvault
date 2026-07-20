import { getSettings, getExpiredRecords, permanentlyDeleteRecord } from '@/lib/db';
import { del } from '@/lib/blob';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getSettings();
    const expired = await getExpiredRecords(settings.retention_days);

    let deletedCount = 0;
    for (const record of expired) {
      try {
        await del(record.blob_url);
      } catch {
      }
      await permanentlyDeleteRecord(record.id);
      deletedCount++;
    }

    return Response.json({ message: `Cleaned up ${deletedCount} expired records` });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}
