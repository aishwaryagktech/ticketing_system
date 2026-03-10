const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const widgetClient = { get: (path: string) => request(path), post: (path: string, body: any) => request(path, { method: 'POST', body: JSON.stringify(body) }) };
