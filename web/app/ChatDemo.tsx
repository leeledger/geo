"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 살아 있는 시연 — 실제 AI 검색 화면처럼.
 *
 * 특정 회사의 화면을 복제하지 않는다(로고·트레이드 드레스는 그쪽 자산이다).
 * 대신 실제 AI 답변 화면의 특징을 갖춘다: 엔진 이름, "웹 검색 중" 상태,
 * 단어 단위로 흘러나오는 답, 굵은 브랜드명과 한 줄 설명, 출처 칩.
 *
 * 한 루프에서 같은 질문을 두 번 보내 세 번째 답이 바뀌는 것을 보여주고,
 * 루프가 돌 때마다 엔진이 바뀐다 — ChatGPT 만의 문제가 아니라는 뜻이다.
 * 스크립트가 꺼진 환경(크롤러 포함)에는 완성된 상태가 그대로 보인다.
 */

const Q = "우리 동네에서 이 분야 괜찮은 업체 좀 추천해줘";

const ENGINES = [
  { name: "ChatGPT", dot: "#74AA9C" },
  { name: "Claude", dot: "#D97757" },
  { name: "Gemini", dot: "#4E86F5" },
];

const LEAD = "검색 결과를 바탕으로 다음 세 곳을 추천드립니다.";
const R1 = [
  { n: "경쟁사 A", d: "이 지역에서 가장 자주 언급되는 곳입니다." },
  { n: "경쟁사 B", d: "후기 평점이 높고 접근성이 좋습니다." },
  { n: "경쟁사 C", d: "비교 글에서 가성비로 꼽힙니다." },
];
const R2 = [
  { n: "경쟁사 A", d: "이 지역에서 가장 자주 언급되는 곳입니다." },
  { n: "경쟁사 B", d: "후기 평점이 높고 접근성이 좋습니다." },
  { n: "경쟁사 D", d: "최근 커뮤니티에서 자주 추천됩니다." },
];
const SOURCES = ["비교 블로그", "지역 커뮤니티", "업체 목록", "후기 모음"];

type Phase =
  | "typing" | "searching" | "lead" | "items" | "sources" | "missing" | "hold"
  | "retyping" | "searching2" | "lead2" | "items2" | "swapped" | "hold2";

const DONE: Phase[] = ["sources", "missing", "hold", "swapped", "hold2"];

