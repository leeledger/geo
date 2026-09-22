import { Pool } from "pg";

/**
 * 운영 대시보드가 읽는 데이터.
 *
 * 학원 사이트와 같은 DB 를 본다. 사이티드는 그 숫자를 파는 회사이므로
 * 여기에 보이는 것이 곧 영업 자료다. 그래서 지어낸 값을 넣지 않는다 —
 * 못 읽으면 null 을 주고 화면에서 "확인 못함"으로 표시한다.
 */

const g = globalThis as unknown as { __opsPool?: Pool };

export function pool(): Pool {
  if (!g.__opsPool) {
    const dsn = process.env.DATABASE_URL;
    if (!dsn) throw new Error("DATABASE_URL 없음");
    const u = new URL(dsn);
    u.searchParams.delete("sslmode");
    g.__opsPool = new Pool({
      connectionString: u.toString(),
      ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
      max: 3,
    });
  }
  return g.__opsPool;
}

export type Ops = {
  ok: boolean;
  err?: string;
  posts: { published: number; draft: number; lastAt: string | null; sinceDays: number | null };
  crawl: { last24h: number; vendors: { vendor: string; hits: number; pages: number; pct: number }[]; totalPages: number };
  serp: {
    day: string | null;
    hits: { engine: string; query: string; rank: number }[];
    total: number;
    /**
     * 경쟁 검색어 — 학원 이름 없이 「지역 + 업종」으로 친 검색.
     * 브랜드 검색에서 1위인 건 이겨서 얻은 자리가 아니라 원래 우리 자리다.
     * 그걸 성과로 세면 좋아 보이는 숫자를 만드는 것이고, 그건 우리가 파는 것의 반대다.
     * 질의 단위로 센다 — 엔진별 행을 세면 하루에 두 번 돌린 날 분모가 두 배가 된다.
     */
    rivalWon: number;
    rivalTotal: number;
    /** 브랜드 검색 방어 — 우리 이름인데 안 나오는 게 있으면 문제다 */
    brandLost: string[];
  };
  place: { query: string; rank: number }[];
  ai: {
    day: string | null;
    engine: string | null;
    method: string | null;
    prompts: number;
    cited: number;
    mentioned: number;
    rounds: number;
    comparable: boolean;
  };
  sales: {
    scans30d: number;
    leads30d: number;
    newLeads: number;
    unresolvedInquiries: number;
    scanToLeadPct: number;
  };
  agentLoop: {
    day: string | null; status: string; diagnosis: string; action: string; evidence: string;
    startedAt: string | null; completedAt: string | null;
    /** 그날 엔진별 자동 측정 적중 (예: "gemini 2/20 · groq-compound 0/20") */
    engines: string;
    history: { day: string; status: string; kind: string | null; verdict: string; note: string }[];
  };
  /**
   * 에이전트 회사(academy/scripts/company.mjs)가 실제로 집어 간 일감과 한 일.
   * 카드의 「다음 행동」 문장이 아니라 실행 기록이다. 표가 없으면 ok=false.
   */
  company: {
    ok: boolean;
    tasks: { id: number; agent: string; kind: string; status: string; title: string; detail: string; evidence: string; error: string; link: string | null; updatedAt: string; doneAt: string | null; payload: Record<string, unknown> | null }[];
    activity: { agent: string; action: string; ok: boolean; summary: string; at: string; runUrl: string | null }[];
  };
  recent: { title: string; slug: string; at: string }[];
  /**
   * 자리마다 마지막으로 실제로 뭔가 일어난 시각.
   *
   * 누적값만 보여주면 지금 돌고 있는지 알 수 없다.
   * 「이게 실제로 돌아가고 있는 건지 판단이 안 된다」 — 그래서 붙였다.
   */
  lastAt: {
    content: string | null;   // 마지막 발행
    deliver: string | null;   // 마지막 네이버 이관
    crawler: string | null;   // 마지막 크롤러 방문
    measure: string | null;   // 마지막 노출 측정
    next: string | null;      // 마지막으로 손을 댄 날
  };

  /* 자리별 성과에 쓰는 값들 */
  totalHits: number;         // 크롤러 총 방문
  vendorCount: number;       // 다녀간 크롤러 종류
};

