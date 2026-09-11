/**
 * 오늘 한 일 — 마감 시각으로 자른 하루와, 그 안에 DB 에 남은 일.
 *
 * 대시보드(web/lib/brief.ts)와 마감 스크립트(academy/scripts/daily-brief.mjs)가 같이 쓴다.
 * 두 곳에서 따로 세면 화면과 기록이 갈라진다. 그래서 순수 함수로 여기 한 곳에 둔다.
 * 쿼리 함수는 밖에서 받는다 — 여기서는 pg 를 모른다.
 *
 * 창의 이름은 「마감되는 날」이다. 18:00 마감이면 어제 18:00 ~ 오늘 18:00 이 「오늘」이다.
 * 시각은 전부 한국 시각으로 자른다. DB 는 UTC 로 준다 — 한 번 그걸 모르고
 * 첫 크롤러 방문 00:49 를 「오후 3시 49분」으로 랜딩에 내보냈다.
 */

export const DEFAULT_CUTOFF = "18:00";

// 엔진은 셋이다. 이름표를 둘만 두었다가 네이버 통합검색을 Bing 이라고 적은 적이 있다.
const ENGINE = { naver: "네이버 웹문서", naver_all: "네이버 통합검색", bing: "Bing" };
const KST_MS = 9 * 3600000;

/** "HH:MM" 인가 */
export function validCutoff(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s ?? ""));
}

/** 한국 날짜 YYYY-MM-DD */
export function kstDay(d) {
  return new Date(new Date(d).getTime() + KST_MS).toISOString().slice(0, 10);
}

/** 한국 시각 HH:MM */
export function kstTime(d) {
  return new Date(new Date(d).getTime() + KST_MS).toISOString().slice(11, 16);
}

