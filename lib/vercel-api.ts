import type { AccessLogEntry } from './types';

interface VercelDeployment {
  uid: string;
  url: string;
  createdAt: number;
}

export interface FetchResult {
  deploymentId: string;
  logs: AccessLogEntry[];
  logCount: number;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  const delays = [5000, 10000, 30000];
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Vercel API responded with ${response.status}: ${await response.text()}`);
      }
      return response;
    } catch (error) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export async function getLatestDeployment(projectName?: string, projectId?: string): Promise<VercelDeployment | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN environment variable is not set');

  const params = new URLSearchParams({ limit: '1', state: 'READY', target: 'production' });
  if (projectName) params.set('app', projectName);
  if (projectId) params.set('projectId', projectId);

  const response = await fetchWithRetry(
    `https://api.vercel.com/v6/deployments?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await response.json();
  const deployments: VercelDeployment[] = data.deployments;
  return deployments?.[0] ?? null;
}

export async function getOwnerId(): Promise<string> {
  const fromEnv = process.env.VERCEL_OWNER_ID;
  if (fromEnv) return fromEnv;

  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN not set');

  const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (teamsRes.ok) {
    const teamsData = await teamsRes.json();
    if (teamsData.teams?.length > 0) {
      return teamsData.teams[0].id;
    }
  }

  const userRes = await fetch('https://api.vercel.com/v2/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (userRes.ok) {
    const userData = await userRes.json();
    if (userData.user?.id) return userData.user.id;
  }

  throw new Error('Could not determine Vercel owner ID. Set VERCEL_OWNER_ID in .env.local');
}

export async function fetchRequestLogs(options: {
  projectId: string;
  ownerId: string;
  deploymentId?: string;
  environment?: string;
  limit?: number;
  since?: number;
  until?: number;
}): Promise<AccessLogEntry[]> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN environment variable is not set');

  const now = Date.now();
  const query = new URLSearchParams({
    projectId: options.projectId,
    ownerId: options.ownerId,
    page: '0',
    startDate: String(options.since ?? now - 24 * 60 * 60 * 1000),
    endDate: String(options.until ?? now),
  });

  if (options.deploymentId) query.set('deploymentId', options.deploymentId);
  if (options.environment) query.set('environment', options.environment);
  if (options.limit) query.set('limit', String(options.limit));

  const response = await fetchWithRetry(
    `https://vercel.com/api/logs/request-logs?${query}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await response.json();
  const rows: any[] = data.rows || [];

  return rows.map((row) => ({
    id: row.requestId || '',
    timestamp: row.timestamp ? new Date(row.timestamp).getTime() : Date.now(),
    deploymentId: row.deploymentId || '',
    requestMethod: row.requestMethod || '',
    requestPath: row.requestPath || '',
    responseStatusCode: row.statusCode || 0,
    level: row.logs?.[0]?.level || 'info',
    message: row.logs?.[0]?.message || '',
    source: row.events?.[0]?.source || 'static',
    domain: row.domain || '',
    environment: row.environment || 'production',
    cache: row.cache,
    traceId: row.traceId,
    functionLogs: (row.logs || []).map((l: any) => ({ level: l.level || 'info', message: l.message || '' })),
  }));
}

export function getProjectConfig() {
  const name = process.env.VERCEL_PROJECT_NAME;
  const id = process.env.VERCEL_PROJECT_ID;
  if (!name && !id) {
    throw new Error('Set VERCEL_PROJECT_NAME or VERCEL_PROJECT_ID in .env.local');
  }
  return { name, id };
}

export async function fetchLatestLogs(projectName?: string, projectId?: string): Promise<FetchResult | null> {
  const [deployment, ownerId] = await Promise.all([
    getLatestDeployment(projectName, projectId),
    getOwnerId(),
  ]);

  if (!deployment || !projectId) return null;

  const logs = await fetchRequestLogs({
    projectId,
    ownerId,
    deploymentId: deployment.uid,
    environment: 'production',
    limit: 200,
  });

  return {
    deploymentId: deployment.uid,
    logs,
    logCount: logs.length,
  };
}
