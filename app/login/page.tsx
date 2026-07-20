'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/');
    }
  }, [session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">LogVault</h1>
        <p className="mb-8 text-sm text-neutral-500 sm:text-base">Vercel Log Management System</p>
        <Button className="w-full sm:w-auto" onClick={() => signIn('github', { redirectTo: '/' })} size="lg">
          Sign in with GitHub
        </Button>
      </div>
    </div>
  );
}
