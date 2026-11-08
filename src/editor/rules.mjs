export const emptyDocument = () => ({ schemaVersion: 1, physicsVersion: 1, length: 300, speedMultiplier: 1, spawn: { x: 2, y: 0 }, finishX: 298, objects: [] });
export const snap = value => Math.round(value * 2) / 2;
function overlap(a, b) {
  if (!(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height)) return false;
  if (a.type !== 'triangle' && b.type !== 'triangle') return true;
  const t = a.type === 'triangle' ? a : b; const r = a.type === 'triangle' ? b : a;
  const bottom = Math.max(t.y, r.y); const top = Math.min(t.y + t.height, r.y + r.height);
  if (bottom >= top) return false;
  const inset = (bottom - t.y) / t.height * t.width / 2;
  return Math.max(t.x + inset, r.x) < Math.min(t.x + t.width - inset, r.x + r.width);
}
export function validateLevel(draft, publish = false) {
  const errors = []; const d = draft?.content; const grid = n => Number.isFinite(n) && n * 2 === Math.trunc(n * 2);
  if (!draft?.title || draft.title.trim().length < 3 || draft.title.trim().length > 80) errors.push('Título: entre 3 y 80 caracteres.');
  if (typeof draft?.description !== 'string' || draft.description.length > 2000) errors.push('Descripción: máximo 2000 caracteres.');
  if (!['Easy', 'Normal', 'Hard'].includes(draft?.difficulty)) errors.push('Dificultad inválida.');
  if (!d || !Array.isArray(d.objects)) return [...errors, 'Documento de nivel inválido.'];
  if (d.schemaVersion !== 1 || d.physicsVersion !== 1) errors.push('Solo se admite esquema y física 1.');
  if (!Number.isInteger(d.length) || d.length < 100 || d.length > 5000) errors.push('Longitud: de 100 a 5000.');
  if (![0.75, 1, 1.25, 1.5].includes(d.speedMultiplier)) errors.push('Velocidad no admitida.');
  if (!d.spawn || !grid(d.spawn.x) || d.spawn.x < 0 || d.spawn.x > 10 || d.spawn.y !== 0) errors.push('Inicio: x entre 0 y 10; y=0.');
  if (!grid(d.finishX) || d.finishX > d.length || d.finishX < (d.spawn?.x ?? 0) + 10) errors.push('Meta inválida.');
  if (d.objects.length > 2000 || (publish && !d.objects.length)) errors.push('Publicar requiere entre 1 y 2000 objetos.');
  if (new TextEncoder().encode(JSON.stringify(d)).length > 512 * 1024) errors.push('El nivel supera 512 KiB.');
  const ids = new Set();
  for (let i = 0; i < Math.min(2000, d.objects.length); i++) {
    const o = d.objects[i]; const label = `Objeto ${i + 1}`;
    if (!o || typeof o.id !== 'string') { errors.push(`${label}: objeto inválido.`); continue; }
    if (!o.id.trim() || o.id.length > 64 || ids.has(o.id)) errors.push(`${label}: identificador inválido o duplicado.`); ids.add(o.id);
    if (!['cube', 'triangle', 'platform'].includes(o.type)) errors.push(`${label}: tipo desconocido.`);
    if (![o.x, o.y, o.width, o.height].every(grid) || o.x < 0 || o.y < 0 || o.x + o.width > d.length || o.y + o.height > 30) errors.push(`${label}: fuera del recorrido o de la cuadrícula.`);
    if (o.rotation !== 0 || (o.type === 'platform' ? o.width < 1 || o.width > 10 || o.height !== 0.5 : o.width !== 1 || o.height !== 1)) errors.push(`${label}: tamaño o rotación inválidos.`);
    if (o.x < (d.spawn?.x ?? 0) + 4 || o.x + o.width > d.finishX - 2) errors.push(`${label}: deja libre el inicio y la meta.`);
    for (let j = 0; j < i; j++) { const b = d.objects[j]; if (b && !(o.type === 'triangle' && b.type === 'triangle') && overlap(o, b)) { errors.push(`${label}: interseca otro objeto.`); break; } }
  }
  return errors;
}
