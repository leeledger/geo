"use client";

import { useState } from "react";
import { PILOT } from "@/lib/services";

/**
 * 요금 계산 — 필요한 준비(1회) + 30일 파일럿(모두) + 월 구독(파일럿 뒤).
 *
 * 원장(2026-09-29 밤): 「사이트를 만들어 줘야 하는 경우도 있는데 가격테이블 다시 봐」.
 * 파일럿 하나로 합치며 구축·세팅을 「파일럿 뒤」로 숨긴 것은 잘못이었다 — 홈페이지가 없으면 AI 가 읽을 것이 없다.
 * 값은 원래 요금표 그대로다 — 구축 250 · 기술 세팅 80 · 진단 통과 0 · 블로그 이관 +80 · 파일럿 39 · 월 39/79.
 * 월 구독은 고르는 칸이 아니다. 파일럿을 끝낸 곳에만 안내한다.
 * 「이 조건으로 상담 신청」은 아래 상담 폼으로 내려가고 고른 조건을 폼에 넘긴다(cited:plan 이벤트).
 */

const SITES = [
  { t: "홈페이지 없음", d: "블로그만 있거나 못 쓰는 사이트", cost: 250, line: "사이트 구축 · 기술 세팅 포함" },
  { t: "홈페이지 있음", d: "AI 가 읽게 손봐야 하는 사이트", cost: 80, line: "기술 세팅" },
  { t: "진단 통과", d: "이미 AI 가 읽는 사이트", cost: 0, line: "세팅 필요 없음" },
];
const MIGRATE = 80;
const PILOT_COST = 39;

/** 파일럿 뒤 선택 — 월 구독. 문구 규칙은 Step 24 그대로(질문 20개 · 하루 1회 · 최근 7일 n번 중 k번) */
const MONTHLY = [
  { t: "리포트", price: 39, items: ["질문 20개 × AI 4곳 · 하루 1회", "질문·AI별 최근 7일 n번 중 k번", "답변 원문 전량", "고칠 곳 다섯 개, 순서대로"] },
  { t: "관리", price: 79, items: ["리포트 전부", "AI 가 가져다 쓸 글 월 1편 작성·발행", "업계 목록·디렉터리 등재", "퍼져 있는 틀린 정보 정정"] },
];

const won = (v: number) => (v ? `${v}만원` : "0원");

export default function PriceCalc() {
  const [site, setSite] = useState(0);
  const [migrate, setMigrate] = useState(true);

  const S = SITES[site];
  const first = S.cost + (migrate ? MIGRATE : 0) + PILOT_COST;

  function goContact() {
    const cond = `${S.t}${migrate ? " · 이관" : ""} · ${PILOT.name} ${PILOT_COST}만원 · 처음 ${first}만원`;
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
        <div className="lp-calc-k" id="calc-k1">1 · 지금 홈페이지는 (1회, 필요한 곳만)</div>
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

        <div className="lp-mig">
          <div>
            <b id="calc-mig">블로그 글 이관</b>
            <div className="d">AI 크롤러를 막는 블로그 글을 AI 가 읽는 곳으로 · 30편 기준 +{MIGRATE}만원</div>
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

        <div className="lp-calc-k">2 · {PILOT.name} (모두)</div>
        <div className="lp-pilot-box">
          <div className="h"><b>{PILOT.name}</b><span className="pr">{PILOT_COST}<small>만원</small></span></div>
          <ol className="lp-pilot" style={{ marginTop: 12 }}>
            {PILOT.gives.map((x) => <li key={x}>{x}</li>)}
          </ol>
          <p className="lp-pilot-note">{PILOT.order}</p>
          <p className="lp-pilot-note">{PILOT.llms}</p>
          <p className="lp-pilot-note">{PILOT.noGuarantee}</p>
          <p className="lp-pilot-note"><b>파일럿을 중간에 그만두시면</b></p>
          <ul className="lp-pilot">
            {PILOT.refund.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <p className="lp-pilot-note">{PILOT.refundNote}</p>
        </div>

        <div className="lp-calc-k">3 · 파일럿 뒤 선택 (월)</div>
        <p className="lp-pilot-note" style={{ marginTop: 0 }}>{PILOT.after}</p>
        <ul className="lp-after">
          {MONTHLY.map((p) => (
            <li key={p.t}><b>{p.t} 월 {p.price}만원</b>{p.items.join(" · ")}</li>
          ))}
        </ul>
      </div>

      <div className="lp-total">
        <p className="lp-sr" aria-live="polite">처음 {first}만원</p>
        {site === 0 && migrate && <span className="lp-pill sky">도입 사례 학원과 같은 조건</span>}
        <div className="k">처음</div>
        <div className="big"><b>{first}</b><span>만원</span></div>
        <div className="bd">
          <div><span>{S.line}</span><span className="mono">{won(S.cost)}</span></div>
          {migrate && <div><span>블로그 글 이관 · 30편 기준</span><span className="mono">{MIGRATE}만원</span></div>}
          <div><span>{PILOT.name}</span><span className="mono">{PILOT_COST}만원</span></div>
        </div>
        <div className="k sep">파일럿 뒤 · 월</div>
        <ul>
          {MONTHLY.map((p) => (
            <li key={p.t}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <span>{p.t} {p.price}만원 — 파일럿을 끝낸 곳만</span>
            </li>
          ))}
        </ul>
        <button type="button" className="lp-total-cta lp-press" onClick={goContact}>이 조건으로 상담 신청</button>
      </div>
    </div>
  );
}
