"use client";

import { useEffect, useState } from "react";

/**
 * 에이전트 망 — 가운데 조율자와 그 둘레의 자리들.
 *
 * 세 번 고쳐 왔다.
 *   고리 위의 원 여섯 개  → 흐름은 보였지만 부하와 계층이 안 보였다
 *   층으로 쌓은 막대       → 부하는 보였지만 "망"이라는 느낌이 없었다
 *   지금                → 조율자가 가운데, 자리들이 둘레. 선으로 일이 오간다
 *
 * 지키는 것
 *   크기가 부하다. 하루 네 번 도는 자리와 한 번 도는 자리를 같게 그리면 거짓말이다
 *   초록은 "지금 일하는 중"만 뜻한다. 멀쩡한 대기는 회색이다
 *   퇴근이 없다 — 24시간 띠에 빈 구간이 있으면 눈에 보이게
 */

export type NodeState = {
  id: string;
  label: string;
  sub: string;
  state: "run" | "idle" | "wait" | "stop";
};

export type Slot = { at: string; name: string; team: string; need: string; dow?: number };
type Props = { nodes: NodeState[]; slots: Slot[]; cycleOk: boolean };

const COLOR = { run: "#3DD6A0", idle: "#4B5666", wait: "#E0A93C", stop: "#D2705F" };
const TEAM_HUE: Record<string, string> = {
  운영: "#8B7BE8", 측정: "#3DD6C4", 유통: "#F5A623", 콘텐츠: "#E86FA0",
};

const W = 1040, H = 712;   // 아래 자리의 글자 세 줄까지 들어가야 한다
const CX = 520, CY = 320;

/**
 * 자리 배치. 일부러 대칭을 깬다 —
 * 정확한 원에 놓으면 도표처럼 보이고, 살짝 흐트러뜨리면 망처럼 보인다.
 * r 은 반지름(부하가 클수록 조율자에 가깝다), size 는 노드 크기(부하).
 */
const SPOTS: Record<string, { x: number; y: number; size: number; team: string }> = {
  ops:     { x: 520, y: 116, size: 46, team: "운영" },
  measure: { x: 826, y: 232, size: 42, team: "측정" },
  deliver: { x: 830, y: 470, size: 38, team: "유통" },
  crawler: { x: 552, y: 556, size: 40, team: "" },
  content: { x: 238, y: 486, size: 34, team: "콘텐츠" },
  human:   { x: 198, y: 214, size: 32, team: "" },
};

const LOAD: Record<string, string> = {
  ops: "하루 4회", measure: "하루 3회", deliver: "하루 2회",
  content: "하루 1회", crawler: "연속", human: "필요할 때",
};

const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** 조율자에서 자리로 가는 부드러운 곡선 */
function link(x: number, y: number) {
  const mx = (CX + x) / 2, my = (CY + y) / 2;
  const nx = -(y - CY), ny = x - CX;
  const L = Math.hypot(nx, ny) || 1;
  const bend = 46;
  return `M${CX},${CY} Q${mx + (nx / L) * bend},${my + (ny / L) * bend} ${x},${y}`;
}

/** 자리마다 다른 표식. 직접 그린 단순한 도형이다. */
function Glyph({ id, c }: { id: string; c: string }) {
  const s = { stroke: c, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const };
  if (id === "measure") return <g {...s}><path d="M-8,6 L-8,-2 M-1,6 L-1,-7 M6,6 L6,1" /></g>;
  if (id === "content") return <g {...s}><path d="M-7,-6 H7 M-7,0 H7 M-7,6 H2" /></g>;
  if (id === "deliver") return <g {...s}><path d="M-8,0 H6 M2,-5 L7,0 L2,5" /></g>;
  if (id === "crawler") return <g fill={c} stroke="none">
    {[-7, 0, 7].map((a) => [-7, 0, 7].map((b) => <circle key={`${a}${b}`} cx={a} cy={b} r="1.7" />))}
  </g>;
  if (id === "human") return <g {...s}><circle cx="0" cy="-4" r="4" /><path d="M-7,8 a7,7 0 0 1 14,0" /></g>;
  return <g {...s}><circle cx="0" cy="0" r="7" /><path d="M0,-7 V7 M-7,0 H7" /></g>;
}

