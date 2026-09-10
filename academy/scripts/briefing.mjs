/**
 * 오늘의 브리핑 — 상태를 읽고 무엇이 밀렸는지 말한다.
 *
 * 세션을 열 때마다 처음부터 파악하면 시간이 다 간다.
 * 이 스크립트가 DB 와 파일을 훑어서 "오늘 뭘 해야 하는가"를 먼저 내놓는다.
 *
 * 판단 기준은 목표에서 나온다.
 *   1) 레퍼런스 완성 — 학원이 증거가 되어야 사이티드를 판다
 *   2) 꾸준한 발행   — 주 1편. 끊기면 크롤러도 뜸해진다
 *   3) 색인 확보     — 구글은 하루 한도가 있어 며칠에 걸쳐 밀어야 한다
 *
 *   node scripts/briefing.mjs
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
const q = async (s, p = []) => (await pool.query(s, p)).rows;

const ROOT = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\//, ""));
const days = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
const todo = [];
const line = (s = "") => console.log(s);

line("═".repeat(60));
line(`  브리핑 · ${new Date().toLocaleDateString("ko-KR", { dateStyle: "long" })}`);
line("═".repeat(60));

// ── 발행 ─────────────────────────────────────────
const [p] = await q(`
  select count(*) filter (where published)::int pub,
         count(*) filter (where not published)::int draft,
         max(published_at) last
    from academy.posts`);
const since = p.last ? days(p.last) : 999;

line("\n【 글 】");
line(`  공개 ${p.pub}편 · 초안 ${p.draft}편`);
line(`  마지막 발행 ${since}일 전`);
if (since >= 7) todo.push(`글 발행 — ${since}일째입니다. 주 1편이 목표입니다`);
else line(`  → 이번 주 발행 완료`);
if (p.draft > 0) todo.push(`초안 ${p.draft}편이 대기 중입니다`);

// ── 색인 ─────────────────────────────────────────
line("\n【 색인 】");
let doneCount = 0, total = 0;
try {
  const done = JSON.parse(fs.readFileSync(path.join(ROOT, "..", "tools", "gsc-done.json"), "utf8"));
  doneCount = done.length;
} catch { /* 아직 없으면 0 */ }
try {
  const xml = await (await fetch("https://robotncoding.com/sitemap.xml")).text();
  total = (xml.match(/<loc>/g) || []).length;
} catch { /* 못 읽으면 넘어간다 */ }
line(`  구글 ${doneCount}/${total}건 접수`);
if (total && doneCount < total) {
  todo.push(`구글 색인 요청 — ${total - doneCount}건 남음 (하루 한도 약 10건)`);
}

// ── 크롤러 ───────────────────────────────────────
line("\n【 크롤러 】");
const cov = await q(`select * from academy.coverage_by_vendor order by pages_crawled desc`);
const y = await q(`
  select vendor, count(*)::int n from academy.crawl_hits
   where seen_at > now() - interval '24 hours' group by vendor order by n desc`);
for (const c of cov.slice(0, 5)) {
  line(`  ${c.vendor.padEnd(11)} ${String(c.pages_crawled).padStart(3)}/${c.pages_total}쪽  ${String(c.coverage_pct).padStart(5)}%`);
}
line(`  최근 24시간: ${y.length ? y.map((r) => `${r.vendor} ${r.n}`).join(" · ") : "없음"}`);
if (!y.length) todo.push("크롤러가 하루 동안 안 왔습니다 — 사이트 상태를 확인하세요");

// ── 노출 ─────────────────────────────────────────
line("\n【 노출 】");
const serp = await q(`
  select engine, kind, query, hit, rank from academy.serp_checks
   where day = (select max(day) from academy.serp_checks)
   order by engine, hit desc`);
