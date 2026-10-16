# Review Feedback — Step 51
Date: 2026-10-16
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- academy/scripts/seed-cited-panel.mjs:21,25 — 「geo 마케팅 뜻」「geo 최적화 뜻」은 D174 가 「geo 최적화 영어로」를 뺀 까닭(용어 풀이 질문이라 회사 이름이 나올 일이 드물다)과 같은 성격이다. 원문 그대로이고 브리프 규칙(뜻이 GEO/AEO 마케팅이면 넣는다)에는 맞으니 막지 않는다. 기준을 하나로 할지는 Arch 판단 — 아래 Escalate.
- academy/scripts/seed-panel.mjs:60-63 — 패널점검이 DB 접속 뒤로 옮겨졌다. ilog·docttak 은 틀린 패널일 때 DB select 를 한 번 하고 멈춘다(전에는 접속 전에 멈춤). 결과·출력은 같다. 고칠 필요 없음, 기록만.

## Escalate to Architect
- 「~ 뜻」 2문항 유지 여부 — D174 기준(용어 풀이 질문 제외)을 끝까지 적용하면 2자리가 남는 등록 검색어 1개(「GEO 비용」)로는 못 채운다(17 → 16). 이건 코드가 아니라 패널 구성 결정이다.

## 부록 (confidence 4 — 막지 않음)
- web/proxy.ts:60 `new URL(path, req.nextUrl.origin)` — 키를 실은 POST 가 요청 Host 에서 나온 origin 으로 간다. Vercel 은 프로젝트에 붙은 도메인으로만 이 배포에 닿고, 키는 Production 에만 있으며, 옛 호스트는 redirects 가 먼저 308 을 돌리니 실제로 외부 호스트로 새는 길은 못 찾았다. 브리프가 정한 방식이다.

## Cleared
proxy.ts(waitUntil·fetch/readVisit 예외 삼킴·키 없으면 no-op·/api·/admin 은 matcher 와 decide 두 겹으로 막혀 자기 POST 가 다시 proxy 를 타지 않음·키는 서버 헤더로만·Next 16 named `proxy(req, event)`), cited-proxy.ts decide, bots.ts 사본(cmp 동일), check-crawler-class 대조, seed-panel DB 고객 길(ilog·docttak 회귀 없음), cited 패널 20(keyword 12개 전부 autocomplete.json 씨앗·순위와 글자 일치, 5개는 등록 경쟁 검색어, brand 3 은 stage brand 로 분리), 비밀값(36자 키 패턴 diff·새 파일에 없음, .env*.local 은 gitignore) 검토 통과. tsc 0 · check-proxy 전부 통과 · check-crawler-class 통과 · test-seed-panel 10/10 · test-docttak 35/0 을 직접 돌려 확인.
