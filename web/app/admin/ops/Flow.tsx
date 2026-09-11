"use client";

import { useEffect, useState } from "react";

/**
 * 업무가 도는 고리.
 *
 * 네 번 고쳐 왔다.
 *   고리 위의 원 여섯 개  → 흐름은 보였지만 부하와 계층이 안 보였다
 *   층으로 쌓은 막대       → 부하는 보였지만 「망」이라는 느낌이 없었다
 *   조율자 중심의 별 모양   → 글은 「고리」라는데 그림엔 고리가 없었다.
 *                          「고리가 끊겼습니다」라고 적어 놔도 끊길 고리가 화면에 없다
 *   지금                → 일하는 순서대로 다섯 자리를 고리에 놓고,
 *                          일감이 그 위를 실제로 돌게 한다
 *
 * 지키는 것
 *   고리는 진짜 순서다. 쓰고 → 내보내고 → 읽히고 → 재고 → 다음 주제
 *   막힌 자리에는 일감이 쌓인다. 어디서 막혔는지 손가락으로 짚을 수 있어야 한다
 *   초록은 「지금 일하는 중」만 뜻한다. 멀쩡한 대기는 회색이다
 *   퇴근이 없다 — 24시간 띠에 빈 구간이 있으면 눈에 보이게
 *   늘 움직인다. 전에는 prefers-reduced-motion 을 따랐는데, 원장 PC 는 Windows 「애니메이션 효과」가
 *   꺼져 있어 고리가 통째로 멈춰 보였다(9.11). 이 화면은 원장 한 사람이 보는 운영판이라 움직임이 곧 정보다
 */

export type NodeState = {
  id: string;
  label: string;
  sub: string;
  state: "run" | "idle" | "wait" | "stop";
};

export type Slot = { at: string; name: string; team: string; need: string; dow?: number };

type Props = {
  nodes: NodeState[];
  slots: Slot[];
  cycleOk: boolean;
  /** 고리가 실제로 멈춘 자리. 오늘 손대야 하는 것만 들어온다. */
  stopped?: { at: string; why: string } | null;
  /** 5번 자리가 내놓은 답 — 무엇을 할 차례인가. 멈춤이 아니다. */
  decision?: { do: string; why: string } | null;
  /**
   * 자리마다 맥박 — 마지막으로 언제 뛰었고 다음은 언제인가.
   * 누적값만 있으면 살아 있는지 알 수 없다.
   */
  beats?: Record<string, { last: string | null; next: string }>;
};

const COLOR = { run: "#3DD6A0", idle: "#4B5666", wait: "#E0A93C", stop: "#D2705F" };
const TEAM_HUE: Record<string, string> = {
  운영: "#8B7BE8", 측정: "#3DD6C4", 유통: "#F5A623", 콘텐츠: "#E86FA0",
};

const W = 1080, H = 780;
const CX = 540, CY = 348;
const R = 246;

/**
 * 고리 위의 다섯 자리 — 일하는 순서 그대로 시계방향.
 * 맨 위에서 시작해 한 바퀴 돈다. verb 는 「무엇을 하는 자리인가」다.
 * 이름(콘텐츠·유통)만 적으면 부서 조직도가 되고, 동사를 적어야 일로 읽힌다.
 */
const RING = [
  { id: "content", verb: "쓴다", team: "콘텐츠" },
  { id: "deliver", verb: "내보낸다", team: "유통" },
  { id: "crawler", verb: "읽혀진다", team: "" },
  { id: "measure", verb: "잰다", team: "측정" },
  { id: "next", verb: "다음을 정한다", team: "운영" },
] as const;

/** 시계방향, 12시부터. 다섯 자리라 72도씩. */
const angleOf = (i: number) => (-90 + (360 / RING.length) * i) * (Math.PI / 180);
const posOf = (i: number) => ({
  x: CX + Math.cos(angleOf(i)) * R,
  y: CY + Math.sin(angleOf(i)) * R * 0.82,   // 살짝 눌러 화면에 맞춘다
});

/** 고리 위 두 자리를 잇는 호. 바깥으로 볼록하게 — 안쪽은 조율자가 쓴다. */
function arc(i: number, j: number) {
  const a = posOf(i), b = posOf(j);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = mx - CX, dy = my - CY;
  const L = Math.hypot(dx, dy) || 1;
  const bulge = 34;
  return `M${a.x},${a.y} Q${mx + (dx / L) * bulge},${my + (dy / L) * bulge} ${b.x},${b.y}`;
}

