/**
 * 아이로그 질문 패널 초안 20개 + 0원 리허설 파일럿 (Step 30 D34). 넣는 것은 seed-panel.mjs --client ilog (Step 32 D44 에서 일반형으로 뺐다).
 *
 * 9/10 에 고객사로 받았는데 geo.pilots·pilot_questions 가 없어 AI 측정이 0건이었다(학원 381건).
 * 측정기(ai-measure·ai-web-measure)와 개선 루프(daily-agent)는 승인 질문이 있는 고객만 잰다.
 *
 * 질문은 지어내지 않았다. 재료는 셋뿐이다.
 *   consider  회사 루프 who-wins 가 만든 「겨냥 초안」 일감 7건의 질문 원문 (geo.agent_tasks kind=question-draft, client 2 — 2026-09-30 DB 에서 읽음)
 *   problem   아이로그 가이드(C:\dev\자동피드백생성기 lib/guides.ts) 주제 — 가이드 제목 그대로가 아니라 채팅창 말투로 고침(Arch 2026-09-30).
 *             영어 내신 출제는 주제 밖이라 빼고 요금 질문으로 바꿈(요금 답은 guides.ts·marketing-facts.ts 에 있다)
 *   keyword   검색어형(Step 22 틀처럼 사람이 치는 말) — clients.mjs 아이로그 검색어와 guides.ts 의 query 칸
 *   brand     이름 질문 3개 — 학원 패널의 이름 질문 꼴(「어떤 곳이야?」「이 사이트 무슨 …」)과 guides.ts FAQ 원문
 * 기능은 guides.ts·marketing-facts.ts 에 적힌 것(출결 키패드·알림톡·문자·수업 리포트·영어 예상 문제)만 질문에 들어간다.
 *
 * 승인은 원장이 /admin/pilots 에서 한다. 여기서는 approved=false 로만 넣는다. 이미 있는 칸은 덮어쓰지 않는다.
 */
import { 코드덩어리 } from "../clients.mjs";

export const SLUG = "ilog";

/** [stage, 질문, 출처] — 출처는 검토용. DB 에는 안 넣는다 */
export const 패널 = [
  ["consider", "학원 관리 프로그램 뭐가 좋은가요?", "겨냥 초안 일감 #28"],
  ["consider", "학원 관리 프로그램 추천 순위나 후기 알려줘", "겨냥 초안 일감 #29"],
  ["consider", "무료로 쓸 수 있는 학원 관리 프로그램 있나요?", "겨냥 초안 일감 #30"],
  ["consider", "학원에서 카톡 알림 보내는 프로그램 뭐 써요?", "겨냥 초안 일감 #32"],
  ["consider", "학원 수업 리포트 보내는 앱 어떤 게 좋아요?", "겨냥 초안 일감 #33"],
  ["consider", "학원관리프로그램 추천 좀 해주세요", "겨냥 초안 일감 #417"],
  ["consider", "학원 출결 관리 앱 뭐가 있어요?", "겨냥 초안 일감 #757"],
  ["problem", "학원 관리 프로그램 고를 때 뭘 봐야 해?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — how-to-choose-academy-management-program"],
  ["problem", "무료 학원 관리 프로그램은 어디까지 공짜야?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — free-academy-management-program"],
  ["problem", "학원 출결을 학부모한테 카톡으로 자동으로 보내려면 어떻게 해?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — academy-attendance-kakao-notification"],
  ["problem", "학원 수업 리포트를 AI가 써 주는 프로그램 있어?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — ai-class-report"],
  ["problem", "학원 관리 프로그램 한 달에 보통 얼마야?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — 요금(영어 내신 출제는 주제 밖이라 뺌)"],
  ["keyword", "학원 관리 프로그램 추천", "guides.ts query · 설계서 예시"],
  ["keyword", "무료 학원 관리 프로그램", "guides.ts query · clients.mjs c3"],
  ["keyword", "학원 출결 관리 앱", "clients.mjs c4"],
  ["keyword", "학원 카톡 알림 프로그램", "clients.mjs c5"],
  ["keyword", "학원 수업 리포트 앱", "guides.ts query · clients.mjs c6"],
  ["brand", "아이로그 학원 관리 프로그램 어떤 거야?", "이름 질문 — 학원 패널 「어떤 곳이야?」 꼴"],
  ["brand", "ilog.ai.kr 이 사이트 뭐 하는 곳이야?", "이름 질문 — 학원 패널 「robotncoding.com 이 사이트 무슨 학원이야?」 꼴"],
  ["brand", "아이로그는 정말 무료인가요?", "guides.ts how-to-choose FAQ 원문"],
];

/** AI 답에서 이름을 세는 말 — clients.mjs 가 원문이다(한 곳) */
export const 이름말 = () => 코드덩어리(SLUG).answerRe.source;

export const 파일럿 = {
  price: 0, payment_ref: "자사 실증", contact_name: "원장",
  // guides.ts FAQ 에 적힌 아이로그 문의 주소
  contact_email: "ilog.ai@kakao.com",
  contact_phone: "자사", receipt_type: "해당 없음", terms_evidence: "대표자 본인 운영", status: "리허설",
};
