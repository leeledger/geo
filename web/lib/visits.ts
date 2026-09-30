import { pool } from "./ops";
import { addDays } from "./growth";
import type { RefKind, Visit } from "./visit";

/**
 * 고객사 사이트 사람 방문 — 쓰기와 읽기 (Step 29).
 *
 * 고객사 proxy 가 문서 요청 하나마다 한 줄을 보낸다(lib/visit.ts readVisit). IP 는 오지 않는다.
 * visitor 는 그날만 같은 사람을 묶는다 — 날을 넘겨 같은 사람인지는 모른다. 그래서 「7일 방문자」는
 * 날마다 센 방문자의 합이다(같은 사람이 이틀 오면 2).
 * 날짜는 KST. 기록 시작 전 날짜는 0 이 아니라 없음이다 — 화면이 그 전을 그리지 않는다.
 *
 * 표·중복 규칙은 academy/app/api/visit/route.ts 와 같은 줄 — academy/scripts/test-visit.mjs 가 대조한다.
 */

export const VISITS_DDL = [
  `create table if not exists geo.site_visits (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  at timestamptz not null default now(),
  day date not null default ((now() at time zone 'Asia/Seoul')::date),
  path text not null,
  ref_host text not null default '',
  ref_kind text not null check (ref_kind in ('ai','search','sns','direct','internal','other')),
  visitor text not null,
  device text not null default '')`,
  `create index if not exists site_visits_client_day_idx on geo.site_visits (client_id, day)`,
  `alter table geo.site_visits enable row level security`,
];

/** 같은 사람이 같은 쪽을 1분 안에 또 열면(새로고침 연타·폭주) 한 번으로 친다 */
const INSERT_VISIT = `insert into geo.site_visits (client_id, path, ref_host, ref_kind, visitor, device)
  select $1::int, $2::text, $3::text, $4::text, $5::text, $6::text
   where not exists (select 1 from geo.site_visits
                      where client_id = $1::int and day = (now() at time zone 'Asia/Seoul')::date
                        and visitor = $5::text and path = $2::text and at > now() - interval '1 minute')`;

const g = globalThis as unknown as { __visitsReady?: boolean };

export async function saveVisit(clientId: number, v: Visit): Promise<void> {
  // 배포 직후 첫 방문부터 받아야 「그날부터 셈」이 맞다 — 표를 여기서도 만든다(인스턴스마다 한 번).
  // 표가 있으면 DDL 을 안 돌린다 — 콜드 스타트마다 create index·alter table 이 잠금을 잡지 않게.
  // 준비가 실패해도(표는 이미 있음) 쓰기는 해 본다 — 쓰기 실패만 부른 쪽으로 올라간다
  if (!g.__visitsReady) {
    try {
      const { rows: [r] } = await pool().query<{ ok: boolean }>(`select to_regclass('geo.site_visits') is not null as ok`);
      if (!r?.ok) for (const s of VISITS_DDL) await pool().query(s);
      g.__visitsReady = true;
    } catch {
      // 아래 insert 가 실패하면 그때 알린다
    }
  }
  await pool().query(INSERT_VISIT, [clientId, v.path, v.ref_host, v.ref_kind, v.visitor, v.device]);
}

export type VisitDay = { day: string; visitors: number; views: number };
/** 어제까지 7일 vs 그 전 7일. 기록이 다 안 찬 칸은 null — 0 으로 메우지 않는다 */
export type VisitWeek = { visitors: number | null; views: number | null; prevVisitors: number | null; prevViews: number | null; partialDays: number | null };
export type Visits = {
  today: string;
  /** 첫 기록 날짜. null = 아직 한 줄도 없다 */
  since: string | null;
  /** 최근 30일 중 기록 시작 뒤 날짜만, 빈 날은 0 */
  days: VisitDay[];
  week: VisitWeek;
  /** 최근 30일 들어온 곳(사이트 안 이동 뺌) */
  kinds: { kind: RefKind; n: number }[];
  /** 그 가운데 AI — 곳별 */
  ai: { host: string; n: number }[];
  pages: { path: string; n: number }[];
};

