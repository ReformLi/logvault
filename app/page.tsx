'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
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
  date: string;
  text: string;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLogs, setDetailLogs] = useState<LogEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
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
    try {
      const res = await fetch('/api/fetch/manual', { method: 'POST' });
      const data = await res.json();
      if (data.record) {
        await loadRecords();
      }
    } catch {
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
        ) : (
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed dark:bg-neutral-900">
            {JSON.stringify(detailLogs, null, 2)}
          </pre>
        )}
      </Dialog>
    </div>
  );
}
