import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/admin-auth";
import { readOps, listClients } from "@/lib/ops";
import { readGrowth, type Growth as GrowthData } from "@/lib/growth";
import { readAgents } from "@/lib/agents";
import { readPmReport } from "@/lib/pm-report";
import { readVisits, type Visits as VisitsData } from "@/lib/visits";
import Todo from "./Todo";
import AgentStrip from "./AgentStrip";
import Growth, { GrowthMore } from "./Growth";
import AgentBoard from "./AgentBoard";
import Brief from "./Brief";
import PmReport, { PM_CSS } from "./PmReport";
import AskLog from "./AskLog";
import Visits from "./Visits";

/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin/ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 운영 현황 — 원장이 여는 이유는 셋이다. (1) 내가 뭘 해야 하나 (2) 직원들이 잘 돌고 있나 (3) 크고 있나.
 * 그 순서로 위에서부터 놓고, 결정에 안 쓰이는 것은 맨 아래 「자세히」 하나에 접는다.
 *
 * 숫자는 전부 DB 에서 읽는다. 못 읽으면 「확인 못함」으로 적는다.
 * 사이티드는 이 숫자를 파는 회사라, 여기에 지어낸 값이 들어가면 사업이 무너진다.
 */

/**
 * 크롤러마다 사람 이름과 「어디에 쓰이나」. direct = AI 가 답할 때 찾아보는 검색 색인.
 * (Claude 는 Brave, ChatGPT 검색·Copilot 은 빙 — 메모리 claude-search-needs-brave · openai-crawl-needs-bing)
 */
const VENDOR_USE: Record<string, { name: string; use: string; direct?: boolean }> = {
  google: { name: "구글", use: "구글 검색 · 구글 AI 답변", direct: true },
  naver: { name: "네이버", use: "네이버 검색", direct: true },
  microsoft: { name: "빙", use: "빙 검색 → ChatGPT 검색 · Copilot", direct: true },
  openai: { name: "ChatGPT", use: "ChatGPT 학습 · 검색" },
  anthropic: { name: "Claude", use: "Claude 학습 (답할 때는 Brave 를 찾는다)" },
  meta: { name: "메타", use: "메타 AI 학습" },
  amazon: { name: "아마존", use: "알렉사 등 아마존 AI" },
  apple: { name: "애플", use: "애플 검색 · Siri" },
  perplexity: { name: "퍼플렉시티", use: "퍼플렉시티 검색", direct: true },
  duckduckgo: { name: "덕덕고", use: "덕덕고 (결과 대부분은 빙에서)" },
  brave: { name: "Brave", use: "Brave 검색 → Claude 웹 검색", direct: true },
};

