import { pool, type Client } from "./ops";

/**
 * 「늘고 있나」— 현황판 맨 위 성장 지표.
 *
 * 원장(9/22): 「실제로 얼마나 성장하고 있는지 가늠이 힘들다」. 누적값만 있으면 비교 기준이 없다.
 * 그래서 지표마다 같은 조건의 이전 값을 붙인다. 최근 7일 대 그 전 7일(문의·리드는 30일 대 30일).
 *
 * 날짜 경계는 전부 KST 다. 하루 = (ts at time zone 'Asia/Seoul')::date. 날짜는 SQL 에서 ::text 로 받는다.
 * 조각마다 따로 잡는다 — 표 하나가 없어도 나머지는 뜬다. 못 읽은 조각은 null 이고 화면은 「확인 못함」.
 * 없는 값은 지어내지 않는다. 이전 값이 없으면 dir 은 none 이다.
 */

export type Dir = "up" | "down" | "flat" | "none";
export type Delta = { now: number | null; prev: number | null; dir: Dir; good: "up" | "down" | "neutral" };

export type AiCompare = { common: number; prevDay: string; mentioned: [number, number]; cited: [number, number] };
export type CovVendor = "google" | "naver" | "microsoft";

export type Growth = {
  today: string;
  days: string[];
  coverage: { total: number; series: { vendor: CovVendor; label: string; points: { day: string; pages: number }[] }[] } | null;
  ai: {
    engine: string; method: string;
    rounds: { day: string; prompts: number; mentioned: number; cited: number }[];
    compare: AiCompare | null;
  }[] | null;
  rival: {
    daily: { day: string; won: number | null; total: number; engines: number }[];
    latest: { day: string; won: number; total: number; byEngine: { engine: string; hit: number; best: number | null }[] } | null;
    prev: { day: string; won: number } | null;
    partialDays: string[];
  } | null;
  crawl: { search: Delta; ai: Delta; daily: { day: string; search: number; ai: number }[] } | null;
  posts: { last7: Delta; sinceDays: number | null; streakWeeks: number; weekly: { week: string; n: number; partialDays: number | null }[] } | null;
  /** ever = 이 고객사 문의 기록 전체 건수. 0 이면 「0건」이 아니라 「기록 없음」이다 */
  inquiries: { last30: Delta; bySource: { source: string; n: number }[]; unresolved: number; ever: number } | null;
  sales: { leads30: Delta; scans30: Delta } | null;
  agents: { fail7: Delta; total7: number; waitingHuman: number } | null;
  /**
   * 표로 보기의 주별 요약에만 쓴다(착수 주~이번 주, 월요일 시작 KST).
   * 추세선용 daily 는 14일이라 착수 주까지 못 덮는다 — 그래서 주 단위로 따로 센다.
   * 경쟁 검색어는 그 주에서 엔진 수가 그 주 최대인 마지막 날(= 그 주의 마지막 완전한 날).
   */
  weeks: {
    week: string; partialDays: number | null;
    search: number | null; ai: number | null; inquiries: number | null;
    rival: { day: string; won: number; total: number } | null;
  }[] | null;
};

/** 검색 색인 로봇. 나머지는 AI 로 센다 (Step 11: 합쳐 세서 1486 을 AI 방문이라 한 적이 있다) */
const SEARCH_VENDORS = ["google", "naver", "microsoft", "duckduckgo"];
/** AI 가 답할 때 찾는 검색 색인. 순서가 곧 계열색 순서다 — 바꾸지 않는다 */
const COV_VENDORS: { vendor: CovVendor; label: string }[] = [
  { vendor: "google", label: "구글" },
  { vendor: "naver", label: "네이버" },
  { vendor: "microsoft", label: "빙" },
];
const RIVAL_ORDER = ["naver_all", "naver", "bing"];

/**
 * YYYY-MM-DD 달력 계산. 입력이 이미 KST 날짜 문자열이라 UTC 자정으로 놓고 더하기만 한다 —
 * 시각을 날짜로 바꾸는 게 아니므로 toISOString 의 UTC 함정과 무관하다.
 */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}
