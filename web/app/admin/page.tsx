import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

import { listLeads, dbEnabled } from "@/lib/leads";
import { changeLeadStatus } from "@/lib/lead-actions";
import AdminNav from "./AdminNav";

/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 리드 큐 — 무료 진단 뒤 연락처를 남긴 사람.
 * 맨 위는 새로 연락할 사람(상태 new). 연락한 뒤·종료된 사람은 「지난 연락」 자세히에.
 * 넓은 표는 모바일에서 깨져서 카드로 바꿨다. 등급·진단 도메인·경로는 카드 안 자세히.
 */

const CSS = `
.ld-list{display:grid;gap:8px}
.ld-card .a form{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0}
.ld-card .a select{font-size:14px;padding:7px 9px}
.ld-card details{margin-top:8px}
.ld-card details>summary{cursor:pointer;font-size:14px;color:var(--ink2)}
.ld-card dl{margin:6px 0 0;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:14px}
.ld-card dt{color:var(--ink2)}
.ld-card dd{margin:0;overflow-wrap:anywhere}
.ld-score.low{color:var(--crit)} .ld-score.mid{color:var(--warn)} .ld-score.hi{color:var(--ok)}
`;

const STATUS: [string, string][] = [
  ["new", "새 문의"], ["contacted", "연락함"], ["qualified", "상담 대상"], ["closed", "계약"], ["dropped", "종료"],
];

/** KST 로 찍는다 — 서버가 UTC 면 9시간 틀린다(CLAUDE.md 함정) */
const fmt = (d: string) =>
  new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

type Lead = {
  id: string; created_at: string; email: string; company: string | null; origin?: string | null; site?: string | null;
  site_score: number | null; grade: string | null; wants: string | null; referral: string | null;
  concerns: string | null; competitor: string | null; status: string | null;
};

function Card({ l }: { l: Lead }) {
  const said = [l.wants, l.concerns, l.competitor && `경쟁사 ${l.competitor}`].filter(Boolean).join(" · ");
  const domain = (l.origin ?? l.site)?.replace(/^https?:\/\//, "") ?? null;
  const score = l.site_score;
  return (
    <div className="adm-card ld-card">
      <div className="h">{l.company || "회사명 없음"}</div>
      <div className="d">{l.email} · {fmt(l.created_at)}</div>
      <div className="d">{said || "남긴 말 없음"}</div>
      <div className="a">
        <form action={changeLeadStatus}>
          <input type="hidden" name="id" value={l.id} />
          <select name="status" defaultValue={l.status ?? "new"} aria-label="리드 상태">
            {STATUS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <button type="submit" className="adm-btn">저장</button>
        </form>
      </div>
      <details>
        <summary>진단 · 경로</summary>
        <dl>
          <dt>사이트 점수</dt>
          <dd className={`ld-score ${score == null ? "" : score < 40 ? "low" : score < 60 ? "mid" : "hi"}`}>{score ?? "—"}</dd>
          <dt>등급</dt><dd>{l.grade ?? "—"}</dd>
          <dt>진단 도메인</dt><dd>{domain ?? "—"}</dd>
          <dt>어떻게 왔나</dt><dd>{l.referral ?? "—"}</dd>
        </dl>
      </details>
    </div>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  const leads = (await listLeads(200)) as Lead[];
  const fresh = leads.filter((l) => (l.status ?? "new") === "new");
  const past = leads.filter((l) => (l.status ?? "new") !== "new");

  return (
    <div className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="adm-top">
          <h1>리드</h1>
          <AdminNav here="/admin" />
        </div>
        {!dbEnabled && <p className="sub" style={{ color: "var(--crit)", marginBottom: 10 }}>저장소가 연결되지 않았습니다 — 여기 쌓인 리드는 배포하면 사라집니다.</p>}

        <section className="adm-todo" aria-labelledby="ld-h">
          <h2 id="ld-h">새로 연락할 사람{fresh.length > 0 && <span className="n"> {fresh.length}명</span>}</h2>
          {fresh.length === 0
            ? <p className="none">없음 — 무료 진단 뒤 연락처를 남기면 여기 뜹니다</p>
            : <div className="ld-list">{fresh.map((l) => <Card key={l.id} l={l} />)}</div>}
        </section>

        {past.length > 0 && (
          <details className="adm-more">
            <summary>지난 연락 {past.length}명 — {STATUS.slice(1).map(([v, t]) => `${t} ${past.filter((l) => l.status === v).length}`).join(" · ")}</summary>
            <div className="in ld-list">
              {past.map((l) => <Card key={l.id} l={l} />)}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
