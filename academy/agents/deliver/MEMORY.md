# 유통 담당 — 오래 갈 규칙

- OpenAI 는 빙 인덱스에 기댄다. 빙 웹마스터에 사이트가 없으면 IndexNow 를 보내도 색인이 안 붙고, GPTBot 도 사이트를 못 찾는다. 빙 웹마스터는 마이크로소프트 로그인 뒤 「Import from Google Search Console」 로 붙는다(tools/bing-webmaster.mjs).
- Claude 검색은 Brave 색인을 쓴다. 관리 도구가 없고 search.brave.com/submit-url 하나뿐이다(캡차는 사람, tools/brave-submit.mjs).
- 네이버 서치어드바이저의 소유확인·RSS 제출은 캡차가 뜬다. 우회하지 않는다.
- Git Bash 에서 `/` 로 시작하는 인자는 윈도 경로로 바뀐다. `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"` 를 붙인다.
