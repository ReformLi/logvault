'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';

interface AuditLog {
  id: number;
  action: string;
  detail: { ipAddress?: string; [key: string]: unknown };
  user_email: string;
  created_at: string;
}

export default function AuditLogsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [action, setAction] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (action !== 'all') params.set('action', action);
        const res = await fetch(`/api/audit-logs?${params}`);
        if (res.status === 403) { router.push('/'); return; }
        const data = await res.json();
        if (data.logs) { setLogs(data.logs); setTotal(data.total); }
      } catch {
      } finally { setLoading(false); }
    };
    load();
  }, [status, page, pageSize, action, router]);

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const res = await fetch('/api/audit-logs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    if (res.ok) {
      setSelectedIds(new Set());
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (action !== 'all') params.set('action', action);
      const r = await fetch(`/api/audit-logs?${params}`);
      const data = await r.json();
      if (data.logs) { setLogs(data.logs); setTotal(data.total); }
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const actionColor = (log: AuditLog) => {
    const a = log.action;
    if (a === 'login') return log.detail?.success === false ? 'text-red-500' : 'text-green-600';
    switch (a) {
      case 'delete': return 'text-red-600';
      case 'fetch': return 'text-blue-600';
      case 'settings': return 'text-orange-600';
      default: return 'text-neutral-600';
    }
  };

  return (
    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Audit Logs</h1>
          <p className="text-sm text-neutral-500">Operation history with timestamps</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/')}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-48">
          <Select
            label="Action"
            value={action}
            onChange={(e) => { setPage(1); setAction(e.target.value); }}
            options={[
              { value: 'all', label: 'All Actions' },
              { value: 'login', label: 'Login' },
              { value: 'fetch', label: 'Fetch' },
              { value: 'delete', label: 'Delete' },
              { value: 'settings', label: 'Settings' },
            ]}
          />
        </div>
        {selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      <Card noPadding>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedIds.size === logs.length && logs.length > 0}
                  onChange={() => {
                    if (selectedIds.size === logs.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(logs.map((l) => l.id)));
                    }
                  }}
                />
              </TableHead>
              <TableHead className="whitespace-nowrap">Time</TableHead>
              <TableHead className="whitespace-nowrap">User</TableHead>
              <TableHead className="whitespace-nowrap">Action</TableHead>
              <TableHead className="whitespace-nowrap">IP</TableHead>
              <TableHead className="whitespace-nowrap">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">Loading...</TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">No audit logs found</TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <Fragment key={log.id}>
                  <TableRow>
                    <TableCell className="px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedIds.has(log.id)}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(log.id)) next.delete(log.id);
                            else next.add(log.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-xs sm:max-w-[200px]">
                      {log.user_email}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      <span className={actionColor(log)}>{log.action}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-neutral-500">
                      {log.detail?.ipAddress || '—'}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate font-mono text-xs text-neutral-500 sm:max-w-[300px]">
                      <span
                        className="cursor-pointer hover:text-neutral-700"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        {JSON.stringify(log.detail)}
                      </span>
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                          {JSON.stringify(log.detail, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
        <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </Card>
    </div>
  );
}
