import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

import { readOps, listClients } from "@/lib/ops";
import Live from "./Live";
import Flow, { type NodeState } from "./Flow";
import Link from "next/link";
import { inquirySummary } from "@/lib/inquiries";
/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin/ops";

/** 고리 위 자리의 사람 말 이름. 막힌 곳을 문장으로 적을 때 쓴다. */
const RING_LABEL: Record<string, string> = {
  content: "쓴다", deliver: "내보낸다", crawler: "읽혀진다",
  measure: "잰다", next: "다음을 정한다",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 운영 대시보드 — AI 직원이 무슨 일을 하고 있는지 한눈에 본다.
 *
 * 숫자는 전부 DB 에서 읽는다. 못 읽으면 "확인 못함"으로 적는다.
 * 사이티드는 이 숫자를 파는 회사라, 여기에 지어낸 값이 들어가면 사업이 무너진다.
 */

/**
 * 하루 시간표.
 *
 * 「자동」과 「세션 필요」를 갈라 적는다. 이게 섞여 있으면 화면이 거짓말을 한다.
 * 앞선 판은 아홉 칸 중 일곱이 세션 필요였는데 그걸 「24시간 운영」처럼 보여 줬다.
 *
 * 자동   GitHub 이 돌린다. 클로드가 꺼져 있어도 돈다
 * 세션   로그인한 브라우저나 글 쓰는 일이 필요하다. 사람이 켜 줘야 한다
 */
const SLOTS = [
  { at: "02:11", name: "점검 · 브리핑", team: "운영", need: "무관" },
  { at: "03:23", name: "색인 알림 · 스냅샷", team: "운영", need: "무관" },
  { at: "05:11", name: "점검", team: "운영", need: "무관" },
  { at: "07:41", name: "노출 측정 · 리포트 갱신", team: "측정", need: "무관" },
  { at: "08:11", name: "점검", team: "운영", need: "무관" },
  { at: "10:23", name: "주간 정리", team: "운영", need: "세션", dow: 1 },
  { at: "11:11", name: "점검", team: "운영", need: "무관" },
  { at: "11:41", name: "색인 밀기 — 구글 로그인", team: "유통", need: "세션" },
  { at: "14:11", name: "점검", team: "운영", need: "무관" },
  { at: "14:23", name: "글 작업", team: "콘텐츠", need: "세션" },
  { at: "17:11", name: "점검", team: "운영", need: "무관" },
  { at: "18:53", name: "네이버 이관 · 정리", team: "유통", need: "세션" },
  { at: "20:11", name: "점검", team: "운영", need: "무관" },
  { at: "23:11", name: "점검", team: "운영", need: "무관" },
];

/**
 * 자리마다 무슨 일을 하고, 그래서 무엇이 나왔는가.
 *
 * 앞선 판은 "하는 일" 목록만 있었다. 목록은 계획이지 성과가 아니다.
 * 자리마다 실제로 나온 숫자를 옆에 붙여야 일하고 있는지 알 수 있다.
 * perf 는 DB 에서 읽은 값으로 채운다 — 못 읽으면 "—" 로 둔다.
 */
type Agent = {
  key: string; glyph: string; role: string; cadence: string;
  jobs: string[]; tools: string[];
  perf: (d: Awaited<ReturnType<typeof readOps>>) => [string, string][];
};

const AGENTS: Agent[] = [
  {
    key: "운영", glyph: "\u25CE", cadence: "하루 8회 · 쉬지 않음",
    role: "고리가 끊기지 않게 지킨다. 사이트가 죽었는지, 크롤러가 끊겼는지 3시간마다 본다.",
    jobs: ["상태 점검", "브리핑", "케이스 리포트 갱신", "커밋·푸시"],
    tools: ["health.mjs", "briefing.mjs", "case-report.mjs"],
    perf: (d) => [
      ["다녀간 크롤러", d.vendorCount ? `${d.vendorCount}종` : "—"],
      ["쌓인 방문 기록", d.totalHits ? `${d.totalHits.toLocaleString("ko-KR")}회` : "—"],
      ["점검 주기", "6시간"],
    ],
  },
  {
    key: "측정", glyph: "\u25A4", cadence: "하루 3회",
    role: "지금 어디까지 왔는지 잰다. 재지 않으면 좋아졌다고 말할 수 없다.",
    jobs: ["검색 노출 (Bing·네이버)", "크롤러 커버리지", "플레이스 순위", "사이트 진단 점수"],
    tools: ["check-index.mjs", "naver-place-check.mjs", "probe/src/scan.js"],
    perf: (d) => [
      ["경쟁 검색어에서 잡힘", `${d.serp.rivalWon}/${d.serp.rivalTotal}`],
      ["플레이스 최고", d.place[0] ? `${d.place[0].rank}위` : "—"],
      ["측정한 날", d.daysMeasured ? `${d.daysMeasured}일` : "—"],
    ],
  },
  {
    key: "유통", glyph: "\u2192", cadence: "하루 2회",
    role: "만든 것을 밖으로 내보낸다. 사이트에만 두면 아무도 못 본다.",
    jobs: ["네이버 블로그 이관", "구글 색인 요청", "IndexNow 알림", "서식·태그"],
    tools: ["naver-blog-post.mjs", "submit-gsc.mjs", "indexnow.mjs"],
    perf: (d) => [
      ["내보낸 글", `${d.posts.published}편`],
      ["읽힌 페이지", d.crawl.vendors[0] ? `${d.crawl.vendors[0].pages}/${d.crawl.totalPages}쪽` : "—"],
      ["최고 커버리지", d.crawl.vendors[0] ? `${d.crawl.vendors[0].pct.toFixed(0)}%` : "—"],
    ],
  },
  {
    key: "콘텐츠", glyph: "\u2261", cadence: "하루 1회 · 무겁다",
    role: "인용될 문장을 만든다. 광고로 읽히면 AI 도 인용하지 않는다.",
    jobs: ["주제 선정", "집필", "도해 SVG → PNG", "AI 티 검사"],
    tools: ["seed-post-*.mjs", "svg-to-png.mjs", "slop-check.mjs"],
    perf: (d) => [
      ["발행", `${d.posts.published}편`],
      ["도해 붙은 글", d.withImages ? `${d.withImages}편` : "—"],
      ["마지막 발행", d.posts.sinceDays === null ? "—" : `${d.posts.sinceDays}일 전`],
    ],
  },
];

const HUMAN = [
  { t: "로그인", d: "구글 서치콘솔 · 네이버. 창은 열어 주지만 로그인은 사람이" },
  { t: "촬영과 목소리", d: "영상은 대본·도해·모션까지만. 찍는 건 사람이" },
  { t: "상담 기록", d: "“어떻게 알고 오셨어요” — 매출 검증의 유일한 고리" },
  { t: "발행 전 확인", d: "지어낸 사실이 없는지. 이건 사람이 봐야 한다" },
];

const CSS = `
.ops{--bg:#0C1016;--card:#141A22;--sunk:#10151C;--line:#232C38;--soft:#1A222C;
  --ink:#E8EDF3;--ink2:#A7B2C0;--mut:#7B8696;--faint:#5A6474;
  --acc:#F5A623;--cool:#3DD6C4;--ok:#3DD6A0;--warn:#E0A93C;--crit:#D2705F;
  background:var(--bg);color:var(--ink);min-height:100vh;
  font-family:"Noto Sans KR",system-ui,sans-serif;padding:38px 0 90px}
.ops .w{max-width:1180px;margin:0 auto;padding:0 26px}
.ops .mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
.ops h1{font-size:26px;font-weight:900;letter-spacing:-.035em;margin:0}
.ops .eb{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--acc);margin-bottom:8px}
.ops h2{font-size:17px;font-weight:800;letter-spacing:-.025em;margin:46px 0 4px}
.ops .sub{font-size:13.5px;color:var(--mut);margin:0 0 16px}

.ops-top{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;
  flex-wrap:wrap;padding-bottom:22px;border-bottom:1px solid var(--line)}
.ops-live{text-align:right}
.ops-clock{font-size:34px;font-weight:500;letter-spacing:-.02em;line-height:1;
  font-variant-numeric:tabular-nums;color:var(--ink)}
.ops-next{font-size:13px;color:var(--mut);margin-top:7px}
.ops-next b{color:var(--acc)}
.ops-gap{margin-left:9px;padding:2px 8px;border-radius:5px;background:var(--soft);
  color:var(--faint);font-size:11.5px}

.ops-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:11px;margin-top:20px}
.ops-kpi{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:15px 17px;
  position:relative;overflow:hidden}
.ops-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--faint)}
.ops-kpi.ok::before{background:var(--ok)} .ops-kpi.warn::before{background:var(--warn)}
.ops-kpi .k em{display:block;font-style:normal;font-size:11px;color:var(--faint);
  margin-top:3px;line-height:1.45;word-break:keep-all}
.ops-kpi.crit::before{background:var(--crit)}
.ops-kpi .v{font-family:"IBM Plex Mono",monospace;font-size:27px;font-weight:500;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.ops-kpi .v small{font-size:13px;color:var(--mut);margin-left:4px}
.ops-kpi .k{font-size:12.5px;color:var(--mut);margin-top:5px}

.ops-tl{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-top:14px}
.ops-slot{display:grid;grid-template-columns:76px 108px 1fr 92px;align-items:center;
  padding:12px 18px;border-bottom:1px solid var(--soft);font-size:14px}
.ops-slot:last-child{border-bottom:0}
.ops-slot .t{font-family:"IBM Plex Mono",monospace;font-size:13.5px;color:var(--ink2);
  font-variant-numeric:tabular-nums}
.ops-slot .n{font-weight:600}
.ops-slot .badge{justify-self:start;font-family:"IBM Plex Mono",monospace;font-size:10.5px;
  letter-spacing:.08em;padding:3px 8px;border-radius:5px;background:var(--soft);color:var(--mut)}
.ops-slot .need{justify-self:end;font-size:11.5px;color:var(--faint)}
.ops-slot .need.auto{color:var(--ok)}

.ops-org{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:12px;margin-top:14px}
.ops-team{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.ops-team h3{font-size:15.5px;font-weight:800;margin:0 0 3px;letter-spacing:-.02em}
.ops-team .what{font-size:12.5px;color:var(--mut);margin-bottom:14px}
.ops-team ul{margin:0;padding-left:15px;list-style:none}
.ops-team li{position:relative;font-size:13.3px;color:var(--ink2);margin-bottom:6px;padding-left:11px}
.ops-team li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;
  border-radius:50%;background:var(--acc);opacity:.8}
.ops-splitnote{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:14px}
.ops-splitnote > div{background:var(--card);border:1px solid var(--line);border-radius:13px;
  padding:15px 18px;border-left:3px solid var(--ok)}
.ops-splitnote > div.w2{border-left-color:var(--warn)}
.ops-splitnote .n{font-family:"IBM Plex Mono",monospace;font-size:27px;font-weight:500;
  color:var(--ok);margin-right:8px}
.ops-splitnote .w2 .n{color:var(--warn)}
.ops-splitnote .t{font-size:14px;font-weight:700}
.ops-splitnote .d{display:block;font-size:12.5px;color:var(--mut);margin-top:5px}
.ops-slot .need.man{color:var(--warn)}
@media(max-width:560px){.ops-splitnote{grid-template-columns:1fr}}
.ops-team-h{display:flex;align-items:baseline;gap:9px;margin-bottom:8px}
.ops-team-g{font-size:16px;color:var(--acc);line-height:1}
.ops-cad{margin-left:auto;font-family:"IBM Plex Mono",monospace;font-size:10.5px;
  color:var(--faint);letter-spacing:.06em}
.ops-role{font-size:13px;color:var(--ink2);line-height:1.7;margin:0 0 14px;word-break:keep-all}
.ops-perf{background:var(--sunk);border:1px solid var(--soft);border-radius:10px;
  padding:9px 13px;margin-bottom:14px}
.ops-perf-r{display:flex;justify-content:space-between;align-items:baseline;
  padding:5px 0;font-size:12.5px;color:var(--mut)}
.ops-perf-r + .ops-perf-r{border-top:1px solid var(--soft)}
.ops-perf-r b{color:var(--cool);font-size:13.5px;font-variant-numeric:tabular-nums}
.ops-team .tools{margin-top:13px;padding-top:11px;border-top:1px solid var(--soft);
  font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--faint);line-height:1.85}

.ops-human{background:var(--sunk);border:1px solid var(--line);border-left:3px solid var(--cool);
  border-radius:0 14px 14px 0;padding:18px 22px;margin-top:14px}
.ops-human .row{display:flex;gap:14px;padding:9px 0;border-bottom:1px solid var(--soft);font-size:13.5px}
.ops-human .row:last-child{border-bottom:0}
.ops-human b{color:var(--cool);min-width:104px;font-weight:700}
.ops-human span{color:var(--ink2)}

.ops-tw{overflow-x:auto;border:1px solid var(--line);border-radius:13px;background:var(--card);margin-top:14px}
.ops table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:460px}
.ops th,.ops td{text-align:left;padding:11px 16px;border-bottom:1px solid var(--soft)}
.ops thead th{background:var(--sunk);font-size:11px;letter-spacing:.08em;color:var(--mut);font-weight:600}
.ops tbody tr:last-child td{border-bottom:0}
.ops td.m{font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--mut);
  white-space:nowrap;font-variant-numeric:tabular-nums}
.ops td b{color:var(--ink)}
.ops .bar{display:inline-block;width:74px;height:5px;border-radius:3px;background:var(--soft);
  overflow:hidden;vertical-align:middle;margin-right:9px}
.ops .bar i{display:block;height:100%;background:var(--cool)}
.ops .err{background:#1E1416;border:1px solid #3D2A2C;border-radius:12px;padding:16px 20px;
  color:#D2705F;font-size:13.5px;margin-top:14px}
.ops-flow{background:var(--card);border:1px solid var(--line);border-radius:16px;
  padding:16px 16px 6px;margin-top:14px}
.ops-flow svg{width:100%;height:auto;display:block}
.ops-nl{fill:var(--ink);font-size:16px;font-weight:800;letter-spacing:-.02em}
.ops-ns{fill:var(--mut);font-size:12px;font-family:"IBM Plex Mono",monospace}
.ops-el{fill:var(--faint);font-size:11.5px;font-family:"IBM Plex Mono",monospace;letter-spacing:.04em}
.ops-tier{fill:var(--ink2);font-size:14px;font-weight:800;letter-spacing:-.02em}
.ops-live-t{fill:var(--ok);font-size:12px;font-weight:700;font-family:"IBM Plex Mono",monospace}
.ops-orch{fill:var(--ink);font-size:15px;font-weight:900;letter-spacing:-.02em}
.ops-orch-t{fill:#7BE8D6;font-size:12px;font-weight:700;font-family:"IBM Plex Mono",monospace}
.ops-note{color:var(--faint);font-size:11.5px}

/* 고객사 줄 — 한 곳이면 이름표, 여러 곳이면 탭 */
.ops-clients{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:16px 0 4px;
  padding-bottom:13px;border-bottom:1px solid var(--line)}
.ops-clients .lbl{font-size:11px;letter-spacing:.14em;color:var(--faint);
  text-transform:uppercase;margin-right:2px}
.ops-clients .chip{display:inline-flex;align-items:baseline;gap:7px;
  background:var(--sunk);border:1px solid var(--line);border-radius:999px;
  padding:6px 14px;font-size:13.5px;font-weight:700;color:var(--mut);
  text-decoration:none;word-break:keep-all}
.ops-clients .chip.on{border-color:var(--cool);color:var(--ink);background:rgba(61,214,196,.08)}
.ops-clients .chip i{font-style:normal;font-size:10.5px;font-weight:600;color:var(--faint)}
.ops-clients .chip.on i{color:var(--cool)}
.ops-clients .meta{margin-left:auto;font-size:11.5px;color:var(--faint);
  font-family:"IBM Plex Mono",monospace}
.ops-clients .note2{width:100%;font-size:12px;color:var(--mut);
  word-break:keep-all;margin-top:2px}
@media(max-width:640px){.ops-clients .meta{margin-left:0;width:100%}}

/* 고리 위 글자. 동사를 크게 — 부서 이름이 아니라 「무엇을 하는 자리」로 읽혀야 한다 */
.fl-verb{fill:var(--ink);font-size:15.5px;font-weight:800;letter-spacing:-.02em}
.fl-sub{fill:var(--mut);font-size:12px;font-family:"IBM Plex Mono",monospace}
.fl-sub.dim{fill:var(--faint);font-size:11px}
.fl-mid{fill:var(--ink);font-size:14.5px;font-weight:900;letter-spacing:-.02em}
.fl-step{fill:var(--faint);font-size:10.5px;font-weight:700;font-family:"IBM Plex Mono",monospace}
.fl-live{fill:var(--ok);font-size:11.5px;font-weight:700;font-family:"IBM Plex Mono",monospace}
.fl-block{fill:var(--warn);font-size:11.5px;font-weight:700;font-family:"IBM Plex Mono",monospace}
.fl-do{fill:var(--cool);font-size:12px;font-weight:700;font-family:"IBM Plex Mono",monospace}
/* 맥박 — 마지막 · 다음. 눈에 세게 띄면 안 된다. 찾으면 보이는 정도 */
.fl-beat{fill:var(--faint);font-size:11px;font-family:"IBM Plex Mono",monospace}
.fl-next{fill:var(--mut)}

/* 24시간 띠 — 빈 시간이 있는지 눈으로 보이게 한다 */
.ops-band{padding:2px 4px 30px}
.ops-band-h{display:flex;justify-content:space-between;align-items:baseline;
  font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--faint);
  letter-spacing:.12em;margin-bottom:9px}
.ops-band-note{display:flex;gap:14px;align-items:baseline;letter-spacing:0}
.ops-band-note .live{color:var(--ok);font-weight:700}
.ops-band-note .idle{color:var(--faint)}
.ops-band-note .nx{color:var(--mut)}
.ops-band-h .cnt{color:var(--ink2);font-weight:700;letter-spacing:0}
.ops-band-track{position:relative;height:46px;background:var(--sunk);
  border:1px solid var(--line);border-radius:10px;overflow:hidden}
/* 지난 시간을 바탕색으로 칠한다. 지금이 어디쯤인지 한눈에 보인다 */
.ops-band-track .past{position:absolute;top:0;bottom:0;left:0;
  background:linear-gradient(90deg,rgba(61,214,196,.04),rgba(61,214,196,.09));
  border-right:1px solid rgba(61,214,196,.18)}
.ops-band-track .tick{position:absolute;top:0;bottom:0;width:1px;background:var(--line)}
.ops-band-track .tick span{position:absolute;bottom:5px;left:6px;font-size:10px;
  color:var(--faint);font-family:"IBM Plex Mono",monospace;letter-spacing:.06em}
/* 지난 일은 채우고, 남은 일은 테두리만. 모양이 다르면 세지 않아도 보인다 */
.ops-band-track .mk{position:absolute;top:9px;width:9px;height:18px;border-radius:3px;
  border:1.5px solid;transform:translateX(-4.5px)}
.ops-band-track .mk.done{opacity:.55}
.ops-band-track .mk.todo{opacity:1}
/* 사람이 켜 줘야 하는 일에는 위에 점을 찍는다 */
.ops-band-track .mk.man::after{content:"";position:absolute;top:-6px;left:2.5px;
  width:4px;height:4px;border-radius:50%;background:var(--warn)}
.ops-band-track .nowline{position:absolute;top:0;bottom:0;width:2px;background:#E8EDF2;
  box-shadow:0 0 12px rgba(232,237,242,.55)}
.ops-band-track .nowline b{position:absolute;top:3px;left:5px;font-size:10px;
  font-family:"IBM Plex Mono",monospace;font-weight:600;color:#0B0F16;
  background:#E8EDF2;padding:1px 4px;border-radius:3px;white-space:nowrap}
/* 오른쪽 끝에 붙으면 시각 표시가 잘린다. 그때는 왼쪽으로 넘긴다 */
@media(min-width:1px){.ops-band-track .nowline b{transform:translateX(0)}}
.ops-band-key{display:flex;flex-wrap:wrap;gap:13px;align-items:center;margin-top:10px;
  font-size:11.5px;color:var(--mut)}
.ops-band-key i{display:inline-block;width:9px;height:9px;border-radius:2px;
  margin-right:5px;vertical-align:-1px}
.ops-band-key .k-done{background:var(--mut);opacity:.55}
.ops-band-key .k-todo{background:transparent;border:1.5px solid var(--mut)}
.ops-band-key .k-man{background:var(--warn);border-radius:50%;width:6px;height:6px}
.ops-band-key .sep{width:1px;height:12px;background:var(--line);margin:0 3px}
.ops-legend{display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:12px 12px 10px;
  font-size:12px;color:var(--mut);border-top:1px solid var(--soft);margin-top:6px}
.ops-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;
  vertical-align:middle}
.ops-cy{margin-left:auto;font-weight:700;padding:4px 11px;border-radius:6px}
.ops-cy.ok{color:var(--ok);background:rgba(61,214,160,.1)}
.ops-cy.bad{color:var(--crit);background:rgba(210,112,95,.12)}
@media(max-width:640px){
  .ops-slot{grid-template-columns:70px 1fr;row-gap:5px}
  .ops-slot .badge,.ops-slot .need{justify-self:start}
}
`;

const SEP = String.fromCharCode(10);

const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "—";

export default async function OpsPage({
  searchParams,
}: { searchParams: Promise<{ key?: string; c?: string }> }) {
  const { key, c: want } = await searchParams;
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  /**
   * 고객사를 고른다.
   *
   * 지금은 한 곳이라 선택기가 안 보이지만, 두 곳이 되는 날 코드를 고칠 일이 없다.
   * 주소에 ?c=슬러그 를 붙이면 그 고객사를 본다.
   */
  const clients = await listClients();
  const client = clients.find((x) => x.slug === want) ?? clients[0] ?? null;

  const [d, inq] = await Promise.all([readOps(client ?? undefined), inquirySummary()]);
  const im = inq[0];
  // 「최고 커버리지」는 듣기 좋은 숫자였다. 실제로 손봐야 하는 건 제일 낮은 쪽이다 —
  // google 95% 옆에 openai 15% 가 있으면 문제는 openai 다.
  // 좋은 숫자를 만들지 않는 게 우리가 파는 것인데 대시보드가 그러고 있었다.
  const MAJOR = ["openai", "anthropic", "google", "naver"];
  const covLow = d.crawl.vendors
    .filter((v) => MAJOR.includes(v.vendor))
    .sort((a, b) => a.pct - b.pct)[0];

  /* 노드 상태는 실제 숫자에서 나온다. 색만 예쁘게 칠하면 대시보드가 아니라 그림이다. */
  const since = d.posts.sinceDays;
  const crawling = d.crawl.last24h > 0;
  const measuredToday = d.serp.day
    ? new Date(d.serp.day).toDateString() === new Date().toDateString()
    : false;
  /**
   * 고리가 어디서 「멈췄나」.
   *
   * 멈춘 것과 결과가 아직 안 나온 것은 다르다.
   * 앞선 판은 「경쟁 검색어 0」을 멈춤으로 쳤다. 그래서 5번 자리에 빨간
   * 「여기서 막혔습니다」가 계속 붙어 있었다 — 손쓸 데가 없는데 경고만 남는다.
   * 0/6 은 멈춤이 아니라 아직 안 이긴 상태다. 이건 「할 일」로 적어야 한다.
   *
   * 멈춤은 셋뿐이다. 전부 사람이 오늘 손대야 하는 것들이다.
   */
  const stopped: { at: string; why: string } | null =
    since === null || since > 10
      ? { at: "content", why: `발행이 ${since ?? "?"}일째 끊겼습니다` }
      : !crawling
      ? { at: "crawler", why: "36시간 동안 크롤러가 안 왔습니다" }
      : !measuredToday
      ? { at: "measure", why: "오늘 노출을 아직 안 쟀습니다" }
      : null;

  /**
   * 5번 자리가 내놓는 답. 「무엇을 할 차례인가」다.
   *
   * 잰 결과를 보고 정한다. 급한 순서대로 —
   *   이름 방어가 안 되면 그게 먼저다. 내 이름으로 못 찾으면 그 앞은 다 의미 없다
   *   경쟁 검색어에서 0이면, 재 보니 이기는 건 목록 지면이었다. 글이 아니라 등재다
   */
  const decision = d.serp.brandLost.length > 0
    ? { do: "브랜드 방어", why: `우리 이름인데 안 나옵니다 — ${d.serp.brandLost.join(" · ")}` }
    : d.serp.rivalWon === 0
    ? { do: "목록 지면 등재", why: `경쟁 검색어 0/${d.serp.rivalTotal}. 재 보니 이 자리는 목록 사이트가 이깁니다` }
    : { do: "다음 주제 쓰기", why: `경쟁 검색어 ${d.serp.rivalWon}/${d.serp.rivalTotal}` };

  const cycleOk = !stopped;

  /**
   * 자리마다 「마지막으로 언제 · 다음은 언제 · 안 돌면 왜」.
   *
   * 누적값만 보여주면 지금 살아 있는지 알 수 없다.
   * 「이게 실제로 돌아가고 있는 건지 판단이 안 된다」는 말이 나왔고 그게 맞다.
   *
   * 다음 시각은 시간표(SLOTS)에서 팀으로 찾는다.
   * 사람이 켜 줘야 하는 자리는 「예정」이 아니라 「사람 필요」라고 적어야 한다 —
   * 시간만 적어 두면 저절로 도는 것처럼 보인다.
   */
  const ago = (iso: string | null) => {
    if (!iso) return null;
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "방금";
    if (m < 60) return `${m}분 전`;
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
    return `${Math.floor(m / 1440)}일 전`;
  };

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const dowNow = new Date().getDay();
  const todaySlots = SLOTS.filter((x) => x.dow === undefined || x.dow === dowNow);

  /** 이 팀이 다음에 도는 시각. 오늘 안 남았으면 내일 첫 차례. */
  const nextFor = (team: string) => {
    const mine = todaySlots.filter((x) => x.team === team);
    if (!mine.length) return null;
    const ahead = mine.filter((x) => toMin(x.at) > nowMin).sort((a, b) => toMin(a.at) - toMin(b.at));
    const pick = ahead[0] ?? mine.sort((a, b) => toMin(a.at) - toMin(b.at))[0];
    return { at: pick.at, name: pick.name, auto: pick.need === "무관", tomorrow: !ahead.length };
  };

  const RING_TEAM: Record<string, string> = {
    content: "콘텐츠", deliver: "유통", crawler: "", measure: "측정", next: "운영",
  };

  const beat = (id: keyof typeof d.lastAt) => {
    const team = RING_TEAM[id];
    const nx = team ? nextFor(team) : null;
    return {
      last: ago(d.lastAt[id]),
      next: id === "crawler"
        ? "쉬지 않음"
        : nx
        ? `${nx.tomorrow ? "내일 " : ""}${nx.at} ${nx.auto ? "자동" : "사람 필요"}`
        : "예정 없음",
    };
  };

  const FLOW_NODES: NodeState[] = [
    {
      id: "content", label: "콘텐츠", state: since === null ? "stop" : since <= 7 ? "run" : "wait",
      sub: since === null ? "기록 없음" : `${since}일 전 발행`,
    },
    {
      id: "deliver", label: "유통", state: d.posts.published > 0 ? "run" : "idle",
      sub: `${d.posts.published}편 내보냄`,
    },
    {
      id: "outside", label: "바깥", state: "run",
      sub: "사이트·네이버·구글",
    },
    {
      id: "crawler", label: "크롤러", state: crawling ? "run" : "stop",
      sub: `24시간 ${d.crawl.last24h}회`,
    },
    {
      id: "measure", label: "측정", state: measuredToday ? "run" : "wait",
      sub: d.serp.day ? `${fmtDay(d.serp.day)} 측정` : "미측정",
    },
    {
      id: "ops", label: "운영", state: "run",
      sub: "3시간마다 점검",
    },
    {
      id: "next", label: "다음을 정한다",
      state: d.serp.rivalWon > 0 ? "run" : "wait",
      sub: `경쟁 ${d.serp.rivalWon}/${d.serp.rivalTotal}`,
    },
    {
      id: "human", label: "사람", state: "wait",
      sub: "로그인·촬영·상담",
    },
    {
      id: "db", label: "기록", state: "run",
      sub: `경쟁 ${d.serp.rivalWon}/${d.serp.rivalTotal}`,
    },
  ];

  return (
    <div className="ops">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="ops-top">
          <div>
            <div className="eb">Cited · 운영 현황</div>
            <h1>AI 직원이 하고 있는 일</h1>
          </div>
          <Live slots={SLOTS} />
        </div>

        {/*
          고객사 줄. 지금은 한 곳이라 이름만 보이고, 늘어나면 탭이 된다.
          한 곳일 때 「고객사」라는 자리를 만들어 두는 게 싸다 —
          두 곳이 되고 나서 만들면 화면 전체를 다시 짜야 한다.
        */}
        {client && (
          <div className="ops-clients">
            <span className="lbl">고객사</span>
            {clients.map((x) => (
              <Link key={x.slug} href={`/admin/ops?c=${x.slug}`}
                    className={`chip ${x.slug === client.slug ? "on" : ""}`}>
                {x.name}
                <i>{x.relation === "자사" ? "자사" : "외부"}</i>
              </Link>
            ))}
            <span className="meta">
              {client.domain} · 착수 {client.startedOn.slice(5).replace("-", ".")}
              {client.baselineScore !== null && ` · 착수 진단 ${client.baselineScore}점`}
              {client.currentScore !== null && ` → 지금 ${client.currentScore}점`}
            </span>
            {/*
              자사 레퍼런스는 정해진 순서다 — 레퍼런스 증명 → 도메인 → 영업.
              그러니 경고로 띄우지 않는다. 다만 사실은 적어 둔다.
              밖에 내놓을 때 「직접 운영하는 학원」이라고 밝혀야 하기 때문이다.
            */}
            {clients.every((x) => x.relation === "자사") && (
              <span className="note2">
                직접 운영하는 곳으로 재고 있습니다. 밖에 낼 때 그 사실을 함께 밝힙니다.
              </span>
            )}
          </div>
        )}

        {!d.ok && <div className="err">데이터를 못 읽었습니다 — {d.err}</div>}

        {/* 요약 먼저. 자세한 건 아래에 */}
        <div className="ops-kpis">
          <div className={`ops-kpi ${d.posts.sinceDays === null ? "" : d.posts.sinceDays <= 7 ? "ok" : "warn"}`}>
            <div className="v">{d.posts.published}<small>편</small></div>
            <div className="k">발행 · 마지막 {d.posts.sinceDays ?? "?"}일 전</div>
          </div>
          <div className={`ops-kpi ${d.crawl.last24h > 0 ? "ok" : "crit"}`}>
            <div className="v">{d.crawl.last24h}<small>회</small></div>
            <div className="k">24시간 크롤러</div>
          </div>
          <div className={`ops-kpi ${covLow && covLow.pct >= 60 ? "ok" : "warn"}`}>
            <div className="v">{covLow ? covLow.pct.toFixed(0) : "—"}<small>%</small></div>
            <div className="k">제일 낮은 커버리지 · {covLow?.vendor ?? "—"}</div>
          </div>
          <div className={`ops-kpi ${d.serp.rivalWon > 0 ? "ok" : "warn"}`}>
            <div className="v">{d.serp.rivalWon}<small> / {d.serp.rivalTotal}</small></div>
            <div className="k">
              경쟁 검색어 · {fmtDay(d.serp.day)} 측정
              <em>학원 이름 빼고 「지역+업종」으로 친 검색</em>
            </div>
          </div>
          <div className={`ops-kpi ${d.place.length ? "ok" : ""}`}>
            <div className="v">{d.place.length ? `${d.place[0].rank}위` : "—"}</div>
            <div className="k">플레이스 최고 · {d.place[0]?.query ?? "미측정"}</div>
          </div>
          {/* 노출이 문의로 이어지는지 — 이 숫자만 사람이 넣어 준다 */}
          <div className={`ops-kpi ${im && im.total > 0 ? "ok" : "warn"}`}>
            <div className="v">{im?.fromSearch ?? 0}<small> / {im?.total ?? 0}</small></div>
            <div className="k">이번 달 검색 유입 · 문의</div>
          </div>
        </div>

        <h2>업무가 도는 고리</h2>
        <p className="sub">
          이 일은 한 바퀴 돌아 제자리로 옵니다. <b>쓰고 → 내보내고 → 크롤러가 읽어 가고 →
          그걸 재고 → 잰 결과로 다음에 뭘 쓸지 정합니다.</b> 그래서 고리입니다.
          {" "}한 자리가 막히면 뒤가 전부 멈추므로, 막힌 자리에 일감이 쌓이게 그렸습니다.
          {stopped ? (
            <b style={{ color: "var(--warn)" }}>
              {" "}지금은 「{RING_LABEL[stopped.at] ?? stopped.at}」에서 멈춰 있습니다 — {stopped.why}.
            </b>
          ) : (
            <b style={{ color: "var(--cool)" }}>
              {" "}지금 고리는 돌고 있습니다. 5번이 내놓은 답은 「{decision.do}」입니다 — {decision.why}.
            </b>
          )}
        </p>
        <Flow nodes={FLOW_NODES} slots={SLOTS} cycleOk={cycleOk}
              stopped={stopped} decision={decision}
              beats={{
                content: beat("content"), deliver: beat("deliver"),
                crawler: beat("crawler"), measure: beat("measure"), next: beat("next"),
              }} />

        <h2>하루 시간표</h2>
        <p className="sub">
          <b style={{ color: "var(--ok)" }}>자동</b>은 GitHub 이 돌립니다 — 클로드가 꺼져 있어도 돕니다.
          {" "}<b style={{ color: "var(--warn)" }}>세션 필요</b>는 로그인한 브라우저나 글 쓰는 일이라
          사람이 켜 줘야 합니다.
        </p>

        <div className="ops-splitnote">
          <div>
            <span className="n mono">{SLOTS.filter((x) => x.need === "무관").length}</span>
            <span className="t">칸이 사람 없이 돕니다</span>
            <span className="d">3시간마다 점검 · 색인 알림 · 노출 측정</span>
          </div>
          <div className="w2">
            <span className="n mono">{SLOTS.filter((x) => x.need === "세션").length}</span>
            <span className="t">칸은 사람이 필요합니다</span>
            <span className="d">구글·네이버 로그인 · 글쓰기</span>
          </div>
        </div>

        <div className="ops-tl">
          {SLOTS.map((sl) => (
            <div className="ops-slot" key={sl.at + sl.name}>
              <span className="t">{sl.at}</span>
              <span className="badge">{sl.team}</span>
              <span className="n">
                {sl.name}
                {sl.dow !== undefined && <span className="ops-gap">월요일만</span>}
              </span>
              <span className={`need ${sl.need === "무관" ? "auto" : "man"}`}>
                {sl.need === "무관" ? "자동" : "세션 필요"}
              </span>
            </div>
          ))}
        </div>

        <h2>자리마다 무슨 일을 하고, 무엇이 나왔나</h2>
        <p className="sub">
          하는 일 목록은 계획입니다. 그 옆의 숫자가 실제로 나온 것입니다.
        </p>
        <div className="ops-org">
          {AGENTS.map((a) => (
            <div className="ops-team" key={a.key}>
              <div className="ops-team-h">
                <span className="ops-team-g">{a.glyph}</span>
                <h3>{a.key}</h3>
                <span className="ops-cad">{a.cadence}</span>
              </div>
              <p className="ops-role">{a.role}</p>

              <div className="ops-perf">
                {a.perf(d).map(([k, v]) => (
                  <div className="ops-perf-r" key={k}>
                    <span>{k}</span><b className="mono">{v}</b>
                  </div>
                ))}
              </div>

              <ul>{a.jobs.map((j) => <li key={j}>{j}</li>)}</ul>
              <div className="tools">{a.tools.join(SEP)}</div>
            </div>
          ))}
        </div>

        <h2>사람만 할 수 있는 일</h2>
        <p className="sub">
          이건 자동화하지 않습니다. 자동화하면 안 되는 것도 있습니다.
          {d.serp.brandLost.length > 0 && (
            <b style={{ color: "var(--warn)" }}>
              {" "}우리 이름인데 안 나오는 검색이 있습니다 — {d.serp.brandLost.join(" · ")}.
            </b>
          )}
          {covLow && covLow.vendor === "openai" && covLow.pct < 60 && (
            <b style={{ color: "var(--warn)" }}>
              {" "}OpenAI 가 {covLow.pct.toFixed(0)}% 만 읽었습니다 — 빙 색인이 없어서입니다.
              빙 웹마스터 등록은 마이크로소프트 로그인이 필요합니다.
            </b>
          )}
          {(!im || im.total === 0) && (
            <b style={{ color: "var(--warn)" }}>
              {" "}상담 기록이 아직 0건입니다 — 노출이 문의로 이어지는지 못 재고 있습니다.
            </b>
          )}
        </p>
        <p className="sub">
          <a href="https://robotncoding.com/admin" target="_blank" rel="noopener"
             style={{ color: "var(--mut)", fontWeight: 600, marginRight: 18 }}>
            학원 글 관리 ↗
          </a>
          <Link href="/admin/inquiry"
                style={{ color: "var(--cool)", fontWeight: 700 }}>
            문의 기록하기 →
          </Link>
        </p>
        <div className="ops-human">
          {HUMAN.map((h) => (
            <div className="row" key={h.t}><b>{h.t}</b><span>{h.d}</span></div>
          ))}
        </div>

        <h2>크롤러 커버리지</h2>
        <p className="sub">전체 {d.crawl.totalPages}쪽 중 몇 쪽을 읽어 갔는가.</p>
        <div className="ops-tw">
          <table>
            <thead><tr><th>크롤러</th><th>방문</th><th>읽은 쪽</th><th>커버리지</th></tr></thead>
            <tbody>
              {d.crawl.vendors.map((v) => (
                <tr key={v.vendor}>
                  <td><b>{v.vendor}</b></td>
                  <td className="m">{v.hits}</td>
                  <td className="m">{v.pages}</td>
                  <td className="m">
                    <span className="bar"><i style={{ width: `${Math.min(100, v.pct)}%` }} /></span>
                    {v.pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {!d.crawl.vendors.length && <tr><td colSpan={4}>기록 없음</td></tr>}
            </tbody>
          </table>
        </div>

        <h2>검색에 처음 나온 날</h2>
        <p className="sub">영업에서 쓰는 날짜입니다. 기억으로 말하면 안 됩니다.</p>
        <div className="ops-tw">
          <table>
            <thead><tr><th>날짜</th><th>어디</th><th>검색어</th></tr></thead>
            <tbody>
              {d.firstSeen.map((f) => (
                <tr key={f.engine + f.query}>
                  <td className="m">{fmtDay(f.day)}</td>
                  <td className="m">{f.engine === "naver" ? "네이버" : "Bing"}</td>
                  <td><b>{f.query}</b></td>
                </tr>
              ))}
              {!d.firstSeen.length && <tr><td colSpan={3}>아직 없음</td></tr>}
            </tbody>
          </table>
        </div>

        <h2>최근 발행</h2>
        <div className="ops-tw">
          <table>
            <thead><tr><th>날짜</th><th>제목</th></tr></thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.slug}>
                  <td className="m">{fmtDay(r.at)}</td>
                  <td>
                    <a href={`https://robotncoding.com/blog/${r.slug}`}
                       target="_blank" rel="noopener" style={{ color: "var(--cool)" }}>
                      {r.title}
                    </a>
                  </td>
                </tr>
              ))}
              {!d.recent.length && <tr><td colSpan={2}>없음</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
