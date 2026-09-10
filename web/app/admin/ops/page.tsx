import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

import { readOps } from "@/lib/ops";
import Live from "./Live";
import Flow, { type NodeState } from "./Flow";
import Link from "next/link";
import { inquirySummary } from "@/lib/inquiries";
/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin/ops";

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
      ["노출 잡은 검색어", `${d.serp.hits.length}건`],
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

/* 24시간 띠 — 빈 시간이 있는지 눈으로 보이게 한다 */
.ops-band{padding:2px 4px 30px}
.ops-band-h{display:flex;justify-content:space-between;align-items:baseline;
  font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--faint);
  letter-spacing:.12em;margin-bottom:9px}
.ops-band-note{display:flex;gap:14px;align-items:baseline;letter-spacing:0}
.ops-band-note .live{color:var(--ok);font-weight:700}
.ops-band-note .idle{color:var(--faint)}
.ops-band-note .nx{color:var(--mut)}
.ops-band-track{position:relative;height:34px;background:var(--sunk);
  border:1px solid var(--line);border-radius:9px}
.ops-band-track .tick{position:absolute;top:0;bottom:0;width:1px;background:var(--line)}
.ops-band-track .tick span{position:absolute;top:38px;left:-5px;font-size:10px;
  color:var(--faint);font-family:"IBM Plex Mono",monospace}
.ops-band-track .mk{position:absolute;top:7px;width:7px;height:20px;border-radius:3px;
  transform:translateX(-3.5px);opacity:.9}
.ops-band-track .mk.auto{outline:1.5px solid rgba(61,214,160,.55);outline-offset:1px}
.ops-band-track .nowline{position:absolute;top:-4px;bottom:-4px;width:2px;background:#fff;
  box-shadow:0 0 10px rgba(255,255,255,.6);border-radius:1px}
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
}: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  const [d, inq] = await Promise.all([readOps(), inquirySummary()]);
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
  const cycleOk = crawling && d.serp.hits.length > 0;

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
      id: "human", label: "사람", state: "wait",
      sub: "로그인·촬영·상담",
    },
    {
      id: "db", label: "기록", state: "run",
      sub: `노출 ${d.serp.hits.length}건`,
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
          <div className={`ops-kpi ${d.serp.hits.length > 0 ? "ok" : "warn"}`}>
            <div className="v">{d.serp.hits.length}<small> / {d.serp.total}</small></div>
            <div className="k">검색 노출 · {fmtDay(d.serp.day)} 측정</div>
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

        <h2>업무가 흐르는 길</h2>
        <p className="sub">
          이 일은 고리입니다. 쓰고 → 내보내고 → 크롤러가 읽어 가고 → 그걸 재고 →
          다음에 뭘 쓸지 정합니다. 어디서 끊겼는지 보이면 손을 쓸 수 있습니다.
        </p>
        <Flow nodes={FLOW_NODES} slots={SLOTS} cycleOk={cycleOk} />

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
