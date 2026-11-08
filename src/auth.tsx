import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from './types';
import { api, json, observeSession, refreshSession, setSession } from './lib/api';

const Auth = createContext<{ session: Session | null; ready: boolean; logout: () => Promise<void>; update: (value: Session) => void }>({ session: null, ready: false, logout: async () => {}, update: () => {} });
export const useAuth = () => useContext(Auth);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, update] = useState<Session | null>(null); const [ready, setReady] = useState(false);
  useEffect(() => { observeSession(update); void refreshSession().finally(() => setReady(true)); return () => observeSession(() => {}); }, []);
  async function logout() { await api('/auth/logout', json('POST'), false); setSession(null); }
  return <Auth.Provider value={{ session, ready, logout, update: setSession }}>{children}</Auth.Provider>;
}
export function Private({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth(); const location = useLocation();
  if (!ready) return <p role="status">Recuperando sesión…</p>;
  return session ? children : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}
export function isAdmin(session: Session | null) {
  if (!session) return false;
  try {
    const body = JSON.parse(atob(session.accessToken.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    const role = body['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? body.role;
    return Array.isArray(role) ? role.includes('Administrator') : role === 'Administrator';
  } catch { return false; }
}
