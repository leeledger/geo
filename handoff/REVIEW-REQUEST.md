# Review Request — Step 21 · AI 여러 곳에 매일 묻고 보고 · Brave 빈틈
Date: 2026-09-24
Ready for Review: YES

원장: 「학원 레퍼런스 해야 하고 AI 질문도 여러 곳에 지속적으로 하고 리포팅」 · 「인사이트를 얻어 스스로 퍼포먼스를 올려봐」.

## 찾은 것 (9/24 Claude 측정 원자료)
- 동네·이름 질문(q1~8·18~20) 11/11 이름+인용, 일반 질문(q9~17) 0/9 — 그중 5개는 딱 맞는 글이 이미 있다
- Brave 에 site:robotncoding.com 이 **홈 1쪽뿐**(tools/brave-index-check.mjs 로 브라우저 확인, curl 은 429). 9/22 홈 제출이 동네 질문 0→11 을 만든 것과 맞물린다
- Brave 제출은 캡차 — 우회 안 함. 원장 일감 579(「Brave 에 질문 글 10편 — 캡차만」, `node tools/brave-submit.mjs --faq`)
- 로그아웃 ChatGPT·Perplexity 는 우리를 **learns.academy(런즈)** 를 근거로 소개한다. Gemini 는 지도 카드로 답하고 링크가 없다

## 바꾼 것
- `tools/ai-web-measure.mjs`(새) — ChatGPT·Perplexity·Gemini 소비자 화면을 로그아웃 새 문맥으로 문항마다 연다. 승인 20문항(Claude 와 같은 것).
  언급은 ai-measure.mjs 와 같은 정규식, 인용은 답 영역 링크의 도메인. Perplexity 는 「링크」 탭까지 모은다. collection_method `*-web-logged-out`, model 'web'.
  연속 3번 실패(막힘·답 없음)면 그 엔진은 그날 멈춤. 캡차·로그인 우회 없음. 창은 화면 밖(-2400,0). 잠금 파일, 오늘 잰 문항은 건너뜀.
  `--install` → 작업 스케줄러 「Cited AI Measure」 매일 21:30, StartWhenAvailable. 이미 등록함(State Ready)
- `academy/scripts/pm-report.mjs` — `AI답변읽기(q)`: 방법마다 최근·그 전 측정일, 같은 문항끼리만 비교, 이름 수 차이 3 이하면 「비슷」. 5문항 미만(시험) 날·3일 넘게 없는 방법은 뺀다
- `web/lib/pm-report.ts`·`web/app/admin/ops/PmReport.tsx` — 아침 보고 카드에 엔진별 표(학원 이름 · 사이트 인용 · 지난번과) + 흔들림 한 줄
- `tools/brave-submit.mjs --faq` — 질문 글 10편 목록 · `tools/brave-index-check.mjs`(새, 읽기만)

## 확인
- `node ai-web-measure.mjs --limit 2`: 세 엔진 모두 답을 읽음. Perplexity 링크 1→14·10(링크 탭). 지금 전체 실행 도는 중(백그라운드 — 리뷰어는 돌리지 말 것)
- `pm-report --dry`: `AI Claude 2026-09-24 이름 11/20 · 인용 11/20 (2026-09-22 같은 20문항 4→11, 늘었음)`
- web tsc 통과, node --check 통과

## 봐 주셨으면
1. 로그아웃 소비자 화면 자동 질의가 약관·차단 면에서 위험한가 — 하루 60질의, 문항 사이 4~8초, 엔진당 연속 3실패면 멈춤
2. 인용 판정이 엔진마다 다르다(ChatGPT 는 답 영역 링크, Gemini 는 링크가 거의 없음) — 엔진끼리 인용 수를 비교하면 안 되는 이유를 화면에 써야 하나
3. dense_rank 가 문자열로 오던 버그를 Number() 로 고침 — 같은 모양이 다른 곳에 있나
