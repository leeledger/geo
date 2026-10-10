export type Backlog = { n: number; oldest: string; q?: number };
export type StatusRaw = {
  name: string;
  measure: number;
  posts: number;
  outside: { blog: number; jisikin: number; cafe: number };
  guides: number;
  gsc: number;
  bing: number;
  naver: number;
  /** 손댄 마지막 날 — 실제 작업만(글 발행·바깥 글·가이드 반영). 색인 요청·측정 같은 자동 일은 안 넣는다 */
  touched: { post?: string | null; outside?: string | null; guide?: string | null };
  backlog: { owner?: Backlog; session?: Backlog; local?: Backlog; repair?: Backlog; failed?: Backlog };
  repairOff: boolean;
};
export type StatusText = { 제목: string; 뱃지: "돌고 있음" | "느림" | "멈춤" | "아직 시작 전"; 한일: string; 손댄날: string; 밀린일: string[] };
export function 월일(d: string): string;
export function 오늘KST(now?: number): string;
export function 며칠전(ts: string | null | undefined, 오늘: string): number | null;
export function 이번주(오늘: string): { from: string; to: string };
export function 상태문장(raw: StatusRaw, 오늘: string): StatusText;
