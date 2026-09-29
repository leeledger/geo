import Link from "next/link";

import type { Client } from "@/lib/ops";
import { readAskDays, readAsks, mainMethod, RESULT_TEXT } from "@/lib/asks";

/**
 * AI 에게 물어본 질문 — 가장 최근 측정한 날, 매일 자동으로 묻는 곳 하나의 질문 전부.
 * 그날 다른 곳에도 물었으면 곳마다 요약 한 줄만 더 적는다(숫자를 합치지 않는다). 답·출처·지난 날짜는 /admin/asks.
 */

const CSS = `
.al{margin-top:34px}
.al-hd{display:flex;justify-content:space-between;align-items:baseline;gap:6px 16px;flex-wrap:wrap}
.al-hd h2{margin:0}
.al-hd a{font-size:14px;font-weight:700;color:var(--acc);text-decoration:none}
.al-sum{margin:4px 0 0;font-size:15px;color:var(--ink2)}
.al-sum b{color:var(--ink)}
.al-list{list-style:none;margin:8px 0 0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden}
.al-list li{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:baseline;padding:8px 16px;border-bottom:1px solid var(--soft);font-size:15px}
.al-list li:last-child{border-bottom:0}
.al-t{font-size:14px;color:var(--ink2);font-variant-numeric:tabular-nums}
.al-q small{display:block;font-size:13px;color:var(--ink2)}
.al-r{font-size:13px;font-weight:700;white-space:nowrap;color:var(--ink2)}
.al-r.both,.al-r.cited{color:var(--ok)}
.al-r.named{color:var(--warn)}
@media(max-width:640px){.al-list li{grid-template-columns:44px minmax(0,1fr)}.al-r{grid-column:2}}
`;

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const span = (a: string | null, b: string | null) => (a ? (b && b !== a ? `${a}~${b}` : a) : "");

export default async function AskLog({ client }: { client: Client | null }) {
  if (!client) return null;
  let body;
  try {
    const days = await readAskDays(client, 1);
    const d = days[0];
    const main = mainMethod(days);
    if (!d || !main) {
      body = <p className="al-sum">아직 물어본 기록이 없습니다.</p>;
    } else {
      const rows = await readAsks(client, d.day, 0, main);
      body = (
        <>
          {d.places.map((p) => (
            <p className="al-sum" key={p.method}>
              {md(d.day)} {span(p.first, p.last)} · <b>{p.where}</b>에 질문 {p.n}개 —
              학원 이름 <b>{p.named}개</b>, 우리 사이트 링크 <b>{p.cited}개</b>
            </p>
          ))}
          {d.places.length > 1 && <p className="al-sum">아래 목록은 {rows[0]?.where ?? "대표 곳"} 질문만입니다. 다른 곳은 기록 화면에서 봅니다.</p>}
          <ol className="al-list">
            {rows.map((r) => (
              <li key={r.id}>
                <span className="al-t">{r.time ?? "—"}</span>
                <span className="al-q">{r.question}<small>{r.where}</small></span>
                <span className={`al-r ${r.result}`}>{RESULT_TEXT[r.result]}</span>
              </li>
            ))}
          </ol>
        </>
      );
    }
  } catch (e) {
    console.error("asklog", e);
    body = <p className="al-sum">기록을 못 읽었습니다.</p>;
  }
  return (
    <section className="al" aria-labelledby="al-h">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="al-hd">
        <h2 id="al-h">AI 에게 물어본 질문</h2>
        <Link href={`/admin/asks?c=${client.slug}`}>날짜별 기록 · AI 의 답 보기 →</Link>
      </div>
      {body}
    </section>
  );
}
