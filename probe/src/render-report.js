/**
 * 진단 리포트 렌더러 — diagnose.js 결과를 고객에게 보낼 HTML 한 장으로.
 *
 *   node src/render-report.js iquest
 *   node src/render-report.js iquest --out ../report-iquest.html
 *
 * 설계 원칙: 확정값처럼 보이는 단일 숫자를 쓰지 않는다.
 * 노출률에는 반드시 표본 수와 신뢰구간(Wilson)을 병기한다. 이게 경쟁사와의 유일한 차이다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, parseArgs } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const args = parseArgs(process.argv.slice(2));
const id = args._[0];
if (!id) { console.error("사용법: node src/render-report.js <brand_id> [--out 파일]"); process.exit(1); }

const d = readJson(path.resolve(ROOT, `data/diagnoses/${id}.json`));
const outFile = path.resolve(ROOT, args.out || `data/diagnoses/${id}.html`);

/** Wilson score interval — 표본이 작을 때 정직한 구간 */
function wilson(hits, n, z = 1.96) {
  if (!n) return { lo: 0, hi: 0, margin: 0 };
  const p = hits / n;
  const den = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / den;
  const m = (z / den) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, (c - m) * 100), hi: Math.min(100, (c + m) * 100), margin: m * 100 };
}

const n = d.executions;
const hits = Math.round(((d.ai?.presence ?? 0) / 100) * n);
const ci = wilson(hits, n);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SITE_LABELS = {
  crawler: "AI 크롤러 접근", ssr: "본문 추출 가능성", schema: "구조화 데이터",
  chunk: "인용 가능한 문단", patterns: "AI 친화 패턴", llmstxt: "llms.txt", sitemap: "sitemap.xml",
};

const focusCopy = {
  third_party: { tag: "제3자 지면", color: "crit" },
  site: { tag: "자사 사이트", color: "warn" },
  expand: { tag: "커버리지 확장", color: "good" },
}[d.focus] ?? { tag: "—", color: "warn" };

