import type { Session } from '../types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public errors?: Record<string, string[]>, public retryAfter = 0) { super(message); }
}
let current: Session | null = null;
let listener: (session: Session | null) => void = () => {};
let refreshing: Promise<Session | null> | null = null;
let blockedUntil = 0;
export function observeSession(fn: typeof listener) { listener = fn; }
export function setSession(value: Session | null) { current = value; listener(value); }
export function getSession() { return current; }
async function decode(response: Response) {
  if (response.status === 204) return undefined;
  const text = await response.text();
  try { return text ? JSON.parse(text) : undefined; } catch { throw new ApiError(response.status, 'INVALID_RESPONSE', 'El servidor devolvió una respuesta inesperada.'); }
}
export async function refreshSession(): Promise<Session | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    if (Date.now() < blockedUntil) return null;
    try {
      const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
      if (res.status === 429) { blockedUntil = Date.now() + Number(res.headers.get('Retry-After') || 60) * 1000; return null; }
      if (!res.ok) { if (res.status === 401 || res.status === 403) setSession(null); return null; }
      const session = await decode(res) as Session; setSession(session); return session;
    } catch { return null; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}
export async function api<T>(path: string, init: RequestInit = {}, auth = true, retry = true): Promise<T> {
  if (Date.now() < blockedUntil) throw new ApiError(429, 'RATE_LIMITED', 'Espera antes de volver a intentarlo.', undefined, Math.ceil((blockedUntil - Date.now()) / 1000));
  if (auth && current && Date.parse(current.expiresAt) - Date.now() < 20000) await refreshSession();
  const usedToken = current?.accessToken;
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (auth && current) headers.set('Authorization', `Bearer ${current.accessToken}`);
  let response: Response;
  try { response = await fetch('/api/v1' + path, { ...init, headers, credentials: 'include' }); }
  catch { throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con la API. Revisa la conexión e inténtalo otra vez.'); }
  if (response.status === 401 && auth && retry) {
    // A parallel request may already have rotated the session used by this request.
    const session = current?.accessToken !== usedToken && current ? current : await refreshSession();
    if (session) return api<T>(path, init, auth, false);
  }
  const data = await decode(response);
  if (!response.ok) {
    const wait = response.status === 429 ? Number(response.headers.get('Retry-After') || 60) : 0;
    if (wait) blockedUntil = Date.now() + wait * 1000;
    throw new ApiError(response.status, data?.code ?? 'REQUEST_FAILED', data?.title ?? 'No se pudo completar la operación.', data?.errors, wait);
  }
  return data as T;
}
export const json = (method: string, body?: unknown, headers?: HeadersInit): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body), headers });
export function errorText(error: unknown) { return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'; }
