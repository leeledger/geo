import type { 줄 as 세팅줄 } from "./client-core.mjs";

export type 누가 = "자동" | "Claude 세션" | "원장님" | "고객";
export type 줄상태 = "됨" | "도는 중" | "원장님 몫" | "고객 기다림" | "아직" | "해당없음" | "못 읽음";
export const 누가: { 자동: "자동"; 세션: "Claude 세션"; 원장: "원장님"; 고객: "고객" };
export const 상태: { 됨: "됨"; 도는: "도는 중"; 원장: "원장님 몫"; 고객: "고객 기다림"; 아직: "아직"; 없음: "해당없음"; 못: "못 읽음" };

export type 순서줄 = { id: string; 칸: string; 누가: 누가; 상태: 줄상태; 사람말: string; 근거?: string; 링크?: string | null; 보낼글?: string; 일수?: number };
export type 순서단계 = { id: "contract" | "receive" | "site" | "kickoff" | "baseline" | "run30" | "day30"; 이름: string; 줄: 순서줄[] };
export type 착수결과 = {
  띠: string[];
  요약: { 원장: number; 고객: number; 고객최장일: number | null; 자동: number };
  다음고비: string | null;
  단계: 순서단계[];
};
export type 로그인일감 = { dedupe_key: string; title: string; status: string };
export type 착수입력 = {
  row: Record<string, any>;
  derived: unknown;
  세팅줄: 세팅줄[];
  pilot: Record<string, any> | null;
  tasks: Record<string, any>[];
  questions: Record<string, any>[];
  content: Record<string, any>[];
  ai: Record<string, any>[];
  checks: Record<string, any>[];
  audits: Record<string, any>[];
  로그인일감: 로그인일감[] | "못읽음";
  크롤: { n7: number; last: string | null } | null | "못읽음";
  /** 기록표 주소 앞부분 — 기본 https://cited.kr */
  site?: string;
};
export function 날(x: unknown): string | null;
export function 시각날(x: unknown): string | null;
export function 환불문장(p: { kickoff_on?: unknown; baseline_sent_at?: unknown }): string;
export function 착수순서(입력: 착수입력, 오늘?: string | number | Date): 착수결과;

export type Onboard칸 = {
  dns: "고객" | "우리" | "모름" | null;
  naverSa: "아직" | "확인파일보냄" | "끝" | "안씀" | null;
  bing: "아직" | "끝" | "안씀" | null;
  blog: "없음" | "안맡김" | "받음" | null;
  migrateState: "아직" | "진행" | "끝" | null;
  migrate: boolean;
  noChannels: boolean;
  channels: { blog: string | null; place: string | null; sns: string | null };
  blogSavedOn: string | null;
  draftShownOn: string | null;
  setupReportOn: string | null;
};
export function onboard입력검사(f: Record<string, unknown>): { ok: boolean; 칸: Onboard칸; 오류: string[] };
