'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface Settings {
  cron_enabled: boolean;
  fetch_interval_minutes: number;
  retention_days: number;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    cron_enabled: true,
    fetch_interval_minutes: 60,
    retention_days: 30,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings/get');
        const data = await res.json();
        if (data.cron_enabled !== undefined) setSettings(data);
      } catch {
      }
    };
    loadSettings();
  }, [status]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-neutral-500">{session?.user?.email}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/')}>
          &larr; Back
        </Button>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Cron Job</CardTitle>
        </CardHeader>
        <div className="space-y-4">
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
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Retention</CardTitle>
        </CardHeader>
        <div className="space-y-4">
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
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600">Settings saved!</span>}
      </div>
    </div>
  );
}
