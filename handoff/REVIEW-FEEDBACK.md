# Review Feedback — 학원 홈 #why 유튜브 영상 삽입
Date: 2026-10-16
Ready for Builder: YES (영상 선택은 Arch 결정 — 아래 Escalate)

## Must Fix
- 없음

## Should Fix
- 없음

## Escalate to Architect
- 어느 영상을 넣을지. 채널(@robotncoding, UCvAcsJPFdvXxVON-sQUHmkQ)에 공개 영상이 2개다.
  - FMgemA2a7_c 「AI가 코드를 써주는데, 왜 아직 코딩을 배울까요」 41초, 2026-10-15T02:37:48-07:00, utm_campaign=homepage-motion — 지금 들어간 것
  - rwSd_ErIviI 「AI가 코드를 쓰는 시대, 코드보다 먼저 배워야 할 것은?」 45초, 2026-10-15T03:24:29-07:00 (47분 뒤), 설명 링크 utm_campaign=homepage-hype — tools/motion-pipeline.mjs homepage-hype --sec 45 --music hype 로 만든 판. BUILD-LOG·research 어디에도 이 ID 기록이 없다
  - 권고: rwSd_ErIviI. 나중에 올린 최종 파이프라인 판이고 내용(무엇을 만들지 정하고 왜 안 되는지 찾는 힘)이 #why 리드와 같은 말을 한다. 제목이 #why h2 와 글자까지 같은 건 FMgemA2a7_c 쪽이라 Bob 선택도 근거는 있다 — 원장 의도 확인 필요
  - 바꾸면 고칠 곳: home.html:79 iframe src·title, schema.json VideoObject name·thumbnailUrl(i.ytimg.com/vi/rwSd_ErIviI/hqdefault.jpg)·uploadDate(2026-10-15T03:24:29-07:00)·duration(PT45S)·embedUrl·url, BUILD-LOG 기록. 값은 위가 oEmbed·watch 페이지에서 확인한 것

## Cleared
oEmbed·watch 페이지로 VideoObject 값 검증(제목·썸네일·uploadDate 일치, duration PT41S 는 videoDetails.lengthSeconds=41 과 일치 — microformat 은 PT0M42S 로 1초 차, 반올림 차이라 무해), schema.json 파싱 정상, 영상 주변 메타 문구 없음, iframe title 있음·loading=lazy·youtube-nocookie, .film aspect-ratio 16/9 로 자리 선점(레이아웃 밀림 없음)·클래스 충돌 없음, .rise 관찰 스크립트(home.html:1159)는 클래스만 붙여 히어로 스크립트에 영향 없음, test-faq-sync 23 PASS·test-ai-page 30 PASS.
