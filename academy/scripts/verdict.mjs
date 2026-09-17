/** 로봇&코딩학원 자사 실증 사례가 어디까지 증명됐는지 한 장으로 판정한다. */
import fs from "node:fs";
import { Pool } from "pg";
import { bySlug } from "../clients.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const ci = process.argv.indexOf("--client");
const selected = bySlug(ci >= 0 ? process.argv[ci + 1] : "robotncoding");
if (!selected) throw new Error(`고객사 없음: ${process.argv[ci + 1]}`);
const CLIENT_ID = selected.id;
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = async (s, p = []) => (await pool.query(s, p)).rows;
const has = async (t) => (await q(`select to_regclass('academy.${t}') r`))[0].r !== null;

console.log("════════════════════════════════════════════════");
console.log(`  ${selected.name} 서비스 결과 판정`);
console.log(`  ${selected.domain} · 고객사별 기록만 집계합니다`);
console.log("════════════════════════════════════════════════");

console.log("\n【 1. AI 답변에 인용되는가 】 ← 판매하는 결과");
if (!(await has("ai_measurements"))) {
  console.log("  측정 기록 없음");
} else {
  const rounds = await q(`
    select measured_on::text as measured_day, collection_method, engine,
           count(*)::int n, count(*) filter (where cited)::int cited,
           count(*) filter (where mentioned and not cited)::int mentioned
      from academy.ai_measurements where client_id = $1
     group by measured_on, collection_method, engine order by measured_on`, [CLIENT_ID]);
  if (!rounds.length) console.log("  측정 기록 없음");
  for (const r of rounds) {
    console.log(`  ${r.measured_day} · ${r.engine} · ${r.collection_method}`);
    console.log(`    사이트 인용 ${r.cited}/${r.n} · 출처 없이 이름만 언급 ${r.mentioned}/${r.n}`);
  }
  const comparable = new Map();
  for (const r of rounds) {
    const key = `${r.collection_method}|${r.engine}`;
    comparable.set(key, (comparable.get(key) ?? 0) + 1);
  }
  if (![...comparable.values()].some((n) => n >= 2)) {
    console.log("  판정: 같은 엔진·방법의 재측정 없음 — 서로 다른 회차를 합쳐 개선률로 말할 수 없음");
  }
}

console.log("\n【 2. AI·검색 크롤러가 읽는가 】 ← 기술 선행지표");
for (const r of await q(`
  select vendor, pages_crawled::int p, pages_total::int t, coverage_pct::float c
    from academy.coverage_by_vendor where client_id = $1 order by coverage_pct desc`, [CLIENT_ID])) {
  const bar = "█".repeat(Math.round(r.c / 10)).padEnd(10, "·");
  console.log(`  ${r.vendor.padEnd(11)} ${bar} ${r.c.toFixed(1)}%  (${r.p}/${r.t}쪽)`);
}

console.log("\n【 3. 검색·플레이스에 나오는가 】 ← 발견 가능성");
const day = (await q(`select max(day)::text d from academy.serp_checks where client_id=$1`, [CLIENT_ID]))[0]?.d;
if (day) {
  for (const r of await q(`
    select query, kind, bool_or(hit) hit, min(rank) filter (where hit) rank,
           string_agg(distinct engine, ', ') engines
      from academy.serp_checks where client_id=$1 and day=$2
     group by query, kind order by kind, query`, [CLIENT_ID, day])) {
    console.log(`  ${r.hit ? (r.rank ? `${r.rank}위` : "노출") : "미노출"}  [${r.kind}] ${r.query} · ${r.engines}`);
  }
}
if (await has("place_checks")) {
  for (const r of await q(`
    select query, rank::int from academy.place_checks
     where client_id=$1 and day=(select max(day) from academy.place_checks where client_id=$1)
       and rank is not null order by rank`, [CLIENT_ID])) {
    console.log(`  플레이스 ${r.rank}위  ${r.query}`);
  }
}

console.log("\n【 4. 문의·등록으로 이어지는가 】 ← 사업 검증의 마지막 고리");
if (await has("inquiries")) {
  const [r] = await q(`
    select count(*)::int n,
           count(*) filter (where source in ('네이버검색','구글검색','AI'))::int search,
           count(*) filter (where source='AI')::int ai,
           count(*) filter (where enrolled)::int enrolled,
           count(*) filter (where enrolled is null)::int unknown
      from academy.inquiries where client_id=$1`, [CLIENT_ID]);
  console.log(`  문의 ${r.n}건 · 검색/AI 확인 ${r.search}건 · AI 직접 확인 ${r.ai}건 · 등록 ${r.enrolled}명`);
  if (r.unknown) console.log(`  등록 여부 미입력 ${r.unknown}건 — 결과를 확인하기 전에는 전환을 주장할 수 없음`);
} else console.log("  측정 표 없음");

console.log("\n【 5. 운영이 이어지는가 】");
const [p] = await q(`
  select count(*) filter (where published)::int pub,
         max(published_at)::date::text last, min(published_at)::date::text first
    from academy.posts where client_id=$1`, [CLIENT_ID]);
console.log(`  공개 ${p.pub}편 · ${p.first} ~ ${p.last}`);
const [c] = await q(`
  select min(seen_at)::date::text first, count(*)::int n
    from academy.crawl_hits where client_id=$1`, [CLIENT_ID]);
console.log(`  크롤러 기록 ${c.n}회 · ${c.first}부터`);
if (await has("interventions")) {
  for (const r of await q(`select day::text, what from academy.interventions where client_id=$1 order by day`, [CLIENT_ID])) {
    console.log(`  ${r.day}  ${r.what}`);
  }
}

console.log("\n【 현재 판정 】");
console.log("  기술 접근성과 검색 노출은 진척이 있음.");
console.log("  AI 인용 개선과 문의·등록 기여는 아직 증명되지 않음.");
console.log("  다음 증거: 같은 조건 AI 재측정 + 모든 문의의 유입·등록 결과 기록.");
await pool.end();
