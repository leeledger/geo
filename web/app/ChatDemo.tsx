"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 살아 있는 시연.
 *
 * 이 회사의 주장은 두 문장이다 — "AI 답변에 내 이름이 없다",
 * "다시 물으면 답이 바뀐다". 그걸 글로 설명하는 대신 눈앞에서 일어나게 한다.
 * 질문이 타이핑되고, 답이 하나씩 나오고, 내 이름이 없다는 줄이 찍히고,
 * 같은 질문을 다시 보내면 세 번째 답이 바뀐다.
 *
 * 동영상이 아니라 코드로 그리는 이유: 용량이 없고, 항상 선명하고,
 * 스크립트가 꺼진 환경(크롤러 포함)에는 완성된 상태가 그대로 보인다.
 */

const Q = "이 분야 괜찮은 곳 세 군데만 알려줘";
const ROUND1 = ["경쟁사 A", "경쟁사 B", "경쟁사 C"];
const ROUND2 = ["경쟁사 A", "경쟁사 B", "경쟁사 D"];

type Phase =
  | "typing" | "thinking" | "answer" | "missing" | "hold"
  | "retyping" | "thinking2" | "answer2" | "swapped" | "hold2";

export default function ChatDemo() {
  const [phase, setPhase] = useState<Phase>("hold2"); // SSR·감속 환경은 완성 상태
  const [typed, setTyped] = useState(Q);
  const [items, setItems] = useState(3);
  const [round, setRound] = useState<1 | 2>(2);
  const [live, setLive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // 완성 상태 유지

    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        setLive(true);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      timers.current.forEach(clearTimeout);
      timers.current = [];

      // ── 1회차
      setRound(1); setItems(0); setTyped(""); setPhase("typing");
      Q.split("").forEach((_, i) =>
        later(() => setTyped(Q.slice(0, i + 1)), 55 * i));
      const tq = 55 * Q.length + 320;

      later(() => setPhase("thinking"), tq);
      later(() => { setPhase("answer"); setItems(1); }, tq + 950);
      later(() => setItems(2), tq + 1450);
      later(() => setItems(3), tq + 1950);
      later(() => setPhase("missing"), tq + 2750);
      later(() => setPhase("hold"), tq + 3300);

      // ── 2회차 — 같은 질문, 다른 답
      const t2 = tq + 4900;
      later(() => { setRound(2); setItems(0); setPhase("retyping"); }, t2);
      later(() => setPhase("thinking2"), t2 + 700);
      later(() => { setPhase("answer2"); setItems(1); }, t2 + 1550);
      later(() => setItems(2), t2 + 1950);
      later(() => setItems(3), t2 + 2400);
      later(() => setPhase("swapped"), t2 + 3100);
      later(() => setPhase("hold2"), t2 + 3600);

      // ── 루프
      later(run, t2 + 7600);
    };
    run();
    return () => { cancelled = true; timers.current.forEach(clearTimeout); };
  }, [live]);

  const list = round === 1 ? ROUND1 : ROUND2;
  const answered = ["answer", "missing", "hold", "answer2", "swapped", "hold2"].includes(phase);
  const showMissing = ["missing", "hold", "hold2", "swapped"].includes(phase) ||
    (!live && phase === "hold2");
  const showSwap = ["swapped", "hold2"].includes(phase) && round === 2;

  return (
    <div className="chat" ref={ref} aria-label="AI 답변 시연">
      <div className="chathd">
        <span className="dots"><i /><i /><i /></span>
        <span className="mono">AI 채팅</span>
        <span className={`mono chatround r${round}`}>{round}회차</span>
      </div>

      <div className="chatbody">
        {/* 사용자 질문 */}
        <div className="msg me">
          <span>
            {phase === "retyping" ? Q : typed}
            {(phase === "typing") && <i className="caret" />}
          </span>
        </div>

        {/* AI 응답 */}
        {(phase === "thinking" || phase === "thinking2") && (
          <div className="msg ai thinking" aria-hidden="true">
            <span className="tdot" /><span className="tdot" /><span className="tdot" />
          </div>
        )}

        {answered && (
          <div className="msg ai">
            <p className="ailead">이 세 곳을 추천드립니다.</p>
            <ol className="ailist">
              {list.slice(0, items).map((name, i) => (
                <li key={`${round}-${name}`}
                    className={showSwap && i === 2 ? "swap" : undefined}>
                  <span className="rk mono">{i + 1}</span>
                  {name}
                  {showSwap && i === 2 && (
                    <span className="swtag mono">바뀜</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 판정 줄 */}
        <div className={`chatverdict${showMissing ? " on" : ""}`}>
          <span className="mek">우리 회사</span>
          <span className="mev mono">
            {round === 2 && showSwap ? "이번에도 없음" : "목록에 없음"}
          </span>
        </div>
      </div>

      <div className="chatft">
        {round === 1 || !showSwap ? (
          <>고객은 이 세 곳만 봅니다. <b>2페이지는 없습니다.</b></>
        ) : (
          <>같은 질문인데 <b>세 번째가 바뀌었습니다.</b> 그래서 한 번 재고 말하지 않습니다.</>
        )}
      </div>
    </div>
  );
}
