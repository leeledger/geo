# Review Feedback — Step 40 재검수 (1ce1e32)
Date: 2026-10-10
Ready for Builder: YES

## Must Fix
없음.
- 지난번 Must Fix(Growth.tsx 주별 요약 표가 0 을 찍던 것)는 고쳐졌다. 표 칸은 이제 growth-core.mjs `주별칸` 이 tracked 를 먼저 보고 정한다. tracked false 면 글은 「안 셈」, 로봇 방문·답변 색인은 「안 잼」이다. Growth.tsx:358-365 가 이 함수를 쓰고, test-todo-words 에 문서딱 꼴 시험이 들어갔다.

## Should Fix
- web/lib/agents.ts:193 (confidence: 4, 참고) — `(?<![가-힣])감사(?![가-힣]*니다)` 는 「감사가 …」 같은 조사 붙은 꼴을 「자동 점검가」로 만든다. 지금 운영 문구에는 따로 선 「감사」만 있어서 당장 생기는 일은 아니다. 고치지 말고 KG-40-6 옆에 적어만 둔다.

## Escalate to Architect
없음. 손댄 날 결정은 BUILD-LOG:1588 에 기록됐다. 손댄 날은 실제 작업(글 발행·바깥 글 올림·가이드 글 반영)만 센다. 기계가 저절로 하는 일(색인·빙 제출·네이버 옮김·측정)은 뺀다. 코드도 그대로다. client-status.ts:33-39 가 셋만 읽고 client-status-core.mjs:63 이 그중 가장 늦은 날을 고른다. 지난번 올린 걱정(색인만 돌아도 「돌고 있음」)은 이것으로 풀렸다. 「색인만 돌고 한 달 글 없음 → 멈춤」 시험도 들어갔다.

## Cleared
1ce1e32 의 다섯 곳을 봤다.
- 주별 표의 안 셈/안 잼
- plain() 의 감사·조사 경계: 「감사합니다」「제조사」는 그대로 둔다
- scout 판정 실패를 stderr 로 남김
- 손댄 날을 실제 작업 셋으로 좁힘: 옛 lastTouch 참조가 남은 곳은 없다
- 시험 갱신
시험을 다시 돌려 모두 통과했다: client-status 14 · ops-words 531 · todo-words 14 · serp-judge 13. web tsc 는 exit 0 이다. ops-words 가 533 에서 531 로 2건 줄었다. 그 시험 파일 diff 는 입력만 lastTouch 에서 touched 로 바꿨고 단언은 지우지 않았다. 2건이 준 정확한 원인은 확인하지 않았다. Step 40 은 통과다.
