import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';
export function useResource<T>(path: string, auth = false) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<unknown>(null); const [loading, setLoading] = useState(true); const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce(n => n + 1), []);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(null); setData(null);
    api<T>(path, { signal: abort.signal }, auth).then(value => { if (!abort.signal.aborted) setData(value); }).catch(e => { if (!abort.signal.aborted) setError(e); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [path, auth, nonce]);
  return { data, error, loading, reload, setData };
}
