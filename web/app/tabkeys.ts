import type { KeyboardEvent } from "react";

/**
 * 탭 목록 키보드 이동 — 화살표·Home·End.
 * 랜딩에 탭이 세 벌(엔진·기록·진행) 있어서 한 곳에 둔다.
 */
export function tabKeys(
  e: KeyboardEvent,
  i: number,
  n: number,
  pick: (j: number) => void,
  id: (j: number) => string,
) {
  let j = -1;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % n;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + n) % n;
  else if (e.key === "Home") j = 0;
  else if (e.key === "End") j = n - 1;
  if (j < 0) return;
  e.preventDefault();
  pick(j);
  document.getElementById(id(j))?.focus();
}
