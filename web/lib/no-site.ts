/**
 * 주소가 하나도 없는 사장님 — ChatGPT 에 그대로 붙여 넣을 질문 세 개. 템플릿만, LLM 없음. 순수 함수.
 * 화면(질문 만들기)과 서버(접수 때 다시 만들기)가 같은 함수를 쓴다. 클라이언트가 보낸 질문은 믿지 않는다.
 */

export const NO_SITE_MAX = { name: 40, area: 20, industry: 20 } as const;

export const clean = (v: unknown, max: number) =>
  (typeof v === "string" ? v : "").trim().replace(/\s+/g, " ").slice(0, max).trim();

/** 1 검색어형 · 2 대화체 · 3 이름 확인(성과 숫자가 아니라 확인용) */
export function askQuestions(name: string, area: string, industry: string): [string, string, string] {
  const n = clean(name, NO_SITE_MAX.name);
  const a = clean(area, NO_SITE_MAX.area);
  const i = clean(industry, NO_SITE_MAX.industry);
  return [`${a} ${i} 추천`, `${a}에서 ${i} 찾는데 어디가 좋아?`, `${n} 어떤 곳이야?`];
}

/** 받침이 있으면 a, 없으면 b(은/는·이/가). 한글로 안 끝나면 b */
export function josa(word: string, a: string, b: string) {
  const c = word.charCodeAt(word.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return b;
  return (c - 0xac00) % 28 ? a : b;
}
