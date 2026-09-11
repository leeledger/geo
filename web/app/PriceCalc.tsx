"use client";

import { useState } from "react";

/**
 * 요금 계산.
 *
 * 값은 요금표 그대로다 — 구축 250 · 기술 세팅 80 · 진단 통과 0 · 블로그 이관 +80 · 월 39/79.
 * 계산만 해 주고 끝나면 안 된다. 「이 조건으로 상담 신청」은 아래 상담 폼으로 내려가고
 * 고른 조건을 폼에 넘긴다(cited:plan 이벤트). 폼이 그 조건을 같이 보낸다.
 */

const SITES = [
  { t: "홈페이지 없음", d: "블로그만 있거나 못 쓰는 사이트", cost: 250, line: "사이트 구축 · 기술 세팅 포함" },
  { t: "홈페이지 있음", d: "AI 가 읽게 손봐야 하는 사이트", cost: 80, line: "기술 세팅" },
  { t: "진단 통과", d: "이미 AI 가 읽는 사이트", cost: 0, line: "세팅 필요 없음" },
];

const PLANS = [
  {
    t: "리포트", price: 39, for: "숫자를 보고 직접 고치실 팀",
    items: [
      "질문 30개 × AI 4곳 · 월 2회",
      "몇 번 중 몇 번 불렸는지 + 흔들리는 범위",
      "AI 방문 기록 — 어느 AI 가 몇 쪽 읽었는지",
      "답변 원문 전량",
      "경쟁사 3곳 나란히",
      "고칠 곳 다섯 개, 순서대로",
    ],
  },
  {
    t: "관리", price: 79, for: "고치는 일까지 맡기실 팀",
    items: [
      "리포트 전부",
      "AI 가 가져다 쓸 글 월 1편 작성·발행",
      "업계 목록·디렉터리 등재",
      "퍼져 있는 틀린 정보 정정",
      "월 1회 통화",
    ],
  },
];

const won = (v: number) => (v ? `${v}만원` : "0원");

export default function PriceCalc() {
  const [site, setSite] = useState(0);
  const [migrate, setMigrate] = useState(true);
  const [plan, setPlan] = useState(0);

  const S = SITES[site];
  const P = PLANS[plan];
  const init = S.cost + (migrate ? 80 : 0);

  function goContact() {
    const cond = `${S.t}${migrate ? " · 이관" : ""} · 초기 ${init}만원 · ${P.t} 월 ${P.price}만원`;
    window.dispatchEvent(new CustomEvent("cited:plan", { detail: cond }));
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
        <div className="lp-calc-k" id="calc-k1">1 · 지금 홈페이지는</div>
        <div className="lp-opts3" role="group" aria-labelledby="calc-k1">
          {SITES.map((o, i) => (
            <button
              key={o.t}
              type="button"
              className="lp-opt lp-press"
              aria-pressed={i === site}
              onClick={() => setSite(i)}
            >
              <span className="h"><span className="lp-radio" aria-hidden="true" /><b>{o.t}</b></span>
              <span className="d">{o.d}</span>
              <span className="c mono">{won(o.cost)}</span>
            </button>
          ))}
        </div>

        <div className="lp-calc-k">2 · 블로그에 쌓아 둔 글을 옮길까요</div>
        <div className="lp-mig">
          <div>
            <b id="calc-mig">블로그 글 이관</b>
            <div className="d">AI 크롤러를 막는 블로그 글을 AI 가 읽는 곳으로 · 30편 기준 +80만원</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={migrate}
            aria-labelledby="calc-mig"
            className="lp-switch"
            onClick={() => setMigrate(!migrate)}
          />
        </div>

        <div className="lp-calc-k" id="calc-k3">3 · 매달 어디까지 맡기시나요</div>
        <div className="lp-opts2" role="group" aria-labelledby="calc-k3">
          {PLANS.map((p, i) => (
            <button
              key={p.t}
              type="button"
              className="lp-opt plan lp-press"
              aria-pressed={i === plan}
              onClick={() => setPlan(i)}
            >
              <span className="h">
                <span className="nm"><span className="lp-radio" aria-hidden="true" /><b>{p.t}</b></span>
                <span className="pr">{p.price}<small>만원/월</small></span>
              </span>
              <span className="d">{p.for}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lp-total">
        <p className="lp-sr" aria-live="polite">시작할 때 {init}만원, 매달 {P.t} {P.price}만원</p>
        {site === 0 && migrate && <span className="lp-pill sky">도입 사례 학원과 같은 조건</span>}
        <div className="k">시작할 때 한 번</div>
        <div className="big"><b>{init}</b><span>만원</span></div>
        <div className="bd">
          <div><span>{S.line}</span><span className="mono">{won(S.cost)}</span></div>
          {migrate && <div><span>블로그 글 이관 · 30편 기준</span><span className="mono">80만원</span></div>}
        </div>
        <div className="k sep">매달 · {P.t}</div>
        <div className="big m"><b>{P.price}</b><span>만원</span></div>
        <ul>
          {P.items.map((x) => (
            <li key={x}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="lp-total-cta lp-press" onClick={goContact}>이 조건으로 상담 신청</button>
        <p className="fine">최소 약정 없음 · 월 단위 · 세금계산서 발행 · 부가세 별도</p>
      </div>
    </div>
  );
}
