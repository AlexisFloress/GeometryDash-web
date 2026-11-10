import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { useResource } from '../hooks';
import { api, json } from '../lib/api';
import { readLocal, removeLocal, writeLocal } from '../lib/storage';
import { Empty, ErrorBox, LevelTile, Pagination, ResourceState } from '../components';
import type { CompletedLevel, Draft, LevelCard, OwnLevel, Page } from '../types';

export function CreateLevel() {
  const { session } = useAuth(); const navigate = useNavigate(); const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  const pendingKey = `gd:create:${session!.user.id}`;
  const pending = useRef(readLocal<{ key: string; title: string; description: string }>(pendingKey));
  const [title, setTitle] = useState(pending.current?.title ?? 'Mi primer nivel'); const [description, setDescription] = useState(pending.current?.description ?? '');
  return <section className="access panel"><h1>Crea un nivel</h1><p>Empieza con un nombre. Después podrás colocar objetos y probar cada salto.</p>{!!error && <ErrorBox error={error}/>}<form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(null); try {
    if (!pending.current) { pending.current = { key: crypto.randomUUID(), title, description }; writeLocal(pendingKey, pending.current); }
    const { key, ...body } = pending.current;
    const draft = await api<Draft>('/levels', json('POST', body, { 'Idempotency-Key': key })); removeLocal(pendingKey); navigate(`/editor/${draft.levelId}`);
  } catch (err) { setError(err); } finally { setBusy(false); } }}><label>Título<input value={title} onChange={e => setTitle(e.target.value)} minLength={3} maxLength={80} disabled={!!pending.current} required/></label><label>Descripción<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} disabled={!!pending.current}/></label>{pending.current && <p className="small">Hay una creación pendiente. El reintento usa el mismo nombre y la misma clave para evitar duplicados.</p>}<button disabled={busy}>{busy ? 'Creando…' : pending.current ? 'Reintentar creación' : 'Abrir editor →'}</button></form></section>;
}
export default function Library({ tab }: { tab: 'levels' | 'favorites' | 'completed' }) {
  const [params, setParams] = useSearchParams(); const page = Math.max(1, Number(params.get('page')) || 1);
  const resource = useResource<Page<OwnLevel | LevelCard | CompletedLevel>>(`/me/${tab}?page=${page}&pageSize=12`, true);
  const [deleting, setDeleting] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  return <section><div className="section-heading"><div><h1>Mi biblioteca</h1></div><Link className="button" to="/create">+ Crear nivel</Link></div><nav className="tabs" aria-label="Biblioteca"><Link aria-current={tab === 'levels' ? 'page' : undefined} to="/my/levels">Mis niveles</Link><Link aria-current={tab === 'favorites' ? 'page' : undefined} to="/my/favorites">Favoritos</Link><Link aria-current={tab === 'completed' ? 'page' : undefined} to="/my/completed">Completados</Link></nav>{!!error && <ErrorBox error={error}/>}
  {deleting && <div className="notice danger"><h2>¿Eliminar este nivel?</h2><p>Dejará de estar disponible y se quitará de los favoritos de todas las personas. Esta acción no tiene restauración desde tu biblioteca.</p><div className="actions"><button disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await api(`/levels/${deleting}`, json('DELETE')); setDeleting(null); resource.reload(); } catch (err) { setError(err); } finally { setBusy(false); } }}>Eliminar nivel</button><button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div></div>}
  <ResourceState {...resource} retry={resource.reload}>{resource.data && <>{!resource.data.items.length && <Empty>{tab === 'levels' ? 'Todavía no has creado niveles.' : tab === 'favorites' ? 'Guarda un nivel del catálogo para encontrarlo aquí.' : 'Tus niveles completados aparecerán aquí.'}</Empty>}
  <div className={tab === 'favorites' ? 'cards' : 'list'}>{resource.data.items.map(item => {
    if (tab === 'favorites') return <LevelTile key={(item as LevelCard).id} card={item as LevelCard} favorite onChange={resource.reload}/>;
    if (tab === 'levels') { const level = item as OwnLevel; return <article className="list-item" key={level.id}><div><span className="badge">{level.status === 'Published' ? 'Publicado' : level.status === 'Withdrawn' ? 'Retirado' : 'Borrador'}{level.draftRevisionId && level.publishedRevisionId ? ' · cambios en borrador' : ''}</span><h3>{level.title}</h3><small className="muted">Actualizado {new Date(level.updatedAt).toLocaleDateString('es')}</small></div><div className="actions"><Link className="button secondary" to={`/editor/${level.id}`}>Editar</Link>{level.status === 'Published' && <Link to={`/levels/${level.id}`}>Ver publicación</Link>}<button className="text-button" onClick={() => setDeleting(level.id)}>Eliminar</button></div></article>; }
    const level = item as CompletedLevel; return <article className="list-item" key={level.levelId}><div><span className="badge">{!level.available ? 'No disponible' : level.currentRevisionCompleted ? 'Revisión actual completada' : 'Revisión anterior completada'}</span><h3>{level.revisions[0]?.title ?? 'Nivel'}</h3><details><summary>Ver revisiones completadas</summary>{level.revisions.map(r => <p key={r.id}>Revisión {r.revisionNumber} · {r.completionCount} completados · mejor avance {r.bestProgress}%</p>)}</details><small className="muted">Resultado reportado por el cliente</small></div>{level.available && <Link className="button secondary" to={`/play/${level.levelId}`}>Volver a jugar</Link>}</article>;
  })}</div><Pagination data={resource.data} onPage={p => setParams({ page: String(p) })}/></>}</ResourceState></section>;
}
