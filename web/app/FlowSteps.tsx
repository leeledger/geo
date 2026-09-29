"use client";

import { useState } from "react";
import { tabKeys } from "./tabkeys";

/**
 * 진행 — 30일 파일럿 네 단계. 눌러서 한 단계씩 본다.
 * 내용은 research/paid-pilot-order-form.md 「제공」과 같은 일이다. 거기 없는 일을 여기 약속하지 않는다.
 * 네 단계 설명은 전부 HTML 에 있고 고르지 않은 것만 hidden 이다.
 */

const FLOW = [
  {
    w: "첫 7일",
    t: "지금 상태를 숫자로 남깁니다",
    p: "손님이 실제로 칠 질문 20개를 만들어 승인을 받고, ChatGPT·Perplexity·Gemini·Claude에 날짜별로 묻습니다. 학원이면 「○○구 초등 코딩학원 추천」 같은 말입니다. 첫 7일을 곳별로 묶어 기준선 보고를 보냅니다. 구글 AI 개요와 네이버 AI 브리핑은 담당자가 직접 보고 화면을 캡처합니다.",
    c: ["질문 20개", "AI 4곳 · 날짜별", "기준선 보고"],
  },
  {
    w: "2~3주",
    t: "틀린 정보를 맞추고 글을 씁니다",
    p: "상호·주소·전화·운영시간이 곳마다 같은지 점검하고 수정안을 드립니다. 근거 콘텐츠 1편을 씁니다. 사실 확인은 고객이 합니다.",
    c: ["정합성 수정안", "근거 콘텐츠 1편", "상담 유입 기록표"],
  },
  {
    w: "30일 차",
    t: "같은 질문으로 다시 셉니다",
    p: "30일 차에 같은 질문·같은 방법으로 다시 재서 최종 보고서를 드립니다. 변화가 없거나 나빠져도 그대로 적습니다. 구글·네이버도 한 번 더 직접 확인합니다.",
    c: ["답변 원문 전량", "최종 보고서"],
  },
  {
    w: "파일럿 뒤",
    t: "이어갈지 정합니다",
    p: "월 구독·기술 세팅·사이트 구축은 파일럿 뒤 선택입니다. 파일럿을 끝낸 곳에만 안내합니다. 성공 기준이 안 보이면 이유를 적고 갱신을 권하지 않습니다.",
    c: ["파일럿 뒤 선택"],
  },
];

export default function FlowSteps() {
  const [step, setStep] = useState(0);
  const id = (i: number) => `flow-tab-${i}`;

  return (
    <>
      <div className="lp-flow-steps" role="tablist" aria-label="30일 진행 순서">
        {FLOW.map((f, i) => (
          <button
            key={f.w}
            id={id(i)}
            type="button"
            role="tab"
            aria-selected={i === step}
            aria-controls={`flow-panel-${i}`}
            tabIndex={i === step ? 0 : -1}
            className={`lp-step${i <= step ? " done" : ""}${i < step ? " past" : ""}`}
            onClick={() => setStep(i)}
            onKeyDown={(e) => tabKeys(e, i, FLOW.length, setStep, id)}
          >
            <span className="top" aria-hidden="true">
              <span className="num">{i + 1}</span>
              <span className="line" />
            </span>
            <span className="w">{f.w}</span>
            <span className="t">{f.t}</span>
          </button>
        ))}
      </div>

      {FLOW.map((f, i) => (
        <div
          key={f.w}
          role="tabpanel"
          id={`flow-panel-${i}`}
          aria-labelledby={id(i)}
          tabIndex={0}
          hidden={i !== step}
          className="lp-card lp-flow-panel"
        >
          <div>
            <div className="w">{f.w}</div>
            <h3>{f.t}</h3>
            <p>{f.p}</p>
          </div>
          <div className="lp-chips">
            {f.c.map((c) => <span key={c}>{c}</span>)}
          </div>
        </div>
      ))}
    </>
  );
}
