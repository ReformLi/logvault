import { getSettings, getExpiredRecords, getExpiredDeletedRecords, permanentlyDeleteRecord, deleteAuditLogsOlderThan } from '@/lib/db';
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
    const retentionDays = settings.retention_days;

    // Clean expired active records
    const expired = await getExpiredRecords(retentionDays);
    let activeDeleted = 0;
    for (const record of expired) {
      try { await del(record.blob_url); } catch {}
      await permanentlyDeleteRecord(record.id);
      activeDeleted++;
    }

    // Clean soft-deleted records past retention
    const deletedRecords = await getExpiredDeletedRecords(retentionDays);
    let deletedCleaned = 0;
    for (const record of deletedRecords) {
      try { await del(record.blob_url); } catch {}
      await permanentlyDeleteRecord(record.id);
      deletedCleaned++;
    }

    // Clean old audit logs
    const auditDeleted = await deleteAuditLogsOlderThan(retentionDays);

    return Response.json({
      message: `Cleaned up ${activeDeleted} expired records, ${deletedCleaned} soft-deleted records, ${auditDeleted} audit logs`,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}
