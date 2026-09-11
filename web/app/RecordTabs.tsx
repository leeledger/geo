"use client";

import { useState } from "react";
import { tabKeys } from "./tabkeys";

/**
 * 맡기면 받는 것 — 실제로 남긴 기록 세 장을 탭으로.
 *
 * 세 장 모두 HTML 에 들어 있고 고르지 않은 장은 hidden 으로만 가린다.
 * 크롤러는 스크립트를 안 돌리니 세 장을 다 읽는다. 이 회사가 파는 게 그거다.
 *
 * ERP 측정 — probe/data/report.websearch.txt · diagnoses/doto.json.
 * 질문 12개, 웹 검색을 켠 AI 에 15회. 회사 이름은 A·B·C 로 쓴다.
 */

const TABS = [
  { no: "01", k: "몇 번 중 몇 번", t: "지금 불리고 있나" },
  { no: "02", k: "빠진 자리", t: "왜 안 나오나" },
  { no: "03", k: "고친 이유", t: "고친 게 먹혔나" },
];

const ERP_BARS: [string, number, boolean][] = [
  ["A사", 9, false], ["B사", 8, false], ["C사", 8, false], ["D사", 4, false], ["이 회사", 3, true],
];

/** 글 제목에서 업종 이름은 뺐다. 제목과 A·B·C 가 합쳐지면 회사가 특정된다. */
const ERP_DOCS = [
  "국내 업체 순위 Top5",
  "중견·중소기업 프로그램 비교 가이드",
  "회사 규모별 프로그램 추천",
];

export default function RecordTabs() {
  const [tab, setTab] = useState(0);
  const id = (i: number) => `rec-tab-${i}`;

  return (
    <div className="lp-rec">
      <div className="lp-rec-tabs" role="tablist" aria-label="실제 기록 세 장">
        {TABS.map((x, i) => (
          <button
            key={x.no}
            id={id(i)}
            type="button"
            role="tab"
            aria-selected={i === tab}
            aria-controls={`rec-panel-${i}`}
            tabIndex={i === tab ? 0 : -1}
            className="lp-rec-tab lp-press"
            onClick={() => setTab(i)}
            onKeyDown={(e) => tabKeys(e, i, TABS.length, setTab, id)}
          >
            <span className="k">{x.no} · {x.k}</span>
            <span className="t">{x.t}</span>
          </button>
        ))}
      </div>

      <div className="lp-card lp-rec-panel">
        <div role="tabpanel" id="rec-panel-0" aria-labelledby={id(0)} tabIndex={0} hidden={tab !== 0}>
          <div className="eb">소프트웨어 회사 진단 리포트 · 회사 이름 가림</div>
          <h3>홈페이지 점수 1위 회사가 <span className="hl">15번 중 3번</span></h3>
          <p className="p">그 업계 손님이 물어볼 질문을 AI 에게 15번 묻고, 회사마다 이름이 몇 번 나왔는지 셌습니다. 15번이라 순위가 아니라 방향으로 봅니다.</p>
          <div className="lp-bars">
            {ERP_BARS.map(([name, n, me]) => (
              <div key={name} className={me ? "me" : undefined}>
                <span className="n">{name}</span>
                <span className="tr" aria-hidden="true"><i style={{ width: `${Math.round((n / 15) * 100)}%` }} /></span>
                <span className="v mono">{n}/15</span>
              </div>
            ))}
          </div>
        </div>

        <div role="tabpanel" id="rec-panel-1" aria-labelledby={id(1)} tabIndex={0} hidden={tab !== 1}>
          <div className="eb">같은 회사 · AI 가 답할 때 참고한 비교 글</div>
          <h3>비교 글 14개에 <span className="crit">이름 0번</span></h3>
          <p className="p">
            AI 가 답할 때 참고한 비교 글 14개를 하나씩 열어 봤습니다. A·B·C사는 대부분 있었고
            이 회사 이름은 한 번도 없었습니다. 고칠 곳은 홈페이지가 아니라 이 글들이었습니다.
          </p>
          <div className="lp-docs">
            {ERP_DOCS.map((t) => (
              <div key={t}>
                <span className="t">「{t}」</span>
                <span className="y">A·B·C 있음 · <b>이 회사 없음</b></span>
              </div>
            ))}
          </div>
        </div>

        <div role="tabpanel" id="rec-panel-2" aria-labelledby={id(2)} tabIndex={0} hidden={tab !== 2}>
          <div className="eb">사례 학원 · 작업 기록</div>
          <h3>고칠 때마다 <span className="hl">무엇을 · 왜 · 기대</span>를 남깁니다</h3>
          <p className="p">같은 질문으로 다시 물었을 때 무엇이 달라졌는지 견줄 기준이 됩니다.</p>
          <dl className="lp-why">
            <div><dt>무엇</dt><dd><b>네이버 플레이스 소개글 188자 → 933자</b></dd></div>
            <div><dt>왜</dt><dd>네이버 AI 가 이 학원을 <b>「무선 인터넷과 남녀 구분 화장실을 제공합니다」</b>라고 소개하고 있었음</dd></div>
            <div><dt>기대</dt><dd>무엇을 가르치는 학원인지 답에 들어간다</dd></div>
          </dl>
        </div>
      </div>

      <p className="lp-rec-note">
        <b>「몇 위 보장」은 없습니다.</b> AI 답은 물을 때마다 바뀝니다.
        그래서 여러 번 묻고, 몇 번 물었는지를 숫자 옆에 같이 적습니다.
      </p>
    </div>
  );
}
