import { auth } from '@/lib/auth';
import { updateSettings } from '@/lib/db';
import { recordAudit } from '@/lib/audit';

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { cron_enabled, fetch_interval_minutes, retention_days } = body;

    const updated = await updateSettings({
      cron_enabled,
      fetch_interval_minutes,
      retention_days,
    });

    await recordAudit('settings', { cron_enabled, fetch_interval_minutes, retention_days }, session.user.email);

    return Response.json(updated);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}
