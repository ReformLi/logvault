'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, Fragment } from 'react';
import { Button } from '@/components/ui/button';

interface LogEntry {
  id: string;
  timestamp: number;
  requestMethod: string;
  requestPath: string;
  responseStatusCode: number;
  level: string;
  message: string;
  source: string;
  domain: string;
  environment: string;
  functionLogs?: { level: string; message: string }[];
}

export default function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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
    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.push('/')}>
          &larr; Back
        </Button>
        <Button size="sm" onClick={handleDownload}>Download TXT</Button>
      </div>

      {logs.length === 0 ? (
        <p className="text-neutral-500">No logs found</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="max-h-[80vh] overflow-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800">
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="w-6 px-1 py-2"></th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-neutral-500">Time</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-neutral-500">Status</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-neutral-500">Method</th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">Path</th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
                      <td className="px-1 py-2">
                        {(log.functionLogs?.length ?? 0) > 0 && (
                          <button
                            className="text-neutral-400 hover:text-neutral-600"
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          >
                            {expandedLogId === log.id ? '−' : '+'}
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-neutral-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono font-medium ${
                          log.responseStatusCode >= 500 ? 'text-red-600' :
                          log.responseStatusCode >= 400 ? 'text-yellow-600' :
                          log.responseStatusCode >= 300 ? 'text-blue-600' :
                          'text-green-600'
                        }`}>
                          {log.responseStatusCode}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono font-medium ${
                          log.requestMethod === 'GET' ? 'text-blue-600' :
                          log.requestMethod === 'POST' ? 'text-green-600' :
                          log.requestMethod === 'PUT' ? 'text-orange-600' :
                          log.requestMethod === 'DELETE' ? 'text-red-600' :
                          'text-neutral-600'
                        }`}>
                          {log.requestMethod}
                        </span>
                      </td>
                      <td className="max-w-[300px] overflow-x-auto whitespace-nowrap px-3 py-2 font-mono text-neutral-700 dark:text-neutral-300 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        {log.requestPath}
                      </td>
                      <td className="max-w-[400px] overflow-x-auto whitespace-nowrap px-3 py-2 text-neutral-600 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        {log.message}
                      </td>
                    </tr>
                    {expandedLogId === log.id && (log.functionLogs?.length ?? 0) > 0 && (
                      <tr className="border-b border-neutral-100 dark:border-neutral-800">
                        <td colSpan={6} className="bg-neutral-50 px-4 py-2 dark:bg-neutral-900">
                          <pre className="max-h-40 overflow-auto text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                            {log.functionLogs!.map((l, i) => (
                              <span key={i} className={`block ${l.level === 'error' ? 'text-red-600' : l.level === 'warn' ? 'text-yellow-600' : ''}`}>
                                {l.message}
                              </span>
                            ))}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
