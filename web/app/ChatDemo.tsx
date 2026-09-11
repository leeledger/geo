"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 살아 있는 시연 — 실제 AI 검색 화면처럼.
 *
 * 특정 회사의 화면을 복제하지 않는다(로고·트레이드 드레스는 그쪽 자산이다).
 * 대신 실제 AI 답변 화면의 특징을 갖춘다: 엔진 이름, "웹 검색 중" 상태,
 * 단어 단위로 흘러나오는 답, 굵은 이름과 한 줄 설명, 출처 칩.
 *
 * 「우리 동네 이 분야 업체」 같은 질문은 너무 추상적이라는 말을 들었다.
 * 손님이 실제로 칠 법한 말로 바꾸고, 루프마다 업종을 바꾼다 — 학원만의 이야기가 아니라는 뜻이다.
 * 사례 학원의 지역·업종은 쓰지 않는다. 가린 것을 시연이 다시 드러내면 안 된다.
 * 이름은 A·B·C 로 둔다. 예시 화면이라고 아래에 적는다.
 *
 * 스크립트가 꺼진 환경(크롤러 포함)에는 완성된 상태가 그대로 보인다.
 */

type Item = { n: string; d: string };
type Scene = { q: string; lead: string; r1: Item[]; swap: Item; sources: string[] };

const SCENES: Scene[] = [
  {
    q: "마포구에서 임플란트 잘하는 치과 추천해줘",
    lead: "후기와 비교 글을 바탕으로 세 곳을 추천드립니다.",
    r1: [
      { n: "A치과", d: "임플란트 상담 후기가 가장 많이 보입니다." },
      { n: "B치과", d: "야간 진료가 있어 직장인 후기가 많습니다." },
      { n: "C치과", d: "비용을 항목별로 공개했다는 글이 있습니다." },
    ],
    swap: { n: "D치과", d: "최근 지역 카페 글에서 자주 언급됩니다." },
    sources: ["치과 비교 글", "지역 카페", "블로그 후기", "병원 목록"],
  },
  {
    q: "법인 세무 잘 보는 세무사 사무소 추천해줘",
    lead: "검색 결과를 바탕으로 다음 세 곳을 추천드립니다.",
    r1: [
      { n: "A 세무회계", d: "법인 기장과 세무조정 사례 글이 많습니다." },
      { n: "B 세무사사무소", d: "스타트업 법인 설립 상담 후기가 있습니다." },
      { n: "C 택스", d: "월 기장료를 공개하고 있습니다." },
    ],
    swap: { n: "D 세무법인", d: "비교 글에서 응답이 빠르다고 꼽힙니다." },
    sources: ["세무사 비교 글", "창업 커뮤니티", "사무소 블로그", "전문가 목록"],
  },
  {
    q: "30평 아파트 인테리어 업체 추천해줘. 분당이야",
    lead: "시공 후기와 목록 사이트를 바탕으로 세 곳입니다.",
    r1: [
      { n: "A 인테리어", d: "30평대 시공 사진 후기가 가장 많습니다." },
      { n: "B 디자인", d: "견적서를 항목별로 준다는 후기가 있습니다." },
      { n: "C 리모델링", d: "하자 보수 기간을 계약서에 적는다고 합니다." },
    ],
    swap: { n: "D 공간", d: "최근 맘카페 추천 글에 자주 나옵니다." },
    sources: ["시공 후기 모음", "맘카페 글", "업체 목록", "비교 블로그"],
  },
];

const ENGINES = [
  { name: "ChatGPT", dot: "#74AA9C" },
  { name: "Claude", dot: "#D97757" },
  { name: "Gemini", dot: "#4E86F5" },
];

type Phase =
  | "typing" | "searching" | "lead" | "items" | "sources" | "missing" | "hold"
  | "retyping" | "searching2" | "lead2" | "items2" | "swapped" | "hold2";

const DONE: Phase[] = ["sources", "missing", "hold", "swapped", "hold2"];

export default function ChatDemo() {
  const [phase, setPhase] = useState<Phase>("hold2"); // SSR·감속 환경은 완성 상태
  const [engine, setEngine] = useState(0);
  const [typed, setTyped] = useState(SCENES[0].q);
  const [leadWords, setLeadWords] = useState(99);
  const [items, setItems] = useState(3);
  const [round, setRound] = useState<1 | 2>(2);
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
      const { q, lead } = SCENES[eng];

      // ── 1회차: 타이핑 → 검색 → 답이 흘러나옴 → 출처 → 우리 없음
      setRound(1); setItems(0); setLeadWords(0); setTyped(""); setPhase("typing");
      q.split("").forEach((_, i) => later(() => setTyped(q.slice(0, i + 1)), 46 * i));
      const tq = 46 * q.length + 300;

      later(() => setPhase("searching"), tq);
      later(() => setPhase("lead"), tq + 1250);
      const words = lead.split(" ").length;
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

  const s = SCENES[engine];
  const list = round === 1 ? s.r1 : [s.r1[0], s.r1[1], s.swap];
  const answered = ["items", "sources", "missing", "hold", "items2", "swapped", "hold2"].includes(phase);
  const leadOn = ["lead", "items", "sources", "missing", "hold", "items2", "swapped", "hold2"].includes(phase);
  const done = DONE.includes(phase);
  const showMissing = ["missing", "hold", "swapped", "hold2"].includes(phase);
  const showSwap = ["swapped", "hold2"].includes(phase) && round === 2;
  const searching = phase === "searching" || phase === "searching2";
  const e = ENGINES[engine];

  return (
    <div className="chat" ref={ref} aria-label="AI 답변 예시 화면">
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
            {phase === "retyping" ? s.q : typed}
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
              {round === 2 ? s.lead : s.lead.split(" ").slice(0, leadWords).join(" ")}
              {phase === "lead" && <i className="caret dark" />}
            </p>
            <ol className="ailist">
              {list.slice(0, items).map((it, i) => (
                <li key={`${engine}-${round}-${it.n}`} className={showSwap && i === 2 ? "swap" : undefined}>
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
                {s.sources.map((x) => (
                  <span key={x} className="srcc mono">{x}</span>
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
          <>예시 화면입니다. 손님은 여기 나온 이름만 봅니다. <b>2페이지는 없습니다.</b></>
        ) : (
          <>같은 질문인데 <b>세 번째가 바뀌었습니다.</b> 그래서 한 번 물어보고 끝내지 않습니다.</>
        )}
      </div>
    </div>
  );
}
