import type { 할일결과, 할일상태 } from "@/lib/onboard-core.mjs";

/**
 * 새 고객 「할 일 순서」(Step 57 D256) — 고객 화면·계약 뒤 순서 화면 맨 위. 원장이 손댈 큰 일만 번호 목록으로.
 * 줄마다 누가(원장님·저희·고객) · 지금 상태(됨·지금 할 차례·아직). 자세한 줄은 그 아래 「자세히」에 접혀 있다.
 */
const 상태반: Record<할일상태, string> = { 됨: "done", "지금 할 차례": "now", 아직: "wait" };
/** 렌더하는 링크는 /admin 경로만 */
const 링크됨 = (s?: string | null): s is string => !!s && /^\/admin(\/|$|#|\?)/.test(s);

export default function TodoOrder({ r }: { r: 할일결과 }) {
  return (
    <section className="to" aria-labelledby="to-h" data-testid="todo-order" data-branch={r.갈래}>
      <h2 id="to-h">할 일 순서 <span className="to-b">{r.갈래말}</span></h2>
      {r.취소 ? (
        <p className="to-none">취소된 계약입니다. 할 일이 없습니다</p>
      ) : (
        <ol className="to-list">
          {r.줄.map((x) => (
            <li key={x.id} className={`to-row ${상태반[x.상태]}`} data-todo={x.id} data-state={x.상태} data-who={x.누가}>
              <span className="to-n" aria-hidden="true">{x.n}</span>
              <span className="to-k">{x.일}</span>
              <span className="to-who">{x.누가}</span>
              <span className={`to-s ${상태반[x.상태]}`}>{x.상태}</span>
              <span className="to-m">
                {x.말}
                {링크됨(x.링크) && <> <a href={x.링크}>열기</a></>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="to-auto">{r.자동말}</p>
    </section>
  );
}
