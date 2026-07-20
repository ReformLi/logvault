import { auth } from '@/lib/auth';
import { deleteLogRecords } from '@/lib/db';
import { del } from '@/lib/blob';
import { recordAudit } from '@/lib/audit';

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined;

  try {
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    const blobUrls = await deleteLogRecords(ids);
    await Promise.allSettled(blobUrls.map(url => del(url)));

    await recordAudit('delete', { ids }, session.user.email, ip);

    return Response.json({ message: `Deleted ${ids.length} records` });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
