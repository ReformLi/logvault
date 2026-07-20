import { auth, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ user: null, isAdmin: false });
  }
  return Response.json({
    user: { email: session.user.email, name: session.user.name },
    isAdmin: isAdmin(session.user.email),
  });
}
