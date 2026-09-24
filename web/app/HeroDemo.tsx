"use client";

import { useState } from "react";
import { tabKeys } from "./tabkeys";

/**
 * 히어로 — 누르는 시연.
 *
 * 전에는 혼자 타이핑하며 돌았다. 지금은 보는 사람이 업종과 AI 를 골라 보고,
 * 「같은 질문 다시 묻기」를 눌러 세 번째 이름이 바뀌는 걸 직접 본다.
 * 한 번 물어보고 끝내면 안 되는 이유를 말 대신 보여 주는 자리다.
 *
 * 이름은 A·B·C. 예시 화면이라고 아래에 적는다.
 * 사례 학원의 지역·업종은 쓰지 않는다. 가린 것을 시연이 다시 드러내면 안 된다.
 * 서버 렌더는 치과 1회차라 스크립트가 없어도 완성된 화면이다.
 */

type Item = { n: string; d: string };
type Scene = { label: string; q: string; lead: string; r: Item[]; swap: Item; src: string[] };

const SCENES: Scene[] = [
  {
    label: "치과",
    q: "마포구에서 임플란트 잘하는 치과 추천해줘",
    lead: "후기와 비교 글을 바탕으로 세 곳을 추천드립니다.",
    r: [
      { n: "A치과", d: "임플란트 상담 후기가 가장 많이 보입니다." },
      { n: "B치과", d: "야간 진료가 있어 직장인 후기가 많습니다." },
      { n: "C치과", d: "비용을 항목별로 공개했다는 글이 있습니다." },
    ],
    swap: { n: "D치과", d: "최근 지역 카페 글에서 자주 언급됩니다." },
    src: ["치과 비교 글", "지역 카페", "블로그 후기", "병원 목록"],
  },
  {
    label: "세무사",
    q: "법인 세무 잘 보는 세무사 사무소 추천해줘",
    lead: "검색 결과를 바탕으로 다음 세 곳을 추천드립니다.",
    r: [
      { n: "A 세무회계", d: "법인 기장과 세무조정 사례 글이 많습니다." },
      { n: "B 세무사사무소", d: "스타트업 법인 설립 상담 후기가 있습니다." },
      { n: "C 택스", d: "월 기장료를 공개하고 있습니다." },
    ],
    swap: { n: "D 세무법인", d: "비교 글에서 응답이 빠르다고 꼽힙니다." },
    src: ["세무사 비교 글", "창업 커뮤니티", "사무소 블로그", "전문가 목록"],
  },
  {
    label: "인테리어",
    q: "30평 아파트 인테리어 업체 추천해줘",
    lead: "시공 후기와 목록 사이트를 바탕으로 세 곳입니다.",
    r: [
      { n: "A 인테리어", d: "30평대 시공 사진 후기가 가장 많습니다." },
      { n: "B 디자인", d: "견적서를 항목별로 준다는 후기가 있습니다." },
      { n: "C 리모델링", d: "하자 보수 기간을 계약서에 적는다고 합니다." },
    ],
    swap: { n: "D 공간", d: "최근 맘카페 추천 글에 자주 나옵니다." },
    src: ["시공 후기 모음", "맘카페 글", "업체 목록", "비교 블로그"],
  },
];

const ENGINES = [
  { name: "ChatGPT", dot: "#74AA9C" },
  { name: "Claude", dot: "#D97757" },
  { name: "Gemini", dot: "#4E86F5" },
];

