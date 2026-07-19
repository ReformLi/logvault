import { auth } from '@/lib/auth';
import { getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getSettings();
    return Response.json(settings);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to get settings' },
      { status: 500 }
    );
  }
}