const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+09:00`);
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * 지금 열려 있는 창(open)과 마지막으로 닫힌 창(closed).
 * @param {string} cutoff "HH:MM"
 * @param {Date} [now]
 */
export function windows(cutoff = DEFAULT_CUTOFF, now = new Date()) {
  const c = validCutoff(cutoff) ? cutoff : DEFAULT_CUTOFF;
  const today = kstDay(now);
  const openDay = now < at(today, c) ? today : addDays(today, 1);
  const closedDay = addDays(openDay, -1);
  return {
    cutoff: c,
    open: { day: openDay, start: at(addDays(openDay, -1), c), end: at(openDay, c) },
    closed: { day: closedDay, start: at(addDays(closedDay, -1), c), end: at(closedDay, c) },
  };
}

/**
 * 창 안에서 DB 에 남은 일을 고객사별로 모은다.
 * 표가 없거나 쿼리가 실패한 칸은 빈 값으로 둔다 — 한 칸이 막혀 브리핑 전체가 죽으면 안 된다.
 *
 * @param {(sql: string, params?: unknown[]) => Promise<any[]>} q
 * @param {Date} start
 * @param {Date} end
 */
export async function gatherDb(q, start, end) {
  const P = [start, end];
  const safe = (p) => p.catch(() => []);

  const clients = await safe(q(
    `select id, slug, name, domain from geo.clients where coalesce(status, '') <> 'ended' order by id`));

  const [iv, posts, naver, serp, firsts, crawl, newBots, rescans, prevScans, leads, inq, pub] = await Promise.all([
    safe(q(`select client_id, what, why, created from academy.interventions
             where created >= $1 and created < $2 order by created`, P)),
    safe(q(`select client_id, title, slug, published_at from academy.posts
             where published and published_at >= $1 and published_at < $2 order by published_at`, P)),
    safe(q(`select client_id, count(*)::int n from academy.posts
             where naver_at >= $1 and naver_at < $2 group by client_id`, P)),
    // 같은 날 다시 재면 줄이 갱신된다(upsert). 그래서 「몇 번」이 아니라 「몇 개 검색어를, 마지막 언제」로 센다.
    safe(q(`select client_id, count(distinct query)::int queries, max(checked_at) last from academy.serp_checks
             where checked_at >= $1 and checked_at < $2 group by client_id`, P)),
    safe(q(`select client_id, engine, query from (
              select client_id, engine, query, min(checked_at) filter (where hit) f
                from academy.serp_checks group by client_id, engine, query) t
             where f >= $1 and f < $2 order by f`, P)),
    safe(q(`select client_id, count(*)::int hits, array_agg(distinct vendor) vendors from academy.crawl_hits
             where seen_at >= $1 and seen_at < $2 group by client_id`, P)),
    safe(q(`select client_id, bot from academy.crawl_hits group by client_id, bot
             having min(seen_at) >= $1 and min(seen_at) < $2`, P)),
    safe(q(`select origin, total, created_at from geo.scans
             where user_agent = 'cited-rescan' and created_at >= $1 and created_at < $2 order by created_at`, P)),
    safe(q(`select distinct on (origin) origin, total from geo.scans
             where user_agent = 'cited-rescan' and created_at < $1 order by origin, created_at desc`, [start])),
    safe(q(`select created_at, company, wants, referral from geo.leads
             where created_at >= $1 and created_at < $2 order by created_at`, P)),
    safe(q(`select count(*)::int n from academy.inquiries where created_at >= $1 and created_at < $2`, P)),
    safe(q(`select count(*)::int n from geo.scans
             where coalesce(user_agent, '') <> 'cited-rescan' and created_at >= $1 and created_at < $2`, P)),
  ]);

  const iso = (t) => (t ? new Date(t).toISOString() : null);
  const byId = (rows, id) => rows.filter((r) => r.client_id === id);

  return {
    clients: clients.map((c) => {
      const scans = rescans.filter((s) => String(s.origin).includes(c.domain));
      const last = scans[scans.length - 1];
      const prev = prevScans.find((s) => String(s.origin).includes(c.domain));
      const cr = crawl.find((r) => r.client_id === c.id);
      const ms = serp.find((r) => r.client_id === c.id);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        work: byId(iv, c.id).map((x) => ({ what: x.what, why: x.why, at: iso(x.created) })),
        published: byId(posts, c.id).map((x) => ({ title: x.title, slug: x.slug, at: iso(x.published_at) })),
        delivered: naver.find((r) => r.client_id === c.id)?.n ?? 0,
        measured: ms ? { queries: ms.queries, last: iso(ms.last) } : null,
        firstHits: byId(firsts, c.id).map((x) => `${ENGINE[x.engine] ?? x.engine} · ${x.query}`),
        crawl: { hits: cr?.hits ?? 0, vendors: cr?.vendors ?? [] },
        newBots: byId(newBots, c.id).map((x) => x.bot),
        rescan: last ? { total: last.total, prev: prev?.total ?? null } : null,
      };
    }),
    leads: leads.map((l) => ({ at: iso(l.created_at), company: l.company, wants: l.wants, referral: l.referral })),
    inquiries: inq[0]?.n ?? 0,
    publicScans: pub[0]?.n ?? 0,
  };
}

/**
 * 사람이 읽을 줄. 스크립트 출력과 대시보드가 같은 문장을 쓴다.
 * @param {Awaited<ReturnType<typeof gatherDb>>} f
 */
export function clientLine(c) {
  const parts = [];
  if (c.work.length) parts.push(`손댄 일 ${c.work.length}건`);
  if (c.published.length) parts.push(`발행 ${c.published.length}편`);
  if (c.delivered) parts.push(`네이버 이관 ${c.delivered}편`);
  if (c.rescan) {
    const ch = c.rescan.prev != null && c.rescan.prev !== c.rescan.total ? ` (${c.rescan.prev} → ${c.rescan.total})` : "";
    parts.push(`재진단 ${c.rescan.total}점${ch}`);
  }
  if (c.measured) parts.push(`노출 측정 검색어 ${c.measured.queries}개`);
  if (c.firstHits.length) parts.push(`처음 노출 ${c.firstHits.length}건`);
  parts.push(`크롤러 ${c.crawl.hits}회`);
  if (c.newBots.length) parts.push(`처음 온 크롤러 ${c.newBots.join("·")}`);
  return parts.join(" · ");
}
