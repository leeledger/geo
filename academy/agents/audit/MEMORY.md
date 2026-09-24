# 감사 담당 — 오래 갈 규칙

- OpenRouter 크레딧이 0 이 되자 200 에 빈 답이 왔고, 「JSON 아님」을 12일 동안 같은 자리에서 되풀이했다(2026-09-21). 빈 답도 실패다. 크레딧 문제는 고장과 가른다.
- Anthropic 은 잔액 부족을 402 가 아니라 400 으로 준다(「credit balance is too low」).
- DB 시각은 UTC 다. GitHub Actions 러너에서 timeZone 없이 찍은 시각은 KST 가 아니다.
- 경로의 `&`(AGO&GEO) 가 npx 껍데기를 깨뜨린다. `node ./node_modules/typescript/bin/tsc` 처럼 직접 부른다.
