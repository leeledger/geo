"use client";

import { useEffect } from "react";

/**
 * 스크롤 인터랙션.
 *
 * 장식이 아니라 시연이다. 게이지와 막대가 화면에 들어올 때 차오른다 —
 * 숫자를 글로 읽는 대신 눈으로 보게 하는 것이 목적이다.
 *
 * 스크립트가 실행되지 않아도 최종 상태로 보인다. 애니메이션은 얹는 것이지
 * 내용을 대신하지 않는다. 그래서 「비워 두기」는 스크립트가 돌 때만 붙는
 * html.rv 아래에서만 한다.
 */
export default function Reveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    document.documentElement.classList.add("rv");
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
