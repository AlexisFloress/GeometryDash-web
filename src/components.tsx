import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth';
import { api, errorText, json, ApiError } from './lib/api';
import type { LevelCard, Page } from './types';
export const difficultyName = { Easy: 'Fácil', Normal: 'Normal', Hard: 'Difícil' };
export function Modal({ children, titleId, onCancel }: { children: ReactNode; titleId: string; onCancel: () => void }) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = element.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog className="dialog-shell" ref={element} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onCancel(); }}>{children}</dialog>;
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="notice danger" role="alert"><p>{errorText(error)}</p>{error instanceof ApiError && error.retryAfter > 0 && <p>Espera {error.retryAfter} segundos.</p>}{error instanceof ApiError && error.errors && <ul>{Object.entries(error.errors).map(([key, values]) => <li key={key}><strong>{key}:</strong> {values.join(' ')}</li>)}</ul>}{retry && <button className="secondary" onClick={retry}>Reintentar</button>}</div>;
}
export function ResourceState({ loading, error, retry, children }: { loading: boolean; error: unknown; retry: () => void; children: ReactNode }) {
  if (loading) return <div className="empty" role="status">Cargando…</div>;
  if (error) return <ErrorBox error={error} retry={retry} />;
  return children;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }
export function Pagination({ data, onPage }: { data: Pick<Page<unknown>, 'page' | 'pageSize' | 'totalCount'>; onPage: (p: number) => void }) {
  const total = Math.max(1, Math.ceil(data.totalCount / data.pageSize));
  return <div className="pagination"><button className="secondary" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>← Anterior</button><span>Página {data.page} de {total} · {data.totalCount} resultados</span><button className="secondary" disabled={data.page >= total} onClick={() => onPage(data.page + 1)}>Siguiente →</button></div>;
}
export function FavoriteButton({ id, initial = false, onChange }: { id: string; initial?: boolean; onChange?: () => void }) {
  const { session } = useAuth(); const [favorite, setFavorite] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  if (!session) return <Link className="button secondary" to="/login">Guardar favorito</Link>;
  return <><button className="secondary" disabled={busy} aria-pressed={favorite} onClick={async () => { setBusy(true); setError(null); try { await api(`/levels/${id}/favorite`, json(favorite ? 'DELETE' : 'PUT')); setFavorite(!favorite); onChange?.(); } catch (e) { setError(e); } finally { setBusy(false); } }}>{favorite ? '♥ Quitar favorito' : '♡ Guardar favorito'}</button>{!!error && <ErrorBox error={error} />}</>;
}
export function LevelTile({ card, favorite = false, onChange }: { card: LevelCard; favorite?: boolean; onChange?: () => void }) {
  return <article className="level-card"><Link className="level-art" to={`/levels/${card.id}`} aria-label={`Ver ${card.title}`}><span className="art-cube"/><span className="art-spike"/><span className="art-line"/><span className="art-number">{card.speedMultiplier}×</span></Link><div className="card-body"><div className="split"><span className={`badge ${card.difficulty.toLowerCase()}`}>{difficultyName[card.difficulty]}</span><small>Revisión {card.revisionNumber}</small></div><h3><Link to={`/levels/${card.id}`}>{card.title}</Link></h3><p className="muted">por {card.author}</p><p className="rating">{card.averageRating === null ? 'Sin puntuaciones' : `★ ${card.averageRating.toFixed(1)} · ${card.ratingCount} votos`}</p><div className="actions"><Link className="button" to={`/play/${card.id}`}>Jugar →</Link><FavoriteButton id={card.id} initial={favorite} onChange={onChange}/></div></div></article>;
}
