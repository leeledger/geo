"use client";

import { useEffect } from "react";

/**
 * 스크롤 인터랙션.
 *
 * 장식이 아니라 시연이다. 신뢰구간 그래프는 화면에 들어올 때 막대가 위아래로
 * 좁혀지며 그려진다 — "많이 물어볼수록 답이 또렷해진다"는 주장을 글로 읽는 대신
 * 눈으로 보게 하는 것이 목적이다.
 *
 * 스크립트가 실행되지 않아도 최종 상태로 보인다. 애니메이션은 얹는 것이지
 * 내용을 대신하지 않는다.
 */
export default function Reveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const delay = Number(el.dataset.reveal) || 0;
          window.setTimeout(() => el.classList.add("in"), delay);
          io.unobserve(el);
        });
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
