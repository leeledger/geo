import type { 입력칸, 자동단계이름 } from "./client-core.mjs";

type Q = (sql: string, params?: unknown[]) => Promise<any[]>;
type FetchLike = (url: string, init?: any) => Promise<any>;

export type 갈래 = "사이트" | "빌더" | "플랫폼" | "없음";
export type 단계상태 = { 상태: "대기" | "도는중" | "됨" | "실패" | "원장"; at?: string; 시도?: number; 말?: string; 오류?: string };
export type 사실 = { 업종: { 값: string | null; 출처: string }; 지역: { 값: string | null; 출처: string } };
export type Auto = {
  v: 1; at: string; 갈래: 갈래; 입력: { name: string; homepage: string }; 흔함: boolean;
  출처: Record<string, string>; 단계: Record<자동단계이름, 단계상태>;
  사실?: 사실; 사이트상태?: "none" | "setup" | "build"; 플랫폼?: { id: string; name: string; kind: string; evidence: string } | null;
  자동완성?: { fetched_at: string; 씨앗: { q: string; 차: number; status: number | null; items: string[]; 오류?: string }[] };
  후보?: { text: string; 씨앗: string; 순위: number }[];
};
export type 걸음 = { 단계: 자동단계이름 | null; 상태: string; 말: string };
export type Deps = {
  fetch?: FetchLike; lookup?: (host: string) => Promise<{ address: string }[]>;
  checkPlatform?: (id: string, url: string) => Promise<any>;
  detectPlatform?: (html: string, headers: Record<string, string>, url: string) => { id: string; name: string; kind: string; evidence: string };
  admin?: string; now?: () => Date; 실패도?: boolean; 자동완성옵션?: Record<string, unknown>;
};

export const 자동단계: 자동단계이름[];
export const 자동단계말: Record<자동단계이름, string>;
export const 업종표: { 업종: string; 말: string[]; ld: string[] }[];
export const 임대초: number;
export const 최대시도: number;
export const 자동완성UA: string;
export function 자동완성주소(q: string): string;
export function 지역짧게(x: string): string;
export function 입력나누기(name: string, homepage: unknown): { 갈래?: 갈래; domain?: string | null; 채널?: { 칸: string; id: string; url: string }; 원문?: string; 오류?: string };
export function 로마자(이름: string): string;
export function slug고르기(x: { 갈래: 갈래; domain: string | null; 채널?: { id: string; url: string }; name: string }, 쓰인?: string[]): string;
export function 판별말(name: string, domain: string | null): { terms: string[]; 흔함: boolean; 까닭: string };
export function 사실뽑기(html: string, name: string): 사실;
export function 씨앗(업종: string, 지역: string): string[];
export function 응답말(json: unknown): string[];
export function 자동완성(씨앗들: string[], opts?: { fetch?: FetchLike; 다음씨앗?: ((결과: any[]) => string[]) | null; 한도?: number; 전체?: number; 간격?: number; 최대?: number; now?: () => Date }): Promise<NonNullable<Auto["자동완성"]>>;
export function 출처붙임(씨앗들: { q: string; items: string[] }[]): { text: string; 씨앗: string; 순위: number }[];
export function 거르기<T extends string | { text: string }>(items: T[], opts?: { 판별말?: string[]; 업종?: string; 이름?: string }): T[];
export function 패널만들기(keyword17: (string | { text: string; 씨앗: string; 순위: number })[], name: string, domain: string | null): [string, string, string][];
export function 새auto(x: { 갈래: 갈래; 입력: { name: string; homepage: string }; 판별: { terms: string[]; 흔함: boolean; 까닭: string }; at: string }): Auto;
export function 두칸칸(f: Record<string, unknown>, 쓰인?: string[], now?: Date): { ok: boolean; 칸: 입력칸 | null; 오류: string[] };
export function 다음단계(auto: Auto | null | undefined, now?: Date, opts?: { 실패도?: boolean }): 자동단계이름 | null;
export function 자동요약(auto: Auto | null | undefined): { 된: number; 전부: number; 끝: boolean; 원장: 자동단계이름[] };
export function 임대(q: Q, id: number, k: 자동단계이름, at: string): Promise<boolean>;
export function 사이트상태(d: Record<string, any>): "none" | "setup" | null;
export function 자동한걸음(q: Q, slug: string, deps?: Deps): Promise<걸음>;
export function 재시도(q: Q, slug: string, k: string): Promise<boolean>;
export function 사실입력검사(f: Record<string, unknown>): { ok: boolean; 업종: string; 지역: string; 오류: string[] };
export function 사실저장(q: Q, slug: string, x: { 업종: string; 지역: string }, now?: Date): Promise<boolean>;
export function 자동이어하기(q: Q, opts?: { max?: number; admin?: string; deps?: Deps; log?: (s: string) => void; now?: () => Date }): Promise<string[]>;
