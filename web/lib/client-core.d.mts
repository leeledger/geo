type Q = (sql: string, params?: unknown[]) => Promise<any[]>;
type FetchLike = (url: string, init?: any) => Promise<{ status: number; headers: { get(k: string): string | null }; body: ReadableStream<Uint8Array> | null }>;

export const CODE_SLUGS: string[];
export const AI_BOTS: string[];
export function answerPattern(raw: string, exclude?: string): string | null;
export function nextAlias(used: (string | null)[]): string;
export function 도메인정리(d: unknown): string;

export type 입력칸 = {
  name: string; slug: string; domain: string | null;
  answerTerms: string[]; answerExclude: string[]; compete: string[]; brand: string[];
  address: string | null; phone4: string | null; relation: string; test: boolean; wantGsc: boolean;
  /** 두 칸 등록(Step 55) — config.auto · config.onboard.channels · 같은 이름 「그래도 등록」 */
  auto?: Record<string, unknown>; channels?: Record<string, string | null>; 이름겹침허용?: boolean;
};
export function 호스트(raw: unknown): { host: string | null; 까닭: string | null };
export const 고객금지말: string[];
export function 금지말찾기(글: unknown): string[];
export function 채널정리(url: unknown): string | null;
export function 입력검사(f: Record<string, unknown>): { ok: boolean; 칸: 입력칸; 오류: string[] };
export const 오류말: Record<string, string>;

export type 결과 = { ok: true; id: number; slug: string; 도메인바뀜?: boolean } | { ok: false; err: string; 남음?: number; 겹침?: string };
export function 고객칸준비(q: Q): Promise<void>;
export function 새키(): string;
export function 새크롤키(): string;
export function 등록(q: Q, 칸: 입력칸): Promise<결과>;
export function 고치기(q: Q, slug: string, 칸: 입력칸): Promise<결과>;
export function 폼값(row: Record<string, any>): {
  name: string; slug: string; domain: string; answer_terms: string; answer_exclude: string; compete: string; brand: string;
  address_part: string; phone_last4: string; relation: string; want_gsc: boolean;
};

export type 바깥글칸 = {
  enabled: boolean; disclosure: string; facts: string[]; pages: { all: string[][]; guide: string; tool: string; also?: string[] }[];
  guidePrefix: string; alternatives: string[]; banned: string[]; persona: string;
};
export function 페이지줄읽기(line: string): { all: string[][]; guide: string; tool: string; also?: string[]; 오류?: undefined } | { 오류: string };
export function 페이지줄글(p: { all: string[][]; guide: string; tool: string; also?: string[] }): string;
export function 바깥글입력검사(f: Record<string, unknown>): { ok: boolean; 칸: 바깥글칸; 오류: string[] };
export function 바깥글config(옛config: unknown, 칸: 바깥글칸, 오늘: string): Record<string, any>;
export function 바깥글고치기(q: Q, slug: string, 칸: 바깥글칸, 오늘?: string): Promise<결과>;
export function 바깥글폼값(row: Record<string, any>): Record<string, string>;

