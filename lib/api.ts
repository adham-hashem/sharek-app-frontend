import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError('Backend URL is not configured', 0, 'CONFIGURATION_ERROR');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError('Authentication is required', 401, 'UNAUTHORIZED');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers, signal: init.signal ?? controller.signal });
    const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    if (!response.ok) throw new ApiError(payload?.message ?? 'Request failed', response.status, payload?.error);
    return payload as T;
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') throw new ApiError('Request timed out', 408, 'TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiPost = <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
