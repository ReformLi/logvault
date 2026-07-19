interface VercelDeployment {
  uid: string;
  url: string;
  createdAt: number;
}

interface VercelLog {
  id: string;
  date: string;
  text: string;
  deploymentId: string;
}

export interface FetchResult {
  deploymentId: string;
  logs: VercelLog[];
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

export async function getLatestDeployment(projectName: string): Promise<VercelDeployment | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error('VERCEL_TOKEN environment variable is not set');
  }

  const response = await fetchWithRetry(
    `https://api.vercel.com/v6/deployments?app=${projectName}&limit=1&state=READY&target=production`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();
  const deployments: VercelDeployment[] = data.deployments;
  return deployments?.[0] ?? null;
}

export async function fetchDeploymentLogs(deploymentId: string, limit = 1000): Promise<VercelLog[]> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error('VERCEL_TOKEN environment variable is not set');
  }

  const response = await fetchWithRetry(
    `https://api.vercel.com/v1/deployments/${deploymentId}/logs?limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();
  return data as VercelLog[];
}

export async function fetchLatestLogs(projectName: string): Promise<FetchResult | null> {
  const deployment = await getLatestDeployment(projectName);
  if (!deployment) {
    return null;
  }

  const logs = await fetchDeploymentLogs(deployment.uid);

  return {
    deploymentId: deployment.uid,
    logs,
    logCount: logs.length,
  };
}
