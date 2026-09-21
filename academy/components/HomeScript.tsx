"use client";

import { useEffect } from "react";

/**
 * 홈 HTML 끝의 인라인 스크립트를 클라이언트 이동 때도 돌린다.
 *
 * 새로고침하면 브라우저가 SSR HTML 속 <script> 를 실행한다.
 * 그런데 블로그에서 네비를 눌러 홈으로 오면 React 가 innerHTML 로 끼워 넣고,
 * 그렇게 들어간 <script> 는 실행되지 않는다. .rise 가 opacity:0 에 멈춰 본문이 안 보였다.
 * 두 번 도는 건 스크립트 첫 줄의 가드(#nav[data-live])가 막는다.
 */
export default function HomeScript({ code }: { code: string }) {
  useEffect(() => {
    if (!code) return;
    new Function(code)();
  }, [code]);
  return null;
}