const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** 자리마다 다른 표식. 직접 그린 단순한 도형이다. */
function Glyph({ id, c }: { id: string; c: string }) {
  const s = { stroke: c, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const };
  if (id === "measure") return <g {...s}><path d="M-8,6 L-8,-2 M-1,6 L-1,-7 M6,6 L6,1" /></g>;
  if (id === "content") return <g {...s}><path d="M-7,-6 H7 M-7,0 H7 M-7,6 H2" /></g>;
  if (id === "deliver") return <g {...s}><path d="M-8,0 H6 M2,-5 L7,0 L2,5" /></g>;
  if (id === "crawler") return <g fill={c} stroke="none">
    {[-7, 0, 7].map((a) => [-7, 0, 7].map((b) => <circle key={`${a}${b}`} cx={a} cy={b} r="1.7" />))}
  </g>;
  if (id === "next") return <g {...s}><path d="M-7,3 a7,7 0 1 1 4,4" /><path d="M-8,-2 L-7,3 L-2,2" /></g>;
  if (id === "human") return <g {...s}><circle cx="0" cy="-4" r="4" /><path d="M-7,8 a7,7 0 0 1 14,0" /></g>;
  return <g {...s}><circle cx="0" cy="0" r="7" /><path d="M0,-7 V7 M-7,0 H7" /></g>;
}