type 칸결과 = { status: number | null; type?: string; error?: string; head?: string };
export type Derived = {
  checkedAt: string;
  platform?: Record<string, any>;
  home: 칸결과;
  homeLdTypes?: string[];
  robots: 칸결과 & { blocked?: string[] };
  sitemap: 칸결과 & { url: string; kind?: "index" | "urlset" | null; pages?: number; children?: number; counted?: number; ok?: boolean };
  llmsTxt: 칸결과 & { ok?: boolean };
  indexnowFile?: 칸결과 & { ok?: boolean };
  gscAccess?: 탐침;
  errors: string[];
};
export type 탐침 = { state: "있음" | "없음" | "모름"; at: string; url: string; sample: string };
export function 권한판정(url: string, text: string): "있음" | "없음" | "모름";
export function 탐침읽기(out: string): Omit<탐침, "at"> | null;
export function 탐침저장(q: Q, clientId: number, 결과: Omit<탐침, "at">, at: string): Promise<boolean>;
export function robots막힘(text: string): string[];
export function ld타입(html: string): { types: string[]; 깨짐: number };
type LookupLike = (host: string) => Promise<{ address: string; family?: number }[]>;
export const 본문상한: number;
export function 내부주소(ip: string): boolean;
export function 세팅점검(domain: string, key: string | null, opts?: { fetch?: FetchLike; lookup?: LookupLike; 한도?: number; 전체?: number; 상한?: number; now?: () => Date }): Promise<Derived>;
export function 홈열기(domain: string, opts?: { fetch?: FetchLike; lookup?: LookupLike; 한도?: number; 전체?: number; 상한?: number }): Promise<{ status: number | null; url: string; type?: string; body?: string; headers?: Record<string, string>; error?: string }>;
export function 점검저장(q: Q, row: Record<string, any>, opts?: { fetch?: FetchLike; lookup?: LookupLike }): Promise<Derived>;

export type 상태 = "됨" | "기다림" | "사람" | "해당없음";
export type 줄 = { id: string; 칸: string; 상태: 상태; 사람말: string; 할일?: string; 보낼글?: string; 고칠것?: string };
export type 자동단계이름 = "사이트" | "업종지역" | "검색어" | "파일럿" | "질문";
export const 자동단계: 자동단계이름[];
export const 자동단계말: Record<자동단계이름, string>;
export function 갈래(row: Record<string, any> | null | undefined): "사이트" | "빌더" | "플랫폼" | "없음";
export const 보낼글말: { 사이트: (name: string) => string; 빌더: (name: string, 빌더: string) => string };
export type 파일럿 = { id: string; status: string; approved: boolean } | null;
export function 체크리스트(row: Record<string, any>, derived: unknown, opts?: { pilot?: 파일럿 }): 줄[];
export function 요약(줄: 줄[]): { 사람: number; 기다림: number };
export function 파일럿상태(q: Q, clientId: number): Promise<파일럿>;
export function 일감계획(row: Record<string, any>, 줄: 줄[], admin?: string): {
  열기: { key: string; title: string; detail: string; link: string; payload: Record<string, unknown> }[];
  닫기: { key: string; status: string; why: string }[];
};
export function 사람일감맞추기(q: Q, row: Record<string, any>, 줄: 줄[], opts?: { admin?: string }): Promise<{ 열림: string[]; 닫힘: string[] }>;
export const 원장금지말: string[];
export function 원장금지말찾기(글: unknown): string[];
export const 계약말: { 제목: (n: string) => string; 할일: string };
export const 일감제목: Record<"send" | "gsc" | "measure" | "auto" | "name" | "keyfile", (n: string) => string>;
export function 이름말들(name: unknown): string[];
export function 이름판별고침(row: Record<string, any>, opts?: { 강제?: boolean }): { 바꿀: boolean; terms: string[]; 까닭: string };
export function 판별말저장(q: Q, row: Record<string, any>, terms: string[], at?: Date): Promise<number>;
export function 판별말고치고맞추기(q: Q, opts?: { admin?: string; log?: (s: string) => void; now?: Date }): Promise<number>;
export function 재점검고르기<T extends { id: number; slug: string; status: string; derived?: any }>(rows: T[], now?: number, max?: number): T[];
export function 점검하고맞추기(q: Q, row: Record<string, any>, opts?: { fetch?: FetchLike; admin?: string }): Promise<{ derived: Derived; 줄: 줄[]; 일감: { 열림: string[]; 닫힘: string[] } }>;
export function 세팅재점검(q: Q, opts?: { now?: number; max?: number; admin?: string; log?: (s: string) => void }): Promise<string[]>;
export function 지우기(q: Q, slug: string): Promise<결과 | { ok: true; id: number; 지운: Record<string, number> }>;
export function 파이프(config: unknown, derived: unknown): { posts: boolean; indexnow: boolean; marketing: boolean };
