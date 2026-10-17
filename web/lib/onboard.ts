import { inqPool } from "./inquiries";
import { getPilot } from "./pilots";
import { SITE_URL } from "./site";
import { 체크리스트, 파일럿상태 } from "./client-core.mjs";
import { 날, type 착수입력 } from "./onboard-core.mjs";

/**
 * 계약 뒤 순서(Step 54b) — 착수순서() 입력을 DB 에서 읽는다. 쓰지 않는다(D215).
 * 고객 행 · 파일럿 하나(취소·리허설 아닌 것 먼저, 최근 순) · getPilot 묶음 · 세팅 체크리스트 · 블로그 로그인 일감 · 크롤 방문(구축 고객만)
 */
const q = (s: string, p: unknown[] = []) => inqPool().query(s, p).then((r) => r.rows);

// pg 는 date 를 PC 시간대 자정 Date 로, timestamptz 를 Date 로 준다 — 순수 함수에는 글자로 넘긴다
const 날칸 = ["kickoff_on", "paid_on", "site_launch_on", "started_on", "ends_on", "refund_terms_sent_on", "invoice_issued_on", "cancelled_on"];
const 글자로 = (r: Record<string, any>) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (날칸.includes(k) || k === "due_on" ? 날(v) : v.toISOString()) : v]));

export async function getOnboard(slug: string): Promise<착수입력 | null> {
  const [x] = await q(`select to_jsonb(c) as r from geo.clients c where slug = $1`, [slug]);
  const row = x?.r;
  if (!row) return null;
  const [pid] = await q(`select id from geo.pilots where client_id = $1
      order by (cancelled_on is null) desc, (status <> '리허설') desc, created_at desc limit 1`, [row.id]).catch(() => []);
  const 묶음 = pid ? await getPilot(String(pid.id)) : null;
  const pilot = 묶음 ? 글자로(묶음.pilot) : null;
  const 세팅줄 = 체크리스트(row, row.derived ?? {}, { pilot: await 파일럿상태(q, row.id) });
  const 로그인일감 = await q(`select dedupe_key, title, status from geo.agent_tasks
      where client_id = $1 and dedupe_key in ('naver-session-soon', 'login-naver-blog-' || $2::text) and status not in ('완료', '닫힘')`, [row.id, slug])
    .catch((e) => { console.error("계약 뒤 순서 — 로그인 일감", slug, e); return "못읽음" as const; });
  const 크롤 = pilot?.needs_build === "build"
    ? await q(`select count(*) filter (where seen_at >= now() - interval '7 days')::int as n7, max(seen_at) as last
          from academy.crawl_hits where client_id = $1`, [row.id])
      .then(([r]) => ({ n7: r.n7 as number, last: r.last ? new Date(r.last).toISOString() : null }))
      .catch((e) => { console.error("계약 뒤 순서 — 크롤", slug, e); return "못읽음" as const; })
    : null;
  return {
    row, derived: row.derived ?? {}, 세팅줄, pilot,
    tasks: (묶음?.tasks ?? []).map(글자로), questions: 묶음?.questions ?? [], content: 묶음?.content ?? [],
    ai: 묶음?.ai ?? [], checks: 묶음?.checks ?? [], audits: 묶음?.audits ?? [],
    로그인일감, 크롤, site: SITE_URL,
  };
}
