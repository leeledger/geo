# Review Feedback — Step 45
Date: 2026-10-13
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- 없음. Bob 의 Open Questions 답:
  - 잠기지 않은 UI 글자(표 머리 「단계·대상·AI를 다루는 자리」, 수강료 표 머리, 「관련 글 →」, 「자주 묻는 것」, lab 영문) — 키워드·숫자·사실 주장 없음. 통과.
  - ai.json 의 postsH2·schemaDescription — 둘 다 브리프 잠긴 글. 횟수 셈에 들어가도 키워드 0. 통과.
  - 수강료 3행 「중학생 이상(성인 포함)」 — home.html:1026 과 같은 사실, 표기만 다름. 통과.

## Escalate to Architect
- ai.json course.paras[1] 「주차별 목차는 상담 때 안내합니다.」 (confidence 5) — 브리프 139행 잠긴 글이라 Bob 잘못 아님. 다만 사이트·llms 어디에도 근거가 없는 「약속」이고, KG-45-1 은 그 목차가 아직 원장에게서 안 왔다고 적었다. 상담에서 실제로 줄 수 있는지 원장 확인이 필요하다. 못 준다면 문장을 빼거나 「안 정했다」로 바꾼다. 코드로 정할 일이 아니다.

## Cleared
사실 대조: /ai 의 숫자·사실 문장 전부를 home.html·llms.txt 에서 찾았다 — 단계별 학년(h:123·174·226, llms:151-168), 24주·초5~중3(h:758, llms:225·276), 수강료 3행(h:1024-1026), 제7629호, 02-422-0525, 274-8 2층, 카카오 주소, Pima·서울대 의예과(h:863), 진로 분석 서비스(h:497), 만 13세(h:901), 개발자 출신 원장(llms:39), AI 참고 도구·증명(llms:168), 감독 4가지 문장(그럴듯하게 틀림·저작권·이상한 입력·시킨 대로), 골격·정답 코드. 지어낸 숫자 0.
키워드 횟수(D106): test-ai-page 30 PASS 다시 돌려 확인. page.tsx 하드코딩 글자(스키마 teaches·name, UI 머리, alt/aria 없음)에 「초등 AI 교육」「AI 교육」「AI학원」 추가 없음.
D108: case-report at_start 와 brief-core firsts 둘 다 (엔진·검색어) 단위 min 으로 바뀌었고 SQL 이 맞다. 기존 검색어는 엔진 첫날부터 같이 쟀으므로 결과 불변 — Bob 의 운영 DB 전·후 비교(20→20, 18→18, 차이 0)와 논리가 일치.
ops.ts rivalTally(오케스트레이터 추가): kind 값은 색인·경쟁·브랜드·AI교육 4종뿐(clients.mjs, DB 고객 생성기 :374-376 도 셋만). 새 continue 는 AI교육만 걸러 랜딩 「/6」 분모를 지킨다. kind 없는 옛 줄은 기존 isBrandQuery 경로 그대로. 통과.
& 이스케이프: SVG 없음. home.html 추가 줄에 & 없음. JSON-LD 의 「로봇&코딩학원」은 JSON 문자열이라 문제 없음. 렌더 title 은 &amp; 로 나옴.
seed-probes-step45: 매개변수 쿼리, trim 대조로 멱등, ai_probe_questions 로만 감(승인 20문항 오염 없음). 7번 몫으로 아직 안 돌린 것 맞음.
글 규칙: 질문형 h1·h2, 서론 없음, 빈 강조·흐린 끝맺음 없음, 「하지 않는 것」 절과 「초등학생에게 같은 결과를 약속하지 않습니다」로 하지 말 것을 말함, 「우리 학원으로 오세요」로 닫지 않음.