const days = (d: string | Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);


/** 학원 이름 조각. 하나라도 들어가면 브랜드 검색이다. */
const BRAND = ["로봇앤코딩", "로봇&코딩", "로봇코딩", "robotncoding"];
const isBrandQuery = (q: string) => {
  const t = q.replace(/\s+/g, "").toLowerCase();
  return /^site:/i.test(q) || BRAND.some((b) => t.includes(b.replace(/\s+/g, "").toLowerCase()));
};

/**
 * 경쟁 검색어를 질의 단위로 센다.
 *
 * 엔진별 행을 그냥 세면 안 된다 — 하루에 두 번 돌리면 같은 질의가 네 번 들어가고
 * 분모가 26 같은 이상한 수가 된다. 실제로 랜딩에 「0/26」이 찍혔다.
 * 한 질의는 어느 엔진에서든 한 번 걸리면 이긴 것으로 본다.
 */
function rivalTally(rows: { engine: string; query: string; hit: boolean; kind?: string }[]) {
  const rival = new Map<string, boolean>();
  const brand = new Map<string, boolean>();
  for (const r of rows) {
    if (r.kind === "색인" || /^site:/i.test(r.query)) continue;   // 색인 확인은 순위가 아니다
    // 측정 스크립트가 적어 둔 종류를 믿는다. 학원 이름 조각으로 가르면
    // 아이로그의 「아이로그 학원」 같은 브랜드 검색이 경쟁 검색으로 세진다.
    const isBrand = r.kind ? r.kind === "브랜드" : isBrandQuery(r.query);
    const m = isBrand ? brand : rival;
    m.set(r.query, (m.get(r.query) ?? false) || r.hit);
  }
  return {
    rivalWon: [...rival.values()].filter(Boolean).length,
    rivalTotal: rival.size,
    brandLost: [...brand.entries()].filter(([, hit]) => !hit).map(([q]) => q),
  };
}


/**
 * 고객사.
 *
 * 지금은 로봇&코딩학원 한 곳이다. 대시보드가 여러 곳을 볼 수 있어야 하므로
 * 「어느 고객사」를 명시적으로 들고 다닌다.
 *
 * alias 는 대외 공개용 가림 이름이다. 사례로 쓸 때 회사명 대신 이걸 쓴다 —
 * 지점명·업종·규모가 조합되면 특정되므로 alias 도 뭉뚱그린 말이어야 한다.
 */
export type Client = {
  id: number;
  slug: string;
  name: string;
  alias: string | null;
  domain: string | null;
  status: string;
  startedOn: string;
  schema: string;
  /** 착수 시점 사이트 진단 점수. 「고치기 전이 몇 점이었나」를 기억으로 말하지 않는다. */
  baselineScore: number | null;
  baselineOn: string | null;
  /** 다시 진단한 점수. 착수 점수만 있으면 고친 게 먹혔는지 모른다 (rescan.mjs) */
  currentScore: number | null;
  currentOn: string | null;
  /**
   * 자사 · 외부.
   *
   * 지금 두 곳 다 원장님 소유다. 그건 레퍼런스가 아니라 자가 실험이다.
   * 「고객사 2곳」이라고 세면 좋아 보이는 숫자를 만드는 것이다 —
   * 우리가 남에게 하지 말라고 하는 바로 그 짓이다.
   */
  relation: string;
};

