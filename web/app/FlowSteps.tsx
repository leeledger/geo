"use client";

import { useState } from "react";
import { tabKeys } from "./tabkeys";

/**
 * 진행 — 두 달 네 단계. 눌러서 한 단계씩 본다.
 * 네 단계 설명은 전부 HTML 에 있고 고르지 않은 것만 hidden 이다.
 */

const FLOW = [
  {
    w: "1주차",
    t: "지금 상태를 숫자로 남깁니다",
    p: "손님이 실제로 칠 질문 30개를 만들어 AI 4곳에 여러 번 묻습니다. 학원이면 「○○구 초등 코딩학원 추천」, 치과면 「△△동 임플란트 잘하는 곳」 같은 말입니다.",
    c: ["질문 30개", "AI 4곳", "사이트 7항목 진단"],
  },
  {
    w: "2~3주차",
    t: "AI 가 읽을 수 있게 만듭니다",
    p: "robots.txt 에 GPTBot·ClaudeBot 을 이름으로 열고 회사 정보를 구조화 데이터로 붙입니다. AI 크롤러를 막는 블로그에만 있던 글은 옮깁니다.",
    c: ["robots.txt", "llms.txt", "구조화 데이터", "방문 기록"],
  },
  {
    w: "4~8주차",
    t: "비교 글·목록에 들어갑니다",
    p: "AI 답에 붙은 출처를 모아 경쟁사는 있고 우리만 없는 글 다섯 곳을 고릅니다. 목록 사이트에 등재하고, 플레이스 소개글을 채우고, 틀린 정보를 고칩니다.",
    c: ["등재", "소개글", "정정", "글 1편"],
  },
  {
    w: "8주차",
    t: "같은 질문으로 다시 셉니다",
    p: "1단계와 같은 질문, 같은 AI, 같은 횟수로 다시 묻습니다. 오른 것, 안 오른 것, 거절당한 등재까지 적고 다음 두 달에 할 일을 정합니다.",
    c: ["답변 원문 전량", "거절된 곳 포함"],
  },
];

export default function FlowSteps() {
  const [step, setStep] = useState(0);
  const id = (i: number) => `flow-tab-${i}`;

  return (
    <>
      <div className="lp-flow-steps" role="tablist" aria-label="두 달 진행 순서">
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
