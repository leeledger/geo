/**
 * 상태 점검 — 문제가 있으면 종료코드 1 을 낸다.
 *
 * GitHub Actions 에서 돌린다. 실패하면 저장소 주인에게 메일이 간다.
 * 내 세션이 죽어 있어도 이건 계속 돈다. 사람이 없는 시간에 이것만 남는다.
 *
 * 알림을 위해 일부러 실패시키는 구조라, 잡는 것은 "진짜 문제"만이어야 한다.
 * 사소한 걸로 실패시키면 메일에 무뎌지고, 무뎌지면 진짜 문제도 놓친다.
 *
 *   node scripts/health.mjs
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const bad = [];
const ok = (s) => console.log(`  OK   ${s}`);
const fail = (s) => { console.log(`  ✗    ${s}`); bad.push(s); };

/** 열려야 하는 주소들. 하나라도 막히면 색인이 끊긴다. */
const URLS = [
  ["학원 홈", "https://robotncoding.com/"],
  ["학원 사이트맵", "https://robotncoding.com/sitemap.xml"],
  ["학원 llms.txt", "https://robotncoding.com/llms.txt"],
  ["사이티드 홈", "https://geo-rose-nine.vercel.app/"],
  ["사이티드 사이트맵", "https://geo-rose-nine.vercel.app/sitemap.xml"],
  ["케이스 리포트", "https://geo-rose-nine.vercel.app/case/robotncoding.html"],
];

console.log("── 주소 ──");
for (const [name, url] of URLS) {
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (r.ok) ok(`${name} ${r.status}`);
    else fail(`${name} ${r.status}`);
  } catch (e) {
    fail(`${name} — ${e.message.slice(0, 40)}`);
  }
}

/** robots.txt 가 전부 막고 있으면 사고다. 한 번 그렇게 나가 있었다. */
console.log("\n── robots ──");
for (const [name, base] of [["학원", "https://robotncoding.com"], ["사이티드", "https://geo-rose-nine.vercel.app"]]) {
  try {
    const t = await (await fetch(`${base}/robots.txt`)).text();
    const blocksAll = /^\s*User-Agent:\s*\*\s*$[\s\S]{0,80}?^\s*Disallow:\s*\/\s*$/im.test(t);
    if (blocksAll) fail(`${name} robots.txt 가 전부 막고 있습니다`);
    else ok(`${name} robots.txt 정상`);
  } catch (e) {
    fail(`${name} robots.txt — ${e.message.slice(0, 40)}`);
  }
}

// ── 크롤러가 오고 있는가
console.log("\n── 크롤러 ──");
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

try {
  const { rows } = await pool.query(
    `select count(*)::int n from academy.crawl_hits where seen_at > now() - interval '36 hours'`,
  );
  const n = rows[0].n;
  // 36시간 동안 한 번도 안 왔으면 뭔가 잘못된 것이다.
  if (n === 0) fail("36시간 동안 크롤러가 한 번도 안 왔습니다");
  else ok(`36시간 크롤러 ${n}회`);

  const { rows: p } = await pool.query(
    `select max(published_at) last from academy.posts where published`,
  );
  const days = p[0].last ? Math.floor((Date.now() - new Date(p[0].last)) / 86400000) : 999;
  // 발행이 끊기면 크롤러도 뜸해진다. 열흘은 넘기지 않는다.
  if (days > 10) fail(`마지막 발행이 ${days}일 전입니다`);
  else ok(`마지막 발행 ${days}일 전`);
} catch (e) {
  fail(`DB — ${e.message.slice(0, 50)}`);
} finally {
  await pool.end();
}

console.log("\n" + "─".repeat(46));
if (bad.length) {
  console.log(`  문제 ${bad.length}건`);
  bad.forEach((b) => console.log(`    · ${b}`));
  process.exit(1);
}
console.log("  이상 없음");
