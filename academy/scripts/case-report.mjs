/**
 * 케이스 스터디 리포트 생성.
 *
 * 이 사업에서 파는 것은 "사이트를 잘 만들어 드립니다"가 아니라
 * "움직였는지 숫자로 보여 드립니다"다. 그 증거를 매번 손으로 정리하면
 * 고객사가 늘어나는 순간 무너진다. 그래서 DB 에서 뽑아 페이지를 만든다.
 *
 * 정직하게 쓴다는 원칙:
 *  - 아직 모르는 것은 "모른다"고 적는다. 인용률은 아직 안 쟀다.
 *  - 우리가 한 일과 아직 안 한 일을 구분해서 적는다.
 *  - 기준선 없이 "좋아졌다"고 말하지 않는다.
 *
 *   node scripts/case-report.mjs > ../../probe/data/case-report.html
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

// ── 데이터 수집
const [posts] = (await pool.query(
  `select count(*)::int n, coalesce(sum(length(body)),0)::int chars from academy.published_posts`,
)).rows;
const [drafts] = (await pool.query(
  `select count(*)::int n from academy.posts where not published`,
)).rows;
const crawl = (await pool.query(`select * from academy.crawl_summary`)).rows;
const firstHit = (await pool.query(
  `select min(seen_at) t from academy.crawl_hits`,
)).rows[0]?.t;
const snaps = (await pool.query(
  `select day, posts, crawl_total, vendors from academy.snapshots order by day`,
)).rows;
const hitPaths = (await pool.query(
  `select path, count(*)::int n from academy.crawl_hits group by path order by n desc limit 6`,
)).rows;

// 검색 노출 — 오늘 상태와, 각 질의가 처음 잡힌 날
const serp = (await pool.query(
  `select engine, kind, query, hit, rank from academy.serp_checks
    where day = (select max(day) from academy.serp_checks)
    order by engine, kind desc, query`,
)).rows;
const serpFirst = (await pool.query(
  `select engine, query, min(day) d from academy.serp_checks
    where hit group by engine, query order by min(day), engine`,
)).rows;

// 사이트 점수 (probe 측정 결과)
let scan = null;
try {
  scan = JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), "..", "probe", "data", "scans", "robotncoding.com.json"), "utf8"));
} catch {}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const d = (t) => t ? new Date(t).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "—";
const day = (t) => t ? new Date(t).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "—";

// ── 착수 전 기준선 (2026-09-05 실측)
const BASELINE = [
  ["송파구 석촌동 코딩학원 추천", "오늘학교 · 순위닷"],
  ["서울 송파구 초등학생 코딩학원 추천", "오늘학교 · 순위닷 · 모하지"],
  ["석촌동 로봇 코딩 배우는 학원", "로보티즈 · 디랩 · 글로벌리더센터"],
  ["송파 로봇코딩학원 초등학생", "송파런 · 로보티즈 · 디랩"],
  ["로봇앤코딩학원 (브랜드)", "강남점 카카오채널 · learns.academy 대치동"],
  ["site:robotncoding.com", "색인 0건"],
];

const CHECK_KO = {
  crawler: "AI 크롤러 허용", llmstxt: "llms.txt", sitemap: "사이트맵",
  ssr: "JS 없이 본문", schema: "구조화 데이터", chunk: "문단 구조", patterns: "콘텐츠 패턴",
};

const TIMELINE = [
  ["09.05", "착수 · 검색 계층 기준선 측정", "6개 질의 전부 미노출. 상위에 개별 학원 홈페이지가 하나도 없고 전부 디렉터리였다."],
  ["09.05", "사이트 구축 · 도메인 연결", "robotncoding.com. AI 크롤러 17종 명시 허용, llms.txt, 스키마 19종."],
  ["09.05", "네이버 블로그 32편 이관", "네이버는 robots.txt 로 AI 크롤러를 전부 막는다. 그 글들은 AI 에게 존재하지 않는 문서였다. 사진 69장 자체 호스팅."],
  ["09.05", "검색엔진 등록", "구글·빙·네이버 소유확인. 사이트맵 34 URL, RSS 32편 제출."],
  ["09.05", "크롤러 감지 설치", "AI·검색 크롤러 24종을 판별해 방문을 기록. 결과 지표보다 먼저 움직이는 유일한 선행지표."],
  ["09.05", "일별 스냅샷 자동화", "GitHub Actions 가 매일 기록을 남긴다."],
  ["09.06", "구글 비즈니스 프로필 등록", "구글 AI 개요와 Gemini 가 지역 질의에 이 데이터를 직접 쓴다. 대표자 본인인증이 필요해 대행이 불가능한 항목이다."],
  ["09.06", "오늘학교 아카데미 등재 신청", "「송파구 코딩학원」 목록에 없던 것을 채웠다. 심사 대기중."],
];

const TODO = [
  ["오늘학교 등재 확인", "심사 대기중. 통과되면 「송파구 코딩학원」 목록에 들어간다."],
  ["런즈 · 순위닷 등재", "같은 문안을 재사용한다. 표현이 갈리면 AI 가 다른 학원으로 볼 수 있다."],
  ["엔진별 인용률 측정", "색인이 잡힌 뒤에 잰다. 지금 재면 전 엔진 0% 가 나올 것이 뻔하다."],
];

const out = `<title>로봇&코딩학원 · AI 노출 리포트</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap">
<style>
:root{--bg:#F8F7F4;--card:#FFF;--sunken:#F1EFE9;--line:#E3E0D8;--line-2:#EDEBE4;
  --ink:#15171A;--ink-2:#4A4E54;--ink-3:#8A8375;--accent:#B5760A;--ok:#2F7D5B;--wait:#9A7B2E}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0F1319;--card:#161C25;--sunken:#1A212B;--line:#252E3B;--line-2:#1E2631;
  --ink:#E9EDF3;--ink-2:#A9B3C1;--ink-3:#6F7A8A;--accent:#F5A623;--ok:#3DD6A0;--wait:#E0B85C}}
:root[data-theme="dark"]{--bg:#0F1319;--card:#161C25;--sunken:#1A212B;--line:#252E3B;--line-2:#1E2631;
  --ink:#E9EDF3;--ink-2:#A9B3C1;--ink-3:#6F7A8A;--accent:#F5A623;--ok:#3DD6A0;--wait:#E0B85C}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"Noto Sans KR",system-ui,sans-serif;font-size:15px;line-height:1.75;-webkit-font-smoothing:antialiased}
.mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
.wrap{max-width:880px;margin:0 auto;padding:0 24px}
header{padding:62px 0 30px;border-bottom:1px solid var(--line)}
.eb{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
h1{font-size:clamp(26px,4vw,36px);font-weight:900;letter-spacing:-.035em;line-height:1.24;margin:12px 0 14px}
.dek{font-size:15.5px;color:var(--ink-2);max-width:70ch;margin:0}
.dek b{color:var(--ink)}
h2{font-size:19px;font-weight:800;letter-spacing:-.025em;margin:48px 0 5px}
h2 .n{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-3);letter-spacing:.1em;margin-right:9px;font-weight:400}
.sub{color:var(--ink-2);font-size:14.5px;margin:0 0 16px;max-width:70ch}
.sub b{color:var(--ink)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:18px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 17px}
.kpi .v{font-family:"IBM Plex Mono",monospace;font-size:26px;font-weight:500;color:var(--ink);letter-spacing:-.02em}
.kpi .v small{font-size:13px;color:var(--ink-3);margin-left:3px}
.kpi .k{font-size:12.5px;color:var(--ink-3);margin-top:5px}
.kpi.hi .v{color:var(--accent)}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);margin-top:14px}
table{border-collapse:collapse;width:100%;font-size:14.2px;min-width:520px}
th,td{text-align:left;padding:11px 15px;border-bottom:1px solid var(--line-2);vertical-align:top}
thead th{background:var(--sunken);font-size:11.5px;letter-spacing:.07em;color:var(--ink-3);font-weight:600;white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td.m{font-family:"IBM Plex Mono",monospace;font-size:13px;color:var(--ink-3);white-space:nowrap}
td b{color:var(--ink)}
.no{color:var(--ink-3)}
.bar{display:inline-block;width:78px;height:5px;border-radius:4px;background:var(--sunken);
  overflow:hidden;vertical-align:middle;margin-right:9px}
.bar i{display:block;height:100%;background:var(--accent)}
.tl{border-left:2px solid var(--line);padding-left:20px;margin-top:16px}
.tl .e{position:relative;padding-bottom:19px}
.tl .e::before{content:"";position:absolute;left:-25px;top:9px;width:8px;height:8px;border-radius:50%;
  background:var(--accent);border:2px solid var(--bg)}
.tl .e .d{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--ink-3)}
.tl .e .t{font-size:15.5px;font-weight:700;margin:2px 0 4px}
.tl .e p{margin:0;font-size:14.2px;color:var(--ink-2);line-height:1.75}
.box{border-left:3px solid var(--accent);background:color-mix(in oklab,var(--accent) 7%,var(--bg));
  border-radius:0 12px 12px 0;padding:17px 20px;margin-top:20px}
.box p{margin:0 0 9px;font-size:14.5px;color:var(--ink-2);line-height:1.85}
.box p:last-child{margin-bottom:0}
.box b{color:var(--ink)}
.todo{display:flex;flex-direction:column;gap:9px;margin-top:14px}
.td{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:14px 16px}
.td .h{font-size:14.8px;font-weight:700;color:var(--ink);margin-bottom:4px}
.td p{margin:0;font-size:13.8px;color:var(--ink-2);line-height:1.7}
footer{padding:40px 0 68px;margin-top:42px;border-top:1px solid var(--line);color:var(--ink-3);font-size:12.5px}
</style>

<header><div class="wrap">
  <div class="eb">Case Study · 진행중</div>
  <h1>로봇&amp;코딩학원 · AI 노출 리포트</h1>
  <p class="dek">
    서울 송파구 석촌동 코딩·로봇·AI 학원. 착수 <b>2026년 9월 5일</b>.
    이 문서는 <b>DB 에서 자동 생성</b>되며, 아직 확인되지 않은 것은 확인되지 않았다고 적습니다.
    생성 시각 ${d(new Date())}.
  </p>
</div></header>

<div class="wrap">

  <h2><span class="n">01</span>착수 시점의 상태</h2>
  <p class="sub">
    학부모가 실제로 쓸 질문 6개를 검색엔진에 넣어 <b>무엇이 나오는지</b> 기록했습니다.
    이 기준선이 없으면 나중에 "좋아졌다"는 말은 느낌일 뿐입니다.
  </p>
  <div class="tw"><table>
    <thead><tr><th>질의</th><th>이 학원</th><th>실제로 나온 문서</th></tr></thead>
    <tbody>${BASELINE.map(([q, w]) =>
      `<tr><td>${esc(q)}</td><td class="no">미노출</td><td class="m">${esc(w)}</td></tr>`).join("")}
    </tbody>
  </table></div>
  <div class="box"><p>
    <b>6개 질의 전부 미노출.</b> 그리고 더 중요한 사실 —
    상위 결과에 <b>개별 학원 홈페이지가 하나도 없었습니다.</b> 전부 디렉터리와 플랫폼이었습니다.
    홈페이지를 아무리 잘 만들어도 이 질의에서는 디렉터리를 이길 수 없다는 뜻입니다.
  </p></div>

  <h2><span class="n">02</span>지금까지 한 일</h2>
  <div class="tl">${TIMELINE.map(([dt, t, p]) =>
    `<div class="e"><div class="d">${dt}</div><div class="t">${esc(t)}</div><p>${esc(p)}</p></div>`).join("")}
  </div>

  <h2><span class="n">03</span>측정 가능한 변화</h2>
  <div class="kpis">
    <div class="kpi hi"><div class="v">${scan ? scan.total : "—"}<small>/100</small></div><div class="k">사이트 진단 (착수 시 83)</div></div>
    <div class="kpi"><div class="v">${posts.n}<small>편</small></div><div class="k">공개 문서 (착수 시 0)</div></div>
    <div class="kpi"><div class="v">${Number(posts.chars).toLocaleString()}<small>자</small></div><div class="k">본문 합계</div></div>
    <div class="kpi"><div class="v">${crawl.reduce((s, r) => s + r.hits, 0)}<small>회</small></div><div class="k">AI 크롤러 방문</div></div>
  </div>
${scan ? `
  <div class="tw"><table>
    <thead><tr><th>진단 항목</th><th>점수</th><th>근거</th></tr></thead>
    <tbody>${Object.entries(scan.checks).map(([k, v]) => `<tr>
      <td>${CHECK_KO[k] || k}</td>
      <td class="m"><span class="bar"><i style="width:${v.score}%"></i></span>${v.score}</td>
      <td class="m">${esc(
        k === "crawler" ? `${v.bots.length}종 명시 허용` :
        k === "sitemap" ? `${v.urls} URL` :
        k === "ssr" ? `평균 본문 ${v.avgTextLen}자 · 빈약 ${v.thinPages}쪽` :
        k === "schema" ? `${v.types.length}종 · 오류 ${v.invalid}` :
        k === "chunk" ? `문단 ${v.paragraphs} 중 인용가능 ${v.inBand}` :
        k === "patterns" ? `질문형 제목 ${v.questionHeadings} · 수치 ${v.numericFacts}` :
        `${v.bytes}B · ${v.sections}절`)}</td></tr>`).join("")}
    </tbody>
  </table></div>` : ""}

  <h2><span class="n">04</span>AI 크롤러 방문</h2>
  <p class="sub">
    "AI 답변에 불리는가"는 몇 주가 걸리는 결과 지표입니다.
    그 전에 움직이는 유일한 선행지표가 <b>크롤러가 실제로 왔는가</b>이고,
    이건 서버가 직접 기록하지 않으면 알 수 없습니다.
  </p>
${crawl.length ? `
  <div class="tw"><table>
    <thead><tr><th>크롤러</th><th>소속</th><th>방문</th><th>페이지</th><th>최초</th><th>최근</th></tr></thead>
    <tbody>${crawl.map((r) => `<tr>
      <td><b>${esc(r.bot)}</b></td><td class="m">${esc(r.vendor)}</td>
      <td class="m">${r.hits}</td><td class="m">${r.pages}</td>
      <td class="m">${day(r.first_seen)}</td><td class="m">${day(r.last_seen)}</td></tr>`).join("")}
    </tbody>
  </table></div>
  <div class="box"><p>
    <b>첫 방문 ${d(firstHit)}.</b> 도메인 연결 당일입니다.
    ${crawl.some((r) => r.vendor === "anthropic")
      ? "ClaudeBot 이 robots.txt 를 먼저 읽고 이관한 블로그 글을 가져갔습니다."
      : ""}
    ${(() => {
      const search = crawl.filter((r) => /Googlebot|Bingbot|Yeti/i.test(r.bot));
      if (!search.length) return "아직 검색 색인 크롤러는 오지 않았습니다 — 색인 요청 직후라 정상입니다.";
      return "검색 색인 크롤러도 왔습니다 — "
        + search.map((r) => `${esc(r.bot)} ${r.hits}회`).join(", ") + ".";
    })()}
  </p></div>
${hitPaths.length ? `
  <div class="tw"><table>
    <thead><tr><th>많이 읽힌 경로</th><th>횟수</th></tr></thead>
    <tbody>${hitPaths.map((p) => `<tr><td class="m">${esc(p.path)}</td><td class="m">${p.n}</td></tr>`).join("")}</tbody>
  </table></div>` : ""}
` : `<div class="box"><p>아직 방문 기록이 없습니다. 색인 요청 직후에는 정상입니다.</p></div>`}

  <h2><span class="n">05</span>검색 노출</h2>
  <p class="sub">
    크롤러가 왔다는 것과 사람이 검색해서 찾을 수 있다는 것은 다른 단계입니다.
    아래는 <b>매일 실제로 검색해서 남긴 기록</b>입니다.
    엔진마다 색인 속도가 다르므로 나눠서 잽니다.
  </p>
${serp.length ? `
  <div class="tw"><table>
    <thead><tr><th>엔진</th><th>구분</th><th>검색어</th><th>결과</th></tr></thead>
    <tbody>${serp.map((r) => `<tr>
      <td class="m">${esc(r.engine === "naver" ? "네이버" : "Bing")}</td>
      <td class="m">${esc(r.kind)}</td>
      <td>${esc(r.query)}</td>
      <td class="m">${r.hit ? `<b>${r.rank}위</b>` : `<span class="no">미노출</span>`}</td>
    </tr>`).join("")}
    </tbody>
  </table></div>
${serpFirst.length ? `
  <div class="box"><p>
    <b>처음 검색에 나온 날.</b>
    ${serpFirst.map((f) =>
      `${esc(f.engine === "naver" ? "네이버" : "Bing")} &middot; ${esc(f.query)} &mdash; ${day(f.d)}`).join("<br>")}
  </p></div>` : ""}
  <div class="box"><p>
    구글은 결과 페이지를 긁으면 막히기 때문에 여기서 재지 않습니다.
    대신 Search Console 의 URL 검사로 페이지마다 확인합니다.
    <b>지역 경쟁 검색어는 아직 잡히지 않았습니다</b> &mdash;
    브랜드명과 정확한 지역명이 먼저 잡히고 경쟁 검색어가 나중에 붙는 순서입니다.
  </p></div>
` : `<div class="box"><p>아직 측정 기록이 없습니다.</p></div>`}

  <h2><span class="n">06</span>아직 모르는 것</h2>
  <p class="sub">케이스 스터디에서 이 항목을 빼면 신뢰를 잃습니다.</p>
  <div class="box">
    <p><b>인용률은 아직 재지 않았습니다.</b>
    ${serp.some((r) => r.hit)
      ? `검색에는 올라왔지만 올라온 지 며칠 안 됐습니다. 지금 재면 AI 가 아직 못 본 상태를 재는 셈입니다.
         측정 도구(33개 질문 &times; 5회 반복)는 준비돼 있고, 며칠 뒤에 돌립니다.`
      : `색인이 잡히기 전에 재면 전 엔진 0% 가 나올 것이 뻔합니다. 색인이 확인된 뒤에 잽니다.`}</p>
    <p><b>이 케이스에는 약점이 있습니다.</b> 학원 대표가 곧 이 프로젝트의 의뢰인이라
    사이트를 즉시 고칠 수 있었습니다. 실제 고객사는 도메인 권한·개발팀·결재 라인이 있어
    같은 작업에 몇 주가 걸립니다. <b>다음 고객사에서 시험할 것은 기술이 아니라 리드타임입니다.</b></p>
    <p>측정에서 드러난 대로 AI 가 인용하는 문서의 대부분이 제3자 지면이므로,
    사이트를 못 건드리는 고객사에서도 성립할 가능성이 높습니다.
    다만 그때는 홈페이지 점수가 아니라 <b>제3자 지면 진입이 상품</b>이 됩니다.</p>
  </div>

  <h2><span class="n">07</span>다음에 할 일</h2>
  <div class="todo">${TODO.map(([h, p]) =>
    `<div class="td"><div class="h">${esc(h)}</div><p>${esc(p)}</p></div>`).join("")}
  </div>

${snaps.length > 1 ? `
  <h2><span class="n">08</span>일별 기록</h2>
  <p class="sub">GitHub Actions 가 매일 자동으로 남깁니다.</p>
  <div class="tw"><table>
    <thead><tr><th>날짜</th><th>문서</th><th>누적 크롤러 방문</th><th>엔진</th></tr></thead>
    <tbody>${snaps.map((s) => `<tr>
      <td class="m">${new Date(s.day).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</td>
      <td class="m">${s.posts}</td><td class="m">${s.crawl_total}</td>
      <td class="m">${(s.vendors || []).join(", ") || "—"}</td></tr>`).join("")}
    </tbody>
  </table></div>` : ""}

</div>
<footer><div class="wrap mono">
  robotncoding.com · 초안 ${drafts.n}편 대기 · 이 문서는 scripts/case-report.mjs 가 DB 에서 생성합니다
</div></footer>`;

/**
 * 기본은 조각(fragment)을 표준출력으로 보낸다 — 아티팩트로 올릴 때 쓰던 방식이다.
 * --out 을 주면 그대로 브라우저에 띄울 수 있는 완결된 문서로 감싸서 파일에 쓴다.
 * 영업에서 링크로 보내려면 URL 이 있어야 하고, URL 로 열리려면 문서여야 한다.
 */
const outArg = process.argv.indexOf("--out");
if (outArg > 0 && process.argv[outArg + 1]) {
  const file = path.resolve(process.cwd(), process.argv[outArg + 1]);
  const doc = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
${out.slice(0, out.indexOf("</style>") + 8)}
</head>
<body>
${out.slice(out.indexOf("</style>") + 8)}
</body>
</html>`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, doc, "utf8");
  console.log(`${path.relative(process.cwd(), file)} · ${doc.length.toLocaleString("ko-KR")}자`);
} else {
  process.stdout.write(out);
}
await pool.end();
