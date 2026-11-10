import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth';
import { errorText, setSession } from '../lib/api';
import type { Session } from '../types';

export type TestOperation = { method: string; path: string; summary?: string };

export default function ApiTester({ selection }: { selection: TestOperation | null }) {
  const { session, update } = useAuth();
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/v1/levels');
  const [token, setToken] = useState('');
  const [useSession, setUseSession] = useState(true);
  const [etag, setEtag] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('La respuesta aparecerá aquí.');
  const [pending, setPending] = useState(false);
  const section = useRef<HTMLElement>(null);
  const pathInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selection) return;
    setMethod(selection.method); setPath(selection.path); setBody(''); setEtag(''); setIdempotencyKey('');
    section.current?.scrollIntoView({ behavior: 'smooth' }); pathInput.current?.focus({ preventScroll: true });
  }, [selection]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setResponse('Enviando solicitud…');
    try {
      const value = path.trim();
      const url = new URL(value, window.location.origin);
      if (!value.startsWith('/') || url.origin !== window.location.origin || !(url.pathname.startsWith('/api/v1/') || ['/openapi/v1.json', '/health/live', '/health/ready'].includes(url.pathname)))
        throw new Error('Usa una ruta de la API de este sitio, como /api/v1/levels.');
      if (/[{}]/.test(value)) throw new Error('Reemplaza {id} por el identificador que quieres usar.');
      const headers = new Headers();
      const accessToken = token.trim() || (useSession ? session?.accessToken : '');
      if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
      if (etag.trim()) headers.set('If-Match', etag.trim());
      if (idempotencyKey.trim()) headers.set('Idempotency-Key', idempotencyKey.trim());
      let content: string | undefined;
      if (method !== 'GET' && body.trim()) { content = JSON.stringify(JSON.parse(body)); headers.set('Content-Type', 'application/json'); }
      const result = await fetch(url, { method, headers, body: content, credentials: 'same-origin' });
      const raw = await result.text();
      let data: unknown = raw;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* Show text responses too. */ }
      let display = data;
      if (result.ok && ['/api/v1/auth/login', '/api/v1/auth/refresh'].includes(url.pathname) && data && typeof data === 'object' && 'accessToken' in data && 'expiresAt' in data && 'user' in data) {
        const signedIn = data as Session;
        setToken(''); setUseSession(true); update(signedIn);
        display = { ...signedIn, accessToken: '(disponible en tu sesión durante esta visita)' };
        setBody('');
      }
      if (result.ok && url.pathname === '/api/v1/auth/logout') { setSession(null); setToken(''); }
      if (result.headers.get('ETag')) setEtag(result.headers.get('ETag')!);
      const retryAfter = result.headers.get('Retry-After');
      setResponse(`${result.status} ${result.statusText}${retryAfter ? '\nEspera ' + retryAfter + ' segundos antes de reintentar.' : ''}\n${typeof display === 'string' ? display : JSON.stringify(display, null, 2) ?? ''}`);
    } catch (error) { setResponse(errorText(error)); }
    finally { setPending(false); }
  }

  return <section id="probar-endpoints" ref={section} aria-labelledby="tester-title">
    <h2 id="tester-title">Prueba los endpoints</h2>
    <p>Cualquier persona puede usar este formulario. Empieza consultando los niveles publicados sin tener cuenta. Para guardar cambios o consultar datos privados necesitas iniciar sesión y tener los permisos correspondientes.</p>
    <p>Las solicitudes se envían al servicio conectado a este sitio, desde <code>{window.location.origin}</code>. Las acciones se aplican a los datos del servicio.</p>
    {selection?.summary && <p className="notice">{selection.summary}</p>}
    <form className="panel" onSubmit={submit}>
      <fieldset disabled={pending}>
        <legend>Configura tu solicitud</legend>
        <label>Método<select value={method} onChange={event => setMethod(event.target.value)}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(verb => <option key={verb}>{verb}</option>)}</select></label>
        <label>Ruta<input ref={pathInput} value={path} onChange={event => setPath(event.target.value)} required spellCheck={false}/></label>
        <p>Si la ruta contiene <code>{'{id}'}</code>, reemplázalo por el identificador del nivel, versión, partida o cuenta que quieras usar.</p>
        <label><input type="checkbox" checked={useSession} onChange={event => setUseSession(event.target.checked)}/> Usar mi sesión actual para las operaciones privadas</label>
        <label>Clave de acceso (Bearer, opcional)<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder="Pega un accessToken si quieres usar otra sesión"/></label>
        <label>Versión del borrador (If-Match)<input value={etag} onChange={event => setEtag(event.target.value)} placeholder={'"1"'}/></label>
        <label>Clave para evitar crear duplicados (Idempotency-Key)<input value={idempotencyKey} onChange={event => setIdempotencyKey(event.target.value)} placeholder="UUID requerido al crear un nivel"/></label>
        <button type="button" className="secondary" onClick={() => setIdempotencyKey(crypto.randomUUID())}>Generar clave</button>
        <label>Datos de la solicitud (JSON)<textarea rows={8} value={body} onChange={event => setBody(event.target.value)} spellCheck={false} placeholder={'{"email":"tu-correo@example.com","password":"TuContraseña"}'}/></label>
        <p>Puedes iniciar sesión enviando tu correo y contraseña a <code>POST /api/v1/auth/login</code>. El probador usará esa sesión para las siguientes solicitudes; la clave de acceso se guarda en memoria durante la visita.</p>
        <button type="submit">{pending ? 'Enviando…' : 'Enviar solicitud'}</button>
      </fieldset>
    </form>
    <pre role="status" aria-live="polite" aria-label="Respuesta de la API">{response}</pre>
  </section>;
}