export default function ChatDemo() {
  const [phase, setPhase] = useState<Phase>("hold2"); // SSR·감속 환경은 완성 상태
  const [typed, setTyped] = useState(Q);
  const [leadWords, setLeadWords] = useState(99);
  const [items, setItems] = useState(3);
  const [round, setRound] = useState<1 | 2>(2);
  const [engine, setEngine] = useState(0);
  const [live, setLive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) =>
    timers.current.push(window.setTimeout(fn, ms));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (es) => { if (es[0].isIntersecting) { io.disconnect(); setLive(true); } },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => { io.disconnect(); timers.current.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (!live) return;
    let stop = false;
    let eng = 0;

    const run = () => {
      if (stop) return;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setEngine(eng);

      // ── 1회차: 타이핑 → 검색 → 답이 흘러나옴 → 출처 → 우리 없음
      setRound(1); setItems(0); setLeadWords(0); setTyped(""); setPhase("typing");
      Q.split("").forEach((_, i) => later(() => setTyped(Q.slice(0, i + 1)), 46 * i));
      const tq = 46 * Q.length + 300;

      later(() => setPhase("searching"), tq);
      later(() => setPhase("lead"), tq + 1250);
      const words = LEAD.split(" ").length;
      for (let w = 1; w <= words; w++)
        later(() => setLeadWords(w), tq + 1250 + w * 110);
      const tl = tq + 1250 + words * 110 + 250;

      later(() => { setPhase("items"); setItems(1); }, tl);
      later(() => setItems(2), tl + 620);
      later(() => setItems(3), tl + 1240);
      later(() => setPhase("sources"), tl + 1950);
      later(() => setPhase("missing"), tl + 2600);
      later(() => setPhase("hold"), tl + 3100);

      // ── 2회차: 같은 질문 다시 → 세 번째가 바뀜
      const t2 = tl + 4700;
      later(() => { setRound(2); setItems(0); setLeadWords(99); setPhase("retyping"); }, t2);
      later(() => setPhase("searching2"), t2 + 650);
      later(() => { setPhase("items2"); setItems(1); }, t2 + 1700);
      later(() => setItems(2), t2 + 2150);
      later(() => setItems(3), t2 + 2650);
      later(() => setPhase("swapped"), t2 + 3400);
      later(() => setPhase("hold2"), t2 + 3900);

      later(() => { eng = (eng + 1) % ENGINES.length; run(); }, t2 + 8200);
    };
    run();
    return () => { stop = true; timers.current.forEach(clearTimeout); };
  }, [live]);

  const list = round === 1 ? R1 : R2;
  const answered = ["items", "sources", "missing", "hold", "items2", "swapped", "hold2"].includes(phase);
  const leadOn = ["lead", ...["items", "sources", "missing", "hold"]].includes(phase) ||
    ["items2", "swapped", "hold2"].includes(phase);
  const done = DONE.includes(phase);
  const showMissing = ["missing", "hold", "swapped", "hold2"].includes(phase);
  const showSwap = ["swapped", "hold2"].includes(phase) && round === 2;
  const searching = phase === "searching" || phase === "searching2";
  const e = ENGINES[engine];

  return (
    <div className="chat" ref={ref} aria-label="AI 답변 시연">
      <div className="chathd">
        <span className="dots"><i /><i /><i /></span>
        <span className="tabs">
          {ENGINES.map((x, i) => (
            <span key={x.name} className={`tab mono${i === engine ? " on" : ""}`}>
              <i style={{ background: x.dot }} />{x.name}
            </span>
          ))}
        </span>
        <span className={`mono chatround r${round}`}>{round}회차</span>
      </div>

      <div className="chatbody">
        <div className="msg me">
          <span>
            {phase === "retyping" ? Q : typed}
            {phase === "typing" && <i className="caret" />}
          </span>
        </div>

        {searching && (
          <div className="aistat mono" aria-hidden="true">
            <span className="spin" /> 웹 검색 중…
          </div>
        )}

        {(leadOn || answered) && (
          <div className="msg ai">
            <div className="aieng mono">
              <i style={{ background: e.dot }} />{e.name}
            </div>
            <p className="ailead">
              {round === 2
                ? LEAD
                : LEAD.split(" ").slice(0, leadWords).join(" ")}
              {phase === "lead" && <i className="caret dark" />}
            </p>
            <ol className="ailist">
              {list.slice(0, items).map((it, i) => (
                <li key={`${round}-${it.n}`} className={showSwap && i === 2 ? "swap" : undefined}>
                  <div className="ailn">
                    <b>{it.n}</b>
                    {showSwap && i === 2 && <span className="swtag mono">1회차와 다름</span>}
                  </div>
                  <span className="aild">{it.d}</span>
                </li>
              ))}
            </ol>
            {done && (
              <div className="aisrc">
                <span className="mono srck">출처</span>
                {SOURCES.map((s2) => (
                  <span key={s2} className="srcc mono">{s2}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`chatverdict${showMissing ? " on" : ""}`}>
          <span className="mek">우리 회사</span>
          <span className="mev mono">{showSwap ? "이번에도 없음" : "목록에 없음"}</span>
        </div>
      </div>

      <div className="chatft">
        {!showSwap ? (
          <>고객은 여기 나온 곳만 봅니다. <b>2페이지는 없습니다.</b></>
        ) : (
          <>같은 질문인데 <b>세 번째가 바뀌었습니다.</b> 그래서 한 번 재고 말하지 않습니다.</>
        )}
      </div>
    </div>
  );
}
