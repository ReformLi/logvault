'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Dialog } from '@/components/ui/dialog';

interface LogRecord {
  id: string;
  deployment_id: string;
  blob_url: string;
  log_count: number;
  status: string;
  fetched_at: string;
}

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

interface Stats {
  total: number;
  active: number;
  storage: string;
  lastFetch: string | null;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLogs, setDetailLogs] = useState<LogEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, storage: '0 B', lastFetch: null });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs/list?page=${page}&pageSize=${pageSize}`);
      const data = await res.json();
      if (data.records) {
        setRecords(data.records);
        setTotal(data.total);
        setStats({
          total: data.total,
          active: data.records.filter((r: LogRecord) => r.status === 'active').length,
          storage: `${(data.total * 0.5).toFixed(1)} KB`,
          lastFetch: data.records[0]?.fetched_at ?? null,
        });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadRecords();
    }
  }, [status, loadRecords]);

  const handleFetch = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/fetch/manual', { method: 'POST' });
      const data = await res.json();
      if (data.record) {
        await loadRecords();
      } else if (data.error) {
        setFetchError(data.error);
      }
    } catch {
      setFetchError('Network error');
    } finally {
      setFetching(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const res = await fetch('/api/logs/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    if (res.ok) {
      setSelectedIds(new Set());
      await loadRecords();
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/logs/detail/${id}`);
      const data = await res.json();
      setDetailLogs(data.logs ?? []);
    } catch {
      setDetailLogs([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">LogVault</h1>
          <p className="text-sm text-neutral-500">{session?.user?.email}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/settings')}>
            Settings
          </Button>
          <Button onClick={handleFetch} disabled={fetching}>
            {fetching ? 'Fetching...' : 'Fetch Now'}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Total Logs</CardTitle>
          </CardHeader>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Active Records</CardTitle>
          </CardHeader>
          <p className="text-2xl font-bold">{stats.active}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Storage</CardTitle>
          </CardHeader>
          <p className="text-2xl font-bold">{stats.storage}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Last Fetch</CardTitle>
          </CardHeader>
          <p className="text-sm text-neutral-600">
            {stats.lastFetch ? new Date(stats.lastFetch).toLocaleString() : 'N/A'}
          </p>
        </Card>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {fetchError}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete Selected ({selectedIds.size})
          </Button>
        </div>
      )}

      <Card noPadding>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedIds.size === records.length && records.length > 0}
                  onChange={() => {
                    if (selectedIds.size === records.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(records.map((r) => r.id)));
                    }
                  }}
                />
              </TableHead>
              <TableHead>Fetched At</TableHead>
              <TableHead>Deployment ID</TableHead>
              <TableHead>Log Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedIds.has(record.id)}
                      onChange={() => toggleSelect(record.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(record.fetched_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                    {record.deployment_id}
                  </TableCell>
                  <TableCell>{record.log_count}</TableCell>
                  <TableCell>
                    <Badge variant={record.status as 'active' | 'deleted' | 'failed'}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetail(record.id)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </Card>

      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Log Details"
      >
        {detailLoading ? (
          <p className="text-neutral-500">Loading...</p>
        ) : detailLogs.length === 0 ? (
          <p className="text-neutral-500">No logs found</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800">
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="w-6 px-1 py-1"></th>
                  <th className="px-2 py-1 text-left font-medium text-neutral-500">Time</th>
                  <th className="px-2 py-1 text-left font-medium text-neutral-500">Status</th>
                  <th className="px-2 py-1 text-left font-medium text-neutral-500">Method</th>
                  <th className="px-2 py-1 text-left font-medium text-neutral-500">Path</th>
                  <th className="px-2 py-1 text-left font-medium text-neutral-500">Message</th>
                </tr>
              </thead>
              <tbody>
                {detailLogs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
                      <td className="px-1 py-1">
                        {(log.functionLogs?.length ?? 0) > 0 && (
                          <button
                            className="text-neutral-400 hover:text-neutral-600"
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          >
                            {expandedLogId === log.id ? '−' : '+'}
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-neutral-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-2 py-1">
                        <span className={`font-mono font-medium ${
                          log.responseStatusCode >= 500 ? 'text-red-600' :
                          log.responseStatusCode >= 400 ? 'text-yellow-600' :
                          log.responseStatusCode >= 300 ? 'text-blue-600' :
                          'text-green-600'
                        }`}>
                          {log.responseStatusCode}
                        </span>
                      </td>
                      <td className="px-2 py-1">
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
                      <td className="max-w-[200px] truncate px-2 py-1 font-mono text-neutral-700 dark:text-neutral-300">
                        {log.requestPath}
                      </td>
                      <td className="max-w-[300px] truncate px-2 py-1 text-neutral-600">
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
        )}
      </Dialog>
    </div>
  );
}
