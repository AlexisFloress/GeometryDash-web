import type { Editable, LevelDocument } from '../types';
export function emptyDocument(): LevelDocument;
export function snap(value: number): number;
export function validateLevel(draft: Editable, publish?: boolean): string[];
