/**
 * 사이티드(cited.kr) 질문 패널 초안 20개 + 0원 리허설 파일럿 (Step 51 D170~D172). 넣는 것은 seed-panel.mjs --client cited.
 *
 * DB 고객이다 — clients.mjs 덩어리가 없고 /admin/clients 에 등록된 칸(geo.clients id 15)을 쓴다.
 * 질문은 지어내지 않았다. 재료는 셋뿐이다.
 *   keyword  네이버 자동완성 원문 12개(2026-10-16 실측, 원응답 handoff/research/step51/autocomplete.json)
 *            + 모자란 5개는 geo.clients 에 등록된 경쟁 검색어(guides.ts 겨냥) 앞에서부터
 *   brand    이름 질문 3개 — 학원·아이로그·문서딱 패널과 같은 꼴 · 등록 브랜드 검색어 「사이티드 GEO」
 * 대화체 질문은 넣지 않았다(D171). 「geo 최적화 영어로」는 용어 풀이 질문이라 뺐다(D174). 고른 것·버린 것·까닭은 handoff/REVIEW-REQUEST.md.
 *
 * 승인은 원장이 /admin/pilots 에서 한다. 여기서는 approved=false 로만 넣는다.
 */
export const SLUG = "cited";

/** [stage, 질문, 출처] — 출처는 검토용. DB 에는 안 넣는다 */
export const 패널 = [
  ["keyword", "geo 마케팅", "네이버 자동완성 · 씨앗 geo 마케팅 · 1위"],
  ["keyword", "AEO GEO 마케팅", "네이버 자동완성 · 씨앗 geo 마케팅 · 2위"],
  ["keyword", "geo 마케팅 대행사", "네이버 자동완성 · 씨앗 geo 마케팅 · 3위"],
  ["keyword", "geo 마케팅 뜻", "네이버 자동완성 · 씨앗 geo 마케팅 · 4위"],
  ["keyword", "geo 마케팅 회사", "네이버 자동완성 · 씨앗 geo 마케팅 · 5위"],
  ["keyword", "geo 마케팅 방법", "네이버 자동완성 · 씨앗 geo 마케팅 · 6위"],
  ["keyword", "geo 마케팅 비용", "네이버 자동완성 · 씨앗 geo 마케팅 · 7위"],
  ["keyword", "geo 최적화", "네이버 자동완성 · 씨앗 geo 최적화 · 1위"],
  ["keyword", "geo 최적화 뜻", "네이버 자동완성 · 씨앗 geo 최적화 · 2위"],
  ["keyword", "AEO마케팅", "네이버 자동완성 · 씨앗 aeo · 4위"],
  ["keyword", "ai 검색 최적화", "네이버 자동완성 · 씨앗 ai 검색 최적화 · 1위"],
  ["keyword", "생성형엔진최적화", "네이버 자동완성 · 씨앗 생성형 엔진 최적화 · 1위"],
  ["keyword", "GEO 대행사", "등록 경쟁 검색어(guides.ts 겨냥)"],
  ["keyword", "GEO 마케팅 업체", "등록 경쟁 검색어(guides.ts 겨냥)"],
  ["keyword", "AEO 대행사", "등록 경쟁 검색어(guides.ts 겨냥)"],
  ["keyword", "AI 검색 노출 대행", "등록 경쟁 검색어(guides.ts 겨냥)"],
  ["keyword", "챗GPT 회사 노출 방법", "등록 경쟁 검색어(guides.ts 겨냥)"],
  ["brand", "사이티드 어떤 회사야?", "이름 질문 — 학원·아이로그·문서딱 패널과 같은 꼴"],
  ["brand", "cited.kr 뭐 하는 곳이야?", "이름 질문 — 학원·아이로그·문서딱 패널과 같은 꼴"],
  ["brand", "사이티드 GEO", "등록 브랜드 검색어"],
];

/** AI 답에서 이름을 세는 말 — DB geo.clients.answer_pattern 과 같은 글자(seed-panel 패널점검이 대조) */
export const 이름말 = () => "사\\s?이\\s?티\\s?드|cited\\.kr";

export const 파일럿 = {
  price: 0, payment_ref: "자사 실증", contact_name: "원장",
  contact_email: null,
  contact_phone: "자사", receipt_type: "해당 없음", terms_evidence: "대표자 본인 운영", status: "리허설",
  // probe/prompts/geo-kr.json brand_universe 앞 5곳 이름 그대로. 보고서가 이름마다 글자 그대로 escape 해 센다
  competitors: "지오랭크, 서치폴라리스, 제스트컴퍼니, 넥스트티, 비즈스프링",
};
