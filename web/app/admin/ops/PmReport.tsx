import type { PmReport as Data, PmStatus } from "@/lib/pm-report";

/**
 * ⓪ 오늘 아침 보고 — 현황판 맨 위, 「오늘 원장님이 하실 일」 위.
 *
 * 총괄(pm-report.mjs)이 매일 08시 넘어 한 장 남긴다. 문장은 거기서 틀에 숫자만 넣어 만든 것 — 여기서 고치지 않는다.
 * 상태 · 결론 · 확인 필요(있을 때만)를 펼쳐 두고, 직원별 한 줄과 다음 할 일은 접는다.
 */

const 뱃지: Record<PmStatus, string> = { 정상: "ok", 주의: "warn", 막힘: "crit" };

const 월일 = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${m}/${d}`;
};

export const PM_CSS = `
.pm{margin-top:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.pm-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ops .pm h2{margin:0;font-size:19px}
.pm-badge{font-size:14px;font-weight:800;border-radius:999px;padding:2px 10px;border:1px solid currentColor}
.pm-badge.ok{color:var(--ok)}.pm-badge.warn{color:var(--warn)}.pm-badge.crit{color:var(--crit)}
.pm-con{margin:8px 0 0;font-size:16px;font-weight:700}
.pm-need{margin:10px 0 0;padding:10px 12px;background:var(--sunk);border:1px solid var(--line);border-radius:10px}
.pm-need b{display:block;font-size:14px;color:var(--warn);margin-bottom:4px}
.pm-need ul,.pm-staff ul{margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:var(--ink)}
.pm-meta{margin:8px 0 0;font-size:14px;color:var(--ink2)}
.pm-staff{margin-top:8px}
.pm-staff>summary{cursor:pointer;font-size:14px;color:var(--ink2)}
.pm-staff ul{margin-top:6px}
.pm-staff li span{color:var(--ink2)}
.pm-none{margin:8px 0 0;font-size:15px;color:var(--ink2)}
.pm-none.bad{color:var(--crit)}
`;

export default function PmReport({ data }: { data: Data }) {
  if (!data.ok) {
    return (
      <section className="pm" aria-label="아침 보고">
        <div className="pm-head"><h2>오늘 아침 보고</h2></div>
        <p className="pm-none bad">보고를 못 읽었습니다.</p>
      </section>
    );
  }
  if (!data.report) {
    return (
      <section className="pm" aria-label="아침 보고">
        <div className="pm-head"><h2>오늘 아침 보고</h2></div>
        <p className="pm-none">아직 보고가 없습니다. 매일 08시가 지나면 총괄이 한 장 남깁니다.</p>
      </section>
    );
  }
  const { day, today, body: b } = data.report;
  return (
    <section className="pm" aria-label="아침 보고">
      <div className="pm-head">
        <h2>{today ? `오늘 아침 보고 · ${월일(day)}` : `${월일(day)} 보고`}</h2>
        <span className={`pm-badge ${뱃지[b.status] ?? "warn"}`}>{b.status}</span>
      </div>
      <p className="pm-con">{b.conclusion}</p>
      {b.확인필요.length > 0 && (
        <div className="pm-need">
          <b>확인 필요 {b.확인필요.length}건</b>
          <ul>{b.확인필요.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      <p className="pm-meta">원장님 할 일 {b.원장할일}건 · {b.산출물.join(" · ")}</p>
      <details className="pm-staff">
        <summary>직원별 한 줄 · 다음</summary>
        <ul>
          {b.직원.map((s) => (
            <li key={s.id}><b>{s.이름}</b> {s.한일} <span>— {s.지금}</span></li>
          ))}
        </ul>
        <ul>{b.다음.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </details>
    </section>
  );
}
