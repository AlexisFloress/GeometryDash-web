import type { Result } from '../types';
import { api, json } from '../lib/api';
import { readLocal, writeLocal } from '../lib/storage';
export interface Pending { attemptId: string; result: Result }
const key = (uid: string) => `gd:results:${uid}`;
export const readPending = (uid: string) => readLocal<Pending[]>(key(uid)) ?? [];
export function addPending(uid: string, item: Pending) { return writeLocal(key(uid), [...readPending(uid).filter(p => p.attemptId !== item.attemptId), item]); }
export async function sendPending(uid: string, item: Pending) {
  await api(`/attempts/${item.attemptId}/result`, json('PUT', item.result));
  writeLocal(key(uid), readPending(uid).filter(p => p.attemptId !== item.attemptId));
}
