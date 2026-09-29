/**
 * 이름 판별 말 → geo.clients.answer_pattern (Step 25 D1).
 *
 * 등록 화면은 정규식 원문을 받지 않는다 — 관리자라도 잘못 넣은 정규식 하나가 측정을 멈추거나(ReDoS) 남의 이름을 센다.
 * 쉼표로 나눈 말을 글자 그대로 escape 해 | 로 잇는다. 말 안의 빈칸은 「있어도 없어도」(\s*), & 는 HTML 의 &amp; 도 받는다
 * — 학원 덩어리(academy/clients.mjs)가 같은 이유로 그렇게 짜여 있다. 정규식은 측정 쪽에서 i(대소문자 무시)로 만든다.
 * 한 글자 말은 버린다(아무 답에나 걸린다). 말은 10개, 한 말은 40자까지.
 */
export function answerPattern(raw: string): string | null {
  const terms = [...new Set(raw.split(/[,，]/).map((s) => s.trim().replace(/\s+/g, " ")).filter((s) => s.length >= 2 && s.length <= 40))].slice(0, 10);
  if (!terms.length) return null;
  const one = (t: string) => t.split(" ")
    .map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/&/g, "(?:&|&amp;)"))
    .join("\\s*");
  return terms.map(one).join("|");
}
