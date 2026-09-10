import { Pool } from "pg";

/**
 * 운영 대시보드가 읽는 데이터.
 *
 * 학원 사이트와 같은 DB 를 본다. 사이티드는 그 숫자를 파는 회사이므로
 * 여기에 보이는 것이 곧 영업 자료다. 그래서 지어낸 값을 넣지 않는다 —
 * 못 읽으면 null 을 주고 화면에서 "확인 못함"으로 표시한다.
 */

const g = globalThis as unknown as { __opsPool?: Pool };

function pool(): Pool {
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
  recent: { title: string; slug: string; at: string }[];
  firstSeen: { engine: string; query: string; day: string }[];
  /* 자리별 성과에 쓰는 값들 */
  daysMeasured: number;      // 며칠째 재고 있는가
  withImages: number;        // 도해가 붙은 글
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
function rivalTally(rows: { engine: string; query: string; hit: boolean }[]) {
  const rival = new Map<string, boolean>();
  const brand = new Map<string, boolean>();
  for (const r of rows) {
    const m = isBrandQuery(r.query) ? brand : rival;
    if (/^site:/i.test(r.query)) continue;         // 색인 확인은 순위가 아니다
    m.set(r.query, (m.get(r.query) ?? false) || r.hit);
  }
  return {
    rivalWon: [...rival.values()].filter(Boolean).length,
    rivalTotal: rival.size,
    brandLost: [...brand.entries()].filter(([, hit]) => !hit).map(([q]) => q),
  };
}

export async function readOps(): Promise<Ops> {
  const empty: Ops = {
    ok: false,
    posts: { published: 0, draft: 0, lastAt: null, sinceDays: null },
    crawl: { last24h: 0, vendors: [], totalPages: 0 },
    serp: { day: null, hits: [], total: 0, rivalWon: 0, rivalTotal: 0, brandLost: [] },
    place: [],
    recent: [],
    firstSeen: [],
    daysMeasured: 0,
    withImages: 0,
    totalHits: 0,
    vendorCount: 0,
  };

  try {
    const p = pool();
    const q = async (s: string) => (await p.query(s)).rows;

    const [post] = await q(`
      select count(*) filter (where published)::int pub,
             count(*) filter (where not published)::int draft,
             max(published_at) last
        from academy.posts`);

    const [c24] = await q(`
      select count(*)::int n from academy.crawl_hits
       where seen_at > now() - interval '24 hours'`);

    const vendors = await q(`
      select vendor, pages_crawled::int pages, pages_total::int total,
             coverage_pct::float pct
        from academy.coverage_by_vendor order by pages_crawled desc limit 8`);

    const vhits = await q(`
      select vendor, count(*)::int hits from academy.crawl_hits group by vendor`);
    const hitBy = new Map(vhits.map((r) => [r.vendor, r.hits]));

    const serpDay = await q(`select max(day)::text d from academy.serp_checks`);
    const serp = serpDay[0]?.d
      ? await q(`select engine, query, rank, hit from academy.serp_checks
                  where day = '${serpDay[0].d}'`)
      : [];

    const place = await q(`
      select query, rank::int from academy.place_checks
       where day = (select max(day) from academy.place_checks) and rank is not null
       order by rank`);

    const recent = await q(`
      select title, slug, published_at::text at from academy.posts
       where published order by published_at desc limit 5`);

    // day 를 그냥 별칭으로 쓰면 "syntax error at or near day" 가 난다.
    // 예약어라 AS 를 붙이거나 다른 이름을 써야 한다.
    const firstSeen = await q(`
      select engine, query, min(day)::text as first_day from academy.serp_checks
       where hit group by engine, query order by min(day) limit 6`);

    const [more] = await q(`
      select
        (select count(distinct day)::int from academy.serp_checks) as days_measured,
        (select count(*)::int from academy.posts
          where published and body like '%![%') as with_images,
        (select count(*)::int from academy.crawl_hits) as total_hits,
        (select count(distinct vendor)::int from academy.crawl_hits) as vendor_count`);

    return {
      ok: true,
      daysMeasured: more.days_measured,
      withImages: more.with_images,
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
      place: place.map((r) => ({ query: r.query, rank: r.rank })),
      recent: recent.map((r) => ({ title: r.title, slug: r.slug, at: r.at })),
      firstSeen: firstSeen.map((r) => ({ engine: r.engine, query: r.query, day: r.first_day })),
    };
  } catch (e) {
    return { ...empty, err: e instanceof Error ? e.message : String(e) };
  }
}