const html = `<title>${esc(d.brand.name)} AI 노출 진단</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600&family=Noto+Serif+KR:wght@700&display=swap">
<style>
:root{--ground:#F6F7F5;--surface:#FFF;--sunken:#EFF1EE;--ink:#141A17;--ink-2:#3B4640;--muted:#5C6862;--faint:#8A958E;
 --rule:#DCE1DD;--rule-soft:#E7EBE7;--accent:#0E5C48;--accent-soft:#E2EFE9;--good:#0E8F70;--warn:#B0721A;--crit:#AF3D2E;--mark:rgba(255,214,64,.5)}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0E1311;--surface:#141A18;--sunken:#101614;--ink:#E6EBE7;--ink-2:#C3CCC7;
 --muted:#93A099;--faint:#6E7B75;--rule:#242E2A;--rule-soft:#1C2421;--accent:#4FC7A4;--accent-soft:#152722;--good:#22A882;--warn:#C8892C;--crit:#D9705F;--mark:rgba(255,214,64,.24)}}
:root[data-theme="dark"]{--ground:#0E1311;--surface:#141A18;--sunken:#101614;--ink:#E6EBE7;--ink-2:#C3CCC7;
 --muted:#93A099;--faint:#6E7B75;--rule:#242E2A;--rule-soft:#1C2421;--accent:#4FC7A4;--accent-soft:#152722;--good:#22A882;--warn:#C8892C;--crit:#D9705F;--mark:rgba(255,214,64,.24)}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font-family:"IBM Plex Sans KR",-apple-system,"Segoe UI","Malgun Gothic",sans-serif;
 font-size:15px;line-height:1.72;-webkit-font-smoothing:antialiased;letter-spacing:-.005em}
h1,h2{font-family:"Noto Serif KR",Georgia,serif;font-weight:700;margin:0;line-height:1.3;letter-spacing:-.02em;text-wrap:balance}
.mono{font-family:"IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
.wrap{max-width:820px;margin:0 auto;padding:0 26px 90px}
.hd{padding:46px 0 26px;border-bottom:1px solid var(--rule)}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
h1{font-size:clamp(26px,4.5vw,36px);margin-top:14px}
.sub{color:var(--muted);font-size:13.5px;margin-top:10px;font-family:"IBM Plex Mono",monospace}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule);border-radius:3px;margin:28px 0;overflow:hidden}
.kpi>div{background:var(--surface);padding:16px 18px}
.kpi .k{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint)}
.kpi .v{font-family:"Noto Serif KR",serif;font-size:30px;font-weight:700;margin-top:6px;font-variant-numeric:tabular-nums;line-height:1}
.kpi .v small{font-family:"IBM Plex Sans KR",sans-serif;font-size:13px;font-weight:400;color:var(--muted)}
.kpi .d{font-size:11.5px;color:var(--muted);margin-top:6px;font-family:"IBM Plex Mono",monospace}
.verdict{border-left:3px solid var(--crit);background:var(--surface);border:1px solid var(--rule);border-left-width:3px;padding:20px 22px;border-radius:0 3px 3px 0;margin:26px 0}
.verdict.warn{border-left-color:var(--warn)} .verdict.good{border-left-color:var(--good)} .verdict.crit{border-left-color:var(--crit)}
.verdict .lab{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.verdict h2{font-size:20px;margin:8px 0 10px}
.verdict p{margin:0;color:var(--ink-2);font-size:14.5px}
section{margin-top:46px}
h2.sec{font-size:17px;padding-bottom:10px;border-bottom:1px solid var(--rule);margin-bottom:18px}
.bars{display:flex;flex-direction:column;gap:8px}
.row{display:grid;grid-template-columns:130px minmax(0,1fr) 78px;align-items:center;gap:12px;font-size:13px}
.row .lbl{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row.me .lbl{color:var(--ink);font-weight:600}
.track{height:11px;background:var(--sunken);border-radius:0 4px 4px 0}
.fill{height:11px;border-radius:0 4px 4px 0;display:block;background:var(--rule)}
.row.me .fill{background:var(--accent)}
.row .val{font-family:"IBM Plex Mono",monospace;font-size:11.5px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
.row.me .val{color:var(--ink)}
table{border-collapse:collapse;width:100%;font-size:13px}
.tw{overflow-x:auto;border:1px solid var(--rule);border-radius:3px;background:var(--surface)}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--rule-soft);vertical-align:top;line-height:1.6}
thead th{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);font-weight:400;background:var(--sunken);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td.n{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.act{display:flex;flex-direction:column;border:1px solid var(--rule);border-radius:3px;background:var(--surface);overflow:hidden}
.act .i{display:grid;grid-template-columns:38px minmax(0,1fr);border-bottom:1px solid var(--rule-soft)}
.act .i:last-child{border-bottom:0}
.act .no{background:var(--sunken);border-right:1px solid var(--rule-soft);display:flex;align-items:flex-start;justify-content:center;padding-top:15px;font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--accent)}
.act .b{padding:14px 17px}
.act .tag{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.1em;padding:1px 6px;border:1px solid var(--rule);border-radius:2px;color:var(--faint);margin-bottom:6px}
.act .m{font-size:13.5px;color:var(--ink-2);line-height:1.65}
.method{background:var(--sunken);border:1px solid var(--rule);border-radius:3px;padding:16px 18px;font-size:12.5px;color:var(--muted);line-height:1.7;margin-top:16px}
.method b{color:var(--ink)}
mark{background:var(--mark);color:inherit;padding:0 2px}
footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--rule);font-size:11.5px;color:var(--faint);font-family:"IBM Plex Mono",monospace;display:flex;gap:20px;flex-wrap:wrap}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
<header class="hd">
  <div class="eyebrow">AI 노출 진단 리포트</div>
  <h1>${esc(d.brand.name)}는 AI 답변에서<br>${d.ai?.rank ? `${d.ai.rank}번째로 불립니다` : "거의 불리지 않습니다"}</h1>
  <div class="sub">${esc(d.brand.domain ?? "")} · ${esc(d.vertical)} · ${d.generated_at.slice(0, 10)}</div>
</header>

<div class="kpi">
  <div><div class="k">AI 노출률</div><div class="v">${d.ai?.presence ?? 0}<small>%</small></div>
    <div class="d">${ci.lo.toFixed(0)}–${ci.hi.toFixed(0)}% · n=${n}</div></div>
  <div><div class="k">경쟁 순위</div><div class="v">${d.ai?.rank ?? "—"}<small> / ${d.leaderboard.length}</small></div>
    <div class="d">답변 등장 브랜드 중</div></div>
  <div><div class="k">사이트 GEO 점수</div><div class="v">${d.site?.total ?? "—"}<small> / 100</small></div>
    <div class="d">${esc(d.site?.grade ?? "미측정")}</div></div>
  <div><div class="k">제3자 문서 등장</div><div class="v">${d.thirdParty?.mine ?? 0}<small> / ${d.thirdParty?.totalDocs ?? 0}</small></div>
    <div class="d">비교·추천 문서 기준</div></div>
</div>

<div class="verdict ${focusCopy.color}">
  <div class="lab">판정 · 우선 대응 = ${esc(focusCopy.tag)}</div>
  <h2>${esc(d.verdict)}</h2>
  <p>${esc(d.reason)}</p>
</div>

<section>
  <h2 class="sec">경쟁 지형 — 같은 질문에 누가 불리는가</h2>
  <div class="bars">
    ${d.leaderboard.map((b) => `<div class="row${b.isMe ? " me" : ""}">
      <span class="lbl">${esc(b.name)}</span>
      <span class="track"><span class="fill" style="width:${Math.max(2, b.presence)}%"></span></span>
      <span class="val">${b.presence}%${b.avgPos ? ` · ${b.avgPos}위` : ""}</span></div>`).join("\n    ")}
  </div>
</section>

${d.site ? `<section>
  <h2 class="sec">사이트 점검 — AI가 읽을 수 있는가</h2>
  <div class="tw"><table>
    <thead><tr><th>항목</th><th>점수</th><th>의미</th></tr></thead>
    <tbody>${Object.entries(d.site.checks).map(([k, v]) => `<tr>
      <td><b>${esc(SITE_LABELS[k] ?? k)}</b></td><td class="n">${v}</td>
      <td>${v >= 80 ? "양호" : v >= 50 ? "보완 필요" : "미흡 — 우선 조치"}</td></tr>`).join("\n      ")}</tbody>
  </table></div>
