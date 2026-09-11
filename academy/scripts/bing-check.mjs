/**
 * 빙 색인 상태를 본다.
 *
 * GPTBot 이 sitemap 만 가져가고 본문을 안 읽는다. 사이트맵도 robots 도 정상이다.
 * 남는 가설은 「발견 경로가 없다」 — OpenAI 계열은 빙 인덱스에 크게 기댄다.
 * 빙에 안 올라가 있으면 ChatGPT 검색이 이 사이트를 찾을 방법이 없다.
 *
 *   node scripts/bing-check.mjs
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
const q = async (s) => (await pool.query(s)).rows;

console.log("── 엔진별 노출 (최근 측정) ──");
for (const r of await q(`
  select engine,
         count(*) filter (where hit)::int hits,
         count(*)::int total
    from academy.serp_checks
   where day = (select max(day) from academy.serp_checks)
   group by engine order by engine`)) {
  console.log(`  ${r.engine.padEnd(10)} ${r.hits}/${r.total}`);
}

console.log("\n── 빙에서 한 번이라도 잡힌 적 ──");
const ever = await q(`
  select query, min(day)::text as first_day, count(*)::int n
    from academy.serp_checks
   where engine = 'bing' and hit group by query order by min(day)`);
if (!ever.length) console.log("  없음 — 빙 색인에 아직 안 올라갔습니다");
else ever.forEach((r) => console.log(`  ${r.first_day}  ${r.query} (${r.n}회)`));

// 마이크로소프트 크롤러(bingbot)가 실제로 오고는 있나
console.log("\n── bingbot 방문 ──");
const ms = await q(`
  select count(*)::int hits, count(distinct path)::int pages,
         max(seen_at)::date::text last
    from academy.crawl_hits where vendor = 'microsoft'`);
const m = ms[0];
console.log(`  ${m.hits}회 · ${m.pages}쪽 · 마지막 ${m.last ?? "없음"}`);
if (m.pages < 10) {
  // 9.11 에 이 문구만 보고 「빙 웹마스터 등록은 사람 일」이라고 보고했는데,
  // 실제로는 9/5 사이트맵 제출·9/10 크롤 성공(45개 발견) 상태였다. 추측하지 말고 화면을 본다.
  console.log("  → 빙봇 방문이 적습니다. 빙 웹마스터 사이트맵 상태를 먼저 확인하세요:");
  console.log("     cd tools && node bing-webmaster-look.mjs \"https://www.bing.com/webmasters/sitemaps?siteUrl=https%3A%2F%2Frobotncoding.com%2F\"");
  console.log("     제출·크롤 성공인데 색인이 0 이면 기다리는 단계입니다. 사이트맵이 없으면 tools/bing-submit-sitemap.mjs");
}

await pool.end();
