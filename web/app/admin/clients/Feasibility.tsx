import type { 판정판 } from "@/lib/feasibility";
import { 기준안내 } from "@/lib/feasibility-core.mjs";
import CopyButton from "../ops/CopyButton";

/**
 * 착수 판정(Step 58) — 고객 화면 「할 일 순서」 바로 아래. 원장만 본다(D270). 퍼센트·성공률 없음, 잰 숫자와 정한 기준만.
 * 고객에게 보낼 요약(D273)은 아직이 아닐 때만 — 경쟁 업체 이름 없이 숫자만.
 */
const 등급반: Record<string, string> = { 좋음: "good", 보통: "mid", 어려움: "hard", "못 잼": "none" };
const 판정반: Record<string, string> = { "해볼 만함": "good", "시간이 걸림": "mid", 어려움: "hard", 아직: "none" };

export default function Feasibility({ r }: { r: 판정판 }) {
  const 판정 = r.종합?.판정 ?? "아직";
  const 배지 = r.창.단계 === "아직" ? "아직" : r.창.단계 === "대강" ? `대강 ${r.창.날들.length}일` : "기준선";
  return (
    <section className="fz" aria-labelledby="fz-h" data-testid="feasibility" data-verdict={r.오류 ? "오류" : 판정} data-stage={r.창.단계}>
      <h2 id="fz-h">해볼 만한가 <span className="fz-b">{배지}</span></h2>
      {r.오류 ? (
        <p className="fz-err" role="alert">{r.오류}</p>
      ) : r.종합 && (
        <>
          <p className={`fz-v ${판정반[판정]}`}>{판정}</p>
          <ul className="fz-list">
            {r.요인.map((x) => (
              <li key={x.id} className="fz-row" data-factor={x.id} data-grade={x.등급}>
                <span className="fz-k">{x.이름}</span>
                <span className={`fz-g ${등급반[x.등급]}`}>{x.등급}</span>
                <span className="fz-n">{x.숫자말}</span>
              </li>
            ))}
          </ul>
          <p className="fz-h3">이유</p>
          <ul className="fz-why">{r.종합.이유들.map((x) => <li key={x}>{x}</li>)}</ul>
          {r.종합.못잰것.length > 0 && (
            <>
              <p className="fz-h3">못 잰 것</p>
              <ul className="fz-why fz-mut">{r.종합.못잰것.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          )}
        </>
      )}
      <p className="fz-past">{r.지난기록}</p>
      <p className="fz-foot">{기준안내}</p>
      {r.고객요약 && (
        <div className="fz-send" data-testid="feasibility-send">
          <p className="fz-h3">고객에게 보낼 요약</p>
          <textarea readOnly defaultValue={r.고객요약} aria-label="고객에게 보낼 요약" />
          <div><CopyButton text={r.고객요약} label="보낼 글 복사" /></div>
        </div>
      )}
      <details className="fz-ref" data-testid="feasibility-ref">
        <summary>첫 레퍼런스(학원)는 어땠나</summary>
        {r.레퍼런스 ? <ul className="fz-why">{r.레퍼런스.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="fz-err">{r.레퍼런스오류}</p>}
      </details>
    </section>
  );
}
