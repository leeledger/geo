"use client";

import { PILOT } from "@/lib/services";

/**
 * 요금 — 30일 파일럿 하나 (원장 2026-09-29).
 *
 * 전에는 구축·기술 세팅·이관·월 구독을 골라 더하는 계산기였다. 고객이 무엇을 사는지 문서로 정해져 있지 않았다(역량 검토 「첫 고객 전 1」).
 * 이제 값은 하나고, 문구는 lib/services.ts PILOT 그대로다(research/paid-pilot-order-form.md 와 같은 글자).
 * 「이 조건으로 상담 신청」은 아래 상담 폼으로 내려가고 조건을 폼에 넘긴다(cited:plan 이벤트).
 */
export default function PriceCalc() {
  function goContact() {
    window.dispatchEvent(new CustomEvent("cited:plan", { detail: `${PILOT.name} · ${PILOT.price}` }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("contact")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.setTimeout(
      () => document.getElementById("cf-name")?.focus({ preventScroll: true }),
      reduce ? 0 : 700,
    );
  }

  return (
    <div className="lp-calc">
      <div className="lp-card lp-calc-in">
        <div className="lp-calc-k">30일 동안 하는 일</div>
        <ol className="lp-pilot">
          {PILOT.gives.map((x) => <li key={x}>{x}</li>)}
        </ol>
        <p className="lp-pilot-note">{PILOT.llms}</p>

        <div className="lp-calc-k">보장하지 않는 것</div>
        <p className="lp-pilot-note">{PILOT.noGuarantee}</p>

        <div className="lp-calc-k">중간에 그만두시면</div>
        <ul className="lp-pilot">
          {PILOT.refund.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <p className="lp-pilot-note">{PILOT.refundNote}</p>
      </div>

      <div className="lp-total">
        <div className="k">{PILOT.name} · {PILOT.period}</div>
        <div className="big"><b>{PILOT.price.replace("원", "")}</b><span>원</span></div>
        <div className="bd">
          <div><span>결제</span><span>{PILOT.pay}</span></div>
          <div><span>파일럿 뒤</span><span>선택</span></div>
        </div>
        <p className="lp-pilot-after">{PILOT.after}</p>
        <button type="button" className="lp-total-cta lp-press" onClick={goContact}>이 조건으로 상담 신청</button>
      </div>
    </div>
  );
}
