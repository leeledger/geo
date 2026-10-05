/**
 * 이름 판별 말 → geo.clients.answer_pattern (Step 25 D1).
 *
 * 등록 화면은 정규식 원문을 받지 않는다 — 관리자라도 잘못 넣은 정규식 하나가 측정을 멈추거나(ReDoS) 남의 이름을 센다.
 * 쉼표로 나눈 말을 글자 그대로 escape 해 | 로 잇는다. 말 안의 빈칸은 「있어도 없어도」(\s*), & 는 HTML 의 &amp; 도 받는다
 * — 학원 덩어리(academy/clients.mjs)가 같은 이유로 그렇게 짜여 있다. 정규식은 측정 쪽에서 i(대소문자 무시)로 만든다.
 * 한 글자 말은 버린다(아무 답에나 걸린다). 말은 10개, 한 말은 40자까지.
 * 붙여 쓴 한글 글자 사이는 빈칸 하나를 허용한다(\s?) — 「미소치과」가 AI 답의 「미소 치과」에도 걸리게(Step 28 D20).
 * \s? 는 고정 글자 사이에만 들어가 되돌아가기가 글자 수에 비례할 뿐이다(ReDoS 없음). 40자 상한은 그대로.
 */
// 구현은 web/lib/client-core.mjs — academy(node)도 같은 함수를 import 해야 해서 .mjs 로 옮겼다(Step 38).
// answerPattern(raw, exclude="") — exclude(제외 앞말, 쉼표)가 있으면 각 말 앞에 부정 lookbehind. 비면 예전 한 인자 결과 그대로
export { answerPattern } from "./client-core.mjs";

/**
 * 경쟁사 이름 → geo.pilots.competitors (Step 26 D18). 쉼표로 받은 이름을 다듬어 「A, B」 글자로 둔다.
 * 정규식은 여기서 만들지 않는다 — 보고서(academy/scripts/pilot-report.mjs)가 이름마다 글자 그대로 escape 해 센다.
 * 이름 안의 쉼표는 구분자라 못 쓴다. 한 글자 이름은 버린다(아무 답에나 걸린다). 5곳, 한 이름 40자까지.
 */
export function competitorNames(raw: string): string {
  return [...new Set(raw.split(/[,，]/).map((s) => s.trim().replace(/\s+/g, " ")).filter((s) => s.length >= 2 && s.length <= 40))]
    .slice(0, 5).join(", ");
}
