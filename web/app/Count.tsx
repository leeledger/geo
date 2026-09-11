"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 화면에 들어올 때 숫자가 올라간다.
 *
 * 장식으로 쓰면 값싸 보이지만, 이 페이지에서는 숫자가 주장 그 자체라
 * 시선을 거기로 끌어오는 값어치가 있다. 한 번만 돌고 다시 돌지 않는다.
 *
 * 서버 렌더에는 진짜 값이 들어간다. 전에는 0 으로 그렸다가 올렸는데,
 * 스크립트를 안 돌리는 크롤러에게는 「크롤러 0곳 · 0회」로 읽혔다.
 * 그래서 이미 화면에 보이는 숫자는 건드리지 않고, 아래쪽 숫자만 0 에서 올린다.
 */
export default function Count({
  to,
  decimals = 0,
  suffix = "",
  duration = 900,
}: {
  to: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const [v, setV] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(to);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      setV(to);
      return;
    }
    setV(0);
    let raf = 0;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min((now - t0) / duration, 1);
          // ease-out cubic — 끝에서 부드럽게 멈춘다
          setV(to * (1 - Math.pow(1 - k, 3)));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}