export async function listClients(): Promise<Client[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { rows } = await pool().query(
      `select id, slug, name, alias, domain, status,
              started_on::text as started_on, schema_name,
              baseline_score, baseline_on::text as baseline_on, relation,
              current_score, current_on::text as current_on
         from geo.clients
        where status <> 'ended'
        order by started_on, id`,
    );
    return rows.map((r) => ({
      id: r.id, slug: r.slug, name: r.name, alias: r.alias,
      domain: r.domain, status: r.status,
      startedOn: r.started_on, schema: r.schema_name,
      baselineScore: r.baseline_score ?? null,
      baselineOn: r.baseline_on ?? null,
      currentScore: r.current_score ?? null,
      currentOn: r.current_on ?? null,
      relation: r.relation ?? "외부",
    }));
  } catch {
    // 표가 아직 없으면 첫 고객사 하나로 친다. 화면이 빈 채로 뜨는 것보다 낫다.
    return [{
      id: 1, slug: "robotncoding", name: "로봇&코딩학원",
      alias: "수도권의 코딩·로봇 교육 학원", domain: "robotncoding.com",
      status: "active", startedOn: "2026-09-05", schema: "academy",
      baselineScore: 83, baselineOn: "2026-09-05", currentScore: null, currentOn: null, relation: "자사",
    }];
  }
}

/**
 * 고객사 하나의 운영 현황.
 *
 * 지금은 고객사가 한 곳이지만 두 곳이 되는 순간을 대비해 client 를 받는다.
 * 한 곳일 때 갈라 두는 게 싸다 — 두 곳이 되고 나서 가르려면 「어느 줄이 누구
 * 것인지」부터 알아내야 한다.
 *
 * 측정 데이터가 어느 스키마에 있는지는 geo.clients.schema_name 이 안다.
 * 첫 고객사는 academy 에 있고, 새 고객사는 각자 스키마를 갖거나 같이 써도 된다.
 */
