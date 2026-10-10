type Q = (sql: string, params?: unknown[]) => Promise<any[]>;
export type 목록줄 = { url: string; title: string; snippet: string; day: string | null; answers: number | null };
export type 질문 = { title: string; body: string; askedText: string | null; answers: number; adopted: boolean };

export function 질문주소(raw: string | null | undefined): string | null;
export function 목록주소(query: string): string;
export function 목록읽기(html: string): { 없음: boolean; 줄: 목록줄[] };
export function 질문읽기(html: string): 질문 | null;
export function kst날(d?: Date): string;
export function 날짜풀기(text: string | null | undefined, now?: Date): string | null;
export function 막힘(text: string, url?: string): boolean;
export function 후보거름(x: (질문 & { asked: string | null }) | null, 오늘: string, 맞는페이지: (t: string) => unknown): string | null;
export function 답차례(
  오늘글: { kin_question_id: number | string | null }[],
  후보들: { id: number | string; asked_at: string; status: string }[],
  오늘: string,
): { id: number; why?: undefined } | { why: string; id?: undefined };
export function 붙일글(md: string | null | undefined): string;
export function kin요청검사(payload: unknown): { post: number } | null;
export function kin창요청(q: Q, postId: number, now?: Date): Promise<{ ok: true; 이미: boolean; id: number | null } | { ok: false; err: string }>;
export function 오래된kin요청닫기(q: Q): Promise<{ id: number; client_id: number; payload: any; last_error: string }[]>;
export function 창상태말(status: string, lastError: string | null | undefined, evidence: string | null | undefined): string;
export const 채움말: { 됨: string; 클립보드만: string };
export function 창결과(out: string): { ok: boolean; 말: string };
