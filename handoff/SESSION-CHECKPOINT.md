# Session Checkpoint — 2026-09-12
*Read this before reading anything else. If it covers current state, skip BUILD-LOG.*

---

## Where We Stopped (2026-09-12 갱신)

Step 1~7 배포 완료 (아이로그 0c1b6d4 · 017f1e7/bf3e03f · 4ca23e8 · 26de039 · 9dcbf24 · e7fa3db · dfe9bc0 · 1d18f79).
5 승인한 리포트만 토큰·응답 allowlist / 6 약관·결제 화면 실제 요금 / 7 기출 분석 Claude Vision·실패 환불·에이전트 모델 / 8 발송 잔액 예약·환원·단가 단일화(65be615).
네이버 소유확인은 캡차라 사람 일 — 단계 번호를 붙이지 않는다.
Bob·Richard 에이전트가 세션 한도(12:40 리셋)로 중단돼 Step 3 재작업·Step 4 이식은 Arch 가 마무리했다 — 한도가 풀리면 커밋 diff 로 재검토.
다음: Step 5(승인한 리포트만 토큰·응답 allowlist) → Step 6(약관·결제 화면) → Step 7(기출 분석 단종 모델·환불, 운영 장애라 우선) → Step 8(네이버 소유확인 캡차는 사람 일).

## 이전 기록

Bob 이 Step 3(아이로그 발송: 에이전트 문자 차감·수납 발송 응답·설정 단가 표시)을 짓는 중. 끝나면 Richard 리뷰 → 커밋 → 배포(`npx vercel --prod`, 다른 작업이 작업 트리에 있으면 worktree 로).
그다음 Step 4 = 아이로그 랜딩 개편 이식 — 브리프 초안 `handoff/NEXT-BRIEF-step4.md`, 시안 캔버스 https://claude.ai/code/artifact/bf23cf6e-4092-4259-92c6-666ec1d26885

---

## What Was Decided This Session

- 배포 게이트 상시 승인(원장). Richard 통과 + 운영 주소 확인이면 배포 후 보고
- 아이로그 공개 문구는 코드 사실만 — Step 1(0c1b6d4) 배포. 특허 문구 전부 삭제(원장 지시) — Step 1b(017f1e7, bf3e03f) 배포
- 공개 리포트는 토큰 또는 학생전용페이지 증명이 있어야 열림 — Step 2(4ca23e8) 배포, 운영 403/403/404 확인
- 운영판 고리 애니메이션은 prefers-reduced-motion 을 무시한다 — 원장 PC Windows 「애니메이션 효과」 꺼짐 때문에 멈춰 보였음 (d062c20, 운영에서 reduce 조건으로 점 이동 확인)
- 빙 웹마스터: 두 사이트 모두 등록돼 있음. robotncoding.com 은 9/5 제출·9/10 크롤 성공, ilog.ai.kr 사이트맵은 9/12 제출
- 동시에 두 작업이 아이로그 작업 트리에 있을 때 배포는 커밋 기준 worktree 에서 한다 (미리뷰 코드가 딸려 나가지 않게)

---

## Arch 결정 (원장 위임 2026-09-12 — 「추천안대로 상식적인 판단」)

- KG-1 → **약관을 실제 요금 구조로 고친다**(기본 관리 무료 · 발송비 건당 · AI 크레딧/무제한 패스). 「평생 무료」는 증명할 수 없는 영구 약속이라 공개 문구에서 뺀다(랜딩 개편 Step 4 에서 사라짐). 약관 개정은 이용자에게 유리한 변경이라 기존 약관의 공지 조항대로 공지하고 시행일을 적는다 — Step 6
- 무제한 패스에서 예상 문제 출제 제외 → **의도로 본다**(`lib/ai/billing.ts:8-9` 주석이 비용 높은 기능이라 명시). 공개 문구는 그대로, 결제 화면에도 같은 말이 보이게 — Step 6
- KG-12 → **승인한 리포트만 토큰을 발급**한다. 화면(`dashboard/reports/[id]/page.tsx:167`)이 이미 막는 규칙을 API 에도 — Step 5 (KG-11 응답 allowlist 와 함께)
- KG-3 에이전트 챗 단종 모델 → 다른 AI 호출과 같은 모델로 교체 — Step 7
- 아이로그 네이버 서치어드바이저 → 사이티드가 등록·소유확인·사이트맵 제출 — Step 8
  - 9.12 진행: 소유확인 메타태그 운영 배포 완료(아이로그 커밋 dd26f2d, 운영 HTML 확인). 「소유확인」 누르면 **자동입력 방지 문자(캡차)** 가 떠서 멈춤 — 캡차는 우회하지 않는다
  - **사람 일(10초)**: 브라우저에서 https://searchadvisor.naver.com/console/verify?site=https%3A%2F%2Filog.ai.kr → 「HTML 태그」 선택 → 소유확인 → 캡차 입력. 끝나면 사이트맵 제출은 사이티드가 이어서 한다

## 순서

Step 3(발송, main 작업 트리, Bob) ∥ Step 4(랜딩, `C:\dev\ilog-step4` 작업 트리, Bob) → 각각 Richard → 배포 → Step 5 → 6 → 7 → 8

---

## Resume Prompt

---

You are Arch on 사이티드(Cited) · AGO&GEO.
Read handoff/SESSION-CHECKPOINT.md, then ARCHITECT.md.
Confirm where we stopped and what the next action is. Then wait.

---

## Version Check
version_notified: v1.3.0
