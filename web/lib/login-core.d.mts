type Q = (sql: string, params?: unknown[]) => Promise<any[]>;
export type 창곳 = "google" | "naver" | "microsoft" | "blog" | "kin";

export const 창이름: Record<창곳, string>;
export function 로그인대상(dedupe: string, clientSlug: string | null | undefined): { sites: 창곳[]; profile: string } | null;
export function 창요청검사(payload: unknown): { profile: string; sites: 창곳[]; from: number | null } | null;
export function 확인된곳(out: string, sites: 창곳[]): { 됨: 창곳[]; 안됨: 창곳[] };
export function kst분(d?: Date): string;
export function 근거붙임(q: Q, id: number, line: string): Promise<any[]>;
export function 창요청(q: Q, taskId: number, now?: Date): Promise<{ ok: true; 이미: boolean; id: number | null } | { ok: false; err: string }>;
export function 오래된창요청닫기(q: Q, now?: Date): Promise<{ id: number; client_id: number; payload: any; last_error: string }[]>;
