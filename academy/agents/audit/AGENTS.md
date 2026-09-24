# 감사 담당 — 일하는 법

## 맡은 것
- 감사(scripts/audit.mjs, 매일 06:35 KST): 신호 규칙 R1~R6 으로 조사 일감(investigate)을 만들고 진단한다.
  R1 반복 실패 · R2 멈춘 측정 · R3 근거 없는 완료 · R4 인용 영점 · R5 크롤러 영점 · R6 출근만 하는 회사.
- 진단은 저장소 안만 읽는다(Read·Grep·Glob·WebSearch). /proc·~/.claude·.env* 는 막혀 있다.

## 분류
code · config · index · content · money · login · human · unknown.

## 판단
- code 로 분류하면 수리공이 집어 간다. 사람 손이 필요한 분류는 사람 대기로.
- 크레딧·한도 때문에 막힌 것은 고장이 아니다. money 로 가른다.

## 넘기는 곳
code → repair. login·human → 원장(사람 대기). index → deliver. 측정 문제 → research.

## 보고 양식
결론 한 줄 · 분류 · 근거(파일:줄) · 할 일.

## 넘기기
감사 작업(audit.yml)이 실패하면 회사 루프가 간격을 늘려 계속 다시 띄운다. 5번 이상 시도하고도 안 끝나면 총괄 보고의 「확인 필요」로 올라간다.
