import { auth } from '@/lib/auth';
import { getLogRecordById } from '@/lib/db';
import { decrypt } from '@/lib/encrypt';
import { readBlob } from '@/lib/blob';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const record = await getLogRecordById(id);
    if (!record) {
      return Response.json({ error: 'Record not found' }, { status: 404 });
    }

    const encrypted = await readBlob(record.blob_url);
    const decrypted = decrypt(encrypted);
    const logs = JSON.parse(decrypted);

    return Response.json({ record, logs });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch detail' },
      { status: 500 }
    );
  }
}
