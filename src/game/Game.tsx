import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { useResource } from '../hooks';
import { api, errorText, json } from '../lib/api';
import { readLocal, writeLocal } from '../lib/storage';
import { ErrorBox, ResourceState } from '../components';
import type { Attempt, ContentResponse, LevelDocument, Result } from '../types';
import { advanceFrame, createWorld, demoDocument, drawWorld } from './engine.mjs';
import type { World } from './engine.mjs';
import { addPending, readPending, sendPending } from './pending';
import type { Pending } from './pending';

type State = 'Ready' | 'Starting' | 'Countdown' | 'Running' | 'Paused' | 'Dead' | 'Completed';
export function GameView({ document, levelId, revisionId, practice = false }: { document: LevelDocument; levelId?: string; revisionId?: string; practice?: boolean }) {
  const { session } = useAuth(); const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World>(createWorld(document)); const gameState = useRef<State>('Ready');
  const [state, setState] = useState<State>('Ready'); const [progress, setProgress] = useState(0); const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<unknown>(null); const [sync, setSync] = useState(''); const [sending, setSending] = useState(false);
  const attempt = useRef<Attempt | null>(null); const pauseTicks = useRef(0); const pauseStart = useRef<number | null>(null);
  const jump = useRef(false); const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const currentRun = useRef(0);
  const [jumpKey, setJumpKey] = useState(readLocal<string>('gd:jump-key') ?? 'Space');
  const pending = useRef<Pending | null>(null); const [oldPending, setOldPending] = useState<Pending[]>(session ? readPending(session.user.id) : []);
  const local = practice || !session || !levelId;
  function transition(next: State) { gameState.current = next; setState(next); }
  function clearTimer() { if (stateTimer.current) clearTimeout(stateTimer.current); stateTimer.current = null; }
  function pause() {
    if (gameState.current !== 'Running' && gameState.current !== 'Countdown') return;
    clearTimer(); pauseStart.current ??= performance.now(); jump.current = false; transition('Paused');
  }
  function resume() {
    clearTimer(); canvas.current?.focus(); transition('Countdown'); let remaining = 3; setCountdown(remaining);
    function tick() {
      if (gameState.current !== 'Countdown') return;
      remaining--; setCountdown(remaining);
      if (remaining > 0) stateTimer.current = setTimeout(tick, 1000);
      else { if (pauseStart.current !== null) pauseTicks.current += Math.floor((performance.now() - pauseStart.current) / 1000 * 120); pauseStart.current = null; transition('Running'); }
    }
    stateTimer.current = setTimeout(tick, 1000);
  }
  async function start() {
    if (gameState.current === 'Starting' || gameState.current === 'Running' || gameState.current === 'Countdown') return;
    if (pending.current && sync !== 'Resultado guardado en servidor.') { setError(new Error('Reintenta guardar el resultado pendiente antes de reiniciar, o vuelve al catálogo.')); return; }
    transition('Starting'); setError(null); setSync(''); pending.current = null; currentRun.current++;
    try {
      attempt.current = local ? null : await api<Attempt>(`/levels/${levelId}/attempts`, json('POST', { expectedRevisionId: revisionId }));
      world.current = createWorld(document); pauseTicks.current = 0; pauseStart.current = performance.now(); setProgress(0); jump.current = false;
      resume();
    } catch (err) { setError(err); transition('Ready'); }
  }
  async function transmit(item: Pending, uid: string) {
    const run = currentRun.current; setSending(true);
    try { await sendPending(uid, item); if (run === currentRun.current) { setSync('Resultado guardado en servidor.'); pending.current = null; } setOldPending(readPending(uid)); }
    catch (err) { setSync('Resultado local pendiente de sincronizar.'); setError(err); }
    finally { setSending(false); }
  }
  function finish(outcome: Result['outcome']) {
    if (outcome === 'Quit') { pause(); transition('Ready'); } else transition(outcome);
    const active = attempt.current; if (!active || !session) { setSync(practice ? 'Prueba local: no modifica tu biblioteca.' : 'Partida local: sin progreso en el servidor.'); return; }
    const result: Result = { clientResultId: crypto.randomUUID(), outcome, elapsedTicks: world.current.ticks, pauseTicks: pauseTicks.current, progressPercent: outcome === 'Completed' ? 100 : Math.floor(world.current.progress * 100) / 100 };
    const item = { attemptId: active.id, result }; pending.current = item;
    const stored = addPending(session.user.id, item); setSync(stored ? 'Guardando resultado…' : 'Guardando resultado… La copia local no está disponible.');
    void transmit(item, session.user.id);
  }
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const ctx = element.getContext('2d'); if (!ctx) return;
    const resize = () => { element.width = Math.max(320, Math.floor(element.getBoundingClientRect().width)); element.height = 380; drawWorld(ctx, element, document, world.current); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const visibility = () => { if (globalThis.document.hidden) pause(); }; const blur = () => pause();
    globalThis.document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', blur);
    return () => { clearTimer(); observer.disconnect(); globalThis.document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur); };
  }, [document]);
  useEffect(() => {
    if (state !== 'Running') { const c = canvas.current; const ctx = c?.getContext('2d'); if (c && ctx) drawWorld(ctx, c, document, world.current); return; }
    let frame = 0; let previous = performance.now(); let accumulator = 0; let lastUI = 0;
    const loop = (now: number) => {
      if (gameState.current !== 'Running') return;
      const elapsed = (now - previous) / 1000; previous = now;
      const result = advanceFrame(world.current, document, elapsed, accumulator, jump.current); accumulator = result.accumulator;
      if (result.consumedJump) jump.current = false;
      if (result.unstable) { pause(); return; }
      world.current = result.world; const c = canvas.current; const ctx = c?.getContext('2d'); if (c && ctx) drawWorld(ctx, c, document, world.current);
      if (now - lastUI > 80) { setProgress(world.current.progress); lastUI = now; }
      if (world.current.outcome) { setProgress(world.current.progress); finish(world.current.outcome); return; }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame);
  }, [state, document]);
  useEffect(() => () => {
    // Route changes preserve an unfinished attempt as Quit for an explicit retry.
    if (session && attempt.current && ['Running', 'Paused', 'Countdown'].includes(gameState.current)) {
      addPending(session.user.id, { attemptId: attempt.current.id, result: { clientResultId: crypto.randomUUID(), outcome: 'Quit', elapsedTicks: world.current.ticks, pauseTicks: pauseTicks.current, progressPercent: Math.floor(world.current.progress * 100) / 100 } });
    }
  }, []);
  return <div className="game"><div className="game-bar"><span>{practice ? 'Prueba del borrador' : local ? 'Partida local' : 'Partida con progreso'}</span><span>{progress.toFixed(1)}%</span></div><progress value={progress} max="100" aria-label="Avance"/>
    <div className="game-stage"><canvas ref={canvas} tabIndex={0} aria-label="Juego. Espacio o clic derecho para saltar; Escape para pausar." onKeyDown={e => { if (e.code === jumpKey) { e.preventDefault(); if (!e.repeat && state === 'Running') jump.current = true; } if (e.code === 'Escape') pause(); }} onContextMenu={e => e.preventDefault()} onPointerDown={e => { if (e.button === 2 || e.pointerType === 'touch') { e.preventDefault(); canvas.current?.focus(); if (state === 'Running') jump.current = true; } }} onBlur={pause}/>
    {state !== 'Running' && <div className="game-overlay"><div><h2>{state === 'Ready' ? '¿Listo para saltar?' : state === 'Starting' ? 'Preparando partida…' : state === 'Countdown' ? countdown : state === 'Paused' ? 'Partida en pausa' : state === 'Dead' ? 'Un salto más cerca.' : '¡Nivel completado!'}</h2><p>{state === 'Dead' ? `Alcanzaste ${progress.toFixed(1)}%. Inténtalo otra vez.` : state === 'Paused' ? 'La simulación está detenida.' : 'Espacio o clic derecho · un toque, un salto'}</p>{state === 'Paused' ? <button onClick={resume}>Reanudar</button> : state !== 'Countdown' && state !== 'Starting' ? <button disabled={sending || !!pending.current} onClick={() => void start()}>{state === 'Ready' ? 'Iniciar partida' : 'Volver a intentar'}</button> : null}</div></div>}</div>
    <div className="actions"><button className="secondary" disabled={state !== 'Running' && state !== 'Countdown'} onClick={pause}>Pausar</button><button className="secondary" disabled={state !== 'Paused'} onClick={() => finish('Quit')}>Terminar intento</button><label>Tecla de salto<select value={jumpKey} disabled={state === 'Running' || state === 'Countdown'} onChange={e => { setJumpKey(e.target.value); writeLocal('gd:jump-key', e.target.value); }}><option value="Space">Espacio</option><option value="KeyW">W</option><option value="ArrowUp">Flecha arriba</option></select></label></div>
    <p role="status">{sync}</p>{pending.current && session && <button disabled={sending} onClick={() => void transmit(pending.current!, session.user.id)}>Reintentar guardar resultado</button>}{!!error && <ErrorBox error={error}/>}
    {session && oldPending.filter(p => p.attemptId !== pending.current?.attemptId).length > 0 && <details><summary>Resultados anteriores pendientes</summary>{oldPending.filter(p => p.attemptId !== pending.current?.attemptId).map(item => <p key={item.attemptId}>{item.result.outcome} · {item.result.progressPercent}% <button className="secondary" disabled={sending} onClick={async () => { setSending(true); try { await sendPending(session.user.id, item); setOldPending(readPending(session.user.id)); } catch (err) { setError(new Error(errorText(err))); } finally { setSending(false); } }}>Reintentar</button></p>)}</details>}
    </div>;
}
function PublicGame({ id }: { id: string }) {
  const resource = useResource<ContentResponse>(`/levels/${id}/content`);
  return <ResourceState {...resource} retry={resource.reload}>{resource.data && <GameView key={resource.data.revisionId} document={resource.data.content} levelId={id} revisionId={resource.data.revisionId}/>}</ResourceState>;
}
const demo = demoDocument();
export default function GamePage() {
  const { id } = useParams();
  return <section><div className="section-heading"><div><h1>{id === 'demo' ? 'Recorrido de práctica' : 'A jugar'}</h1></div><Link to={id === 'demo' ? '/' : `/levels/${id}`}>← Salir del juego</Link></div>{id === 'demo' ? <GameView document={demo} practice/> : <PublicGame id={id!}/>}</section>;
}