const CSS = `
.ops{--bg:#0C1016;--card:#141A22;--sunk:#10151C;--line:#232C38;--soft:#1A222C;
  --ink:#E8EDF3;--ink2:#A7B2C0;--mut:#7B8696;--faint:#5A6474;
  --acc:#F5A623;--cool:#3DD6C4;--ok:#3DD6A0;--warn:#E0A93C;--crit:#D2705F;
  background:var(--bg);color:var(--ink);min-height:100vh;font-size:16px;line-height:1.55;word-break:keep-all;
  font-family:"Noto Sans KR",system-ui,sans-serif;padding:18px 0 80px}
.ops .w{max-width:920px;margin:0 auto;padding:0 16px}
/* 랜딩 globals.css 의 section·nav·h2 규칙을 이 화면에서 끊는다 */
:where(.ops) section{padding:0}
:where(.ops) nav{position:static;z-index:auto;border:0;background:none;backdrop-filter:none}
:where(.ops) details{border:0;border-radius:0;background:none;overflow:visible;box-shadow:none}
:where(.ops) summary{padding:0;font-size:inherit;font-weight:inherit;display:list-item}
:where(.ops) summary::after{content:none}
.ops h1,.ops h2,.ops h3{max-width:none;color:var(--ink)}
.ops h1{font-size:24px;font-weight:900;letter-spacing:-.03em;margin:0}
.ops h2{font-size:21px;font-weight:800;letter-spacing:-.025em;margin:34px 0 4px}
.ops .sub{font-size:14px;color:var(--ink2);margin:0}
.ops-top{display:flex;justify-content:space-between;align-items:center;gap:8px 16px;flex-wrap:wrap}
.ops-links{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:14px}
.ops-links a{color:var(--ink2);text-decoration:none;border-bottom:1px solid var(--line)}
.ops-links a:hover{color:var(--ink)}
.ops-clients{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.ops-clients a{border:1px solid var(--line);border-radius:999px;padding:5px 14px;font-size:14px;font-weight:700;
  color:var(--ink2);text-decoration:none;background:var(--sunk)}
.ops-clients a.on{border-color:var(--cool);color:var(--ink);background:rgba(61,214,196,.08)}
.ops .err{background:#1E1416;border:1px solid #3D2A2C;border-radius:12px;padding:14px 18px;color:#E58F7F;font-size:16px;margin-top:14px}

/* ① 오늘 원장님이 하실 일 */
.td{margin-top:14px;background:#1d1a14;border:1px solid #5c4a2a;border-radius:14px;padding:14px 16px}
.ops .td h2{margin:0 0 10px;color:#F0CE87}
.td-n{font-size:16px;font-weight:700;color:#F0CE87}
.td-none{margin:0;font-size:16px;color:var(--ink)}
.td-none.bad{color:var(--crit)}
.td-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.td-list li{display:flex;gap:14px;align-items:center;justify-content:space-between;background:var(--card);
  border:1px solid var(--line);border-radius:10px;padding:6px 12px}
.td-t{min-width:0;flex:1;display:grid;grid-template-columns:minmax(0,max-content) minmax(0,1fr);align-items:baseline;column-gap:12px}
.td-t b{font-size:16px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px}
.td-why{font-size:14px;color:var(--ink2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.td-act{flex:none}
.td-btn{display:inline-block;font:inherit;font-size:14px;font-weight:700;color:#1a1204;background:var(--acc);border:0;
  border-radius:8px;padding:7px 12px;cursor:pointer;white-space:nowrap;text-decoration:none}
.td-btn.alt{background:#2a333f;color:var(--ink)}
.td-naver{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.td-naver input{background:var(--sunk);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font:inherit;font-size:14px;min-width:150px}
.td-more{margin:8px 0 0;font-size:14px;color:var(--ink2)}
.td-session{margin:10px 2px 0;font-size:14px;color:var(--ink2);word-break:keep-all}
.td-list li.doing{opacity:.6}
.ops .td-more-d{position:relative;border:0;border-radius:0;background:none;overflow:visible;box-shadow:none}
.ops .td-more-d>summary{display:inline-block;padding:7px 12px;font-size:14px}
.ops .td-more-d>summary::after{content:none}
.ops .td-more-d p{position:absolute;right:0;top:calc(100% + 6px);z-index:5;width:min(420px,80vw);max-width:none;box-sizing:border-box;
  background:var(--sunk);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0;font-size:14px;line-height:1.6;color:var(--ink2)}
@media(max-width:720px){.ops .td-more-d>summary{display:block;text-align:center}.ops .td-more-d p{position:static;width:auto;margin-top:6px}}
@media(max-width:720px){
  .td-list li{flex-direction:column;align-items:stretch;gap:8px}
  .td-t{display:flex;flex-direction:column}
  .td-t b{white-space:normal;max-width:none;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .td-btn{text-align:center;width:100%;box-sizing:border-box}
}

/* ⑤ 자세히 */
.ops-more{margin-top:34px;border:1px solid var(--line);border-radius:14px;background:var(--sunk)}
.ops-more>summary{cursor:pointer;padding:14px 18px;font-size:16px;font-weight:800;color:var(--ink2)}
.ops-more>summary:focus-visible{outline:2px solid var(--acc);outline-offset:-2px}
.ops-more-in{padding:0 16px 20px}
.ops-more-in h3{font-size:17px;font-weight:800;margin:26px 0 8px}
.ops-tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.ops table{border-collapse:collapse;width:100%;font-size:14px;min-width:460px}
.ops th,.ops td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--soft)}
.ops thead th{background:var(--sunk);font-size:14px;color:var(--ink2);font-weight:600}
.ops tbody tr:last-child td{border-bottom:0}
.ops td.m{color:var(--ink2);white-space:nowrap;font-variant-numeric:tabular-nums}
.ops .bar{display:inline-block;width:64px;height:5px;border-radius:3px;background:var(--soft);overflow:hidden;vertical-align:middle;margin-right:8px}
.ops .bar i{display:block;height:100%;background:var(--cool)}
.ops-more .staff-board{margin-top:26px}
`;

const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }) : "—";

