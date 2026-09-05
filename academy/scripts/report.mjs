/**
 * 주간 스냅샷 — 케이스 스터디의 원장(原帳).
 *
 * 이 사업에서 파는 것은 "사이트를 잘 만들어 드립니다"가 아니라
 * "움직였는지 숫자로 보여 드립니다"다. 그러려면 같은 방식으로 반복해서 재고
 * 그 기록이 남아 있어야 한다. 이 스크립트가 그 기록을 만든다.
 *
 *   node scripts/report.mjs            결과 출력
 *   node scripts/report.mjs --save     data/history.jsonl 에 한 줄 추가
 */
import fs from "node:fs";
import path from "node:path";
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

const pad = (s, n) => String(s).padEnd(n);
const line = (c = "─") => console.log(c.repeat(62));

const posts = (await pool.query(
  `select count(*)::int n, sum(length(body))::int chars from academy.published_posts`
)).rows[0];

const crawl = (await pool.query(`select * from academy.crawl_summary`)).rows;

const recent = (await pool.query(
  `select count(*)::int n from academy.crawl_hits where seen_at > now() - interval '7 days'`
)).rows[0];

const byPath = (await pool.query(
  `select path, count(*)::int n from academy.crawl_hits
   group by path order by n desc limit 8`
)).rows;

console.log();
line("━");
console.log("  로봇&코딩학원 · AI 노출 스냅샷");
console.log("  " + new Date().toLocaleString("ko-KR"));
line("━");

console.log("\n── 콘텐츠 ────────────────────────────────────────────────");
console.log(`  공개 글 ${posts.n}편 · 본문 합계 ${Number(posts.chars).toLocaleString()}자`);

console.log("\n── AI 크롤러 방문 ────────────────────────────────────────");
if (!crawl.length) {
  console.log("  아직 방문 없음.");
  console.log("  색인 요청 직후에는 정상이다. Googlebot 이 먼저 오고,");
  console.log("  AI 크롤러는 보통 그 뒤 며칠~몇 주 안에 따라온다.");
} else {
  console.log(`  ${pad("크롤러", 20)}${pad("소속", 13)}${pad("방문", 7)}${pad("페이지", 8)}최근`);
  line();
  for (const r of crawl) {
    const last = new Date(r.last_seen).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
    console.log(`  ${pad(r.bot, 20)}${pad(r.vendor, 13)}${pad(r.hits, 7)}${pad(r.pages, 8)}${last}`);
  }
  line();
  console.log(`  최근 7일 ${recent.n}회`);

  if (byPath.length) {
    console.log("\n  많이 읽힌 경로");
    for (const p of byPath) console.log(`    ${pad(p.n, 6)}${p.path}`);
  }
}

const vendors = new Set(crawl.map((r) => r.vendor));
console.log("\n── 판정 ──────────────────────────────────────────────────");
if (!crawl.length) {
  console.log("  0단계 — 아직 아무도 안 왔다. 색인 요청과 외부 링크가 먼저다.");
} else if (!vendors.has("google") && !vendors.has("microsoft")) {
  console.log("  1단계 — AI 크롤러는 왔지만 검색 색인이 아직이다.");
} else if (vendors.size <= 2) {
  console.log("  2단계 — 검색 색인이 잡혔다. AI 크롤러 유입을 기다리는 구간이다.");
} else {
  console.log("  3단계 — 여러 엔진이 읽고 있다. 이제 인용되는지를 재야 한다.");
  console.log("  워크벤치로 엔진별 언급률을 측정할 시점이다.");
}
console.log();

if (process.argv.includes("--save")) {
  const row = {
    at: new Date().toISOString(),
    posts: posts.n,
    chars: Number(posts.chars),
    crawl_total: crawl.reduce((s, r) => s + r.hits, 0),
    crawl_7d: recent.n,
    vendors: [...vendors],
    bots: crawl.map((r) => ({ bot: r.bot, hits: r.hits, last: r.last_seen })),
  };
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "history.jsonl"), JSON.stringify(row) + "\n");
  console.log("  data/history.jsonl 에 기록했습니다.\n");
}

await pool.end();
