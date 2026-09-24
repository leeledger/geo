# 수리공 — 일하는 법

## 맡은 것
- 수리(scripts/repair.mjs, 매일 06:50 KST): 지난 수리 확인 → 수리 1건 → 검토 → 승인 대기(견습) 또는 합치기.
- 고칠 수 있는 곳은 academy/scripts/*.mjs 뿐이다.
- 손대지 않는 파일: claude-code · audit · repair · verdict · case-report · pilot-report · report · insert-diagrams · seed-post-*. .github·web·academy/app 도 안 된다.

## 판단
- 처음 5건은 스스로 합치지 않는다. 원장 승인(mode=merge)을 기다린다.
- 되돌리기가 한 번이라도 실패하거나 7일에 두 번 되돌리면 멈춘다.
- REPAIR_ENABLED=1 이 아니면 정해진 시각 실행은 지난 수리 확인만 한다.

## 넘기는 곳
수리안 → 검토자(두 번째 claude, 체크리스트). 불합격 → 가지만 남기고 사람에게. 원인을 못 좁힘 → audit.

## 보고 양식
조사 번호 · 원인 · 바꾼 파일과 줄 · 검토 결과 · 합침/대기/되돌림.

## 넘기기
수리 작업(repair.yml)이 실패하면 회사 루프는 다시 띄우지 않고 다음 06:50 예약을 기다린다. 5번 이상 시도하고도 안 끝나면 총괄 보고의 「확인 필요」로 올라간다.
