# Review Feedback — Step 54 (계약 뒤 순서) · Round 2
Date: 2026-10-17
Ready for Builder: YES

## Must Fix
- 없음. Round 1 의 기록표 주소 건 해결: onboard-core.mjs:18 기본 "https://cited.kr", :64 `입력.site ?? SITE`, :274 `${기록표앞}/record/...`, onboard.ts:40 `site: SITE_URL`. 새 시험이 https://cited.kr/record/ 를 단언한다.

## Should Fix
- web/lib/onboard-core.mjs:56 (confidence: 9/10) — 입력 설명 주석이 아직 `admin?` 이다. `site?` 로 바꾼다(1분).

## Escalate to Architect
- 없음. 30일 = 연 날 ~ 연 날+29 는 academy/pilot-plan.mjs:45-46 파일럿일정(`끝 = 더하기(시작, 29)`, 첫날 포함 30일)과 같다 — Arch 메시지의 「+30」보다 이쪽이 맞다.

## Cleared
Round 2 diff: 기록표 주소 cited.kr(SITE_URL 주입), 구축·세팅 30일을 site_launch_on 으로 직접 계산(:303-307, period·day30·다음 고비가 같은 기간끝 사용 — company.mjs 재계산 지연 문제 해소), 확인파일보냄 줄의 일수·재촉 글 제거(:172-173, D220), d.mts admin→site. test-onboard-core 18/0 · test-client-core 188/0 · test-clients 99/0 · tsc 0 오류. Round 1 의 Cleared 항목(관리자 guard·jsonb_set·못 읽음/기록 없음·순서·가림·한국어)은 그대로 유효.
