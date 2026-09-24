# Review Feedback — Step 19 (2차)
Date: 2026-09-24
Ready for Builder: YES

## Must Fix
- 없음.

1차 Must 두 건 확인:
- Must 1 — illustrate·sales·audit·repair 의 system 문자열과 tools·allow·deny·envDrop·maxTurns·permission 옵션이 HEAD 와 같다. git diff 에 그 줄들의 -/+ 가 없다. 프로필은 표준입력 프롬프트 맨 앞에 붙는다: illustrate 448, sales 224, audit 진단 배열 첫 줄, repair 검토 316·수리 493.
- Must 2 — `검사()` 1-4 가 근거 글에서 `https?://\S+` 를 지운 뒤 맞춘다(slop-rules.mjs:273). write-news 는 출처 제목만 넘긴다. 1차 시험 스크립트를 다시 돌렸다: 주소뿐인 근거에 「학생 34명, 90분」 → 걸림 2(34명, 90). 기존 걸림도 그대로다(「수업은 90분」).

## Should Fix
- 없음. 1차 Should 는 모두 반영됐다.
  - 게이트근거: write-draft 452·533, write-news 268·322 에서 저장한다. slop-check --strict 는 70 에서 이것부터 읽는다.
  - pm-report: 「N번 시도했고 아직 안 끝났습니다」「5번 이상 시도하고도」로 고쳤다. 「원장 확인 필요로 올림」은 셈에서 뺐다(104).
  - agents: 날짜 박힌 수치와 「5번 넘게」가 모두 빠졌다. content AGENTS 는 근거표를 누가 만드는지와 78 건너뛰기를 바로잡았다.

## Escalate to Architect
- 없음.

## Cleared
2차 수정분을 확인했다. node --check 10개 통과, 숫자 게이트는 다시 돌려서 봤다. 1차에서 통과시킨 항목(KST, 하루 한 번, 에스컬레이션, 고객사 가림, 웹 XSS)은 그대로다. Step 19 통과.