export default function HeroDemo({ children }: { children: React.ReactNode }) {
  const [ind, setInd] = useState(0);
  const [eng, setEng] = useState(0);
  const [round, setRound] = useState<1 | 2>(1);

  const s = SCENES[ind];
  const e = ENGINES[eng];
  const r2 = round === 2;
  const list = r2 ? [s.r[0], s.r[1], s.swap] : s.r;
  const engId = (i: number) => `lp-eng-${i}`;
  const pickEng = (i: number) => { setEng(i); setRound(1); };

  return (
    <div className="lp-hero-grid">
      <div className="lp-hero-top lp-rise">
        <span className="lp-badge"><i className="lp-live" aria-hidden="true" />AI 답변 노출 · GEO</span>
        <h1 className="lp-h1">손님이 AI에게 물었을 때<br /><span>우리 이름이 나오나요?</span></h1>
        <p className="lp-lede">
          「{s.q}」. 이렇게 물으면 AI 는 링크 대신 <b>이름 세 개쯤</b>으로 답합니다.
          거기 우리가 있는지 여러 번 물어 세고, 없으면 들어가게 만듭니다.
        </p>
        <div className="lp-inds" role="group" aria-label="업종 바꿔 보기">
          <span className="lp-inds-k" aria-hidden="true">업종 바꿔 보기</span>
          {SCENES.map((x, i) => (
            <button
              key={x.label}
              type="button"
              className="lp-ind lp-press"
              aria-pressed={i === ind}
              onClick={() => { setInd(i); setRound(1); }}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lp-hero-chat lp-rise2">
        <div className="lp-chat" role="region" aria-label="AI 답변 예시 화면">
          <div className="lp-chat-hd">
            <span className="lp-dots" aria-hidden="true"><i /><i /><i /></span>
            <div className="lp-engs" role="tablist" aria-label="AI 고르기">
              {ENGINES.map((x, i) => (
                <button
                  key={x.name}
                  id={engId(i)}
                  type="button"
                  role="tab"
                  aria-selected={i === eng}
                  aria-controls="lp-answer"
                  tabIndex={i === eng ? 0 : -1}
                  className="lp-eng mono"
                  onClick={() => pickEng(i)}
                  onKeyDown={(ev) => tabKeys(ev, i, ENGINES.length, pickEng, engId)}
                >
                  <i style={{ background: x.dot }} aria-hidden="true" />{x.name}
                </button>
              ))}
            </div>
            <span className={`lp-round mono${r2 ? " r2" : ""}`}>{round}회차</span>
          </div>

          <div className="lp-chat-body">
            <div className="lp-q">{s.q}</div>
            <div id="lp-answer" role="tabpanel" aria-labelledby={engId(eng)} aria-live="polite">
              <div className="lp-a lp-fade" key={`${ind}-${eng}-${round}`}>
                <div className="lp-a-eng mono"><i style={{ background: e.dot }} aria-hidden="true" />{e.name}</div>
                <p className="lp-a-lead">{s.lead}</p>
                <ol className="lp-a-list">
                  {list.map((it, i) => {
                    const sw = r2 && i === 2;
                    return (
                      <li key={it.n} className={sw ? "sw" : undefined}>
                        <span className="lp-rk mono" aria-hidden="true">{i + 1}</span>
                        <div>
                          <div className="lp-a-n">
                            <b>{it.n}</b>
                            {sw && <span className="lp-swtag">1회차와 다름</span>}
                          </div>
                          <div className="lp-a-d">{it.d}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="lp-src">
                  <span className="k">출처</span>
                  {s.src.map((x) => <span key={x}>{x}</span>)}
                </div>
              </div>
            </div>
            <div className="lp-verdict">
              <b>우리 회사</b>
              <span>{r2 ? "이번에도 없음" : "목록에 없음"}</span>
            </div>
          </div>

          <div className="lp-chat-ft">
            <p>
              {r2 ? "같은 질문인데 " : "예시 화면입니다. 손님은 여기 나온 이름만 봅니다. "}
              <b>{r2 ? "세 번째가 바뀌었습니다." : "2페이지는 없습니다."}</b>
            </p>
            <button type="button" className="lp-ask lp-press" onClick={() => setRound(r2 ? 1 : 2)}>
              {r2 ? "처음으로" : "같은 질문 다시 묻기"}
            </button>
          </div>
        </div>
      </div>

      <div className="lp-hero-form lp-rise">{children}</div>
    </div>
  );
}