const KIND_ORDER: RefKind[] = ["ai", "search", "sns", "direct", "other"];
const noTable = (e: unknown) => (e as { code?: string })?.code === "42P01";

export async function readVisits(clientId: number): Promise<Visits> {
  const db = pool();
  const { rows: [t] } = await db.query<{ today: string }>(`select (now() at time zone 'Asia/Seoul')::date::text as today`);
  const today = t.today;
  const empty: Visits = {
    today, since: null, days: [],
    week: { visitors: null, views: null, prevVisitors: null, prevViews: null, partialDays: null },
    kinds: [], ai: [], pages: [],
  };
  try {
    const { rows: [s] } = await db.query<{ since: string | null }>(
      `select min(day)::text as since from geo.site_visits where client_id = $1`, [clientId]);
    if (!s.since) return empty;
    const since = s.since;
    const win = [clientId, today];
    const [daily, kinds, ai, pages] = await Promise.all([
      db.query<VisitDay>(
        `select day::text as day, count(distinct visitor)::int as visitors, count(*)::int as views
           from geo.site_visits where client_id = $1 and day >= $2::date - 29 group by day`, win),
      db.query<{ kind: RefKind; n: number }>(
        `select ref_kind as kind, count(*)::int as n from geo.site_visits
          where client_id = $1 and day >= $2::date - 29 and ref_kind <> 'internal' group by ref_kind`, win),
      db.query<{ host: string; n: number }>(
        `select ref_host as host, count(*)::int as n from geo.site_visits
          where client_id = $1 and day >= $2::date - 29 and ref_kind = 'ai' group by ref_host order by n desc, host`, win),
      db.query<{ path: string; n: number }>(
        `select path, count(*)::int as n from geo.site_visits
          where client_id = $1 and day >= $2::date - 29 group by path order by n desc, path limit 5`, win),
    ]);

    const by = new Map(daily.rows.map((r) => [r.day, r]));
    const start = since > addDays(today, -29) ? since : addDays(today, -29);
    const days: VisitDay[] = [];
    for (let d = start; d <= today; d = addDays(d, 1)) days.push(by.get(d) ?? { day: d, visitors: 0, views: 0 });

    // 오늘은 진행 중이라 비교에 안 넣는다 — 어제까지 7일 대 그 전 7일
    const y = addDays(today, -1);
    const sum = (from: string, to: string, k: "visitors" | "views") =>
      days.filter((d) => d.day >= from && d.day <= to).reduce((a, d) => a + d[k], 0);
    const nowFrom = addDays(y, -6), prevFrom = addDays(y, -13), prevTo = addDays(y, -7);
    const nowOk = since <= y;
    const prevOk = since <= prevFrom;
    const week: VisitWeek = {
      visitors: nowOk ? sum(nowFrom, y, "visitors") : null,
      views: nowOk ? sum(nowFrom, y, "views") : null,
      prevVisitors: prevOk ? sum(prevFrom, prevTo, "visitors") : null,
      prevViews: prevOk ? sum(prevFrom, prevTo, "views") : null,
      // 지난 7일 중 기록이 있던 날 수 — 7 보다 작으면 화면이 「n일치」라고 적는다
      partialDays: nowOk && since > nowFrom ? days.filter((d) => d.day >= since && d.day <= y).length : null,
    };

    const kindN = new Map(kinds.rows.map((r) => [r.kind, r.n]));
    return {
      today, since, days, week,
      kinds: KIND_ORDER.map((k) => ({ kind: k, n: kindN.get(k) ?? 0 })),
      ai: ai.rows, pages: pages.rows,
    };
  } catch (e) {
    if (noTable(e)) return empty;
    throw e;
  }
}