export default function Flow({ nodes, slots, cycleOk, stopped, decision, beats }: Props) {
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

  const stopIdx = stopped ? RING.findIndex((r) => r.id === stopped.at) : -1;

  const isLive = (id: string, team: string) =>
    (team && activeTeam === team) || (id === "crawler" && by.crawler?.state === "run");

  return (
    <div className="ops-flow">
      {/* 24시간 띠 — 퇴근이 없다는 걸 눈으로 보이게 */}
      <div className="ops-band">
        <div className="ops-band-h">
          <span>
            오늘 <b className="cnt">{today.length}</b>번 돕니다
            {nowM >= 0 && <> · 지난 <b className="cnt">{today.filter((s) => mins(s.at) <= nowM).length}</b> · 남은 <b className="cnt">{today.filter((s) => mins(s.at) > nowM).length}</b></>}
          </span>
          <span className="ops-band-note">
            {activeTeam
              ? <b className="live">● {activeTeam} 작업 중</b>
              : <span className="idle">● 다음 근무 대기</span>}
            {nextSlot && <span className="nx">다음 {nextSlot.at} {nextSlot.name}</span>}
          </span>
        </div>
        {/*
          시간띠. 앞선 판은 같은 모양 막대가 늘어서 있어서 무엇이 지났고
          무엇이 남았는지 안 보였다. 지금은 셋을 눈으로 가른다 —
            지난 일   흐리게, 채워짐
            남은 일   또렷하게, 테두리만
            세션 필요 위쪽에 점을 찍는다 (사람이 켜 줘야 도는 일)
        */}
        <div className="ops-band-track">
          <div className="past" style={{ width: `${nowM >= 0 ? (nowM / 1440) * 100 : 0}%` }} />
          {Array.from({ length: 5 }, (_, i) => i * 6).map((h) => (
            <i key={h} className="tick" style={{ left: `${(h / 24) * 100}%` }}>
              <span>{String(h).padStart(2, "0")}</span>
            </i>
          ))}
          {today.map((s) => {
            const m = mins(s.at);
            const done = nowM >= 0 && m <= nowM;
            const hue = TEAM_HUE[s.team] ?? "#5A6474";
            return (
              <span key={s.at + s.name}
                    className={`mk ${done ? "done" : "todo"} ${s.need === "세션" ? "man" : ""}`}
                    style={{
                      left: `${(m / 1440) * 100}%`,
                      background: done ? hue : "transparent",
                      borderColor: hue,
                    }}
                    title={`${s.at} ${s.name} · ${s.need === "무관" ? "자동" : "사람이 켜 줘야 함"}`} />
            );
          })}
          {nowM >= 0 && (
            <i className="nowline" style={{ left: `${(nowM / 1440) * 100}%` }}>
              <b>{String(now!.getHours()).padStart(2, "0")}:{String(now!.getMinutes()).padStart(2, "0")}</b>
            </i>
          )}
        </div>

        <div className="ops-band-key">
          {Object.entries(TEAM_HUE).map(([k, v]) => (
            <span key={k}><i style={{ background: v }} />{k}</span>
          ))}
          <span className="sep" />
          <span><i className="k-done" />지난 일</span>
          <span><i className="k-todo" />남은 일</span>
          <span><i className="k-man" />사람이 켜 줘야 함</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`업무 고리. 쓴다 → 내보낸다 → 읽혀진다 → 잰다 → 다음을 정한다 순서로 돌고, 가운데 조율자가 지켜본다.${stopped ? ` 지금 ${stopped.why} 때문에 멈춰 있다.` : ` 5번이 내놓은 답은 ${decision?.do ?? ""}.`}`}>
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
          <marker id="ahOk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={COLOR.run} opacity=".75" />
          </marker>
          <marker id="ahBad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={COLOR.wait} />
          </marker>
          {/* 고리 위를 도는 일감이 지날 길 */}
          {RING.map((_, i) => (
            <path key={`p${i}`} id={`ring${i}`} d={arc(i, (i + 1) % RING.length)} fill="none" />
          ))}
        </defs>

        <rect width={W} height={H} fill="url(#bgg)" rx="14" />

        {/* ── 고리의 각 구간 ── */}
        {RING.map((r, i) => {
          const j = (i + 1) % RING.length;
          // 막힌 자리로 들어가는 구간이 끊긴 구간이다
          const dead = stopIdx >= 0 && j === stopIdx;
          return (
            <g key={`arc${i}`}>
              <path d={arc(i, j)} fill="none"
                    stroke={dead ? COLOR.wait : "#22415C"}
                    strokeWidth={dead ? 2 : 1.6}
                    strokeDasharray={dead ? "7 7" : undefined}
                    opacity={dead ? 0.85 : 0.5}
                    markerEnd={dead ? "url(#ahBad)" : "url(#ahOk)"} />

              {/* 일감. 막힌 구간에는 안 흘려보낸다 — 흐르는 그림이 거짓말이 된다 */}
              {!dead && [0, 1].map((k) => (
                <circle key={k} r="3.4" fill={COLOR.run} opacity=".95">
                  <animateMotion dur={`${4.2 + i * 0.45}s`} begin={`${k * 2.1 + i * 0.5}s`}
                                 repeatCount="indefinite" rotate="auto">
                    <mpath href={`#ring${i}`} />
                  </animateMotion>
                </circle>
              ))}
            </g>
          );
        })}

        {/* ── 막힌 자리 앞에 쌓인 일감 ── */}
        {stopIdx >= 0 && (() => {
          const prev = (stopIdx - 1 + RING.length) % RING.length;
          const a = posOf(prev), b = posOf(stopIdx);
          const t = 0.72;                             // 도착 직전에 멈춰 선다
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          return (
            <g>
              {[0, 1, 2].map((k) => (
                <circle key={k} cx={x - k * 11} cy={y - k * 5} r="3.4"
                        fill={COLOR.wait} opacity={0.9 - k * 0.22}>
                  <animate attributeName="opacity"
                           values={`${0.9 - k * 0.22};${0.35 - k * 0.08};${0.9 - k * 0.22}`}
                           dur="2.4s" begin={`${k * 0.3}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
          );
        })()}

        {/* ── 가운데 조율자 ── */}
        <g>
          <circle cx={CX} cy={CY} r="52" fill={COLOR.run} opacity=".07" filter="url(#wide)" />
          <circle cx={CX} cy={CY} r="34" fill="#0D1622" stroke={COLOR.run} strokeWidth="1.6" opacity=".9" />
          <g transform={`translate(${CX},${CY - 4})`}><Glyph id="ops" c={COLOR.run} /></g>
          <text x={CX} y={CY + 21} textAnchor="middle" className="fl-mid">조율자</text>
          <text x={CX} y={CY + 62} textAnchor="middle" className="fl-sub">
            {by.ops?.sub ?? "3시간마다 점검"}
          </text>
          {/* 조율자가 각 자리를 지켜본다는 표시. 가늘게 — 주인공은 고리다 */}
          {RING.map((_, i) => {
            const p = posOf(i);
            return <line key={`w${i}`} x1={CX} y1={CY} x2={p.x} y2={p.y}
                         stroke="#1D3247" strokeWidth="0.9" opacity=".55" strokeDasharray="2 6" />;
          })}
        </g>

        {/* ── 고리 위의 자리들 ── */}
        {RING.map((r, i) => {
          const p = posOf(i);
          const n = by[r.id] ?? by.ops;
          const live = isLive(r.id, r.team);
          const isBlock = i === stopIdx;
          const c = isBlock ? COLOR.wait
            : live ? COLOR.run
            : n?.state === "stop" ? COLOR.stop
            : n?.state === "wait" ? COLOR.wait
            : COLOR.idle;
          const size = 36;

          return (
            <g key={r.id}>
              {(live || isBlock) && (
                <circle cx={p.x} cy={p.y} r={size + 16} fill={c} opacity=".1" filter="url(#soft)" />
              )}
              <circle cx={p.x} cy={p.y} r={size} fill="#0C1420" stroke={c}
                      strokeWidth={live || isBlock ? 2 : 1.2} opacity={live || isBlock ? 1 : 0.75} />
              {live && (
                <circle cx={p.x} cy={p.y} r={size} fill="none" stroke={c} strokeWidth="1.4">
                  <animate attributeName="r" values={`${size};${size + 13}`} dur="2.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values=".5;0" dur="2.6s" repeatCount="indefinite" />
                </circle>
              )}
              <g transform={`translate(${p.x},${p.y - 5})`}><Glyph id={r.id} c={c} /></g>

              {/* 순서 번호. 이게 있어야 「고리」로 읽힌다 */}
              <text x={p.x} y={p.y + 17} textAnchor="middle" className="fl-step">{i + 1}</text>

              <text x={p.x} y={p.y + size + 22} textAnchor="middle" className="fl-verb">{r.verb}</text>
              <text x={p.x} y={p.y + size + 40} textAnchor="middle" className="fl-sub">{n?.sub}</text>
              {/* 맥박 — 마지막으로 언제 뛰었나. 이게 있어야 살아 있는지 안다 */}
              {beats?.[r.id] && (
                <text x={p.x} y={p.y + size + 74} textAnchor="middle" className="fl-beat">
                  {beats[r.id].last ? `마지막 ${beats[r.id].last}` : "기록 없음"}
                  {"  ·  "}
                  <tspan className="fl-next">{beats[r.id].next}</tspan>
                </text>
              )}
              {/*
                한 줄만 쓴다. 앞선 판은 「작업 중」과 「→ 할 일」을 같은 높이에 그려서
                5번 자리에서 글씨가 겹쳤다. 할 일이 있으면 그게 더 중요한 정보고,
                작업 중인지는 원 테두리 빛으로 이미 보인다.
              */}
              {isBlock ? (
                <text x={p.x} y={p.y + size + 57} textAnchor="middle" className="fl-block">여기서 멈췄습니다</text>
              ) : r.id === "next" && decision ? (
                <text x={p.x} y={p.y + size + 57} textAnchor="middle" className="fl-do">
                  → {decision.do}
                </text>
              ) : live ? (
                <text x={p.x} y={p.y + size + 57} textAnchor="middle" className="fl-live">작업 중</text>
              ) : null}
            </g>
          );
        })}

        {/* ── 사람. 고리 밖에 둔다 — 자동으로 안 돌아가는 일이라 ── */}
        <g>
          <line x1={CX} y1={CY} x2={112} y2={104} stroke={COLOR.wait} strokeWidth="1" opacity=".3" strokeDasharray="3 6" />
          <circle cx={112} cy={104} r="27" fill="#0C1420" stroke={COLOR.wait} strokeWidth="1.2" opacity=".8" />
          <g transform="translate(112,100)"><Glyph id="human" c={COLOR.wait} /></g>
          <text x={112} y={141} textAnchor="middle" className="fl-verb">사람</text>
          <text x={112} y={158} textAnchor="middle" className="fl-sub">{by.human?.sub ?? "로그인·촬영·상담"}</text>
          <text x={112} y={175} textAnchor="middle" className="fl-sub dim">고리 밖 · 자동 안 됨</text>
        </g>
      </svg>

      <div className="ops-legend">
        <span><i style={{ background: COLOR.run }} />작업 중</span>
        <span><i style={{ background: COLOR.idle }} />대기</span>
        <span><i style={{ background: COLOR.wait }} />사람 필요 · 막힘</span>
        <span><i style={{ background: COLOR.stop }} />멈춤</span>
        <span className="ops-note">점 = 일감 · 번호 = 순서</span>
        <span className={cycleOk ? "ops-cy ok" : "ops-cy bad"}>
          {stopped ? stopped.why : decision ? `다음: ${decision.do}` : "고리가 돌고 있습니다"}
        </span>
      </div>
    </div>
  );
}
