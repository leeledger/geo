import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

import { readOps, listClients } from "@/lib/ops";
import Live from "./Live";
import AgentBoard from "./AgentBoard";
import Link from "next/link";
import { inquirySummary } from "@/lib/inquiries";
import Brief from "./Brief";
import Growth from "./Growth";
import { readGrowth, type Growth as GrowthData } from "@/lib/growth";
/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin/ops";

/**
 * 크롤러마다 「어디에 쓰이나」. 원장 지적(2026-09-22): 표만 봐서는 뭘 뜻하는지 모르겠다.
 * direct = AI 가 답할 때 찾아보는 검색 색인. 여기가 낮으면 학습용이 다 읽어도 인용이 안 된다
 * (Claude 는 Brave, ChatGPT 검색·Copilot 은 빙 — 메모리 claude-search-needs-brave · openai-crawl-needs-bing)
 */
const VENDOR_USE: Record<string, { use: string; direct?: boolean }> = {
  google: { use: "구글 검색 · 구글 AI 답변", direct: true },
  naver: { use: "네이버 검색", direct: true },
  microsoft: { use: "빙 검색 → ChatGPT 검색 · Copilot", direct: true },
  openai: { use: "ChatGPT 학습 · 검색" },
  anthropic: { use: "Claude 학습 (답할 때는 Brave 를 찾는다)" },
  meta: { use: "메타 AI 학습" },
  amazon: { use: "알렉사 등 아마존 AI" },
  apple: { use: "애플 검색 · Siri" },
  perplexity: { use: "퍼플렉시티 검색", direct: true },
  duckduckgo: { use: "덕덕고 (결과 대부분은 빙에서)" },
  brave: { use: "Brave 검색 → Claude 웹 검색", direct: true },
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
  { at: "03:23", name: "색인 알림 · 스냅샷", team: "유통", need: "무관" },
  { at: "05:11", name: "점검", team: "운영", need: "무관" },
  { at: "06:07", name: "주간 초안 작성", team: "콘텐츠", need: "무관", dow: 1 },
  { at: "06:37", name: "문제 정찰", team: "운영", need: "무관" },
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

@media(max-width:640px){
  .ops-slot{grid-template-columns:70px 1fr;row-gap:5px}
  .ops-slot .badge,.ops-slot .need{justify-self:start}
}
`;

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

  const [d, inq, gr] = await Promise.all([
    readOps(client ?? undefined),
    inquirySummary(client?.id),
    // 통째로 실패하면 섹션에 이유 한 줄. 조각 실패는 readGrowth 안에서 null 로 잡힌다
    client
      ? readGrowth(client).then(
          (g): { g: GrowthData | null; err?: string } => ({ g }),
          (e) => ({ g: null, err: e instanceof Error ? e.message : String(e) }))
      : Promise.resolve({ g: null, err: "고객사가 없습니다" }),
  ]);
  const im = inq[0];
  // 「최고 커버리지」는 듣기 좋은 숫자였다. 실제로 손봐야 하는 건 제일 낮은 쪽이다 —
  // google 95% 옆에 openai 15% 가 있으면 문제는 openai 다.
  // 좋은 숫자를 만들지 않는 게 우리가 파는 것인데 대시보드가 그러고 있었다.
  const MAJOR = ["openai", "anthropic", "google", "naver"];
  const covLow = d.crawl.vendors
    .filter((v) => MAJOR.includes(v.vendor))
    .sort((a, b) => a.pct - b.pct)[0];

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
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/admin/outreach" style={{ color: "var(--acc)", fontSize: 13, textDecoration: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>첫 고객 영업판 →</Link>
          <Link href="/admin/pilots" style={{ color: "var(--cool)", fontSize: 13, textDecoration: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>유료 파일럿 납품 →</Link>
          <Link href="/admin/inquiry" style={{ color: "var(--ink2)", fontSize: 13, textDecoration: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>상담 유입 기록 →</Link>
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

        <Growth g={gr.g} err={gr.err} client={client} />

        <AgentBoard data={d} clientName={client?.name ?? "고객사 미선택"} />
        <Brief />

        <h2>고객사 성과 지표</h2>
        <p className="sub">에이전트의 실행 상태와 구분해서 보는 측정 결과입니다.</p>
        {d.ok && <>
        <div className="ops-kpis">
          <div className={`ops-kpi ${d.ai.comparable && d.ai.cited > 0 ? "ok" : "warn"}`}>
            <div className="v">{d.ai.cited}<small> / {d.ai.prompts}</small></div>
            <div className="k">
              AI 답변의 자사 사이트 인용 · {fmtDay(d.ai.day)}
              <em>{!d.ai.comparable ? "같은 엔진·방법 재측정 필요 · 서로 다른 회차는 개선률로 합치지 않음" : `${d.ai.engine} · ${d.ai.method}`}</em>
            </div>
          </div>
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
              <em>브랜드 이름 없이 업종·지역·상황으로 찾는 검색</em>
            </div>
          </div>
          <div className={`ops-kpi ${d.place.length ? "ok" : ""}`}>
            <div className="v">{d.place.length ? `${d.place[0].rank}위` : "—"}</div>
            <div className="k">플레이스 최고 · {d.place[0]?.query ?? "미측정"}</div>
          </div>
          {/* 노출이 문의로 이어지는지 — 이 숫자만 사람이 넣어 준다 */}
          <div className={`ops-kpi ${im && im.total > 0 ? "ok" : "warn"}`}>
            <div className="v">{im?.fromSearch ?? 0}<small> / {im?.total ?? 0}</small></div>
            <div className="k">전체 고객 · 이번 달 검색 유입 / 문의</div>
          </div>
        </div>

        </>}
        <details className="ops-disclosure"><summary>자동 실행 일정과 사람이 필요한 업무 보기</summary>
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
              {" "}OpenAI 수집 커버리지는 {covLow.pct.toFixed(0)}%입니다. 색인 상태와 접근 설정을 확인해야 합니다.
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

        </details>
        {d.ok && <>
        <h2>크롤러 커버리지</h2>
        <p className="sub">
          전체 {d.crawl.totalPages}쪽 중 몇 쪽을 읽어 갔는가. 읽어 간 것과 AI 답에 인용되는 것은 다르다 —
          학습용 로봇이 다 읽어도, 답할 때 찾아보는 검색 색인에 없으면 안 나온다.
          <b> ★ 가 붙은 줄이 AI 답변 검색에 직결된다.</b>
        </p>
        <div className="ops-tw">
          <table>
            <thead><tr><th>크롤러</th><th>어디에 쓰이나</th><th>방문</th><th>읽은 쪽</th><th>커버리지</th></tr></thead>
            <tbody>
              {d.crawl.vendors.map((v) => (
                <tr key={v.vendor}>
                  <td><b>{VENDOR_USE[v.vendor]?.direct ? "★ " : ""}{v.vendor}</b></td>
                  <td>{VENDOR_USE[v.vendor]?.use ?? "—"}</td>
                  <td className="m">{v.hits}</td>
                  <td className="m">{v.pages}</td>
                  <td className="m">
                    <span className="bar"><i style={{ width: `${Math.min(100, v.pct)}%` }} /></span>
                    {v.pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {!d.crawl.vendors.length && <tr><td colSpan={5}>기록 없음</td></tr>}
              <tr>
                <td><b>★ brave</b></td>
                <td>{VENDOR_USE.brave.use}</td>
                <td colSpan={3} className="m">로봇이 이름을 밝히지 않아 여기서 못 센다 — 측정(claude-code-web)의 인용으로 본다</td>
              </tr>
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
                  <td className="m">{f.engine === "naver" ? "네이버 웹문서" : f.engine === "naver_all" ? "네이버 통합검색" : f.engine === "bing" ? "Bing" : f.engine}</td>
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
                    <a href={`https://${client?.domain ?? "robotncoding.com"}/blog/${r.slug}`}
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
        </>}
      </div>
    </div>
  );
}
