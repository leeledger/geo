# Review Feedback — Step 15 (초안 재료) 3차
Date: 2026-09-23
Ready for Builder: YES
Commits reviewed: 57c4ec4 · 4551e83

## Must Fix
없음.

## Should Fix
없음.

## Escalate to Architect
없음. (78 → 일주일 뒤 다시, DB 오류와 0건 가르기 — 둘 다 Arch 승인대로 들어갔다.)

## Cleared
- **한 주에 생성 한 번**: 저장소 전체에서 write-news.mjs 를 부르는 곳은 두 군데뿐이다 — `write-draft.mjs:127`(모드 사실에서 자식으로) 과 `.github/workflows/write.yml:78`(사람이 `mode=news` 를 고를 때만). company.mjs weekly-draft 는 `실행(["scripts/write-draft.mjs"])` 하나다. 예약 실행 기본값은 `auto` 이고, 갈래는 write-draft 가 고른다. 한 번 실행에 생성 호출 하나·「모드=」 한 줄이 맞다.
- **78 은 고장이 아니다**: `실행()` 이 `code` 를 돌려주고, weekly-draft 는 78 이면 `status:"대기"` · `nextTry` 일주일 · 근거 「모드=… · 재료 없음 — material-need 일감 참고」로 끝낸다. `attempt` 를 안 올리니 없는 「3번 실패」가 원장 큐에 안 뜬다. 그 밖의 0 아닌 코드만 실패다. write.yml 은 78 을 0 으로 끝내고 다른 코드는 그대로 실패로 넘긴다.
- **DB 오류와 0건 가르기**: 재료 쿼리가 실패하면 빈 배열 대신 null 을 돌려주고 종료 1 로 끝낸다. DB 가 죽은 주에 「원장이 재료를 안 적었다」로 조용히 넘어가던 길이 막혔다. 이건 Bob 이 스스로 찾아 고친 것이다.
- **전언 표시**: `라며|고 전했|하시더|그러셨|의 말입니다|라고 적` 여섯이 들어갔다. 되묻기·아이 속마음·문서 인용 세 오탐은 표시가 없어 여전히 안 걸린다(REVIEW-REQUEST 의 재확인 출력과 정규식이 일치한다).
- **시험 출력**: 647자·지어낸 인용·라벨만 단 재료 세 경우의 `--strict` 실제 출력이 REVIEW-REQUEST 에 붙었다. 넓은 인용 규칙을 버린 이유도 BUILD-LOG 에 남았다.
- **운영 DB 깨끗함**: posts 45 · 검토 대기 초안 0 · materials 0 · draft_feedback 0 · 시험 슬러그 0 · 일감은 `material-need` 사람 대기 하나뿐이다(next_try 09-23 06:54).

## 남은 것 (원장 몫, 코드 아님)
- 재료가 0건이라 다음 월요일 실행은 모드 사실(뉴스)로 간다. 재료를 세 줄 적어 두면 그 주부터 관점 글이 나온다 — /admin/material.
