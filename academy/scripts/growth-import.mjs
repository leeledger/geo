/**
 * 고객 저장소의 주간 성장 리포트를 우리 DB 로 (Step 36). 지금은 문서딱(leeledger/doc-tools-kr, 공개) 하나.
 *
 * 그쪽 ops-weekly(월 09:23 KST)가 reports/growth/YYYY-WW.md 를 main 에 커밋하고(A-5 서치콘솔·Cloudflare),
 * 새 안내 페이지 후보를 이슈(label ops:opportunity, A-6)로 갱신한다. 우리는 읽기만 한다 — 새 키·토큰 없음.
 * GITHUB_TOKEN(Actions 기본 토큰)이 있으면 헤더에 싣는다. 공개 저장소 읽기 한도(무인증 60회/시)용이다.
 *
 *   node scripts/growth-import.mjs                    growthReports 가 있는 고객 전부
 *   node scripts/growth-import.mjs --client docttak   한 곳
 *   node scripts/growth-import.mjs --dry              DB 를 안 열고 읽은 것만 찍는다
 *
 * 돌리는 자리: .github/workflows/serp.yml (매일 07:41 KST, continue-on-error)
 */
import fs from "node:fs";
import pg from "pg";
import { 고객고르기, 잠깐DB } from "../clients.mjs";
import { GROWTH_DDL, kstDay, parseGrowthReport, parseOpportunityIssue, weekOfName, weeksToFetch } from "../../web/lib/growth-core.mjs";

const DRY = process.argv.includes("--dry");
const say = (s) => console.log(s);
const 앞 = (s, n = 200) => String(s).replace(/\s+/g, " ").trim().slice(0, n);

/** 토큰은 GitHub 이 확인된 호스트에만 싣는다 — 목록이 준 download_url 이 다른 곳을 가리켜도 토큰이 새지 않게 */
const 토큰호스트 = new Set(["api.github.com", "raw.githubusercontent.com"]);
/** 응답 하나에 20초. 잡(serp, 10분) 안에서 이 단계는 2분 — 느린 GitHub 이 케이스 리포트 커밋을 날리지 않게 */
const 시간한도 = 20_000;

/** GitHub 응답. 2xx 가 아니면 상태와 본문 앞부분을 담아 던진다 */
async function 받기(url, json = true) {
  const 토큰 = process.env.GITHUB_TOKEN && 토큰호스트.has(new URL(url).host) ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const headers = { "User-Agent": "cited-growth-import", ...(json ? { Accept: "application/vnd.github+json" } : {}), ...토큰 };
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(시간한도) });
  const body = await r.text();
  if (!r.ok) {
    const left = r.headers.get("x-ratelimit-remaining");
    throw new Error(`${r.status}${left === "0" ? " (읽기 한도 다 씀)" : ""} ${url} · ${앞(body, 120)}`);
  }
  return json ? JSON.parse(body) : body;
}

async function db() {
  for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  await c.connect();
  return c;
}

