# Review Feedback — Step 38 (2026-10-05) · Ready for Builder: YES
## Must Fix — 없음
## Should Fix
- client-core.mjs:250-283 (5/10, 확인 요망) — 호스트 모양만 보고 DNS 결과는 안 본다. 사설 IP로 풀리는 도메인은 통과한다. https 전용이고 관리자만 넣을 수 있어 실제 위험은 낮다 — dns.lookup 으로 사설·링크로컬·루프백을 거부하거나 KG에 적는다.
- client-core.mjs:278 (8/10) — `body = await r.text()` 크기 상한이 없다(KG-38-4). 스트림을 2MB 까지만 읽고 끊는다.
- pilot-actions.ts createPilot (7/10) — 아직 `on conflict(client_id) do update`. 서버는 두 번째 파일럿을 거부하지 않고 담당자 칸을 덮어쓴다. "pilot-exists" 오류말은 정의만 있다. 기존 pilots 행이 있으면 fail("pilot-exists").
- client-core.mjs:186 (5/10) — 도메인 중복 검사가 확인 뒤 insert 이고 고유 색인이 없다. 관리자 한 명이라 경합 가능성은 낮다. tx 안에서 pg_advisory_xact_lock 을 잡는다.
## Escalate — 없음. 다르게 한 3가지는 타당하다: answerPattern 이전(node 가 .ts 를 못 읽고 재수출로 호출부 불변), maxDuration 60(20초 상한 안), useActionState(열 칸을 다시 치지 않게).
## Cleared — guard=isAdmin(기존 actions와 같음)·페이지 인증, 리다이렉트 https·같은 호스트·5홉·8/20초, slug·코드·도메인 거부, 지우기 test·FOR UPDATE·한 tx·남은 0, createPilot 이 geo.clients 를 안 만듦, 공개·리포트 길 0, derived 실측만, CLAUDE.md 는 함정 줄 하나만 바뀜.
