export type Difficulty = 'Easy' | 'Normal' | 'Hard';
export interface LevelObject { id: string; type: 'cube' | 'triangle' | 'platform'; x: number; y: number; width: number; height: number; rotation: number }
export interface LevelDocument { schemaVersion: number; physicsVersion: number; length: number; speedMultiplier: number; spawn: { x: number; y: number }; finishX: number; objects: LevelObject[] }
export interface Editable { title: string; description: string; difficulty: Difficulty; content: LevelDocument }
export interface Draft extends Editable { levelId: string; levelVersion: number; revisionId: string; revisionNumber: number; version: number; contentHash: string; state: string }
export interface LevelCard { id: string; revisionId: string; revisionNumber: number; title: string; description: string; difficulty: Difficulty; authorId: string; author: string; speedMultiplier: number; averageRating: number | null; ratingCount: number; completionCount: number; updatedAt: string }
export interface User { id: string; userName: string; displayName: string; email: string; status: string; createdAt: string }
export interface Session { accessToken: string; expiresAt: string; user: User }
export interface Page<T> { items: T[]; page: number; pageSize: number; totalCount: number }
export interface OwnLevel { id: string; title: string; status: string; version: number; draftRevisionId: string | null; publishedRevisionId: string | null; difficulty: Difficulty; updatedAt: string }
export interface CompletedLevel { levelId: string; available: boolean; currentRevisionCompleted: boolean; verificationStatus: string; revisions: { id: string; revisionNumber: number; title: string; bestProgress: number; completionCount: number; firstCompletedAt: string }[] }
export interface ContentResponse { levelId: string; revisionId: string; contentHash: string; physicsVersion: number; content: LevelDocument }
export interface Attempt { id: string; revisionId: string; startedAt: string; state: string; outcome?: string; progressPercent: number; verificationStatus: string }
export interface Result { clientResultId: string; outcome: 'Completed' | 'Dead' | 'Quit'; elapsedTicks: number; pauseTicks: number; progressPercent: number }