/** 한 고객. 돌려주는 것: { ok, summary } — 활동 줄 한 줄이 된다 */
async function 가져오기(c, q) {
  const { repo, dir, opportunityLabel } = c.growthReports;
  const 실패 = [];

  // ── 리포트 목록
  let 목록;
  try {
    목록 = await 받기(`https://api.github.com/repos/${repo}/contents/${dir}`);
  } catch (e) {
    return { ok: false, summary: `리포트 목록 못 읽음 — ${e.message} · 다음 날 다시` };
  }
  const 파일 = (Array.isArray(목록) ? 목록 : []).map((f) => ({ week: weekOfName(f.name), url: f.download_url })).filter((f) => f.week && f.url);
  const 있는주 = DRY ? [] : (await q(`select week from geo.growth_reports where client_id=$1`, [c.id])).map((r) => r.week);
  const 받을주 = weeksToFetch(파일.map((f) => f.week), 있는주);
  say(`${c.name}: 저장소 리포트 ${파일.length}개 · DB ${DRY ? "(dry — 안 읽음)" : `${있는주.length}주`} · 받을 주 ${받을주.join(", ") || "없음"}`);

  const 받은 = [];
  for (const week of 받을주) {
    const f = 파일.find((x) => x.week === week);
    let md;
    try { md = await 받기(f.url, false); } catch (e) { 실패.push(`${week} 못 받음 ${e.message}`); continue; }
    let r;
    try { r = parseGrowthReport(md); } catch (e) { 실패.push(`${week} 안 씀(${e.message}) · 원문 앞: ${앞(md)}`); continue; }
    if (r.week !== week) { 실패.push(`${week} 안 씀(파일 이름과 growth-data 주가 다름: ${r.week})`); continue; }
    for (const x of r.odd) 실패.push(`${week} ${x} — 그 칸만 비우고 씀`);
    const 표 = ["queries7", "queries28", "pages28"].filter((k) => r[k] === null && r.gsc);
    if (표.length) 실패.push(`${week} 표 못 읽음(${표.join(", ")}) — 합계는 씀`);
    say(`  ${week} 생성 ${r.generated ?? "?"} · 서치콘솔 7일 ${r.gsc ? `클릭 ${r.gsc.last7.clicks} · 노출 ${r.gsc.last7.impressions} · 순위 ${r.gsc.last7.position}` : "없음"}`
      + ` · Cloudflare 7일 ${r.cf ? `요청 ${r.cf.last7.requests} · 페이지뷰 ${r.cf.last7.pageViews} · ${r.cf.last7.days}일` : "없음"}`
      + ` · 표 ${[r.queries7, r.queries28, r.pages28].map((x) => (x ? x.length : "null")).join("/")}${r.notes ? ` · 메모 ${앞(r.notes, 80)}` : ""}`);
    if (!DRY) {
      await q(`insert into geo.growth_reports (client_id, week, generated, source_url, gsc, gsc_queries7, gsc_queries28, gsc_pages28, cf, notes)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               on conflict (client_id, week) do update set generated=excluded.generated, source_url=excluded.source_url, gsc=excluded.gsc,
                 gsc_queries7=excluded.gsc_queries7, gsc_queries28=excluded.gsc_queries28, gsc_pages28=excluded.gsc_pages28,
                 cf=excluded.cf, notes=excluded.notes, fetched_at=now()`,
        [c.id, week, r.generated, f.url, JSON.stringify(r.gsc), JSON.stringify(r.queries7), JSON.stringify(r.queries28), JSON.stringify(r.pages28), JSON.stringify(r.cf), r.notes]);
    }
    받은.push(week);
  }

  // ── 새 안내 페이지 후보 이슈 — 매번 최신 것으로 갱신
  let 제안 = "이슈 못 읽음";
  try {
    const issues = (await 받기(`https://api.github.com/repos/${repo}/issues?labels=${encodeURIComponent(opportunityLabel)}&state=open&per_page=20`))
      .filter((i) => !i.pull_request)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    // 행이 있는 주 — 방금 받은 것까지. dry 면 이번에 읽은 주만
    const 주들 = DRY ? 받은 : (await q(`select week from geo.growth_reports where client_id=$1 order by week desc`, [c.id])).map((r) => r.week);
    if (!issues.length) {
      // 그쪽은 후보가 0개면 이슈를 안 만든다(opportunities.mjs). 열린 이슈가 없다는 것을 최신 주에 남긴다
      제안 = "열린 후보 이슈 없음(0건)";
      if (!DRY && 주들[0]) await q(`update geo.growth_reports set opportunity=$3 where client_id=$1 and week=$2`, [c.id, 주들[0], JSON.stringify({ none: true, count: 0 })]);
    } else {
      const o = parseOpportunityIssue(issues[0]);
      // 그 이슈 제목의 주 행에. 제목을 못 읽었거나 그 주 행이 없으면 최신 주에
      const 주 = o.week && 주들.includes(o.week) ? o.week : 주들[0];
      제안 = `후보 이슈 ${o.count ?? "건수 못 읽음"}${o.count != null ? "건" : ""} (${o.week ?? "주 못 읽음"}, 갱신 ${kstDay(o.updatedAt) ?? "날짜 못 읽음"}) ${o.url}`;
      if (o.count == null) 실패.push(`이슈 제목 꼴이 다름: ${앞(issues[0].title, 80)}`);
      if (!DRY && 주) await q(`update geo.growth_reports set opportunity=$3 where client_id=$1 and week=$2`, [c.id, 주, JSON.stringify(o)]);
    }
  } catch (e) {
    실패.push(`후보 이슈 못 읽음 — ${e.message}`);
  }
  say(`  ${제안}`);

  const 앞말 = 파일.length ? `받은 주 ${받은.join(", ") || "없음(다 있음)"}` : "아직 리포트 없음";
  return { ok: !실패.length, summary: `${앞말} · ${제안}${실패.length ? ` · 실패: ${실패.join(" / ")}` : ""}` };
}

// growthReports 는 문서딱 저장소 전용 칸(코드 덩어리)이다 — DB 고객에는 없다
const 고객 = (await 잠깐DB((q) => 고객고르기(process.argv, q))).filter((c) => c.growthReports);
if (!고객.length) { say("성장 리포트를 읽을 고객이 없습니다 (clients.mjs growthReports)"); process.exit(0); }

const client = DRY ? null : await db();
const q = async (s, p = []) => (await client.query(s, p)).rows;
let 다됨 = true;
try {
  if (!DRY) for (const s of GROWTH_DDL) await q(s);
  for (const c of 고객) {
    let r;
    try { r = await 가져오기(c, q); } catch (e) { r = { ok: false, summary: `실패 — ${e.message}` }; }
    say(`${c.name}: ${r.ok ? "정상" : "실패 있음"} · ${r.summary}`);
    if (!r.ok) 다됨 = false;
    if (!DRY) {
      // run_url 에 serp 실행 주소를 넣지 않는다 — wake.mjs 가 그 주소가 이미 있으면 「자동 작업 serp」 줄을 안 남긴다
      await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url) values ($1,'measure',$2,$3,$4,'growth-import')`,
        [c.id, `${c.name} 성장 리포트`, r.ok, r.summary.slice(0, 1000)]);
    }
  }
} finally {
  await client?.end().catch(() => {});
}
if (!다됨) process.exitCode = 1;
