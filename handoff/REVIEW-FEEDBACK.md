# Review Feedback — Step 21 (2차)
Date: 2026-09-24
Ready for Builder: YES

## Must Fix
없음. 1차 Must(질문이 답에 섞여 브랜드 문항이 저절로 「언급」) 해결 확인.
- tools/ai-web-measure.mjs:80-88 `답만` — 질문 마지막 위치 뒤만 남기고 남은 질문 문자열도 지운다. 이름 판정(206-208)과 막힘 판정이 모두 이 글로 본다.
- DB 확인(2026-09-24 `*-web-logged-out` 17줄): raw.answer 에 prompt_text 가 들어 있는 줄 0. Perplexity 는 「조사 완료…」 부터, ChatGPT 는 「ChatGPT의 말:」 부터 시작한다.
- 언급 true 인 줄(ChatGPT q2·q6·q7, Gemini q2, Perplexity q2)의 질문에는 학원 이름이 없다. 답 속 문맥도 봤다 — 진짜 언급이다.
- q18~20 은 아직 안 쟀다. 그래서 브랜드 문항 결과는 아직 눈으로 못 봤다. 아래 Should 첫 줄로 확인한다.

## Should Fix
- 실행이 끝나면 한 번 확인 — `select prompt_id, mentioned, position(prompt_text in raw->>'answer')>0 from academy.ai_measurements where measured_on='2026-09-24' and collection_method like '%-web-logged-out' and prompt_id in ('q18','q19','q20')`. 셋째 칸이 전부 false 여야 한다. 화면이 질문을 다르게 그려(공백·기호) 정확히 맞추기가 실패하면 여기서 드러난다. 결과는 BUILD-LOG 에 한 줄.
- academy/scripts/pm-report.mjs (비교 하위 쿼리, `prompt_id = any($3)`) — 바깥 쿼리에는 `engine`·`attempt = 1` 을 붙였는데 비교 쿼리에는 없다. 지금 DB 에서는 숫자가 같다. 그래도 두 쿼리를 같은 조건으로 맞춘다.
- pm-report.mjs `전체: 지금.n >= 18` — 문항 수가 20이라고 가정한 상수다. 승인 문항 수와 비교하거나 전 측정의 n 과 비교하는 게 낫다. 문항이 바뀌기 전까지는 맞다.
- `academy/scripts/_q.tmp.mjs` 가 아직 있다(untracked). 커밋 전에 지운다.
- KG-S21-1(스케줄러 콘솔 창)은 Known Gap 으로 적힌 것 확인. 괜찮다.

## Escalate to Architect
없음. ToS 는 Arch 가 (b) 로 정했고 BUILD-LOG:1083 에 적혀 있다. ai-web-measure.mjs:186-188 에서 깃발이 빠진 것도 확인했다.

## Cleared
2차에서 다시 본 것(모두 통과):
- `답만` 이 질문과 Perplexity 후속 질문 영역을 잘라 낸다. 오늘 17줄이 다시 계산됐다.
- 링크는 URL 객체로 다룬다. utm_source 를 지우고 google.com/url?q= 는 풀어서 본다.
- 엔진이 멈춘 날은 활동이 ok=false 로 남는다. 자정을 넘기는 실행은 주석으로 적었다.
- pm-report 바깥 join 이 engine·attempt=1 까지 맞춘다. 신선도는 now 인자로 본다. 2문항 이상이면 보이고 모자라면 「일부」로 표시된다.
- 카드 주석은 20을 박아 두지 않았고, 엔진끼리 인용을 비교하지 않는 이유를 적었다. Gemini 인용 칸은 「—」 다.
- lock 파일이 gitignore 에 들어갔다. web tsc 와 node --check 통과. dangerouslySetInnerHTML 없음.
