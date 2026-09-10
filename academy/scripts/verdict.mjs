/**
 * 레퍼런스가 증명됐는가 — 도메인 구매 판단에 쓸 데이터를 한 장으로 모은다.
 *
 * 합의한 순서: 레퍼런스 증명 → 도메인 → 영업.
 * 판정 기준은 숫자가 아니라 「첫 계약」이었다. 그 앞 조건이 레퍼런스 증명이다.
 *
 * 중요한 건 「무엇이 증명됐나」가 아니라 「무엇이 아직 안 됐나」다.
 * 좋은 것만 세면 그게 우리가 남에게 하지 말라는 짓이다.
 *
 *   node scripts/verdict.mjs
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
const has = async (t) =>
  (await q(`select to_regclass('academy.${t}') r`))[0].r !== null;

console.log("════════════════════════════════════════════════");
console.log("  레퍼런스가 증명됐는가");
console.log("════════════════════════════════════════════════");

// ── 1. 이 사업이 파는 것: AI 답변에 불리는가
console.log("\n【 1. AI 답변에 불리는가 】 ← 이 사업이 파는 것");
let cited = null;
for (const t of ["ai_citations", "citations", "probe_runs", "ai_checks"]) {
  if (await has(t)) { cited = t; break; }
}
if (!cited) {
  console.log("  측정한 적 없음 — 표 자체가 없습니다");
} else {
  const [r] = await q(`select count(*)::int n from academy.${cited}`);
  console.log(`  ${cited}: ${r.n}건`);
}

// ── 2. 읽히는가 (기술 레이어)
console.log("\n【 2. AI 가 읽어 가는가 】 기술 레이어");
for (const r of await q(`
  select vendor, pages_crawled::int p, pages_total::int t, coverage_pct::float c
    from academy.coverage_by_vendor order by coverage_pct desc`)) {
  const bar = "█".repeat(Math.round(r.c / 10)).padEnd(10, "·");
  console.log(`  ${r.vendor.padEnd(11)} ${bar} ${r.c.toFixed(1)}%  (${r.p}/${r.t}쪽)`);
}

// ── 3. 검색에 나오는가
console.log("\n【 3. 검색에 나오는가 】");
const day = (await q(`select max(day)::text d from academy.serp_checks`))[0].d;
for (const r of await q(`
  select engine, query, rank, hit from academy.serp_checks
   where day = '${day}' order by engine, hit desc, rank`)) {
  console.log(`  ${r.engine.padEnd(7)} ${r.hit ? String(r.rank).padStart(2) + "위" : " 미노출"}  ${r.query}`);
}
if (await has("place_checks")) {
  console.log("  ── 플레이스 ──");
  for (const r of await q(`
    select query, rank::int from academy.place_checks
     where day = (select max(day) from academy.place_checks) and rank is not null
     order by rank`)) {
    console.log(`  플레이스  ${String(r.rank).padStart(2)}위  ${r.query}`);
  }
}

// ── 4. 매출로 이어지는가 ← 검증의 끝
console.log("\n【 4. 매출로 이어지는가 】 ← 검증의 마지막 고리");
if (await has("inquiries")) {
  const [r] = await q(`select count(*)::int n from academy.inquiries`);
  console.log(r.n ? `  문의 ${r.n}건` : "  문의 기록 0건 — 노출이 문의가 되는지 전혀 모릅니다");
} else {
  console.log("  표 없음");
}

// ── 5. 꾸준한가
console.log("\n【 5. 꾸준한가 】");
const [p] = await q(`
  select count(*) filter (where published)::int pub,
         max(published_at)::date::text last,
         min(published_at)::date::text first
    from academy.posts`);
console.log(`  공개 ${p.pub}편 · ${p.first} ~ ${p.last}`);
const [c] = await q(`
  select min(seen_at)::date::text first, count(*)::int n
    from academy.crawl_hits`);
console.log(`  크롤러 기록 ${c.n}회 · ${c.first} 부터`);
const dayn = Math.floor((Date.now() - Date.parse(c.first)) / 86400000) + 1;
console.log(`  측정 ${dayn}일차`);

if (await has("interventions")) {
  console.log("\n【 손 댄 날 】");
  for (const r of await q(`select day::text, what from academy.interventions order by day`)) {
    console.log(`  ${r.day}  ${r.what}`);
  }
}

await pool.end();
