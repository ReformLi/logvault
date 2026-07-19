'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface LogEntry {
  id: string;
  date: string;
  text: string;
}

export default function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const loadDetail = async () => {
      const { id } = await params;
      try {
        const res = await fetch(`/api/logs/detail/${id}`);
        const data = await res.json();
        setLogs(data.logs ?? []);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [status, params]);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/')}>
          &larr; Back
        </Button>
        <Button onClick={handleDownload}>Download TXT</Button>
      </div>

      <pre className="max-h-[80vh] overflow-auto rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed dark:bg-neutral-900">
        {JSON.stringify(logs, null, 2)}
      </pre>
    </div>
  );
}
