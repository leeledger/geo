"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * ★ 답변 색인 커버리지 — 착수부터 누적. 한 축(읽어 간 쪽 수), 선 3개.
 *
 * 폭은 상자 폭을 재서 그 픽셀로 그린다(viewBox 도 그 폭). 고정 viewBox 를 390px 에 욱여넣으면
 * 글자가 5px 로 줄어 못 읽는다. 높이는 x축 글자까지 포함한다 — 안쪽 스크롤 없음.
 * 이름·라벨은 JSX 텍스트로만 넣는다.
 */

export type CovSeries = { vendor: string; label: string; color: string; points: { day: string; pages: number }[] };

const H = 212;
const T = 10;          // 위 여백
const B = 28;          // x축 글자 띠
const L = 32;          // y축 글자
const R = 104;         // 끝 라벨 자리 — 「구글·네이버 47」이 390px 에서 안 잘리게
const MERGE = 14;      // 끝 라벨 세로 간격이 이보다 좁으면 한 라벨로 합친다

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const isMonday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1;

export default function CoverageChart({ total, series }: { total: number; series: CovSeries[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = series[0]?.points.map((p) => p.day) ?? [];
  if (total === 0) return <p className="gr-empty">쪽 목록 없음</p>;
  if (days.length < 2) return <p className="gr-empty">하루치 — 추세 없음</p>;

  const pw = w - L - R;
  const ph = H - T - B;
  const step = pw / (days.length - 1);
  const x = (i: number) => L + i * step;
  const y = (v: number) => T + ph - (v / total) * ph;
  const ticks = [...new Set([0, Math.round(total / 2), total])];

  // 월요일 눈금. 좁아서 붙으면 몇 주씩 건너뛴다
  const mondays = days.map((d, i) => ({ d, i })).filter((m) => isMonday(m.d));
  const every = Math.max(1, Math.ceil(36 / (step * 7)));
  const xTicks = mondays.filter((_, k) => k % every === 0);

  // 끝 라벨 — 세로로 가까우면 한 라벨로
  const last = days.length - 1;
  const ends = series
    .map((s) => ({ label: s.label, v: s.points[last].pages, y: y(s.points[last].pages) }))
    .sort((a, b) => a.y - b.y);
  const groups: { label: string; v: number; y: number }[][] = [];
  for (const e of ends) {
    const g = groups[groups.length - 1];
    if (g && e.y - g[g.length - 1].y < MERGE) g.push(e);
    else groups.push([e]);
  }
  const endLabels = groups.map((g) => {
    const same = g.every((e) => e.v === g[0].v);
    return {
      y: g.reduce((s, e) => s + e.y, 0) / g.length,
      text: same ? `${g.map((e) => e.label).join("·")} ${g[0].v}` : g.map((e) => `${e.label} ${e.v}`).join(" · "),
    };
  });

  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const px = (clientX - r.left) * (w / r.width);
    setIdx(Math.min(last, Math.max(0, Math.round((px - L) / step))));
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "Home" && k !== "End") return;
    e.preventDefault();
    setIdx((i) => {
      const cur = i ?? last;
      if (k === "Home") return 0;
      if (k === "End") return last;
      return Math.min(last, Math.max(0, cur + (k === "ArrowRight" ? 1 : -1)));
    });
  };

  const hx = idx === null ? 0 : x(idx);
  const flip = hx > w / 2;
  const readout = idx === null ? "" :
    `${md(days[idx])} — ` + series.map((s) => `${s.label} ${s.points[idx].pages}쪽`).join(", ");

  return (
    <div className="gr-chart">
      <div className="gr-legend" aria-hidden="true">
        {series.map((s) => (
          <span key={s.vendor}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
      <div
        ref={box}
        className="gr-plot"
        tabIndex={0}
        role="group"
        aria-label={`답변 색인에 들어간 쪽 수 선그래프, ${md(days[0])}부터 ${md(days[last])}까지. 좌우 화살표로 날짜를 옮긴다. 날짜별 값은 아래 자세히의 표에 있다`}
        onKeyDown={onKey}
        onFocus={() => setIdx((i) => i ?? last)}
        onBlur={() => setIdx(null)}
      >
        {/* 호버는 svg 전체가 받는다 — 선이 아니라 가장 가까운 날짜를 겨눈다 */}
        <svg
          width="100%" height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setIdx(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={L + pw} y1={y(t)} y2={y(t)} stroke="var(--soft)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={L - 7} y={y(t)} dy="0.35em" textAnchor="end" className="gr-ax">{t}</text>
            </g>
          ))}
          {xTicks.map((m) => (
            <text key={m.d} x={x(m.i)} y={H - 8} textAnchor="middle" className="gr-ax">{md(m.d)}</text>
          ))}
          {idx !== null && (
            <line x1={hx} x2={hx} y1={T} y2={T + ph} stroke="var(--mut)" strokeWidth={1} shapeRendering="crispEdges" />
          )}
          {series.map((s) => (
            <path
              key={s.vendor}
              d={s.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pages).toFixed(1)}`).join("")}
              fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            />
          ))}
          {series.map((s) => (
            <circle key={s.vendor} cx={x(last)} cy={y(s.points[last].pages)} r={4}
                    fill={s.color} stroke="var(--card)" strokeWidth={2} />
          ))}
          {idx !== null && idx !== last && series.map((s) => (
            <circle key={s.vendor} cx={hx} cy={y(s.points[idx].pages)} r={4}
                    fill={s.color} stroke="var(--card)" strokeWidth={2} />
          ))}
          {endLabels.map((l) => (
            <text key={l.text} x={x(last) + 10} y={l.y} dy="0.35em" className="gr-end">{l.text}</text>
          ))}
        </svg>
        {idx !== null && (
          <div className="gr-tip" style={flip ? { right: w - hx + 10 } : { left: hx + 10 }} aria-hidden="true">
            <div className="gr-tip-d">{md(days[idx])}</div>
            {series.map((s) => (
              <div key={s.vendor} className="gr-tip-r">
                <i style={{ background: s.color }} />
                <b>{s.points[idx].pages}쪽</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="gr-sr" aria-live="polite">{readout}</div>
      </div>
    </div>
  );
}
