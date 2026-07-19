import { auth } from '@/lib/auth';
import { getLogRecords } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'active';
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10);

  try {
    const result = await getLogRecords(status, page, pageSize);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch records' },
      { status: 500 }
    );
  }
}
