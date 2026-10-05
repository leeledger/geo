/**
 * 문서딱 질문 패널 초안 20개 + 0원 리허설 파일럿 (Step 32 D44). 넣는 것은 seed-panel.mjs --client docttak.
 *
 * 질문은 지어내지 않았다. 재료는 둘뿐이다.
 *   keyword  브리프(research/docttak-brief-2026-10-01.md) 「측정 요청」의 자동완성 검색어 17개 원문 그대로.
 *            브리프에 적힌 검색어가 17개라 전부 쓴다(도구별: 합치기 5 · PDF 용량 2 · 사진 용량 3 · 사진 규격 4 · HWP 3)
 *   brand    이름 질문 3개 — 설계서(Step 32 D44)가 정한 꼴. 학원·아이로그 패널의 이름 질문과 같은 꼴이다
 * 브리프 사실: 도구 5개 · 무료·가입 없음 · 파일이 기기 밖으로 안 나감. 이 밖의 기능은 질문에 넣지 않았다.
 *
 * 승인은 원장이 /admin/pilots 에서 한다. 여기서는 approved=false 로만 넣는다.
 */
import { 코드덩어리 } from "../clients.mjs";

export const SLUG = "docttak";

/** [stage, 질문, 출처] — 출처는 검토용. DB 에는 안 넣는다 */
export const 패널 = [
  ["keyword", "pdf 합치기 무료", "브리프 자동완성 · PDF 합치기"],
  ["keyword", "아이폰 pdf 합치기", "브리프 자동완성 · PDF 합치기"],
  ["keyword", "pdf 합치기 방법", "브리프 자동완성 · PDF 합치기"],
  ["keyword", "안전한 pdf 합치기", "브리프 자동완성 · PDF 합치기"],
  ["keyword", "파일 안 올리는 pdf 합치기", "브리프 자동완성 · PDF 합치기"],
  ["keyword", "pdf 용량 줄이기", "브리프 자동완성 · PDF 용량 줄이기"],
  ["keyword", "정부24 pdf 용량", "브리프 자동완성 · PDF 용량 줄이기"],
  ["keyword", "사진 용량 줄이기", "브리프 자동완성 · 사진 용량 줄이기"],
  ["keyword", "사진 kb 줄이기", "브리프 자동완성 · 사진 용량 줄이기"],
  ["keyword", "증명사진 용량 줄이기", "브리프 자동완성 · 사진 용량 줄이기"],
  ["keyword", "여권사진 규격", "브리프 자동완성 · 여권·증명사진 규격"],
  ["keyword", "증명사진 사이즈", "브리프 자동완성 · 여권·증명사진 규격"],
  ["keyword", "공무원 시험 사진 규격", "브리프 자동완성 · 여권·증명사진 규격"],
  ["keyword", "큐넷 사진 규격", "브리프 자동완성 · 여권·증명사진 규격"],
  ["keyword", "한글파일 pdf로 변환", "브리프 자동완성 · HWP PDF 변환"],
  ["keyword", "hwp pdf 변환", "브리프 자동완성 · HWP PDF 변환"],
  ["keyword", "hwpx 열기", "브리프 자동완성 · HWP PDF 변환"],
  ["brand", "문서딱 어떤 사이트야?", "이름 질문 — 설계서 D44 꼴"],
  ["brand", "docttak.com 이 사이트 뭐 하는 곳이야?", "이름 질문 — 설계서 D44 꼴"],
  ["brand", "문서딱 파일 안 올리고 처리돼?", "이름 질문 — 설계서 D44 꼴 · 브리프 「파일은 기기 밖으로 나가지 않는다」"],
];

/** AI 답에서 이름을 세는 말 — clients.mjs 가 원문이다(한 곳) */
export const 이름말 = () => 코드덩어리(SLUG).answerRe.source;

/** 고객사 칸이 아직 없다 — seed-panel 이 clients.mjs 의 id·이름·도메인으로 새로 넣는다 */
export const 새고객 = { relation: "자사", note: "자사 실증 — 두 번째 레퍼런스(무료 웹 도구)" };

export const 파일럿 = {
  price: 0, payment_ref: "자사 실증", contact_name: "원장",
  // 공개 사이트·브리프에 문의 주소가 없다(2026-10-01 홈·llms.txt 확인). 지어내지 않고 비운다
  contact_email: null,
  contact_phone: "자사", receipt_type: "해당 없음", terms_evidence: "대표자 본인 운영", status: "리허설",
  // 브리프 「측정 요청」에 적힌 경쟁 도구. 보고서가 이름마다 글자 그대로 escape 해 센다(pilot-report-core 경쟁사목록)
  competitors: "iLovePDF, Smallpdf, 알PDF, allinpdf, 한컴독스",
};