export default function Flow({ nodes, slots, cycleOk }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const nowM = now ? now.getHours() * 60 + now.getMinutes() : -1;
  const dow = now ? now.getDay() : -1;
  const today = slots.filter((s) => s.dow === undefined || s.dow === dow);

  const activeTeam = (() => {
    if (nowM < 0) return null;
    const past = today.filter((s) => mins(s.at) <= nowM).sort((a, b) => mins(b.at) - mins(a.at));
    const last = past[0];
    return last && nowM - mins(last.at) <= 30 ? last.team : null;
  })();
  const nextSlot = today.find((s) => mins(s.at) > nowM) ?? today[0];

  const isLive = (id: string) =>
    (SPOTS[id].team && activeTeam === SPOTS[id].team) ||
    (id === "crawler" && by.crawler?.state === "run");

  return (
    <div className="ops-flow">
      {/* 24시간 띠 — 퇴근이 없다는 걸 눈으로 보이게 */}
      <div className="ops-band">
        <div className="ops-band-h">
          <span>24시간</span>
          <span className="ops-band-note">
            {activeTeam
              ? <b className="live">● {activeTeam} 작업 중</b>
              : <span className="idle">● 다음 근무 대기</span>}
            {nextSlot && <span className="nx">다음 {nextSlot.at} {nextSlot.name}</span>}
          </span>
        </div>
        <div className="ops-band-track">
          {Array.from({ length: 25 }, (_, h) => (
            <i key={h} className="tick" style={{ left: `${(h / 24) * 100}%` }}>
              {h % 6 === 0 && <span>{h}</span>}
            </i>
          ))}
          {today.map((s) => (
            <span key={s.at + s.name}
                  className={`mk ${s.need === "무관" ? "auto" : ""}`}
                  style={{ left: `${(mins(s.at) / 1440) * 100}%`, background: TEAM_HUE[s.team] ?? "#5A6474" }}
                  title={`${s.at} ${s.name}`} />
          ))}
          {nowM >= 0 && <i className="nowline" style={{ left: `${(nowM / 1440) * 100}%` }} />}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label="에이전트 망. 가운데 조율자를 중심으로 운영·측정·유통·콘텐츠·크롤러·사람이 선으로 이어져 있다.">
        <defs>
          <radialGradient id="bgg" cx="50%" cy="46%">
            <stop offset="0" stopColor="#16233A" />
            <stop offset="1" stopColor="#0A0E16" />
          </radialGradient>
          <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="wide" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
          <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#2A3A50" />
          </marker>
        </defs>

        <rect width={W} height={H} rx="18" fill="url(#bgg)" />

        {/* 뒤에 깔린 빛무리. 장식이지만 자리마다 색이 달라 어디가 무슨 팀인지 읽힌다 */}
        {Object.entries(SPOTS).map(([id, p]) => (
          <circle key={`b-${id}`} cx={p.x} cy={p.y} r={p.size * 2.4}
                  fill={TEAM_HUE[p.team] ?? "#2A6E8A"} opacity=".10" filter="url(#wide)" />
        ))}
        <circle cx={CX} cy={CY} r="150" fill="#3DD6C4" opacity=".08" filter="url(#wide)" />

        {/* 연결선 */}
        {Object.entries(SPOTS).map(([id, p], i) => {
          const d = link(p.x, p.y);
          const live = isLive(id);
          return (
            <g key={`l-${id}`}>
              <path d={d} fill="none" stroke={live ? "#3DD6A0" : "#22303F"}
                    strokeWidth={live ? 2.4 : 1.6} opacity={live ? 0.9 : 0.75} />
              {live && <path d={d} fill="none" stroke="#3DD6A0" strokeWidth="5"
                             opacity=".28" filter="url(#soft)" />}
              {now && (
                <circle r={live ? 4.5 : 3} fill={live ? "#7BFFD4" : "#3A5570"}>
                  <animateMotion dur={`${2.8 + i * 0.42}s`} repeatCount="indefinite" path={d} />
                  <animate attributeName="opacity" values="0;1;1;0"
                           dur={`${2.8 + i * 0.42}s`} repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* 가운데 조율자 */}
        <g>
          <circle cx={CX} cy={CY} r="58" fill="#3DD6C4" opacity=".16" filter="url(#soft)" />
          {now && (
            <circle cx={CX} cy={CY} r="52" fill="none" stroke="#3DD6C4" strokeWidth="1.6">
              <animate attributeName="r" values="50;76" dur="3.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values=".5;0" dur="3.4s" repeatCount="indefinite" />
            </circle>
          )}
          <circle cx={CX} cy={CY} r="48" fill="#101A26" stroke="#3DD6C4" strokeWidth="2.5" />
          <g transform={`translate(${CX},${CY - 8})`}>
            <circle cx="0" cy="0" r="11" fill="none" stroke="#3DD6C4" strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill="#3DD6C4" />
            {[0, 72, 144, 216, 288].map((a) => (
              <line key={a} x1="0" y1="0"
                    x2={Math.cos((a * Math.PI) / 180) * 19}
                    y2={Math.sin((a * Math.PI) / 180) * 19}
                    stroke="#3DD6C4" strokeWidth="1.4" opacity=".7" />
            ))}
          </g>
          <text x={CX} y={CY + 26} className="ops-orch" textAnchor="middle">조율자</text>
          <rect x={CX - 62} y={CY + 58} width="124" height="24" rx="12"
                fill="#0F2A2A" stroke="#3DD6C4" strokeOpacity=".55" />
          <text x={CX} y={CY + 74} className="ops-orch-t" textAnchor="middle">
            {activeTeam ? `${activeTeam} 실행 중` : "다음 근무 대기"}
          </text>
        </g>

        {/* 자리들 */}
        {Object.entries(SPOTS).map(([id, p]) => {
          const n = by[id];
          if (!n) return null;
          const live = isLive(id);
          const c = live ? COLOR.run
            : n.state === "wait" ? COLOR.wait
            : n.state === "stop" ? COLOR.stop
            : COLOR.idle;
          return (
            <g key={id}>
              {live && now && (
                <circle cx={p.x} cy={p.y} r={p.size} fill="none" stroke={c} strokeWidth="2">
                  <animate attributeName="r" values={`${p.size};${p.size + 22}`} dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values=".6;0" dur="2.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={p.x} cy={p.y} r={p.size} fill={c} opacity={live ? ".2" : ".1"} filter="url(#soft)" />
              <circle cx={p.x} cy={p.y} r={p.size} fill="#101720" stroke={c} strokeWidth={live ? 2.6 : 1.8} />
              <g transform={`translate(${p.x},${p.y - 4})`}><Glyph id={id} c={c} /></g>
              <text x={p.x} y={p.y + p.size + 22} className="ops-nl" textAnchor="middle">{n.label}</text>
              <text x={p.x} y={p.y + p.size + 40} className="ops-ns" textAnchor="middle">{n.sub}</text>
              <text x={p.x} y={p.y + p.size + 57} textAnchor="middle"
                    className={live ? "ops-live-t" : "ops-el"}>
                {live ? "작업 중" : LOAD[id]}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="ops-legend">
        <span><i style={{ background: COLOR.run }} />작업 중</span>
        <span><i style={{ background: COLOR.idle }} />대기</span>
        <span><i style={{ background: COLOR.wait }} />사람 필요</span>
        <span><i style={{ background: COLOR.stop }} />멈춤</span>
        <span className="ops-note">원 크기 = 하루 실행 횟수</span>
        <span className={cycleOk ? "ops-cy ok" : "ops-cy bad"}>
          {cycleOk ? "고리가 돌고 있습니다" : "고리가 끊겼습니다"}
        </span>
      </div>
    </div>
  );
}
