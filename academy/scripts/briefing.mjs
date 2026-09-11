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
 *   4) 고객사        — 받은 곳마다 기준선·재진단·크롤러 기록이 돌고 있어야 한다
 *
 * 09.11 전까지는 학원 표를 고객사 구분 없이 읽었고, 아이로그는 브리핑에 한 줄도 안 나왔다.
 * 고객사를 받아 놓고 아무도 안 보는 상태를 브리핑이 못 잡았다.
 *
 *   node scripts/briefing.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { CLIENTS } from "../clients.mjs";

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
const ENG = { bing: "Bing", naver: "네이버웹", naver_all: "네이버통합" };
const HOME = CLIENTS[0]; // 레퍼런스 학원

line("═".repeat(60));
line(`  브리핑 · ${new Date().toLocaleDateString("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" })}`);
line("═".repeat(60));
line(`\n━━ ${HOME.name} ━━`);

// ── 발행 ─────────────────────────────────────────
const [p] = await q(`
  select count(*) filter (where published)::int pub,
         count(*) filter (where not published)::int draft,
         max(published_at) last
    from academy.posts where client_id = $1`, [HOME.id]);
const since = p.last ? days(p.last) : 999;

line("\n【 글 】");
line(`  공개 ${p.pub}편 · 초안 ${p.draft}편`);
line(`  마지막 발행 ${since}일 전`);
if (since >= 7) todo.push(`[${HOME.name}] 글 발행 — ${since}일째입니다. 주 1편이 목표입니다`);
else line(`  → 이번 주 발행 완료`);
if (p.draft > 0) todo.push(`[${HOME.name}] 초안 ${p.draft}편이 대기 중입니다`);

// ── 색인 ─────────────────────────────────────────
line("\n【 색인 】");
let doneCount = 0, total = 0;
try {
  const done = JSON.parse(fs.readFileSync(path.join(ROOT, "..", "tools", "gsc-done.json"), "utf8"));
  doneCount = done.length;
} catch { /* 아직 없으면 0 */ }
try {
  const xml = await (await fetch(`https://${HOME.domain}/sitemap.xml`)).text();
  total = (xml.match(/<loc>/g) || []).length;
} catch { /* 못 읽으면 넘어간다 */ }
line(`  구글 ${doneCount}/${total}건 접수`);
if (total && doneCount < total) {
  todo.push(`[${HOME.name}] 구글 색인 요청 — ${total - doneCount}건 남음 (하루 한도 약 10건)`);
}

// ── 크롤러 ───────────────────────────────────────
line("\n【 크롤러 】");
const cov = await q(`select * from academy.coverage_by_vendor where client_id = $1 order by pages_crawled desc`, [HOME.id]);
const y = await q(`
  select vendor, count(*)::int n from academy.crawl_hits
   where client_id = $1 and seen_at > now() - interval '24 hours' group by vendor order by n desc`, [HOME.id]);
for (const c of cov.slice(0, 5)) {
  line(`  ${c.vendor.padEnd(11)} ${String(c.pages_crawled).padStart(3)}/${c.pages_total}쪽  ${String(c.coverage_pct).padStart(5)}%`);
}
line(`  최근 24시간: ${y.length ? y.map((r) => `${r.vendor} ${r.n}`).join(" · ") : "없음"}`);
if (!y.length) todo.push(`[${HOME.name}] 크롤러가 하루 동안 안 왔습니다 — 사이트 상태를 확인하세요`);

/** 한 고객사의 최근 노출 요약. 경쟁과 브랜드를 갈라 센다 — 뭉치면 좋아 보이는 숫자가 된다. */
async function serpSummary(c) {
  const serp = await q(`
    select engine, kind, query, hit, rank from academy.serp_checks
     where client_id = $1 and day = (select max(day) from academy.serp_checks where client_id = $1)
     order by engine, hit desc`, [c.id]);
  const [last] = await q(`select max(day) d from academy.serp_checks where client_id = $1`, [c.id]);
  const age = last?.d ? days(last.d) : null;
  const rivalQ = new Map(), brandQ = new Map();
  for (const r of serp) {
    const m = r.kind === "경쟁" ? rivalQ : r.kind === "브랜드" ? brandQ : null;
    if (m) m.set(r.query, (m.get(r.query) ?? false) || r.hit);
  }
  return {
    age, serp,
    rivalWon: [...rivalQ.values()].filter(Boolean).length, rivalTotal: rivalQ.size,
    brandLost: [...brandQ.entries()].filter(([, h]) => !h).map(([k]) => k), brandTotal: brandQ.size,
  };
}

