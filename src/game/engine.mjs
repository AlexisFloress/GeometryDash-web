// PhysicsVersion 1: logical units; x/y are the player's lower-left corner.
export const DT = 1 / 120;
export const PHYSICS = Object.freeze({ version: 1, speed: 6, gravity: 30, jump: 10.5, playerSize: 0.8 });
export const demoDocument = () => ({ schemaVersion: 1, physicsVersion: 1, length: 100, speedMultiplier: 1, spawn: { x: 2, y: 0 }, finishX: 98,
  objects: [12, 23, 34, 48, 62, 75, 86].map((x, i) => ({ id: `demo_${i}`, type: 'triangle', x, y: 0, width: 1, height: 1, rotation: 0 })) });
export function createWorld(doc) {
  if (doc.schemaVersion !== 1 || doc.physicsVersion !== 1) throw new Error('Versión de esquema o física no compatible.');
  return { x: doc.spawn.x, y: doc.spawn.y, vy: 0, grounded: doc.spawn.y === 0, ticks: 0, outcome: null, progress: 0 };
}
function boxIntersects(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
// SAT includes contact for a lethal triangle; separate axes cover exact geometry.
function triangleCollision(player, o) {
  const vertices = [[o.x, o.y], [o.x + o.width, o.y], [o.x + o.width / 2, o.y + o.height]];
  const corners = [[player.x, player.y], [player.x + player.width, player.y], [player.x + player.width, player.y + player.height], [player.x, player.y + player.height]];
  const axes = [[1, 0], [0, 1], [-o.height, o.width / 2], [o.height, o.width / 2]];
  return axes.every(([nx, ny]) => {
    const ta = vertices.map(([x, y]) => x * nx + y * ny); const pa = corners.map(([x, y]) => x * nx + y * ny);
    return Math.max(...ta) >= Math.min(...pa) && Math.max(...pa) >= Math.min(...ta);
  });
}
export function stepWorld(world, doc, jumpPressed = false) {
  if (world.outcome) return world;
  const next = { ...world, ticks: world.ticks + 1 };
  if (jumpPressed && world.grounded) { next.vy = PHYSICS.jump; next.grounded = false; }
  const oldY = next.y;
  next.x += PHYSICS.speed * doc.speedMultiplier * DT;
  next.vy -= PHYSICS.gravity * DT; next.y += next.vy * DT; next.grounded = false;
  if (next.y <= 0) { next.y = 0; next.vy = 0; next.grounded = true; }
  let lethal = false;
  const size = PHYSICS.playerSize;
  for (const object of doc.objects) {
    if (object.x > next.x + size + 1 || object.x + object.width < next.x - 1) continue;
    const box = { x: next.x, y: next.y, width: size, height: size };
    if (object.type === 'triangle') { if (triangleCollision(box, object)) lethal = true; continue; }
    const top = object.y + object.height;
    const horizontal = next.x < object.x + object.width && next.x + size > object.x;
    if (horizontal && next.vy <= 0 && oldY >= top - 0.000001 && next.y <= top) { next.y = top; next.vy = 0; next.grounded = true; }
    else if (boxIntersects(box, object)) lethal = true;
  }
  if (lethal) next.outcome = 'Dead';
  else if (next.x >= doc.finishX) next.outcome = 'Completed';
  next.progress = next.outcome === 'Completed' ? 100 : Math.min(99.99, Math.max(0, (next.x - doc.spawn.x) / (doc.finishX - doc.spawn.x) * 100));
  return next;
}
export function advanceFrame(world, doc, elapsed, accumulator, jumpPressed = false) {
  if (elapsed > 0.25) return { world, accumulator: 0, unstable: true, consumedJump: false };
  accumulator += elapsed; let consumedJump = false;
  while (accumulator + 1e-10 >= DT && !world.outcome) { world = stepWorld(world, doc, jumpPressed && !consumedJump); consumedJump = true; accumulator = Math.max(0, accumulator - DT); }
  return { world, accumulator, unstable: false, consumedJump };
}
export function drawWorld(ctx, canvas, doc, world) {
  const width = canvas.width; const height = canvas.height; const unit = Math.min(42, width / 22); const floor = height - 65;
  const camera = Math.max(0, world.x - 5); const x = value => (value - camera) * unit; const y = value => floor - value * unit;
  ctx.fillStyle = '#edf3e8'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#dce6d7'; ctx.lineWidth = 1;
  for (let i = Math.floor(camera); i < camera + width / unit; i++) { ctx.beginPath(); ctx.moveTo(x(i), 0); ctx.lineTo(x(i), floor); ctx.stroke(); }
  ctx.fillStyle = '#d0ddc9'; ctx.fillRect(0, floor, width, height - floor);
  ctx.strokeStyle = '#365e4c'; ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(width, floor); ctx.stroke();
  for (const o of doc.objects) {
    if (x(o.x + o.width) < 0 || x(o.x) > width) continue;
    ctx.fillStyle = o.type === 'triangle' ? '#be693b' : '#427b65'; ctx.strokeStyle = '#234b3c'; ctx.lineWidth = 2;
    if (o.type === 'triangle') { ctx.beginPath(); ctx.moveTo(x(o.x), y(o.y)); ctx.lineTo(x(o.x + o.width / 2), y(o.y + o.height)); ctx.lineTo(x(o.x + o.width), y(o.y)); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(x(o.x), y(o.y + o.height), o.width * unit, o.height * unit); ctx.strokeRect(x(o.x), y(o.y + o.height), o.width * unit, o.height * unit); }
  }
  ctx.strokeStyle = '#c69227'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x(doc.finishX), floor); ctx.lineTo(x(doc.finishX), floor - 130); ctx.stroke();
  ctx.fillStyle = '#c69227'; ctx.fillRect(x(doc.finishX), floor - 130, 36, 22);
  const size = PHYSICS.playerSize * unit;
  ctx.fillStyle = world.outcome === 'Dead' ? '#be693b' : '#dfab42'; ctx.strokeStyle = '#5e4929'; ctx.lineWidth = 2;
  ctx.fillRect(x(world.x), y(world.y + PHYSICS.playerSize), size, size); ctx.strokeRect(x(world.x), y(world.y + PHYSICS.playerSize), size, size);
  ctx.fillStyle = '#433f2c'; ctx.fillRect(x(world.x) + size * 0.25, y(world.y + PHYSICS.playerSize) + size * 0.3, 3, 4); ctx.fillRect(x(world.x) + size * 0.65, y(world.y + PHYSICS.playerSize) + size * 0.3, 3, 4);
}
