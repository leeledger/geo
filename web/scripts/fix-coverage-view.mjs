/**
 * coverage_by_vendor 뷰를 고객사별로 다시 만든다.
 *
 * 뷰가 crawl_hits 를 통째로 세고 있었다. 고객사가 한 곳일 때는 맞지만
 * 두 곳이 되면 남의 크롤러 방문이 우리 커버리지에 섞인다.
 * 표에는 client_id 를 붙여 놨는데 뷰가 안 보고 있으면 반쪽이다.
 *
 *   node scripts/fix-coverage-view.mjs
 */
import fs from "node:fs";
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

// published_posts 도 고객사를 가르는지 본다
const pv = await q(`select pg_get_viewdef('academy.published_posts', true) v`).catch(() => []);
console.log("── published_posts ──");
console.log(pv[0]?.v?.split("\n").map((x) => "  " + x.trim()).join("\n") ?? "  (없음)");

const hasClient = (await q(`
  select 1 from information_schema.columns
   where table_schema='academy' and table_name='crawl_hits' and column_name='client_id'`)).length;
if (!hasClient) {
  console.log("\n  crawl_hits 에 client_id 가 없습니다. setup-clients.mjs 를 먼저 돌리세요.");
  await pool.end();
  process.exit(1);
}

// create or replace 는 열 순서를 못 바꾼다 — 앞에 client_id 를 끼우려니
// "cannot change name of view column" 이 났다. 떨구고 다시 만든다.
await q(`drop view if exists academy.coverage_by_vendor`);
await q(`
  create view academy.coverage_by_vendor as
  with pages as (
    select client_id, count(*)::int + 2 as total
      from academy.posts
     where published
     group by client_id
  )
  select h.client_id,
         h.vendor,
         count(distinct h.path)::int as pages_crawled,
         coalesce(p.total, 0) as pages_total,
         round(100.0 * count(distinct h.path)::numeric
               / nullif(coalesce(p.total, 0), 0)::numeric, 1) as coverage_pct,
         min(h.seen_at) as first_seen,
         max(h.seen_at) as last_seen
    from academy.crawl_hits h
    left join pages p on p.client_id = h.client_id
   where h.path !~ '\\.(png|jpg|jpeg|gif|webp|svg|css|js|txt|xml|ico)$'
   group by h.client_id, h.vendor, p.total
   order by count(distinct h.path) desc`);

console.log("\n── 다시 만든 뒤 ──");
for (const r of await q(`
  select client_id, vendor, pages_crawled, pages_total, coverage_pct
    from academy.coverage_by_vendor order by pages_crawled desc`)) {
  console.log(`  [고객사 ${r.client_id}] ${r.vendor.padEnd(11)} ${r.pages_crawled}/${r.pages_total}쪽  ${r.coverage_pct}%`);
}

await pool.end();
