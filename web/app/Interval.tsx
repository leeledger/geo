"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 만져보는 신뢰구간.
 *
 * 이 회사의 주장은 하나다 — "몇 번 물어봤는지 안 적힌 숫자는 믿을 게 못 된다."
 * 그걸 문장으로 설명하는 대신 직접 눌러 보게 한다. 표본을 늘리면 막대가 좁아진다.
 *
 * 숫자는 지어낸 게 아니라 Wilson score interval 로 실제 계산한다.
 * 설명 문장 안의 폭(%p)도 계산값을 그대로 쓴다. 손으로 적어 두면 식과 어긋난다.
 */

const STEPS = [5, 20, 50, 150] as const;
const P_HAT = 0.62; // 관측 비율 — 실제 측정에서 나온 값의 대표치

/** Wilson score interval — 표본이 작을 때 정규근사보다 정직하다 */
function wilson(pHat: number, n: number, z = 1.96) {
  const d = 1 + (z * z) / n;
  const c = pHat + (z * z) / (2 * n);
  const s = z * Math.sqrt((pHat * (1 - pHat)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, (c - s) / d), hi: Math.min(1, (c + s) / d) };
}

const spanOf = (n: number) => {
  const { lo, hi } = wilson(P_HAT, n);
  return Math.round((hi - lo) * 100);
};

export default function Interval() {
  const [n, setN] = useState<number>(5);
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  // 화면에 들어오면 한 번만 자동으로 훑어준다 — 조작 가능하다는 걸 알려주기 위해
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        timers.current = STEPS.map((v, i) => window.setTimeout(() => setN(v), 500 + i * 620));
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => { io.disconnect(); timers.current.forEach(clearTimeout); };
  }, []);

  // 사람이 누르면 자동 훑기는 멈춘다
  const pick = (v: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setN(v);
  };

  const { lo, hi } = useMemo(() => wilson(P_HAT, n), [n]);
  const LO = Math.round(lo * 100);
  const HI = Math.round(hi * 100);
  const span = Math.round((hi - lo) * 100);
  const P = Math.round(P_HAT * 100);

  return (
    <div className="lp-card lp-ivl" ref={ref}>
      <div className="lp-ivl-hd">
        <div>
          <h3>몇 번 물었는지 같이 씁니다</h3>
          <p>같은 {P}%라도 몇 번 물었느냐에 따라 믿을 수 있는 정도가 다릅니다. 눌러 보세요.</p>
        </div>
        <div className="lp-seg" role="group" aria-label="물어본 횟수">
          {STEPS.map((v) => (
            <button
              key={v}
              type="button"
              className="mono lp-press"
              aria-pressed={n === v}
              onClick={() => pick(v)}
            >
              {v}회
            </button>
          ))}
        </div>
      </div>

      <div className="lp-ivl-plot">
        <div className="lp-ivl-axis mono" aria-hidden="true">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
        <div className="lp-ivl-track" role="img" aria-label={`${n}번 물었을 때 ${P}%의 실제 범위 ${LO}~${HI}%`}>
          <span className="mid" />
          <span className="band" style={{ left: `${(lo * 100).toFixed(1)}%`, width: `${((hi - lo) * 100).toFixed(1)}%` }} />
          <span className="dot" style={{ left: `${P}%` }} />
        </div>
        <div className="lp-ivl-read">
          <b className="p">{P}%</b>
          <span>일 수도 있고</span>
          <b className="rng mono">{LO}~{HI}%</b>
          <span>사이 어디든 · {n}번 물었을 때</span>
        </div>
      </div>

      <p className="lp-ivl-note" aria-live="polite">
        {n === 5 && (
          <>5번만 물으면 같은 {P}%라도 실제 값은 <b>{LO}%에서 {HI}% 사이</b> 어디든 될 수 있습니다. 이 숫자로는 아무것도 말할 수 없습니다.</>
        )}
        {n === 20 && (
          <>5번일 때 {spanOf(5)}%p이던 폭이 20번이면 <b>{span}%p</b>로 줄어듭니다. 그래도 지난달과 견주기엔 넓습니다.</>
        )}
        {n === 50 && (
          <>50번쯤 되면 「대략 이 정도」라고 말할 수 있습니다. <b>여기부터가 보고할 만한 숫자</b>입니다.</>
        )}
        {n === 150 && (
          <>150번이면 폭이 <b>{span}%p</b>까지 좁아집니다. 이 정도라야 지난달과 비교해서 「늘었다」고 말할 수 있습니다.</>
        )}
      </p>
    </div>
  );
}