export async function readOps(client?: Client): Promise<Ops> {
  const empty: Ops = {
    ok: false,
    posts: { published: 0, draft: 0, lastAt: null, sinceDays: null },
    crawl: { last24h: 0, vendors: [], totalPages: 0 },
    serp: { day: null, hits: [], total: 0, rivalWon: 0, rivalTotal: 0, brandLost: [] },
    place: [],
    ai: { day: null, engine: null, method: null, prompts: 0, cited: 0, mentioned: 0, rounds: 0, comparable: false },
    sales: { scans30d: 0, leads30d: 0, newLeads: 0, unresolvedInquiries: 0, scanToLeadPct: 0 },
    agentLoop: { day: null, status: "기록 없음", diagnosis: "실행 기록 없음", action: "오늘의 개선 루프를 실행합니다.", evidence: "", startedAt: null, completedAt: null, engines: "", history: [] },
    company: { ok: false, tasks: [], activity: [] },
    recent: [],
    lastAt: { content: null, deliver: null, crawler: null, measure: null, next: null },
    totalHits: 0,
    vendorCount: 0,
  };

  try {
    const p = pool();
    const q = async (s: string) => (await p.query(s)).rows;

    // 고객사를 안 넘기면 첫 고객사를 쓴다. 화면 하나짜리 호출을 안 깨뜨린다.
    const c = client ?? (await listClients())[0];
    if (!c) return { ...empty, err: "고객사가 없습니다. scripts/setup-clients.mjs 를 돌리세요." };
    const S = c.schema;              // 측정 데이터가 있는 스키마
    const ME = `client_id = ${c.id}`; // 이 고객사 줄만

    const [post] = await q(`
      select count(*) filter (where published)::int pub,
             count(*) filter (where not published)::int draft,
             max(published_at) last
        from ${S}.posts where ${ME}`);

    const [c24] = await q(`
      select count(*)::int n from ${S}.crawl_hits
       where ${ME} and seen_at > now() - interval '24 hours'`);

    const vendors = await q(`
      select vendor, pages_crawled::int pages, pages_total::int total,
             coverage_pct::float pct
        from ${S}.coverage_by_vendor where ${ME} order by pages_crawled desc limit 8`);

    const vhits = await q(`
      select vendor, count(*)::int hits from ${S}.crawl_hits where ${ME} group by vendor`);
    const hitBy = new Map(vhits.map((r) => [r.vendor, r.hits]));

    const serpDay = await q(`select max(day)::text d from ${S}.serp_checks where ${ME}`);
    const serp = serpDay[0]?.d
      ? await q(`select engine, query, kind, rank, hit from ${S}.serp_checks
                  where ${ME} and day = '${serpDay[0].d}'`)
      : [];

    const place = await q(`
      select query, rank::int from ${S}.place_checks
       where ${ME} and rank is not null
         and day = (select max(day) from ${S}.place_checks where ${ME})
       order by rank`);

    let ai = empty.ai;
    try {
      const rounds = await q(`
        select measured_on::text as measured_day, collection_method, engine,
               count(*)::int prompts,
               count(*) filter (where cited)::int cited,
               count(*) filter (where mentioned and not cited)::int mentioned
          from academy.ai_measurements where ${ME}
         group by measured_on, collection_method, engine order by measured_on desc`);
      const comparable = rounds.some((r) => rounds.some((x) =>
        x !== r && x.engine === r.engine && x.collection_method === r.collection_method));
      if (rounds[0]) ai = {
        day: rounds[0].measured_day,
        engine: rounds[0].engine,
        method: rounds[0].collection_method,
        prompts: rounds[0].prompts,
        cited: rounds[0].cited,
        mentioned: rounds[0].mentioned,
        rounds: rounds.length,
        comparable,
      };
    } catch { /* 아직 측정 표가 없는 고객사는 0건으로 보인다 */ }

    let sales = empty.sales;
    try {
      const [s] = await q(`
        select
          (select count(*)::int from geo.scans
            where coalesce(user_agent,'') <> 'cited-rescan' and created_at > now() - interval '30 days') scans,
          (select count(*)::int from geo.leads
            where created_at > now() - interval '30 days'
              and (scan_id is not null or source = 'free_scan')) leads,
          (select count(*)::int from geo.leads where coalesce(status,'new') = 'new') new_leads,
          (select count(*)::int from academy.inquiries where ${ME} and enrolled is null) unresolved`);
      sales = {
        scans30d: s.scans,
        leads30d: s.leads,
        newLeads: s.new_leads,
        unresolvedInquiries: s.unresolved,
        scanToLeadPct: s.scans ? Number(((s.leads / s.scans) * 100).toFixed(1)) : 0,
      };
    } catch { /* 영업 표가 아직 없으면 0으로 둔다 */ }
    let agentLoop = empty.agentLoop;
    try {
      // run_day::text day 로 썼다가 예약어 문법 오류를 catch 가 삼켜 카드가 늘 「기록 없음」이었다. as 를 붙인다
      const runs = await q(`select run_day::text as run_day, status, diagnosis, action, evidence,
               started_at::text as started, completed_at::text as completed,
               coalesce(facts->>'engines','') as engines,
               to_jsonb(r) ->> 'action_kind' as kind,
               coalesce(to_jsonb(r) ->> 'verdict', '판정 전') as verdict,
               coalesce(to_jsonb(r) ->> 'verdict_note', '') as note
          from geo.agent_runs r where client_id=${c.id} order by run_day desc, started_at desc limit 7`);
      const [r] = runs;
      if (r) agentLoop = {
        day: r.run_day, status: r.status, diagnosis: r.diagnosis, action: r.action, evidence: r.evidence,
        startedAt: r.started, completedAt: r.completed, engines: r.engines,
        history: runs.map((x) => ({ day: x.run_day, status: x.status, kind: x.kind, verdict: x.verdict, note: x.note })),
      };
    } catch (e) { console.error("agent_runs 읽기 실패", e); }

    let company = empty.company;
    try {
      const tasks = await q(`select id, agent, kind, status, title, detail, evidence, last_error, link, payload,
               updated_at::text as updated, done_at::text as done
          from geo.agent_tasks
         where client_id=${c.id} and (status not in ('완료','닫힘') or done_at > now() - interval '48 hours')
         order by case status when '사람 대기' then 0 when '실행 중' then 1 when '실패' then 2 when '수리 대기' then 3 when '대기' then 4 when '로컬 대기' then 5 when '관찰' then 6 else 7 end, priority, updated_at desc
         limit 120`);
      const activity = await q(`select agent, action, ok, summary, at::text as at, run_url
          from geo.agent_activity where client_id=${c.id} or client_id is null order by at desc limit 80`);
      company = {
        ok: true,
        tasks: tasks.map((t) => ({ id: Number(t.id), agent: t.agent, kind: t.kind, status: t.status, title: t.title, detail: t.detail, evidence: t.evidence, error: t.last_error, link: t.link, updatedAt: t.updated, doneAt: t.done, payload: t.payload ?? null })),
        activity: activity.map((a) => ({ agent: a.agent, action: a.action, ok: a.ok, summary: a.summary, at: a.at, runUrl: a.run_url })),
      };
    } catch (e) { console.error("agent_tasks 읽기 실패", e); }

    const recent = await q(`
      select title, slug, published_at::text at from ${S}.posts
       where ${ME} and published order by published_at desc limit 5`);

    // 자리마다 마지막 활동 시각. 하나라도 없으면 null 로 두고 화면에서 「기록 없음」이라 적는다.
    const [seen] = await q(`
      select
        (select max(published_at) from ${S}.posts where ${ME}) as content,
        (select max(naver_at) from ${S}.posts where ${ME}) as deliver,
        (select max(seen_at) from ${S}.crawl_hits where ${ME}) as crawler,
        (select max(checked_at) from ${S}.serp_checks where ${ME}) as measure,
        (select max(created) from ${S}.interventions where ${ME}) as next`);

    const [more] = await q(`
      select
        (select count(*)::int from ${S}.crawl_hits where ${ME}) as total_hits,
        (select count(distinct vendor)::int from ${S}.crawl_hits where ${ME}) as vendor_count`);

    return {
      ok: true,
      totalHits: more.total_hits,
      vendorCount: more.vendor_count,
      posts: {
        published: post.pub,
        draft: post.draft,
        lastAt: post.last ? new Date(post.last).toISOString() : null,
        sinceDays: post.last ? days(post.last) : null,
      },
      crawl: {
        last24h: c24.n,
        totalPages: vendors[0]?.total ?? 0,
        vendors: vendors.map((v) => ({
          vendor: v.vendor,
          hits: hitBy.get(v.vendor) ?? 0,
          pages: v.pages,
          pct: v.pct,
        })),
      },
      serp: {
        day: serpDay[0]?.d ?? null,
        total: serp.length,
        hits: serp.filter((r) => r.hit).map((r) => ({ engine: r.engine, query: r.query, rank: r.rank })),
        ...rivalTally(serp),
      },
      lastAt: {
        content: seen?.content ? new Date(seen.content).toISOString() : null,
        deliver: seen?.deliver ? new Date(seen.deliver).toISOString() : null,
        crawler: seen?.crawler ? new Date(seen.crawler).toISOString() : null,
        measure: seen?.measure ? new Date(seen.measure).toISOString() : null,
        next: seen?.next ? new Date(seen.next).toISOString() : null,
      },
      place: place.map((r) => ({ query: r.query, rank: r.rank })),
      ai,
      sales,
      agentLoop,
      company,
      recent: recent.map((r) => ({ title: r.title, slug: r.slug, at: r.at })),
    };
  } catch (e) {
    return { ...empty, err: e instanceof Error ? e.message : String(e) };
  }
}