function range(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function delta(now: number | null, prev: number | null, good: Delta["good"]): Delta {
  const dir: Dir = now === null || prev === null ? "none" : now > prev ? "up" : now < prev ? "down" : "flat";
  return { now, prev, dir, good };
}

function schemaOf(client: Client): string {
  if (!/^[a-z_]+$/.test(client.schema)) throw new Error(`스키마 이름이 이상합니다: ${client.schema}`);
  return client.schema;
}

async function part<T>(name: string, f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch (e) {
    console.error(`성장 지표 ${name} 읽기 실패`, e);
    return null;
  }
}

export async function readGrowth(client: Client): Promise<Growth> {
  const S = schemaOf(client);
  const p = pool();
  const q = async <R = Record<string, unknown>>(sql: string, args: unknown[]) => (await p.query(sql, args)).rows as R[];
  const id = client.id;

  const [{ today: T }] = await q<{ today: string }>(
    `select (now() at time zone 'Asia/Seoul')::date::text as today`, []);
  const days = range(addDays(T, -13), T);
  const startWeek = await q<{ w: string }>(
    `select date_trunc('week', $1::date::timestamp)::date::text as w`, [client.startedOn]);
  const W0 = startWeek[0].w;

  /* ★ 답변 색인 커버리지 — 지금 있는 쪽 목록 기준 누적 */
  const coverage = await part("커버리지", async () => {
    let pages = (await q<{ path: string }>(
      `select distinct path from ${S}.site_pages where client_id = $1`, [id])).map((r) => r.path);
    if (!pages.length) {
      // coverage_by_vendor 뷰와 같은 규칙: 발행 글 + / + /blog (발행 글이 있을 때만)
      pages = (await q<{ path: string }>(
        `select '/blog/' || slug as path from ${S}.posts where client_id = $1 and published
         union select '/' from ${S}.posts where client_id = $1 and published
         union select '/blog' from ${S}.posts where client_id = $1 and published`, [id])).map((r) => r.path);
    }
    const total = pages.length;
    const first = total
      ? await q<{ vendor: CovVendor; path: string; first: string }>(
          `select vendor, path, min((seen_at at time zone 'Asia/Seoul')::date)::text as first
             from ${S}.crawl_hits
            where client_id = $1 and vendor = any($2) and path = any($3)
            group by 1, 2`,
          [id, COV_VENDORS.map((v) => v.vendor), pages])
      : [];
    const start = first.reduce((m, r) => (r.first < m ? r.first : m), T);
    const axis = range(start, T);
    return {
      total,
      series: COV_VENDORS.map(({ vendor, label }) => {
        const firsts = first.filter((r) => r.vendor === vendor).map((r) => r.first).sort();
        let i = 0;
        return {
          vendor, label,
          points: axis.map((day) => {
            while (i < firsts.length && firsts[i] <= day) i++;
            return { day, pages: i };
          }),
        };
      }),
    };
  });

  /* AI 답변 — 엔진+방법 쌍 안에서만, 두 회차 공통 문항으로만 비교 */
  const ai = await part("AI 측정", async () => {
    const rows = await q<{ day: string; engine: string; method: string; prompt_id: string; m: boolean; c: boolean }>(
      `select measured_on::text as day, engine, collection_method as method, prompt_id,
              bool_or(mentioned) as m, bool_or(cited) as c
         from academy.ai_measurements where client_id = $1 group by 1, 2, 3, 4`, [id]);
    const pairs = new Map<string, { engine: string; method: string; byDay: Map<string, Map<string, { m: boolean; c: boolean }>> }>();
    for (const r of rows) {
      const k = `${r.engine}\u0000${r.method}`;
      if (!pairs.has(k)) pairs.set(k, { engine: r.engine, method: r.method, byDay: new Map() });
      const byDay = pairs.get(k)!.byDay;
      if (!byDay.has(r.day)) byDay.set(r.day, new Map());
      byDay.get(r.day)!.set(r.prompt_id, { m: !!r.m, c: !!r.c });
    }
    const out = [...pairs.values()].map(({ engine, method, byDay }) => {
      const ds = [...byDay.keys()].sort();
      const rounds = ds.map((day) => {
        const ps = [...byDay.get(day)!.values()];
        return { day, prompts: ps.length, mentioned: ps.filter((x) => x.m).length, cited: ps.filter((x) => x.c).length };
      });
      let compare: AiCompare | null = null;
      if (ds.length >= 2) {
        const last = byDay.get(ds[ds.length - 1])!;
        const prev = byDay.get(ds[ds.length - 2])!;
        const common = [...last.keys()].filter((k) => prev.has(k));
        if (common.length) {
          compare = {
            common: common.length,
            prevDay: ds[ds.length - 2],
            mentioned: [common.filter((k) => prev.get(k)!.m).length, common.filter((k) => last.get(k)!.m).length],
            cited: [common.filter((k) => prev.get(k)!.c).length, common.filter((k) => last.get(k)!.c).length],
          };
        }
      }
      return { engine, method, rounds, compare };
    });
    out.sort((a, b) => {
      const la = a.rounds[a.rounds.length - 1].day, lb = b.rounds[b.rounds.length - 1].day;
      return la === lb ? a.engine.localeCompare(b.engine) : la < lb ? 1 : -1;
    });
    return out;
  });

  /* 경쟁 검색어 — kind='경쟁' 만. 엔진이 덜 돈 날은 불완전 → 빈칸 */
  const rivalAll = await part("경쟁 검색어(전체)", () => q<{ day: string; engines: number; total: number; won: number }>(
    `select day::text as day, count(distinct engine)::int as engines, count(distinct query)::int as total,
            count(distinct query) filter (where hit)::int as won
       from ${S}.serp_checks
      where client_id = $1 and kind = '경쟁' and day >= least($2::date - 13, $3::date)
      group by day order by day`, [id, T, W0]));

  const rival = await part("경쟁 검색어", async () => {
    if (!rivalAll) throw new Error("경쟁 검색어 표를 못 읽음");
    const recent = rivalAll.filter((r) => r.day > addDays(T, -14));
    const maxEng = recent.reduce((m, r) => Math.max(m, r.engines), 0);
    const byDay = new Map(recent.map((r) => [r.day, r]));
    const partialDays = recent.filter((r) => r.engines < maxEng).map((r) => r.day);
    const daily = days.map((day) => {
      const r = byDay.get(day);
      if (!r) return { day, won: null, total: 0, engines: 0 };
      return { day, won: r.engines < maxEng ? null : r.won, total: r.total, engines: r.engines };
    });
    const complete = recent.filter((r) => r.engines === maxEng);
    const l = complete[complete.length - 1];
    let latest: NonNullable<Growth["rival"]>["latest"] = null;
    let prev: NonNullable<Growth["rival"]>["prev"] = null;
    if (l) {
      const eng = await q<{ engine: string; hit: number; best: number | null }>(
        `select engine, count(distinct query) filter (where hit)::int as hit, min(rank) filter (where hit) as best
           from ${S}.serp_checks where client_id = $1 and kind = '경쟁' and day = $2 group by engine`, [id, l.day]);
      const rank = (e: string) => (RIVAL_ORDER.includes(e) ? RIVAL_ORDER.indexOf(e) : 99);
      eng.sort((a, b) => rank(a.engine) - rank(b.engine) || a.engine.localeCompare(b.engine));
      latest = { day: l.day, won: l.won, total: l.total, byEngine: eng.map((e) => ({ engine: e.engine, hit: e.hit, best: e.best ?? null })) };
      const cut = addDays(l.day, -7);
      const pv = complete.filter((r) => r.day <= cut);
      const pr = pv[pv.length - 1];
      if (pr) prev = { day: pr.day, won: pr.won };
    }
    return { daily, latest, prev, partialDays };
  });

  /* 크롤러 방문 — 검색 색인과 AI 를 갈라 센다. 중립 지표 */
  const crawl = await part("크롤러", async () => {
    const rows = await q<{ day: string; search: number; ai: number }>(
      `select (seen_at at time zone 'Asia/Seoul')::date::text as day,
              count(*) filter (where vendor = any($2))::int as search,
              count(*) filter (where coalesce(vendor, '') <> all($2))::int as ai
         from ${S}.crawl_hits
        where client_id = $1 and (seen_at at time zone 'Asia/Seoul')::date > $3::date - 14
        group by 1`, [id, SEARCH_VENDORS, T]);
    const by = new Map(rows.map((r) => [r.day, r]));
    const daily = days.map((day) => ({ day, search: by.get(day)?.search ?? 0, ai: by.get(day)?.ai ?? 0 }));
    const sum = (k: "search" | "ai", a: number, b: number) => daily.slice(a, b).reduce((s, r) => s + r[k], 0);
    return {
      search: delta(sum("search", 7, 14), sum("search", 0, 7), "neutral"),
      ai: delta(sum("ai", 7, 14), sum("ai", 0, 7), "neutral"),
      daily,
    };
  });

  /* 발행 — 착수 뒤 글만. 옛 글(옮겨 온 것)은 뺀다 */
  const posts = await part("발행", async () => {
    const [c] = await q<{ last7: number; prev7: number; since: number | null }>(
      `select count(*) filter (where (published_at at time zone 'Asia/Seoul')::date between $3::date - 6 and $3::date)::int as last7,
              count(*) filter (where (published_at at time zone 'Asia/Seoul')::date between $3::date - 13 and $3::date - 7)::int as prev7,
              $3::date - max((published_at at time zone 'Asia/Seoul')::date) as since
         from ${S}.posts
        where client_id = $1 and published and published_at >= ($2::date::timestamp at time zone 'Asia/Seoul')`,
      [id, client.startedOn, T]);
    const wk = await q<{ week: string; n: number }>(
      `select w::date::text as week, count(p.slug)::int as n
         from generate_series(date_trunc('week', $2::date::timestamp), date_trunc('week', $3::date::timestamp), interval '1 week') w
         left join ${S}.posts p
           on p.client_id = $1 and p.published
          and p.published_at >= ($2::date::timestamp at time zone 'Asia/Seoul')
          and date_trunc('week', p.published_at at time zone 'Asia/Seoul') = w
        group by w order by w`, [id, client.startedOn, T]);
    const weekly = wk.map((r) => {
      const from = r.week < client.startedOn ? client.startedOn : r.week;
      const to = addDays(r.week, 6) > T ? T : addDays(r.week, 6);
      const counted = dayDiff(to, from) + 1;
      return { week: r.week, n: r.n, partialDays: counted < 7 ? counted : null };
    });
    let i = weekly.length - 1;
    if (i >= 0 && weekly[i].n === 0) i--;          // 진행 중인 주가 아직 0편이면 지난주부터 센다
    let streakWeeks = 0;
    for (; i >= 0 && weekly[i].n > 0; i--) streakWeeks++;
    return {
      last7: delta(c.last7, c.prev7, "up"),
      sinceDays: c.since === null ? null : Number(c.since),
      streakWeeks,
      weekly,
    };
  });

  /* 학원 문의 — 30일 대 30일. 사람이 넣는 숫자라 작다 */
  const inquiries = await part("문의", async () => {
    const [c] = await q<{ last30: number; prev30: number; unresolved: number; ever: number }>(
      `select count(*)::int as ever,
              count(*) filter (where day > $2::date - 30 and day <= $2::date)::int as last30,
              count(*) filter (where day > $2::date - 60 and day <= $2::date - 30)::int as prev30,
              count(*) filter (where enrolled is null)::int as unresolved
         from ${S}.inquiries where client_id = $1`, [id, T]);
    const src = await q<{ source: string; n: number }>(
      `select coalesce(nullif(source, ''), '출처 미입력') as source, count(*)::int as n
         from ${S}.inquiries where client_id = $1 and day > $2::date - 30 and day <= $2::date
        group by 1 order by 2 desc, 1`, [id, T]);
    return { last30: delta(c.last30, c.prev30, "up"), bySource: src, unresolved: c.unresolved, ever: c.ever };
  });

  /* 사이티드 전체 — 고객사와 무관 */
  const sales = await part("사이티드 리드", async () => {
    const [c] = await q<{ l30: number; lp: number; s30: number; sp: number }>(
      `select
         (select count(*)::int from geo.leads where (created_at at time zone 'Asia/Seoul')::date > $1::date - 30) as l30,
         (select count(*)::int from geo.leads where (created_at at time zone 'Asia/Seoul')::date > $1::date - 60
                                                 and (created_at at time zone 'Asia/Seoul')::date <= $1::date - 30) as lp,
         (select count(*)::int from geo.scans where user_agent is distinct from 'cited-rescan'
                                                 and (created_at at time zone 'Asia/Seoul')::date > $1::date - 30) as s30,
         (select count(*)::int from geo.scans where user_agent is distinct from 'cited-rescan'
                                                 and (created_at at time zone 'Asia/Seoul')::date > $1::date - 60
                                                 and (created_at at time zone 'Asia/Seoul')::date <= $1::date - 30) as sp`, [T]);
    return { leads30: delta(c.l30, c.lp, "up"), scans30: delta(c.s30, c.sp, "up") };
  });

  /* 막힌 곳 — 실패는 줄어야 좋다 */
  const agents = await part("에이전트", async () => {
    const [a] = await q<{ f7: number; fp: number; t7: number }>(
      `select count(*) filter (where not ok and (at at time zone 'Asia/Seoul')::date > $2::date - 7)::int as f7,
              count(*) filter (where not ok and (at at time zone 'Asia/Seoul')::date > $2::date - 14
                                            and (at at time zone 'Asia/Seoul')::date <= $2::date - 7)::int as fp,
              count(*) filter (where (at at time zone 'Asia/Seoul')::date > $2::date - 7)::int as t7
         from geo.agent_activity where (client_id = $1 or client_id is null)`, [id, T]);
    const [w] = await q<{ n: number }>(
      `select count(*)::int as n from geo.agent_tasks where client_id = $1 and status = '사람 대기'`, [id]);
    return { fail7: delta(a.f7, a.fp, "down"), total7: a.t7, waitingHuman: w.n };
  });

  /* 표로 보기 — 주별 요약 */
  const weeks = await part("주별 요약", async () => {
    const rows = await q<{ week: string; search: number; ai: number }>(
      `select w::date::text as week,
              count(h.id) filter (where h.vendor = any($4))::int as search,
              count(h.id) filter (where coalesce(h.vendor, '') <> all($4))::int as ai
         from generate_series(date_trunc('week', $2::date::timestamp), date_trunc('week', $3::date::timestamp), interval '1 week') w
         left join ${S}.crawl_hits h
           on h.client_id = $1 and date_trunc('week', h.seen_at at time zone 'Asia/Seoul') = w
        group by w order by w`, [id, client.startedOn, T, SEARCH_VENDORS]);
    const inq = await part("주별 문의", () => q<{ week: string; n: number }>(
      `select date_trunc('week', day::timestamp)::date::text as week, count(*)::int as n
         from ${S}.inquiries where client_id = $1 and day >= date_trunc('week', $2::date::timestamp)::date group by 1`,
      [id, client.startedOn]));
    const inqBy = inq ? new Map(inq.map((r) => [r.week, r.n])) : null;
    return rows.map((r) => {
      const from = r.week < client.startedOn ? client.startedOn : r.week;
      const end = addDays(r.week, 6) > T ? T : addDays(r.week, 6);
      const counted = dayDiff(end, from) + 1;
      let rv: { day: string; won: number; total: number } | null = null;
      if (rivalAll) {
        const inWeek = rivalAll.filter((x) => x.day >= r.week && x.day <= end);
        const mx = inWeek.reduce((m, x) => Math.max(m, x.engines), 0);
        const full = inWeek.filter((x) => x.engines === mx);
        const lastFull = full[full.length - 1];
        if (lastFull) rv = { day: lastFull.day, won: lastFull.won, total: lastFull.total };
      }
      return {
        week: r.week, partialDays: counted < 7 ? counted : null,
        search: r.search, ai: r.ai,
        inquiries: inqBy ? inqBy.get(r.week) ?? 0 : null,
        rival: rv,
      };
    });
  });

  return { today: T, days, coverage, ai, rival, crawl, posts, inquiries, sales, agents, weeks };
}
