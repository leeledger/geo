"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 만져보는 신뢰구간.
 *
 * 이 회사의 주장은 하나다 — "몇 번 물어봤는지 안 적힌 숫자는 믿을 게 못 된다."
 * 그걸 문장으로 설명하는 대신 직접 눌러 보게 한다. 표본을 늘리면 막대가 좁아진다.
 *
 * 숫자는 지어낸 게 아니라 Wilson score interval 로 실제 계산한다.
 * 측정을 파는 회사가 그래프를 눈대중으로 그리면 그 자체가 자기모순이다.
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

export default function Interval() {
  const [n, setN] = useState<number>(5);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 화면에 들어오면 한 번만 자동으로 훑어준다 — 조작 가능하다는 걸 알려주기 위해
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        setSeen(true);
        io.disconnect();
        if (reduce) return;
        STEPS.forEach((v, i) => window.setTimeout(() => setN(v), 500 + i * 620));
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  const { lo, hi } = useMemo(() => wilson(P_HAT, n), [n]);
  const width = (hi - lo) * 100;
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

  return (
    <div className="ivl" ref={ref}>
      <div className="ivlh">
        <span className="mono">몇 번 물어볼까요?</span>
        <div className="ivlbtns" role="group" aria-label="물어본 횟수">
          {STEPS.map((v) => (
            <button
              key={v}
              className={`ivlb mono${n === v ? " on" : ""}`}
              onClick={() => setN(v)}
              aria-pressed={n === v}
            >
              {v}회
            </button>
          ))}
        </div>
      </div>

      <div className="ivlplot">
        <div className="ivlaxis mono">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
        <div className="ivltrack">
          <span className="ivlband"
                style={{ left: pct(lo), width: `${width}%` }} />
          <span className="ivldot" style={{ left: pct(P_HAT) }} />
          <span className="ivltick" style={{ left: "50%" }} />
        </div>
        <div className="ivlread mono">
          <b>{(P_HAT * 100).toFixed(0)}%</b>
          <span>일 수도 있고</span>
          <b className="rng">{(lo * 100).toFixed(0)}~{(hi * 100).toFixed(0)}%</b>
          <span>사이 어디든</span>
        </div>
      </div>

      <p className="ivlnote">
        {n === 5 && (
          <>5번 물어서 3번 불렸습니다. <b>60%라고 적어도 될까요?</b> 실제로는 22%일 수도, 90%일 수도 있습니다.</>
        )}
        {n === 20 && (
          <>20번으로 늘리면 범위가 절반쯤 줄어듭니다. 그래도 <b>아직 40%p 폭</b>입니다.</>
        )}
        {n === 50 && (
          <>50번쯤 되면 “대략 이 정도”라고 말할 수 있습니다. 여기부터가 <b>보고할 만한 숫자</b>입니다.</>
        )}
        {n === 150 && (
          <>150번이면 폭이 <b>12%p</b>까지 좁아집니다. 이 정도라야 지난달과 비교해서 “늘었다”고 말할 수 있습니다.</>
        )}
      </p>
    </div>
  );
}
