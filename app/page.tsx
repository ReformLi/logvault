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
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Toast from '@/components/ui/toast';

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
  const [detailError, setDetailError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [dialogSize, setDialogSize] = useState<'normal' | 'large' | 'full'>('large');
  const dialogWidthClass = dialogSize === 'full' ? 'max-w-[95vw] h-[90vh]' : dialogSize === 'large' ? 'max-w-6xl' : 'max-w-3xl';
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, storage: '0 B', lastFetch: null });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ cron_enabled: true, fetch_interval_minutes: 60, retention_days: 30 });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => setIsUserAdmin(d.isAdmin))
      .catch(() => {});
  }, []);

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
      } else if (data.message) {
        setFetchError(data.message);
      }
    } catch {
      setFetchError('Network error');
    } finally {
      setFetching(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const res = await fetch('/api/logs/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      setSelectedIds(new Set());
      await loadRecords();
      setFetchError(`Deleted ${ids.length} record(s)`);
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    setDetailError(null);
    setDetailLogs([]);
    try {
      const res = await fetch(`/api/logs/detail/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error || `Request failed (${res.status})`);
      } else {
        setDetailLogs(data.logs ?? []);
      }
    } catch {
      setDetailError('Network error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSettingsSave = async () => {
    setSettingsSaving(true);
    setSettingsSaved(false);
    try {
      const res = await fetch('/api/settings/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (status !== 'authenticated') return;
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings/get');
        const data = await res.json();
        if (data.cron_enabled !== undefined) setSettings(data);
      } catch {}
    };
    loadSettings();
  }, [status]);

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
    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">LogVault</h1>
          <p className="truncate text-sm text-neutral-500">{session?.user?.email}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isUserAdmin && (
            <Button variant="outline" size="sm" onClick={() => router.push('/audit-logs')}>
              Audit Logs
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Button size="sm" onClick={handleFetch} disabled={fetching}>
            {fetching ? 'Fetching...' : 'Fetch Now'}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-neutral-500 sm:text-sm">Total Logs</CardTitle>
          </CardHeader>
          <p className="text-xl font-bold sm:text-2xl">{stats.total}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-neutral-500 sm:text-sm">Active Records</CardTitle>
          </CardHeader>
          <p className="text-xl font-bold sm:text-2xl">{stats.active}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-neutral-500 sm:text-sm">Storage</CardTitle>
          </CardHeader>
          <p className="text-xl font-bold sm:text-2xl">{stats.storage}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-neutral-500 sm:text-sm">Last Fetch</CardTitle>
          </CardHeader>
          <p className="truncate text-xs text-neutral-600 sm:text-sm">
            {stats.lastFetch ? new Date(stats.lastFetch).toLocaleString() : 'N/A'}
          </p>
        </Card>
      </div>

      <div className="overflow-x-auto">
        <Card noPadding>
          <div className="flex items-center justify-between border-b border-neutral-200/50 px-4 py-2">
            <span className={`text-sm text-neutral-600 ${selectedIds.size === 0 ? 'invisible' : ''}`}>
              {selectedIds.size} selected
            </span>
            <Button variant="destructive" size="sm" onClick={handleDelete} className={selectedIds.size === 0 ? 'invisible' : ''}>
              Delete Selected
            </Button>
          </div>
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
                <TableHead className="whitespace-nowrap">Fetched At</TableHead>
                <TableHead className="whitespace-nowrap">Deployment ID</TableHead>
                <TableHead className="whitespace-nowrap">Log Count</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
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
                    <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                      {new Date(record.fetched_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate font-mono text-xs sm:max-w-[200px]">
                      {record.deployment_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{record.log_count}</TableCell>
                    <TableCell className="whitespace-nowrap">
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
      </div>

      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Log Details"
        className={dialogWidthClass}
        titleExtra={
          <div className="flex items-center gap-0.5 rounded-lg border border-neutral-200 text-xs dark:border-neutral-700">
            {(['normal', 'large', 'full'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setDialogSize(size)}
                className={`px-2 py-1 ${dialogSize === size ? 'bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
              >
                {size === 'normal' ? 'S' : size === 'large' ? 'M' : 'L'}
              </button>
            ))}
          </div>
        }
      >
        {detailLoading ? (
          <p className="text-neutral-500">Loading...</p>
        ) : detailError ? (
          <p className="text-red-500">Error: {detailError}</p>
        ) : detailLogs.length === 0 ? (
          <p className="text-neutral-500">No logs found</p>
        ) : (
          <div className="overflow-auto" style={{ resize: 'horizontal', minWidth: 300 }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900/50">
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="w-6 px-2 py-1.5"></th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-neutral-500">Time</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-neutral-500">Status</th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-neutral-500">Method</th>
                  <th className="px-2 py-1.5 text-left font-medium text-neutral-500">Path</th>
                  <th className="px-2 py-1.5 text-left font-medium text-neutral-500">Message</th>
                </tr>
              </thead>
              <tbody>
                {detailLogs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
                      <td className="px-2 py-1.5">
                        {(log.functionLogs?.length ?? 0) > 0 && (
                          <button
                            className="text-neutral-400 hover:text-neutral-600"
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          >
                            {expandedLogId === log.id ? '−' : '+'}
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-neutral-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`font-mono font-medium ${
                          log.responseStatusCode >= 500 ? 'text-red-600' :
                          log.responseStatusCode >= 400 ? 'text-yellow-600' :
                          log.responseStatusCode >= 300 ? 'text-blue-600' :
                          'text-green-600'
                        }`}>
                          {log.responseStatusCode}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
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
                      <td className="max-w-[200px] overflow-x-auto whitespace-nowrap px-2 py-1.5 font-mono text-neutral-700 dark:text-neutral-300 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        {log.requestPath}
                      </td>
                      <td className="max-w-[300px] overflow-x-auto whitespace-nowrap px-2 py-1.5 text-neutral-600 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        {log.message}
                      </td>
                    </tr>
                    {expandedLogId === log.id && (log.functionLogs?.length ?? 0) > 0 && (
                      <tr className="border-b border-neutral-100 dark:border-neutral-800">
                        <td colSpan={6} className="bg-neutral-50 px-4 py-2 dark:bg-neutral-900">
                          <pre className="max-h-40 overflow-auto text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
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

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
        className="max-w-lg"
      >
        <div className="space-y-6">
          <Switch
            id="cron-enabled"
            label="Enable automatic fetch"
            checked={settings.cron_enabled}
            onChange={(e) => setSettings((s) => ({ ...s, cron_enabled: e.target.checked }))}
          />

          <Select
            label="Fetch Interval"
            value={String(settings.fetch_interval_minutes)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, fetch_interval_minutes: parseInt(e.target.value, 10) }))
            }
            options={[
              { value: '30', label: 'Every 30 minutes' },
              { value: '60', label: 'Every hour' },
              { value: '360', label: 'Every 6 hours' },
              { value: '720', label: 'Every 12 hours' },
              { value: '1440', label: 'Once daily' },
            ]}
          />

          <Select
            label="Retention Period"
            value={String(settings.retention_days)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, retention_days: parseInt(e.target.value, 10) }))
            }
            options={[
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
              { value: '60', label: '60 days' },
              { value: '90', label: '90 days' },
            ]}
          />

          <div className="flex items-center gap-4">
            <Button onClick={handleSettingsSave} disabled={settingsSaving}>
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </Button>
            {settingsSaved && <span className="text-sm text-green-600">Settings saved!</span>}
          </div>
        </div>
      </Dialog>

      <Toast message={fetchError} onClose={() => setFetchError(null)} />
    </div>
  );
}