export default async function OpsPage({
  searchParams,
}: { searchParams: Promise<{ key?: string; c?: string }> }) {
  const { key, c: want } = await searchParams;
  // 옛 열쇠 주소는 쿠키로 바꿔 준다 — 서버 동작(저장 버튼)이 쿠키로만 관리자를 가린다
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(HERE));
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  // 주소에 ?c=슬러그 를 붙이면 그 고객사를 본다
  const clients = await listClients();
  const client = clients.find((x) => x.slug === want) ?? clients[0] ?? null;

  const [d, gr, agents, pm, vis] = await Promise.all([
    readOps(client ?? undefined),
    // 통째로 실패하면 섹션에 이유 한 줄. 조각 실패는 readGrowth 안에서 null 로 잡힌다
    client
      ? readGrowth(client).then(
          (g): { g: GrowthData | null; err?: string } => ({ g }),
          (e) => ({ g: null, err: e instanceof Error ? e.message : String(e) }))
      : Promise.resolve({ g: null, err: "고객사가 없습니다" }),
    readAgents(),
    readPmReport(),
    // 사람 방문(Step 29) — 못 읽으면 카드에 이유 한 줄
    client
      ? readVisits(client.id).then(
          (v): { v: VisitsData | null; err?: string } => ({ v }),
          (e) => ({ v: null, err: e instanceof Error ? e.message : String(e) }))
      : Promise.resolve({ v: null, err: "고객사가 없습니다" }),
  ]);

  return (
    <div className="ops">
      <style dangerouslySetInnerHTML={{ __html: CSS + PM_CSS }} />
      <div className="w">
        <div className="ops-top">
          <h1>운영 현황{client && clients.length < 2 ? ` · ${client.name}` : ""}</h1>
          <nav className="ops-links" aria-label="다른 관리 화면">
            <Link href={`/admin/asks${client ? `?c=${client.slug}` : ""}`}>AI 질문 기록</Link>
            <Link href="/admin/outreach">영업판</Link>
            <Link href="/admin/pilots">파일럿</Link>
            <Link href="/admin/inquiry">상담 기록</Link>
          </nav>
        </div>
        {clients.length > 1 && (
          <nav className="ops-clients" aria-label="고객사">
            {clients.map((x) => (
              <Link key={x.slug} href={`/admin/ops?c=${x.slug}`} className={x.slug === client?.slug ? "on" : ""}
                    aria-current={x.slug === client?.slug ? "page" : undefined}>
                {x.name}
              </Link>
            ))}
          </nav>
        )}

        {!d.ok && <div className="err">데이터를 못 읽었습니다 — {d.err}</div>}

        <PmReport data={pm} />
        <Todo company={d.company} unresolved={gr.g?.inquiries ? gr.g.inquiries.unresolved : null} />
        <AgentStrip initial={agents} />
        <Growth g={gr.g} err={gr.err} />
        <Visits v={vis.v} err={vis.err} name={client?.name ?? "고객사 미선택"} />
        <AskLog client={client} />

        <details className="ops-more">
          <summary>자세히 (운영자용)</summary>
          <div className="ops-more-in">
            <GrowthMore g={gr.g} client={client} place={d.place} />

            <h3>크롤러 — 몇 쪽을 읽어 갔나</h3>
            {!d.ok ? <p className="sub">확인 못함</p> : (
              <div className="ops-tw">
                <table>
                  <thead><tr><th>크롤러</th><th>어디에 쓰이나</th><th>방문</th><th>읽은 쪽</th></tr></thead>
                  <tbody>
                    {d.crawl.vendors.map((v) => (
                      <tr key={v.vendor}>
                        <td><b>{VENDOR_USE[v.vendor]?.direct ? "★ " : ""}{VENDOR_USE[v.vendor]?.name ?? "기타"}</b></td>
                        <td>{VENDOR_USE[v.vendor]?.use ?? "—"}</td>
                        <td className="m">{v.hits.toLocaleString("ko-KR")}</td>
                        <td className="m">
                          <span className="bar"><i style={{ width: `${Math.min(100, v.pct)}%` }} /></span>
                          {v.pages} / {d.crawl.totalPages}쪽
                        </td>
                      </tr>
                    ))}
                    {!d.crawl.vendors.length && <tr><td colSpan={4}>기록 없음</td></tr>}
                    <tr>
                      <td><b>★ Brave</b></td>
                      <td>{VENDOR_USE.brave.use}</td>
                      <td colSpan={2} className="m">로봇이 이름을 밝히지 않아 여기서 못 센다 — Claude 답변 측정의 인용으로 본다</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="sub" style={{ marginTop: 6 }}>★ = AI 가 답할 때 찾아보는 검색 색인. 학습용 로봇이 다 읽어도 여기 없으면 답에 안 나온다.</p>

            <h3>최근 글 5편</h3>
            <div className="ops-tw">
              <table>
                <thead><tr><th>날짜</th><th>제목</th></tr></thead>
                <tbody>
                  {d.recent.slice(0, 5).map((r) => (
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
                  {!d.recent.length && <tr><td colSpan={2}>{d.ok ? "없음" : "확인 못함"}</td></tr>}
                </tbody>
              </table>
            </div>

            <AgentBoard data={d} clientName={client?.name ?? "고객사 미선택"} />
            <Brief />
          </div>
        </details>
      </div>
    </div>
  );
}
