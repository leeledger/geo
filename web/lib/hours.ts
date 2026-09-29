import { inqPool } from "./inquiries";

/**
 * 고객별 투입 시간 — 읽기와 표 (Step 23 D5).
 *
 * 원가를 모르면 가격도, 동시에 몇 곳을 받을지도 못 정한다(역량 검토 「첫 고객 전 9」).
 * 기계가 쓴 시간은 로그에 있지만 원장이 쓴 시간은 어디에도 없다. 그래서 하루 한 줄 「무엇을 · 몇 분」을 적는다.
 * 쓰기(서버 동작)는 hours-actions.ts — "use server" 모듈은 async 함수만 내보낼 수 있다.
 * 날짜는 KST. 기본값을 current_date 로 두면 UTC 기준 전날로 찍힌다.
 */

export const HOURS_DDL = `create table if not exists geo.client_hours (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  day date not null default ((now() at time zone 'Asia/Seoul')::date),
  minutes int not null check (minutes > 0 and minutes <= 1440),
  what text not null default '',
  created_at timestamptz not null default now())`;

export type HourRow = { id: string; day: string; minutes: number; what: string };
export type HourSum = { clientId: number; minutes: number; days: number; first: string | null; last: string | null };

/** 표가 아직 없으면(첫 입력 전) 빈 목록 — 화면이 오류로 뜨지 않게 */
const noTable = (e: unknown) => (e as { code?: string })?.code === "42P01";

export async function listHours(clientId: number, limit = 30): Promise<HourRow[]> {
  try {
    const { rows } = await inqPool().query(
      `select id::text, day::text, minutes, what from geo.client_hours
        where client_id = $1 order by day desc, id desc limit $2`, [clientId, limit]);
    return rows.map((r) => ({ id: r.id, day: r.day, minutes: r.minutes, what: r.what }));
  } catch (e) {
    if (noTable(e)) return [];
    throw e;
  }
}

export async function hourSums(): Promise<HourSum[]> {
  try {
    const { rows } = await inqPool().query(
      `select client_id, sum(minutes)::int as minutes, count(distinct day)::int as days,
              min(day)::text as first, max(day)::text as last
         from geo.client_hours group by client_id`);
    return rows.map((r) => ({ clientId: r.client_id, minutes: r.minutes, days: r.days, first: r.first, last: r.last }));
  } catch (e) {
    if (noTable(e)) return [];
    throw e;
  }
}

/** 95분 → 「1시간 35분」 */
export const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);
