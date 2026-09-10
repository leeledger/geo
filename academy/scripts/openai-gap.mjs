/**
 * OpenAI 계열 크롤러가 왜 적게 읽었는지 본다.
 *
 * 브리핑에서 openai 7/45쪽(15.6%) 이 나왔다. google·anthropic 은 93% 를 넘는다.
 * robots.txt 는 GPTBot 을 명시 허용하고 있으니 차단은 아니다.
 * 그러면 남는 건 발견 경로다 — OpenAI 는 사이트맵 제출 창구가 없어서
 * 링크를 타고 오거나 Bing 색인을 통해 온다.
 *
 *   node scripts/openai-gap.mjs
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
const q = async (s, p = []) => (await pool.query(s, p)).rows;

console.log("── OpenAI 계열 UA 별 ──");
for (const r of await q(`
  select ua, count(*)::int hits, count(distinct path)::int pages,
         min(seen_at)::date::text first, max(seen_at)::date::text last
    from academy.crawl_hits
   where vendor = 'openai'
   group by ua order by hits desc`)) {
  console.log(`  ${r.ua.slice(0, 34).padEnd(36)} ${String(r.hits).padStart(4)}회 ${String(r.pages).padStart(3)}쪽  ${r.first} ~ ${r.last}`);
}

console.log("\n── OpenAI 가 읽은 쪽 ──");
for (const r of await q(`
  select path, count(*)::int n, max(seen_at)::date::text last
    from academy.crawl_hits where vendor = 'openai'
   group by path order by n desc`)) {
  console.log(`  ${String(r.n).padStart(3)}회  ${r.last}  ${r.path}`);
}

// 어느 쪽을 아직 안 읽었나. 이게 실제로 손볼 목록이다.
console.log("\n── 아직 안 읽은 쪽 (앞 15개) ──");
const miss = await q(`
  select p.slug from academy.posts p
   where p.published
     and not exists (
       select 1 from academy.crawl_hits h
        where h.vendor = 'openai' and h.path like '%' || p.slug || '%')
   order by p.published_at desc`);
console.log(`  총 ${miss.length}편`);
miss.slice(0, 15).forEach((r) => console.log(`    /blog/${r.slug}`));

// 비교 — 다른 엔진은 같은 기간에 얼마나 읽었나
console.log("\n── 같은 기간 비교 ──");
for (const r of await q(`
  select vendor, count(distinct path)::int pages, count(*)::int hits,
         min(seen_at)::date::text first
    from academy.crawl_hits group by vendor order by pages desc`)) {
  console.log(`  ${r.vendor.padEnd(12)} ${String(r.pages).padStart(3)}쪽 ${String(r.hits).padStart(4)}회  첫방문 ${r.first}`);
}

await pool.end();
