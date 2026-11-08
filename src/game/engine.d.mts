import type { LevelDocument } from '../types';
export interface World { x: number; y: number; vy: number; grounded: boolean; ticks: number; outcome: 'Dead' | 'Completed' | null; progress: number }
export const DT: number;
export const PHYSICS: { version: number; speed: number; gravity: number; jump: number; playerSize: number };
export function demoDocument(): LevelDocument;
export function createWorld(doc: LevelDocument): World;
export function stepWorld(world: World, doc: LevelDocument, jumpPressed?: boolean): World;
export function advanceFrame(world: World, doc: LevelDocument, elapsed: number, accumulator: number, jumpPressed?: boolean): { world: World; accumulator: number; unstable: boolean; consumedJump: boolean };
export function drawWorld(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, doc: LevelDocument, world: World): void;
