/**
 * 우리가 재고 있는 검색어가 「이겨서 얻은 자리」인가 「원래 우리 자리」인가.
 *
 * 「석촌동 로봇 코딩학원」에서 1위인 건 성과가 아니다. 학원 이름이 로봇&코딩이고
 * 석촌동에 있으니, 그 조합으로 검색하면 나오는 게 당연하다.
 * 그런 걸 성과로 세면 좋아 보이는 숫자를 만드는 것이고, 그건 우리가 남에게
 * 하지 말라고 하는 짓이다.
 *
 * 기준
 *   브랜드   학원 이름 조각이 들어감. 이기고 말고 할 게 없다
 *   색인     site: 검색. 올라갔는지 보는 것이지 순위가 아니다
 *   경쟁     이름 없이 「지역 + 업종」. 학부모가 실제로 치는 말. 이게 진짜다
 *
 *   node scripts/query-audit.mjs
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

/** 학원 이름 조각. 하나라도 들어가면 브랜드 검색이다. */
const BRAND = ["로봇앤코딩", "로봇&코딩", "로봇 코딩", "robotncoding", "로봇코딩"];

function grade(query) {
  if (/^site:/i.test(query)) return "색인";
  if (BRAND.some((b) => query.replace(/\s+/g, "").includes(b.replace(/\s+/g, "")))) return "브랜드";
  return "경쟁";
}

const MARK = { 색인: "—", 브랜드: "△", 경쟁: "★" };

console.log("════════════════════════════════════════════════════");
console.log("  재고 있는 검색어 — 이긴 자리인가, 원래 자리인가");
console.log("════════════════════════════════════════════════════");
console.log("  ★ 경쟁  이름 없이 지역+업종. 이게 진짜 성과다");
console.log("  △ 브랜드 이름이 들어감. 나오는 게 당연하다");
console.log("  — 색인  올라갔는지 보는 것. 순위가 아니다\n");

for (const [table, label] of [["serp_checks", "웹 검색"], ["place_checks", "플레이스"]]) {
  const has = (await q(`select to_regclass('academy.${table}') r`))[0].r;
  if (!has) continue;

  const rows = await q(`
    select query, ${table === "serp_checks" ? "engine" : "null::text as engine"},
           rank, ${table === "serp_checks" ? "hit" : "(rank is not null) as hit"}
      from academy.${table}
     where day = (select max(day) from academy.${table})
     order by query`);

  console.log(`── ${label} ──`);
  const tally = { 경쟁: [0, 0], 브랜드: [0, 0], 색인: [0, 0] };
  for (const r of rows) {
    const g = grade(r.query);
    tally[g][1]++;
    if (r.hit) tally[g][0]++;
    const where = r.hit ? `${r.rank}위` : "미노출";
    const eng = r.engine ? `${r.engine.padEnd(7)}` : "       ";
    console.log(`  ${MARK[g]} ${eng} ${r.query.slice(0, 26).padEnd(28)} ${where}`);
  }
  console.log();
  for (const g of ["경쟁", "브랜드", "색인"]) {
    const [hit, all] = tally[g];
    if (all) console.log(`     ${MARK[g]} ${g}  ${hit}/${all}`);
  }
  console.log();
}

// 결론 — 경쟁 검색어만 따로 센다. 이것만이 영업에서 쓸 수 있는 숫자다.
const serp = await q(`
  select query, hit from academy.serp_checks
   where day = (select max(day) from academy.serp_checks)`);
const place = await q(`
  select query, rank from academy.place_checks
   where day = (select max(day) from academy.place_checks)`);

const cs = serp.filter((r) => grade(r.query) === "경쟁");
const cp = place.filter((r) => grade(r.query) === "경쟁");

console.log("────────────────────────────────────────────────────");
console.log("  영업에서 쓸 수 있는 숫자");
console.log("────────────────────────────────────────────────────");
console.log(`  웹 검색 경쟁 검색어   ${cs.filter((r) => r.hit).length}/${cs.length}`);
console.log(`  플레이스 경쟁 검색어  ${cp.filter((r) => r.rank).length}/${cp.length}`);
console.log();
console.log("  브랜드 검색 1위는 여기 안 넣는다. 이겨서 얻은 자리가 아니다.");

await pool.end();
