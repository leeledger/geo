/**
 * 고객사가 둘 이상일 때 필요한 DB 칸 — 여러 번 돌려도 안전하다.
 *
 * 09.10 에 client_id 칸은 만들었지만 일하는 자리에 필요한 칸이 빠져 있었다.
 *   geo.clients.current_score / current_on   착수 진단 옆에 「지금 점수」. 없으니 아이로그가
 *                                            44 → 75 가 됐는데 아무도 몰랐다
 *   geo.clients.crawl_key                    고객사 서버가 크롤러 방문을 보낼 때 쓰는 키
 *   academy.interventions.client_id          고객사별로 손댄 날
 *   academy.site_pages                       사이트맵의 실제 페이지. 커버리지 분모
 *
 * 커버리지 뷰도 고친다. 분자에 실제 페이지가 아닌 경로(/admin 등)가 들어갔고,
 * 분모가 「발행 글 + 2」라 글이 없는 고객사(아이로그)는 분모가 0이었다.
 *
 *   node scripts/setup-multiclient.mjs
 *   node scripts/setup-multiclient.mjs --show-key ilog     고객사 서버에 넣을 키 보기
 */
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

const show = process.argv.indexOf("--show-key");
if (show > 0) {
  const [r] = await q(`select slug, crawl_key from geo.clients where slug = $1`, [process.argv[show + 1]]);
  console.log(r ? `${r.slug}  CITED_CRAWL_KEY=${r.crawl_key}` : "없음");
  await pool.end();
  process.exit(0);
}

const STEPS = [
  [`geo.clients 지금 점수`, `
    alter table geo.clients add column if not exists current_score int;
    alter table geo.clients add column if not exists current_on date;
    alter table geo.clients add column if not exists crawl_key text`],
  [`개입 로그 고객사 칸`, `
    alter table academy.interventions add column if not exists client_id int not null default 1`],
  [`사이트맵 페이지 표`, `
    create table if not exists academy.site_pages (
      client_id int not null,
      path      text not null,
      seen_on   date not null default current_date,
      primary key (client_id, path)
    )`],
  [`커버리지 뷰 — 실제 페이지만, 고객사별 분모`, `
    create or replace view academy.coverage_by_vendor as
    with sp as (
      select client_id, path from academy.site_pages
    ), pp as (
      select client_id, '/blog/' || slug as path from academy.posts where published
      union select client_id, '/' from academy.posts where published
      union select client_id, '/blog' from academy.posts where published
    ), pages as (
      select client_id, path from sp
      union
      select client_id, path from pp where client_id not in (select distinct client_id from sp)
    ), tot as (
      select client_id, count(*)::int as total from pages group by client_id
    )
    select h.client_id,
           h.vendor,
           count(distinct h.path)::int as pages_crawled,
           coalesce(t.total, 0) as pages_total,
           round(100.0 * count(distinct h.path)::numeric / nullif(coalesce(t.total, 0), 0)::numeric, 1) as coverage_pct,
           min(h.seen_at) as first_seen,
           max(h.seen_at) as last_seen
      from academy.crawl_hits h
      join pages p on p.client_id = h.client_id and p.path = h.path
      left join tot t on t.client_id = h.client_id
     group by h.client_id, h.vendor, t.total
     order by count(distinct h.path) desc`],
];

for (const [name, sql] of STEPS) {
  await pool.query(sql);
  console.log(`  OK  ${name}`);
}

// 키가 없는 고객사에 하나씩. 한 번 만들면 바꾸지 않는다 — 바꾸면 고객사 서버 설정도 바꿔야 한다.
const need = await q(`select id, slug from geo.clients where crawl_key is null`);
for (const c of need) {
  await pool.query(`update geo.clients set crawl_key = $1 where id = $2`, [randomBytes(18).toString("hex"), c.id]);
  console.log(`  OK  ${c.slug} 크롤러 기록 키 생성 (--show-key ${c.slug} 로 확인)`);
}

await pool.end();