const lastSerp = await q(`select max(day) d from academy.serp_checks`);
const serpAge = lastSerp[0]?.d ? days(lastSerp[0].d) : 999;
const hits = serp.filter((r) => r.hit);
// 경쟁 검색어와 브랜드 검색어를 갈라 센다.
// 뭉뚱그리면 「노출 2/10」이 좋아 보이는데, 그 둘이 학원 이름이 들어간
// 검색이면 이긴 게 아니다. 영업에서 쓸 수 있는 건 경쟁 쪽 숫자뿐이다.
const rival = serp.filter((r) => r.kind === "경쟁");
const brand = serp.filter((r) => r.kind === "브랜드");
const rHit = rival.filter((r) => r.hit);
const ENG = { bing: "Bing", naver: "네이버웹", naver_all: "네이버통합" };
const bHit = brand.filter((r) => r.hit);

line(`  마지막 측정 ${serpAge}일 전`);
line(`  경쟁 검색어  ${rHit.length}/${rival.length}   ← 이겨서 얻는 자리`);
for (const h of rHit) line(`    ★ ${(ENG[h.engine] ?? h.engine).padEnd(6)} ${h.rank ? h.rank + "위" : "노출"} — ${h.query}`);
if (brand.length) {
  line(`  브랜드 검색  ${bHit.length}/${brand.length}   (방어 확인. 성과 아님)`);
  const lost = brand.filter((r) => !r.hit).map((r) => r.query);
  if (lost.length) line(`    ⚠ 우리 이름인데 안 나옴: ${[...new Set(lost)].join(" · ")}`);
}
if (serpAge >= 1) todo.push("노출 측정 — check-index.mjs");

const place = await q(`
  select query, rank from academy.place_checks
   where day = (select max(day) from academy.place_checks) and rank is not null
   order by rank`);
if (place.length) {
  const isBrand = (x) => /로봇앤코딩|로봇&코딩|로봇코딩/.test(x.replace(/\s+/g, ""));
  const pr = place.filter((r) => !isBrand(r.query));
  const pb = place.filter((r) => isBrand(r.query));
  if (pr.length) line(`  플레이스 경쟁: ${pr.map((r) => `${r.query} ${r.rank}위`).join(" · ")}`);
  if (pb.length) line(`  플레이스 브랜드: ${pb.map((r) => `${r.query} ${r.rank}위`).join(" · ")} (성과 아님)`);
}

// ── 문의 ─────────────────────────────────────────
line("\n【 문의 】");
try {
  const [im] = await q(`select * from academy.inquiry_summary limit 1`);
  const recent = await q(`
    select day::text d, source, said from academy.inquiries
     where day > current_date - 7 order by day desc limit 5`);
  if (!im || im.total === 0) {
    line("  이번 달 0건");
    todo.push("문의 기록이 비어 있습니다 — 상담 때 한 줄씩. /admin/inquiry");
  } else {
    line(`  이번 달 ${im.total}건 · 검색·AI ${im.from_search}건 · 등록 ${im.enrolled}명`);
    for (const r of recent) line(`    ${r.d} [${r.source}] ${(r.said || "").slice(0, 34)}`);
    if (im.from_ai > 0) line(`  → AI 보고 온 사람 ${im.from_ai}명. 이게 이 사업이 되는지의 증거입니다`);
  }
} catch {
  line("  문의 표가 아직 없습니다 (setup-inquiries.mjs)");
}

// ── 다음 주제 ────────────────────────────────────
line("\n【 다음 주제 】");
try {
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "topics.json"), "utf8"));
  const used = new Set((await q(`select slug from academy.posts`)).map((r) => r.slug));
  const left = bank.topics.filter((t) => !t.slug || !used.has(t.slug));
  line(`  남은 주제 ${left.length}개`);
  left.slice(0, 3).forEach((t) => line(`    · ${t.title}`));
  if (!left.length) todo.push("주제 은행이 비었습니다 — topics.json 에 채워야 합니다");
} catch (e) {
  line("  주제 은행을 못 읽었습니다");
}

// ── 오늘 할 일 ───────────────────────────────────
line("\n" + "─".repeat(60));
line("  오늘 할 일");
line("─".repeat(60));
if (!todo.length) line("  밀린 게 없습니다.");
else todo.forEach((t, i) => line(`  ${i + 1}. ${t}`));
line();

await pool.end();
