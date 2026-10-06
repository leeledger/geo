/**
 * 로그인 풀림 판정 — 주소 한 줄로 「로그인 화면·안내 페이지로 튀었나」를 본다(Step 39b).
 * open-session(창 열기)·bing-submit-urls(빙 제출)·gsc-access(서치콘솔 권한 탐침)가 같은 판정을 쓴다.
 * 한 곳에서만 고친다 — 셋이 따로 고치면 한쪽은 풀렸다 하고 한쪽은 됐다 한다.
 */

/** 구글 서치콘솔 — /about 은 로그아웃 상태의 안내 페이지다. 이걸 로그인으로 오해했었다 */
export const 구글나감 = (u) => /accounts\.google\.com|search-console\/about|\/welcome/.test(u);
/** 네이버 서치어드바이저 */
export const 네이버나감 = (u) => /nid\.naver\.com|\/login/.test(u);
/** 네이버 블로그 — 로그인 화면에서 시작해 블로그 홈으로 돌아오면 된 것이다 */
export const 블로그나감 = (u) => /nid\.naver\.com/.test(u);
/**
 * 빙 웹마스터 — 로그인이 풀리면 /login 이 아니라 /webmasters/about 안내 쪽으로 간다(2026-10-05 확인).
 * 10-03 부터 「버튼 못 찾음」으로만 실패했다. 마이크로소프트 계정 화면(login.live.com·login.microsoftonline)도 풀림이다
 */
export const 빙나감 = (u) => /login|signin|\/webmasters\/about/i.test(u) || /login\.live\.com|login\.microsoftonline/i.test(u);

/**
 * 네이버 NID_AUT 쿠키 — 만료일이 있어야(로그인 상태 유지) 창을 닫은 뒤에도 남는다.
 * 2026-10-05 문서딱 블로그 로그인은 두 번 「확인」으로 닫혔는데 다시 열면 NID_AUT 가 없었다
 *   → "유지" | "세션만" | "없음"
 */
export function 네이버쿠키(cookies) {
  const aut = (cookies ?? []).find((c) => c.name === "NID_AUT");
  if (!aut) return "없음";
  return aut.expires > 0 ? "유지" : "세션만";
}

/**
 * 창 하나의 로그인 판정 한 걸음(3초마다). 로그인 된 주소가 두 번 연속 + 그 탭을 연 지 10초가 지나야 ✓.
 * 리다이렉트 전 주소(로그인 화면으로 튀기 직전)로 헛 ✓ 를 막는다 — bing-submit-urls 가 9초 기다리는 이유와 같다
 *   prev    { streak }
 *   url     지금 주소
 *   now · openedAt   ms
 *   isOut   위 판정 하나
 *   extraOk 주소 말고 더 볼 것(네이버 쿠키 유지)
 */
export function 판정걸음(prev, { url, now, openedAt, isOut, extraOk = true }) {
  const 들어감 = Boolean(url) && !/^about:/.test(url) && !isOut(url) && extraOk;
  const streak = 들어감 ? (prev?.streak ?? 0) + 1 : 0;
  return { streak, ok: streak >= 2 && now - openedAt >= 10_000 };
}