// ── 노출 ─────────────────────────────────────────
line("\n【 노출 】");
const hs = await serpSummary(HOME);
line(`  마지막 측정 ${hs.age ?? "—"}일 전`);
line(`  경쟁 검색어  ${hs.rivalWon}/${hs.rivalTotal}   ← 이겨서 얻는 자리`);
for (const h of hs.serp.filter((r) => r.kind === "경쟁" && r.hit)) {
  line(`    ★ ${(ENG[h.engine] ?? h.engine).padEnd(6)} ${h.rank ? h.rank + "위" : "노출"} — ${h.query}`);
}
if (hs.brandTotal) {
  line(`  브랜드 검색  ${hs.brandTotal - hs.brandLost.length}/${hs.brandTotal}   (방어 확인. 성과 아님)`);
  if (hs.brandLost.length) line(`    ⚠ 우리 이름인데 안 나옴: ${hs.brandLost.join(" · ")}`);
}
if (hs.age === null || hs.age >= 1) todo.push(`[${HOME.name}] 노출 측정 — check-index.mjs`);

const place = await q(`
  select query, rank from academy.place_checks
   where client_id = $1 and day = (select max(day) from academy.place_checks where client_id = $1) and rank is not null
   order by rank`, [HOME.id]);
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
  const used = new Set((await q(`select slug from academy.posts where client_id = $1`, [HOME.id])).map((r) => r.slug));
  const left = bank.topics.filter((t) => !t.slug || !used.has(t.slug));
  line(`  남은 주제 ${left.length}개`);
  left.slice(0, 3).forEach((t) => line(`    · ${t.title}`));
  if (!left.length) todo.push("주제 은행이 비었습니다 — topics.json 에 채워야 합니다");
} catch (e) {
  line("  주제 은행을 못 읽었습니다");
}

// ── 다른 고객사 ──────────────────────────────────
// 받은 곳마다 「기준선이 있나 · 다시 쟀나 · 크롤러 기록이 도나 · 손댄 날이 남나」를 본다.
for (const c of CLIENTS.slice(1)) {
  line(`\n━━ ${c.name} · ${c.domain} ━━`);

  const [cl] = await q(`
    select baseline_score, current_score, current_on::text, started_on::date::text started
      from geo.clients where id = $1`, [c.id]).catch(() => [{}]);
  const cur = cl?.current_score, base = cl?.baseline_score;
  const scanAge = cl?.current_on ? days(cl.current_on) : null;
  line(`  진단  착수 ${base ?? "—"}점 → 지금 ${cur ?? "—"}점${scanAge !== null ? ` (${scanAge}일 전)` : ""}`);
  if (scanAge === null || scanAge >= 3) todo.push(`[${c.name}] 재진단 — rescan.mjs --client ${c.slug}`);

  const s = await serpSummary(c);
  if (s.age === null) {
    line("  노출  한 번도 안 쟀습니다");
    todo.push(`[${c.name}] 노출 기준선 — check-index.mjs --client ${c.slug}`);
  } else {
    line(`  노출  경쟁 ${s.rivalWon}/${s.rivalTotal} · 브랜드 ${s.brandTotal - s.brandLost.length}/${s.brandTotal} (${s.age}일 전)`);
    if (s.brandLost.length) {
      line(`    ⚠ 이름으로 찾아도 안 나옴: ${s.brandLost.join(" · ")}`);
      todo.push(`[${c.name}] 브랜드 방어 — 「${s.brandLost[0]}」에서 안 나옵니다`);
    }
    if (s.age >= 1) todo.push(`[${c.name}] 노출 측정 — check-index.mjs --client ${c.slug}`);
  }

  const [ch] = await q(`
    select count(*)::int n, count(*) filter (where seen_at > now() - interval '24 hours')::int d
      from academy.crawl_hits where client_id = $1`, [c.id]);
  if (ch.n === 0) {
    line("  크롤러 기록 장치 없음");
    todo.push(`[${c.name}] 크롤러 기록 장치 — deliverables/${c.slug} 전달 파일 반영 확인`);
  } else {
    line(`  크롤러 누적 ${ch.n}회 · 24시간 ${ch.d}회`);
  }

  const [iv] = await q(`
    select count(*)::int n, max(day)::text last from academy.interventions where client_id = $1`, [c.id])
    .catch(() => [{ n: 0 }]);
  line(`  손댄 기록 ${iv.n}건${iv.last ? ` · 마지막 ${iv.last}` : ""}`);
}

// ── 오늘 할 일 ───────────────────────────────────
line("\n" + "─".repeat(60));
line("  오늘 할 일");
line("─".repeat(60));
if (!todo.length) line("  밀린 게 없습니다.");
else todo.forEach((t, i) => line(`  ${i + 1}. ${t}`));
line();

await pool.end();
