import { useState } from 'react';
import { useAuth, isAdmin } from '../auth';
import { api, json } from '../lib/api';
import { useResource } from '../hooks';
import { ErrorBox, Pagination, ResourceState } from '../components';
import type { Page } from '../types';
interface Audit { id: string; action: string; targetType: string; targetId: string; reason: string; createdAt: string }
export default function Admin() {
  const { session } = useAuth();
  if (!isAdmin(session)) return <div className="notice danger" role="alert">Esta sección requiere el rol de administrador.</div>;
  return <AdminTools/>;
}
function AdminTools() {
  const [page, setPage] = useState(1); const resource = useResource<Page<Audit>>(`/admin/audit?page=${page}&pageSize=20`, true);
  const [error, setError] = useState<unknown>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  return <section><p className="eyebrow">MODERACIÓN</p><h1>Administración</h1><p>Las acciones requieren motivo y quedan registradas. La autorización efectiva la aplica el servidor.</p><form className="panel" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(null); setMessage(''); const data = new FormData(e.currentTarget); try { const action = String(data.get('action')); const id = String(data.get('id')).trim(); if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Introduce un UUID válido.'); await api(`/admin/${action.replace(':id', id)}`, json('POST', { reason: data.get('reason') })); setMessage('Acción aplicada y auditada.'); resource.reload(); } catch (err) { setError(err); } finally { setBusy(false); } }}><div className="editor-meta"><label>Acción<select name="action"><option value="levels/:id/withdraw">Retirar nivel</option><option value="levels/:id/restore">Restaurar nivel retirado</option><option value="users/:id/suspend">Suspender cuenta</option><option value="users/:id/activate">Activar cuenta</option></select></label><label className="grow">UUID del recurso<input name="id" required/></label></div><label>Motivo<textarea name="reason" minLength={1} maxLength={1000} required/></label><button disabled={busy}>{busy ? 'Aplicando…' : 'Aplicar acción'}</button></form>{!!error && <ErrorBox error={error}/>}<p role="status">{message}</p><h2>Auditoría</h2><ResourceState {...resource} retry={resource.reload}>{resource.data && <><div className="list">{resource.data.items.map(item => <article className="list-item" key={item.id}><div><strong>{item.action}</strong><p>{item.targetType}: <code>{item.targetId}</code></p><p>{item.reason}</p><small>{new Date(item.createdAt).toLocaleString('es')}</small></div></article>)}</div><Pagination data={resource.data} onPage={setPage}/></>}</ResourceState></section>;
}