</section>` : ""}

${d.thirdParty && d.thirdParty.missing.length ? `<section>
  <h2 class="sec">빠져 있는 문서 — 경쟁사는 있고 ${esc(d.brand.name)}는 없는 곳</h2>
  <div class="tw"><table>
    <thead><tr><th>문서</th><th>여기 실린 브랜드</th></tr></thead>
    <tbody>${d.thirdParty.missing.map((m) => `<tr>
      <td><b>${esc(m.domain)}</b><br><span style="color:var(--muted);font-size:12px">${esc((m.title ?? "").slice(0, 52))}</span></td>
      <td class="n">${m.has.length}개 브랜드</td></tr>`).join("\n      ")}</tbody>
  </table></div>
  <div class="method">AI가 “${esc(d.vertical)} 추천”에 답할 때 실제로 읽는 문서들입니다.
  <b>${esc(d.brand.name)}는 ${d.thirdParty.totalDocs}건 중 ${d.thirdParty.mine}건에만 등장합니다.</b>
  자사 사이트를 아무리 고쳐도 이 문서들에 이름이 없으면 답변에 나오지 않습니다.</div>
</section>` : ""}

<section>
  <h2 class="sec">먼저 할 것</h2>
  <div class="act">
    ${d.actions.slice(0, 5).map((a, i) => `<div class="i"><div class="no">${i + 1}</div>
      <div class="b"><span class="tag">${esc(a.kind)}</span><div class="m">${esc(a.msg)}</div></div></div>`).join("\n    ")}
  </div>
</section>

<section>
  <h2 class="sec">측정 방법</h2>
  <div class="method">
    실제 구매자가 쓸 법한 질문 <b>${d.prompts}개</b>를 검색 기반 AI에 던져 <b>${n}회</b> 실행하고,
    답변에 등장한 브랜드와 등장 순서를 추출했습니다.<br><br>
    <b>생성형 AI는 같은 질문에도 매번 다른 답을 냅니다.</b> 그래서 이 리포트의 노출률은 확정값이 아니라
    <b>${d.ai?.presence ?? 0}% (95% 신뢰구간 ${ci.lo.toFixed(0)}–${ci.hi.toFixed(0)}%, 표본 ${n})</b>로 표기합니다.
    표본을 늘리면 구간이 좁아집니다. 구간 없이 단일 숫자만 제시하는 리포트는 근거가 약합니다.<br><br>
    사이트 점검 7개 항목은 전부 코드로 확인 가능한 사실만 봅니다 —
    robots.txt의 AI 크롤러 허용 여부, 자바스크립트 없이 본문이 나오는지, JSON-LD 구조화 데이터,
    문단 길이 분포, llms.txt·sitemap.xml 존재. 브랜드 권위나 E-E-A-T 같은 주관적 항목은 점수에 넣지 않았습니다.<br><br>
    <b>답변 원문은 전부 보관되어 있으며 요청 시 그대로 제공합니다.</b>
  </div>
</section>

<footer>
  <span>AI 노출 진단 · ${d.generated_at.slice(0, 10)}</span>
  <span>측정 ${n}회 · 프롬프트 ${d.prompts}개</span>
  <span>엔진: ${esc(d.engine)}</span>
</footer>
</div>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html, "utf8");
console.log(`리포트 생성: ${path.relative(ROOT, outFile)}`);
console.log(`  ${d.brand.name} · 노출 ${d.ai?.presence}% (${ci.lo.toFixed(0)}-${ci.hi.toFixed(0)}%, n=${n}) · 사이트 ${d.site?.total} · 판정 "${d.verdict}"`);
