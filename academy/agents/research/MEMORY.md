# 근거 담당 — 오래 갈 규칙

- GPTBot 커버리지가 한 엔진만 낮으면 robots·사이트맵보다 빙 색인부터 본다. OpenAI 는 빙 인덱스에 기댄다. IndexNow 는 알림이지 등록이 아니다. 확인은 `node academy/scripts/bing-check.mjs`.
- Claude 웹 검색은 Brave 색인에 달렸다. ClaudeBot 이 많이 읽어 가도 Brave 에 `site:` 결과가 없으면 Claude 답에 안 나온다. Claude 인용이 0이면 Brave 에서 site: 부터 확인한다.
- DB 시각은 UTC 다. 날짜를 쓸 때는 Asia/Seoul 로 바꾼다.
- AI 답변 측정 방법(수집 방식)이 바뀐 앞뒤를 한 줄로 비교하지 않는다. 전후 비교는 같은 방법끼리만.
