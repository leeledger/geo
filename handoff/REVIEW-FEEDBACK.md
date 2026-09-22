# Review Feedback — 2차 (a5cee3d + ebbb5fb, Claude Code 구독 경로)
Date: 2026-09-22
Ready for Builder: NO

1차의 Must 2건과 Should 9건은 반영을 확인했다. setEncoding, stdin 오류 리스너, --tools 좁힘, --strict-mcp-config, 자식 env 에서 키 제거, taskkill /T, SIGKILL 예비, subtype 예비, 판 고정, 라벨 수정이다. 남은 것은 새로 들어간 코드의 결함이다.

## Must Fix
- academy/scripts/write-news.mjs:185 — 도메인만 맞아도 출처로 인정한다. 근거에 `blog.naver.com` 이나 `cafe.naver.com`·`youtube.com`·`namu.wiki` 가 한 번만 나와도 그 호스트의 검색 결과가 전부 「출처」로 붙는다. 학원 주제에서는 검색 결과 대부분이 blog.naver.com 이다. 안 읽은 경쟁 학원 블로그가 출처로 달리는 1차의 문제가 그대로 남는다. Arch 결정(실제로 나온 문서만)과도 어긋난다. 고칠 법: 주소를 정규화해(끝 슬래시·쿼리·해시 제거, 소문자) 통째로 맞춘다. 도메인 일치는 그 호스트의 검색 결과가 1건일 때만 인정한다.
- academy/scripts/claude-code.mjs:93 (!result 분기) + write-draft.mjs:269 — result 줄이 없으면 인증이나 한도가 아닌 한 전부 `시간초과: true` 가 되고 503 으로 간다. 이 경우는 CLI 가 뻗거나 플래그를 거부하거나 설치가 깨진 경우까지 포함한다. write-draft 는 503 을 「돈·한도」로 세서 78(건너뜀)로 끝낸다. 그러면 CLI 가 계속 고장 나 있어도 매주 조용히 건너뛰고 고장 일감이 안 올라온다. 고칠 법: `시간초과` 는 타이머 경로에서만 true 로 둔다. result 가 없는 종료는 시간초과 없이 돌려줘 500 이 되게 한다(ai-measure 는 이 경우 0 으로 두든 break 목록에 500 을 넣든 한다).

## Should Fix
- claude-code.mjs:88-90 — 인증실패·한도 판정이 성공한 결과에도 stderr 를 본다. 인증문구의 `/OAuth token/i` 는 성공 실행의 stderr 경고(예: 토큰 만료 예고)에도 걸린다. 그러면 성공이 401 로 뒤집히고 측정 루프가 멈춘다. 한도 쪽 `resets\b`·`rate.?limit` 도 같은 위험이다. 권장: stderr 는 `!result || result.is_error` 일 때만 판정에 넣는다. 성공 결과는 지금처럼 400자 미만 본문만 본다.
- write-news.mjs:184 — `(post.근거 ?? []).join("\n")` 는 모델이 근거를 `{사실, 출처}` 객체로 주면 "[object Object]" 가 된다. 그러면 근거에 적은 주소가 하나도 안 맞는다. 결과가 흠 경고로 떨어지니 안전한 쪽으로 틀린다. 다만 출처가 다 사라진다. 권장: `JSON.stringify(post.근거 ?? [])` 로 문자열화한다.

## Escalate to Architect
- 없음.

## Cleared
2차: ebbb5fb 의 claude-code.mjs 전체 변경, writer-common 시간 제한과 상태 매핑, ai-measure 503 break, company 분석 모델과 4분 제한, 워크플로 판 고정을 확인했다. 위 4건 말고는 맞다.
