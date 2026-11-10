import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError, api, errorText, json } from '../lib/api';
import { download, readLocal, removeLocal, writeLocal } from '../lib/storage';
import { ErrorBox, Modal } from '../components';
import { GameView } from '../game/Game';
import type { Difficulty, Draft, Editable, LevelObject } from '../types';
import { snap, validateLevel } from './rules.mjs';

interface Backup { userId: string; levelId: string; revisionId: string; baseVersion: number; editable: Editable; updatedAt: string }
const editable = (draft: Draft): Editable => ({ title: draft.title, description: draft.description, difficulty: draft.difficulty, content: structuredClone(draft.content) });
export default function Editor() {
  const { id } = useParams(); const { session } = useAuth(); const navigate = useNavigate();
  const [base, setBase] = useState<Draft | null>(null); const baseRef = useRef<Draft | null>(null);
  const [value, setValue] = useState<Editable | null>(null); const valueRef = useRef<Editable | null>(null); const saved = useRef('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState<unknown>(null); const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(''); const [recovery, setRecovery] = useState<Backup | null>(null); const [conflict, setConflict] = useState(false); const [review, setReview] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [testing, setTesting] = useState<Editable | null>(null); const [publishing, setPublishing] = useState(false); const [errors, setErrors] = useState<string[]>([]);
  const [tool, setTool] = useState<'select' | LevelObject['type']>('select'); const [selected, setSelected] = useState<string | null>(null);
  const [viewX, setViewX] = useState(0); const [viewY, setViewY] = useState(0); const [zoom, setZoom] = useState(32); const canvas = useRef<HTMLCanvasElement>(null);
  const past = useRef<Editable[]>([]); const future = useRef<Editable[]>([]); const [historyTick, updateHistory] = useState(0);
  const inFlight = useRef<Promise<Draft> | null>(null); const autoBlocked = useRef(false); const backupKey = useRef('');
  const blocker = useBlocker(({ currentLocation, nextLocation }) => JSON.stringify(valueRef.current) !== saved.current && valueRef.current !== null && currentLocation.pathname !== nextLocation.pathname);
  const userId = session!.user.id;
  function store(next: Editable, version = baseRef.current?.version ?? 1) {
    if (!baseRef.current) return;
    const backup: Backup = { userId, levelId: id!, revisionId: baseRef.current.revisionId, baseVersion: version, editable: next, updatedAt: new Date().toISOString() };
    const ok = writeLocal(backupKey.current, backup);
    setStatus(ok ? 'Cambios locales' : 'Cambios sin guardar: no se pudo crear copia local. Descarga el JSON.');
  }
  function change(next: Editable, record = true) {
    setSaveFeedback('');
    if (record && valueRef.current) { past.current.push(structuredClone(valueRef.current)); past.current = past.current.slice(-60); future.current = []; }
    valueRef.current = next; setValue(next); setDirty(JSON.stringify(next) !== saved.current); autoBlocked.current = conflict;
    store(next); updateHistory(n => n + 1); setErrors([]);
  }
  async function load(checkBackup = true) {
    setLoading(true); setError(null); setSaveFeedback('');
    try {
      let draft: Draft;
      try { draft = await api<Draft>(`/levels/${id}/draft`); }
      catch (err) { if (err instanceof ApiError && err.code === 'DRAFT_NOT_FOUND') draft = await api<Draft>(`/levels/${id}/draft`, json('POST')); else throw err; }
      baseRef.current = draft; setBase(draft); const next = editable(draft); valueRef.current = next; setValue(next); saved.current = JSON.stringify(next);
      backupKey.current = `gd:draft:${userId}:${id}:${draft.revisionId}`;
      const local = checkBackup ? readLocal<Backup>(backupKey.current) : null;
      setRecovery(local && local.userId === userId && local.levelId === id && local.revisionId === draft.revisionId && JSON.stringify(local.editable) !== saved.current ? local : null);
      setDirty(false); setConflict(false); autoBlocked.current = false; past.current = []; future.current = []; setStatus('Guardado en servidor');
    } catch (err) { setError(err); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id, userId]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  async function save(): Promise<Draft> {
    if (inFlight.current) { await inFlight.current; return save(); }
    if (!baseRef.current || !valueRef.current) throw new Error('El borrador no está cargado.');
    if (conflict || recovery) throw new Error('Resuelve la copia recuperada o el conflicto antes de guardar.');
    if (JSON.stringify(valueRef.current) === saved.current) return baseRef.current;
    const snapshot = structuredClone(valueRef.current); const text = JSON.stringify(snapshot);
    const invalid = validateLevel(snapshot, false); if (invalid.length) { setErrors(invalid); autoBlocked.current = true; throw new Error('Corrige los campos indicados antes de guardar.'); }
    setSaving(true); setStatus('Guardando…'); setError(null); autoBlocked.current = false;
    const operation = api<Draft>(`/levels/${id}/draft`, json('PUT', snapshot, { 'If-Match': `"${baseRef.current.version}"` })); inFlight.current = operation;
    try {
      const result = await operation; baseRef.current = result; setBase(result); saved.current = text;
      const stillDirty = JSON.stringify(valueRef.current) !== text; setDirty(stillDirty);
      if (stillDirty) store(valueRef.current!, result.version); else { removeLocal(backupKey.current); setStatus('Guardado en servidor'); }
      return result;
    } catch (err) {
      autoBlocked.current = true;
      if (err instanceof ApiError && err.status === 412) setConflict(true);
      setStatus('No se pudo guardar · se conserva la copia local'); setError(err); throw err;
    } finally { inFlight.current = null; setSaving(false); }
  }
  async function saveManually() {
    setError(null); setSaveFeedback('');
    const alreadySaved = JSON.stringify(valueRef.current) === saved.current;
    try {
      await save();
      setSaveFeedback(JSON.stringify(valueRef.current) !== saved.current
        ? 'Se guardó una versión anterior. Hay cambios recientes pendientes de guardar.'
        : alreadySaved ? 'No hay cambios pendientes: el nivel ya estaba guardado en el servidor.' : 'Nivel guardado en el servidor.');
    } catch (err) { setError(err); }
  }
  useEffect(() => {
    if (!dirty || recovery || conflict || publishing || saving || autoBlocked.current) return;
    const timer = setTimeout(() => { void save().catch(() => {}); }, 2000); return () => clearTimeout(timer);
  }, [value, dirty, recovery, conflict, saving, publishing]);
  useEffect(() => {
    const element = canvas.current; if (!element || !value) return; const ctx = element.getContext('2d'); if (!ctx) return;
    const width = 1100; const height = 420; element.width = width; element.height = height; const floor = height - 35;
    const px = (x: number) => (x - viewX) * zoom; const py = (y: number) => floor - (y - viewY) * zoom;
    ctx.fillStyle = '#f0f4eb'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#d9e2d2'; ctx.lineWidth = 1;
    for (let x = Math.floor(viewX * 2) / 2; px(x) < width; x += 0.5) { ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), height); ctx.stroke(); }
    for (let y = Math.floor(viewY * 2) / 2; py(y) > 0; y += 0.5) { ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(width, py(y)); ctx.stroke(); }
    ctx.fillStyle = '#c9d6bd'; ctx.fillRect(0, py(0), width, height - py(0));
    for (const o of value.content.objects) {
      ctx.fillStyle = o.type === 'triangle' ? '#b7683b' : '#4b7d65'; ctx.strokeStyle = selected === o.id ? '#d89b19' : '#315540'; ctx.lineWidth = selected === o.id ? 4 : 1;
      if (o.type === 'triangle') { ctx.beginPath(); ctx.moveTo(px(o.x), py(o.y)); ctx.lineTo(px(o.x + o.width / 2), py(o.y + o.height)); ctx.lineTo(px(o.x + o.width), py(o.y)); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.fillRect(px(o.x), py(o.y + o.height), o.width * zoom, o.height * zoom); ctx.strokeRect(px(o.x), py(o.y + o.height), o.width * zoom, o.height * zoom); }
    }
    ctx.fillStyle = '#d5a33a'; ctx.fillRect(px(value.content.spawn.x), py(0.8), 0.8 * zoom, 0.8 * zoom);
    ctx.fillStyle = '#8b6c23'; ctx.fillText('INICIO', px(value.content.spawn.x), py(1.2));
    ctx.strokeStyle = '#b88a20'; ctx.beginPath(); ctx.moveTo(px(value.content.finishX), py(0)); ctx.lineTo(px(value.content.finishX), py(4)); ctx.stroke(); ctx.fillText('META', px(value.content.finishX), py(4.3));
  }, [value, selected, viewX, viewY, zoom, testing]);
  function modifyObject(patch: Partial<LevelObject>) { if (!value) return; change({ ...value, content: { ...value.content, objects: value.content.objects.map(o => o.id === selected ? { ...o, ...patch } : o) } }); }
  function removeObject() { if (!value) return; change({ ...value, content: { ...value.content, objects: value.content.objects.filter(o => o.id !== selected) } }); setSelected(null); }
  function undo(redo = false) {
    const source = redo ? future.current : past.current; const target = redo ? past.current : future.current; const next = source.pop();
    if (next && valueRef.current) { target.push(structuredClone(valueRef.current)); change(next, false); }
  }
  const object = value?.content.objects.find(o => o.id === selected);
  const disabled = publishing || !!recovery;
  if (loading) return <p role="status">Abriendo editor…</p>;
  if (!value || !base) return <ErrorBox error={error ?? new Error('Borrador no disponible.')} retry={() => void load()}/>;
  return <section className="editor"><div className="section-heading"><div><p className="eyebrow">TU TALLER DE RECORRIDOS</p><h1>Editor de nivel</h1><p role="status" className="small muted">{status} · revisión {base.revisionNumber}</p></div><div className="actions"><button className="secondary" disabled={saving || disabled || conflict} onClick={() => void saveManually()}>{saving ? 'Guardando…' : 'Guardar'}</button><button className="secondary" disabled={disabled} onClick={() => { const invalid = validateLevel(value); setErrors(invalid); if (!invalid.length) setTesting(structuredClone(value)); }}>Probar</button><button disabled={disabled || saving || conflict} onClick={() => { const invalid = validateLevel(value, true); setErrors(invalid); if (!invalid.length) setReview(true); }}>Publicar →</button></div></div>
    {saveFeedback && <div className="notice" role="status">{saveFeedback}</div>}
    {!!error && <ErrorBox error={error}/>}{recovery && <div className="notice"><h2>Encontramos una copia local</h2><p>Guardada {new Date(recovery.updatedAt).toLocaleString('es')}. {recovery.baseVersion !== base.version ? 'La versión remota cambió. Revisa la copia antes de reemplazarla.' : 'Puedes recuperar tus cambios sin sincronizar.'}</p><div className="actions"><button onClick={() => { const local = recovery.editable; const stale = recovery.baseVersion !== base.version; setRecovery(null); change(local); if (stale) { setConflict(true); autoBlocked.current = true; } }}>Revisar copia local</button><button className="secondary" onClick={() => { download('copia-local.json', recovery.editable); }}>Descargar copia</button><button className="secondary" onClick={() => { removeLocal(backupKey.current); setRecovery(null); }}>Usar versión remota</button></div></div>}
    {conflict && <div className="notice danger"><h2>Otra pestaña guardó cambios</h2><p>Tu copia se conserva. Descárgala antes de cargar la versión remota; no se mezclan automáticamente.</p><div className="actions"><button className="secondary" onClick={() => download('conflicto-nivel.json', value)}>Descargar mis cambios</button><button onClick={() => { removeLocal(backupKey.current); void load(false); }}>Descartar cambios y recargar</button></div></div>}
    {!!errors.length && <div className="notice danger" role="alert"><h2>Revisa el nivel</h2><ul>{errors.slice(0, 15).map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
    {testing ? <div className="panel"><button className="secondary" onClick={() => setTesting(null)}>← Volver al editor</button><GameView document={testing.content} practice/></div> : <fieldset disabled={disabled} className="editor-fieldset"><div className="editor-meta"><label className="grow">Título<input value={value.title} maxLength={80} onChange={e => change({ ...value, title: e.target.value })}/></label><label>Dificultad<select value={value.difficulty} onChange={e => change({ ...value, difficulty: e.target.value as Difficulty })}><option value="Easy">Fácil</option><option value="Normal">Normal</option><option value="Hard">Difícil</option></select></label><label>Velocidad<select value={value.content.speedMultiplier} onChange={e => change({ ...value, content: { ...value.content, speedMultiplier: Number(e.target.value) } })}>{[0.75, 1, 1.25, 1.5].map(n => <option key={n} value={n}>{n}×</option>)}</select></label></div>
    <div className="editor-layout"><aside className="panel palette"><h2>Herramientas</h2>{(['select', 'cube', 'triangle', 'platform'] as const).map((kind, i) => <button className={tool === kind ? '' : 'secondary'} aria-pressed={tool === kind} key={kind} onClick={() => setTool(kind)}>{['↖ Seleccionar', '■ Cubo', '▲ Triángulo', '▬ Plataforma'][i]}</button>)}<hr/><button className="secondary" disabled={!past.current.length} onClick={() => undo()}>Deshacer</button><button className="secondary" disabled={!future.current.length} onClick={() => undo(true)}>Rehacer</button><small>{value.content.objects.length}/2000 objetos</small></aside>
    <div className="editor-center"><p className="small">{tool === 'select' ? 'Selecciona un objeto para editar sus propiedades.' : 'Haz clic en la cuadrícula para colocar un objeto.'} Cuadrícula: 0.5 unidades.</p><canvas className="editor-canvas" ref={canvas} aria-label="Lienzo de edición. Usa las propiedades para mover el objeto seleccionado." onPointerDown={e => {
      if (disabled) return; const rect = e.currentTarget.getBoundingClientRect(); const x = snap((e.clientX - rect.left) * 1100 / rect.width / zoom + viewX); const y = Math.max(0, snap((420 - 35 - (e.clientY - rect.top) * 420 / rect.height) / zoom + viewY));
      if (tool === 'select') { const hit = [...value.content.objects].reverse().find(o => x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height); setSelected(hit?.id ?? null); }
      else if (value.content.objects.length < 2000) { const o: LevelObject = { id: crypto.randomUUID(), type: tool, x, y, width: tool === 'platform' ? 4 : 1, height: tool === 'platform' ? 0.5 : 1, rotation: 0 }; change({ ...value, content: { ...value.content, objects: [...value.content.objects, o] } }); setSelected(o.id); }
    }}/><div className="editor-meta"><label className="grow">Desplazamiento horizontal: {viewX}<input type="range" min={0} max={value.content.length} step={0.5} value={viewX} onChange={e => setViewX(Number(e.target.value))}/></label><label>Altura visible<input type="range" min={0} max={25} step={0.5} value={viewY} onChange={e => setViewY(Number(e.target.value))}/></label><label>Zoom<input type="range" min={16} max={64} value={zoom} onChange={e => setZoom(Number(e.target.value))}/></label></div><svg className="overview" viewBox={`0 0 ${value.content.length} 32`} preserveAspectRatio="none" aria-label="Vista general del nivel">{value.content.objects.map(o => <rect key={o.id} x={o.x} y={30 - o.y - o.height} width={Math.max(o.width, 1)} height={Math.max(o.height, 1)} fill={o.type === 'triangle' ? '#b7683b' : '#427b65'}/>)}<line x1={value.content.finishX} x2={value.content.finishX} y1={0} y2={32} stroke="#bd8a25" strokeWidth={2}/><rect x={viewX} y={0} width={1100 / zoom} height={32} fill="none" stroke="#1a4f3e" strokeWidth={2}/></svg></div>
    <aside className="panel properties"><h2>Propiedades</h2>{object ? <><small>{object.type} · {object.id.slice(0, 8)}</small><label>Posición X<input type="number" step={0.5} min={0} max={value.content.length} value={object.x} onChange={e => modifyObject({ x: snap(Number(e.target.value)) })}/></label><label>Posición Y<input type="number" step={0.5} min={0} max={30} value={object.y} onChange={e => modifyObject({ y: snap(Number(e.target.value)) })}/></label>{object.type === 'platform' && <label>Ancho<input type="number" step={0.5} min={1} max={10} value={object.width} onChange={e => modifyObject({ width: snap(Number(e.target.value)) })}/></label>}<p className="small">Rotación: 0°. Tamaño: {object.width} × {object.height}.</p><button className="secondary" onClick={() => { const copy = { ...object, id: crypto.randomUUID(), x: object.x + object.width + 0.5 }; if (value.content.objects.length < 2000) { change({ ...value, content: { ...value.content, objects: [...value.content.objects, copy] } }); setSelected(copy.id); } }}>Duplicar</button><button className="text-button" onClick={removeObject}>Eliminar objeto</button></> : <p className="muted">Selecciona un objeto del lienzo o de la lista.</p>}<label>Objeto seleccionado<select value={selected ?? ''} onChange={e => setSelected(e.target.value || null)}><option value="">Ninguno</option>{value.content.objects.map((o, i) => <option value={o.id} key={o.id}>{i + 1}. {o.type} ({o.x}, {o.y})</option>)}</select></label></aside></div>
    <details className="panel"><summary>Configuración del recorrido</summary><div className="editor-meta"><label>Longitud<input type="number" min={100} max={5000} value={value.content.length} onChange={e => change({ ...value, content: { ...value.content, length: Math.round(Number(e.target.value)) } })}/></label><label>Inicio X<input type="number" step={0.5} min={0} max={10} value={value.content.spawn.x} onChange={e => change({ ...value, content: { ...value.content, spawn: { x: snap(Number(e.target.value)), y: 0 } } })}/></label><label>Meta X<input type="number" step={0.5} max={value.content.length} value={value.content.finishX} onChange={e => change({ ...value, content: { ...value.content, finishX: snap(Number(e.target.value)) } })}/></label></div><label>Descripción<textarea value={value.description} maxLength={2000} onChange={e => change({ ...value, description: e.target.value })}/></label><button className="secondary" onClick={() => download('nivel.json', value)}>Descargar JSON</button></details></fieldset>}
    {review && <Modal titleId="publish-title" onCancel={() => { if (!publishing) setReview(false); }}><section className="modal panel"><h2 id="publish-title">Publicar {value.title}</h2><p>{value.content.objects.length} objetos · velocidad {value.content.speedMultiplier}× · {value.difficulty}</p><p>Se guardará el borrador antes de publicarlo. La prueba local ayuda a revisar el recorrido, pero no certifica que pueda completarse.</p><div className="actions"><button disabled={publishing} onClick={async () => {
      setPublishing(true); setError(null);
      try { const draft = await save(); if (JSON.stringify(valueRef.current) !== saved.current) throw new Error('Hay cambios recientes. Guarda de nuevo antes de publicar.'); await api(`/levels/${id}/publish`, json('POST', { draftRevisionId: draft.revisionId, expectedLevelVersion: draft.levelVersion }, { 'If-Match': `"${draft.version}"` })); setDirty(false); removeLocal(backupKey.current); setReview(false); navigate(`/levels/${id}`); }
      catch (err) { setReview(false); setError(new Error(errorText(err))); } finally { setPublishing(false); }
    }}>{publishing ? 'Publicando…' : 'Guardar y publicar'}</button><button className="secondary" disabled={publishing} onClick={() => setReview(false)}>Cancelar</button></div></section></Modal>}
    {blocker.state === 'blocked' && <Modal titleId="leave-title" onCancel={() => blocker.reset()}><section className="modal panel"><h2 id="leave-title">Hay cambios sin guardar en el servidor</h2><p>La copia local estará disponible al volver a abrir este borrador con la misma cuenta.</p><div className="actions"><button onClick={() => blocker.proceed()}>Salir del editor</button><button className="secondary" onClick={() => blocker.reset()}>Seguir editando</button><button className="secondary" onClick={() => download('nivel-sin-sincronizar.json', value)}>Descargar copia</button></div></section></Modal>}
    <p className="small muted">El editor está pensado para escritorio. <Link to="/my/levels">Volver a mis niveles</Link><span hidden>{historyTick}</span></p>
  </section>;
}
