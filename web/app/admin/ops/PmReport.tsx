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
.pm-ai{margin:10px 0 0;border-collapse:collapse;font-size:14px;min-width:0;width:auto}
.ops .pm-ai th,.ops .pm-ai td{padding:4px 12px 4px 0;border:0;text-align:left;background:none}
.pm-ai th{color:var(--ink2);font-weight:600}
.pm-ai td.n{font-variant-numeric:tabular-nums}
.pm-ai-note{margin:4px 0 0;font-size:13px;color:var(--ink2)}
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
      {(b.AI답변 ?? []).length > 0 && (
        <>
          <table className="pm-ai" aria-label="엔진별 AI 답변">
            <thead><tr><th>물어본 곳</th><th>학원 이름이 나온 답</th><th>우리 링크가 붙은 답</th><th>지난번과</th></tr></thead>
            <tbody>
              {b.AI답변!.map((a) => (
                <tr key={a.엔진}>
                  <td><b>{a.엔진}</b> <span className="pm-ai-note">{월일(a.day)} 측정</span></td>
                  <td className="n">{a.n}개 중 {a.이름}개{a.전체 === false && <span className="pm-ai-note"> (일부만 물음)</span>}</td>
                  <td className="n">{a.링크없음 ? "링크를 안 보여 줌" : `${a.n}개 중 ${a.인용}개`}</td>
                  <td>{a.비교 ? `${월일(a.비교.day)} ${a.비교.전이름}개 → ${a.비교.지금이름}개 (${a.비교.말})` : "첫 측정"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pm-ai-note">같은 질문을 매일 한 번 묻습니다. 답이 날마다 조금씩 달라서 3개 이하 차이는 「비슷」으로 봅니다. <a href="/admin/asks" style={{ color: "var(--acc)" }}>어떤 질문을 몇 시에 물었는지 보기 →</a></p>
        </>
      )}
      {b.산출물.length > 0 && <p className="pm-meta">어제부터 한 일: {b.산출물.join(" · ")}</p>}
      {(b.고객별 ?? []).map((c) => <p key={c.slug} className="pm-meta"><b>{c.name}</b> {c.줄}</p>)}
      <details className="pm-staff">
        <summary>담당별로 한 일과 다음 할 일</summary>
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
