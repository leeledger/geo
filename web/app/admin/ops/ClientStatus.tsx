import type { ClientStatus as Data } from "@/lib/client-status";

/**
 * 고객 상태 칸(Step 40 D63) — 고객 탭 맨 위, 아침 보고 위. 「이번 주 실제로 한 일 / 손댄 날 / 밀린 일·며칠째」.
 * 문장은 client-status-core.mjs 가 숫자로 만든 것 — 여기서 고치지 않는다. 못 읽으면 못 읽었다고 적는다(빈 칸·0 금지).
 */
const 뱃지색 = { "돌고 있음": "ok", 느림: "warn", 멈춤: "crit", "아직 시작 전": "warn" } as const;

export const CS_CSS = `
.cs{margin-top:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.cs-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ops .cs h2{margin:0;font-size:19px}
.cs dl{margin:10px 0 0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:15px;line-height:1.6}
.cs dt{color:var(--ink2);font-weight:700;white-space:nowrap}
.cs dd{margin:0;word-break:keep-all}
.cs ul{margin:0;padding-left:18px}
.cs-none{margin:8px 0 0;font-size:15px;color:var(--crit)}
`;

export default function ClientStatus({ data, name }: { data: Data; name: string }) {
  if (!data.ok) {
    return (
      <section className="cs" aria-label={`${name} 상태`}>
        <div className="cs-head"><h2>{name} · 이번 주</h2></div>
        <p className="cs-none">이 고객 상태를 못 읽었습니다</p>
      </section>
    );
  }
  const s = data.s;
  return (
    <section className="cs" aria-label={`${name} 상태`}>
      <div className="cs-head">
        <h2>{s.제목}</h2>
        <span className={`pm-badge ${뱃지색[s.뱃지]}`}>{s.뱃지}</span>
      </div>
      <dl>
        <dt>한 일</dt><dd>{s.한일}</dd>
        <dt>손댄 날</dt><dd>{s.손댄날}</dd>
        <dt>밀린 일</dt>
        <dd>{s.밀린일.length === 1 && s.밀린일[0] === "밀린 일 없습니다" ? s.밀린일[0] : <ul>{s.밀린일.map((x) => <li key={x}>{x}</li>)}</ul>}</dd>
      </dl>
    </section>
  );
}
