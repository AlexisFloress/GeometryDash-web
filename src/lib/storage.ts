export function readLocal<T>(key: string): T | null { try { const text = localStorage.getItem(key); return text ? JSON.parse(text) as T : null; } catch { return null; } }
export function writeLocal(key: string, data: unknown): boolean { try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch { return false; } }
export function removeLocal(key: string) { try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ } }
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
