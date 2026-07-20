import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const isLocal = process.env.USE_LOCAL_DB === 'true';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

async function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

async function localPut(key: string, body: any): Promise<{ url: string }> {
  await ensureDir();
  const buffer = body instanceof Buffer ? body : Buffer.from(await new Response(body).arrayBuffer());
  const filePath = path.join(UPLOAD_DIR, key);
  await writeFile(filePath, buffer);
  return { url: `/uploads/${key}` };
}

async function localDel(url: string): Promise<void> {
  const key = url.startsWith('/uploads/') ? url.replace('/uploads/', '') : path.basename(url);
  const filePath = path.join(UPLOAD_DIR, key);
  try { await unlink(filePath); } catch { }
}

export async function put(
  key: string,
  body: any,
  options?: { access?: 'public' | 'private'; contentType?: string }
): Promise<{ url: string }> {
  if (isLocal) {
    return localPut(key, body);
  }
  const { put: vercelPut } = await import('@vercel/blob');
  return vercelPut(key, body, options as any);
}

export async function readBlob(url: string): Promise<string> {
  if (isLocal) {
    const key = url.startsWith('/uploads/') ? url.replace('/uploads/', '') : url;
    const filePath = path.join(UPLOAD_DIR, key);
    const { readFile } = await import('fs/promises');
    return readFile(filePath, 'utf-8');
  }
  const response = await fetch(url);
  return response.text();
}

export async function del(url: string): Promise<void> {
  if (isLocal) {
    return localDel(url);
  }
  const { del: vercelDel } = await import('@vercel/blob');
  return vercelDel(url);
}
