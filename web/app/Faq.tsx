"use client";

import { useState } from "react";

/**
 * 자주 묻는 것 — 아코디언.
 * 질문 목록은 page.tsx 한 곳에서 받는다. 구조화 데이터의 FAQ 와 화면이 갈라지면 안 된다.
 * 닫힌 답도 HTML 에 들어 있다(hidden). 크롤러는 전부 읽는다.
 */
export default function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="lp-faq">
      {items.map(([q, a], i) => {
        const on = i === open;
        return (
          <div className={`lp-faq-i${on ? " on" : ""}`} key={q}>
            <h3>
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={on}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen(on ? -1 : i)}
              >
                <span>{q}</span>
                <span className="sign" aria-hidden="true">{on ? "−" : "+"}</span>
              </button>
            </h3>
            <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="lp-faq-a" hidden={!on}>
              <p>{a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
