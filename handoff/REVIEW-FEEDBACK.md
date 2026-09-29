# Review Feedback — Step 25
Date: 2026-09-30
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- web/lib/pilot-actions.ts:37 (confidence: 6/10) — `on conflict(slug) do update set ... answer_pattern=excluded.answer_pattern`. 등록 화면에 slug `robotncoding` 을 넣으면 학원 이름 판별 원문이 escape 한 말로 덮인다. 그러면 「똑똑한 로봇&코딩학원」 제외가 사라지고 학원 영업 숫자 계산이 바뀐다. name·domain 을 덮는 것은 전부터 있던 위험이다. 이번 단계에서 판별 원문까지 덮이게 됐다 — slug 가 `robotncoding`(HOUSE)이거나 relation<>'외부' 인 기존 행이면 등록을 거절하라. 5분 안이면 바로, 아니면 KG.
- tools/ai-web-measure.mjs:299 (confidence: 5/10, 확인 필요) — `if (상한걸림) 모자람 += todo.length - 시도;` 는 `나눔` 과 상관없이 돈다. 학원만 도는 날에도 같은 날 `--client ilog` 를 손으로 먼저 돌려 합계 60 에 닿으면, 학원에 「앞 순서 고객이 먼저 써서」 일감이 올라간다. 옛 실행기는 요약 줄만 남겼다. 드문 경우다. 문구를 「하루 상한에 닿아」로 바꾸거나 `나눔` 일 때만 올려라.
- 배포 순서 (confidence: 7/10, 판단은 Arch) — 대상 select(`academy/measure-targets.mjs` 고객행)는 두 칸이 없으면 실패하고, 학원 측정까지 전부 멈춘다. 다만 실행기들은 이미 `create table if not exists` 같은 DDL 을 잡지 않고 돌리고 있다(ai-measure 의 academy.ai_measurements 등). 같은 권한이니 ALTER 가 실패할 가능성은 낮다. 막는 항목은 아니다. 안전하게 가려면 배포 전에 schema.sql 88-90 두 줄을 한 번 적용하라. idempotent 다. 적용하면 첫 실행이 권한 문제로 멈출 여지도 없어진다.
- web/app/admin/ops/AgentStrip.tsx:159 (confidence: 4/10) — 「토큰 입력」에 캐시 읽기·쓰기가 들어가는데 화면에는 그 설명이 없다. 원장이 사용량 화면 숫자와 맞춰 보다 헷갈릴 수 있다. 「입력(캐시 포함)」 정도로 붙여라. 선택.

## Escalate to Architect
- 파일럿을 등록한 뒤 질문을 승인하기 전까지는 ai-measure 가 매일 종료코드 1 을 낸다(「승인된 질문이 없습니다」 → 설정실패). optimize.yml 은 continue-on-error 라 개선 루프는 돈다. 그래도 「측정 실패 표시」 빨간불이 그 기간 내내 켜진다. 일감은 화면 측정 쪽(PC)만 올린다(KG-25-6). 승인 대기를 고장으로 볼지 대기로 볼지는 운영 판단이다.

## Cleared
확인한 범위:
- df3e2d0 전체 diff(-w)를 읽었다.
- 학원만 있을 때: 운영 DB 를 읽기 전용으로 조회했다. geo.clients 는 학원(가격 0 · 리허설 파일럿)과 아이로그(파일럿 없음) 둘뿐이다. 그래서 대상 목록은 학원 하나고, 나눔은 꺼진다. 하네스를 변경 전 커밋(df3e2d0~1) 기준으로 다시 돌렸다. claude · claude 19회 소진 · web 세 경우 모두 질문 순서·적재 행·종료코드가 같았다. 원래 run.mjs 는 `HEAD:` 를 읽는다. 커밋한 뒤에는 옛 사본이 새 clients.mjs 를 가리켜 「아니오」가 나온다. 코드 결함이 아니라 하네스 기준점 문제다.
- 탐침: 몫·35분 가드·위치(학원 바로 뒤)가 전과 같다.
- 이름 판별: 학원 판별은 DB 원문이 비었을 때만 채운다. 채우는 값은 지금 정규식 source 그대로이고, 도메인은 덩어리가 먼저다.
- 등록 escape: 메타문자 전부를 escape 한다. 남은 것은 `\s*` 와 리터럴 대안뿐이라 중첩 수량자가 없다. ReDoS 없음. createPilot 은 guard() 뒤에서만 돈다.
- 예산: 몫이 모자라면 통째로 건너뛰고 sticky 일감을 올린다. 일감 키는 실행기별로 따로다. 다 잰 날만 근거를 남기고 닫는다. 유료 고객이 있는 날은 탐침을 끈다.
- 날짜: 오늘은 KST, 호출 집계도 Asia/Seoul 이다.
- 50분 제한: 기본 몫(22)에서는 Claude 호출 총수가 전과 같다. 몫을 올리는 경우는 KG-25-5 에 적혀 있다.
- D17: 숫자가 아닌 칸은 null 이다. 현황판은 기록된 행만 더하고, 0건이면 줄을 숨긴다. 칸 추가·새 모양 insert 가 실패해도 호출 수 기록은 유지된다.
- D4: coalesce(…,1) 을 없앴다.
- 실행: web `tsc --noEmit` 종료 0. unit 18개(`--experimental-strip-types` 필요), tokens 4개 통과.
