# Review Feedback — 3차 (84a6344 + 82f751c)
Date: 2026-09-22
Ready for Builder: NO

2차의 Must 2건과 Should 2건은 반영을 확인했다. 주소를 통째로 맞추고 도메인 일치는 결과가 1건일 때만 인정한다. 결과 없음은 500 으로 가고 측정 루프가 멈춘다. stderr 는 실패했을 때만 본다. 근거는 JSON.stringify 로 문자열화한다. claude-code 경로에는 남은 결함이 없다.

## Must Fix
- academy/scripts/daily-agent.mjs:115-118 + 177-181 (82f751c) — 이제 api-% 측정과 claude-code-headless-% 측정을 한 묶음으로 읽는다. 효과 판정의 전(effective_on 전 14일)과 후(7일 뒤부터) 창은 엔진을 가리지 않는다. 9/22 에 엔진이 openrouter 에서 claude-code-web 로 바뀌었다. 그래서 이 무렵에 효과일이 걸린 일감은 앞은 openrouter 답, 뒤는 Claude Code+WebSearch 답을 비교하게 된다. 엔진마다 인용하는 방식이 달라 적중률 차이가 20%p 를 넘기 쉽다. 그러면 행동 효과가 아닌 엔진 교체가 「효과 있음」으로 geo.agent_runs 에 적힌다. 이 판정은 케이스 리포트와 영업 숫자로 나간다. 「지어내지 않는다」에 정면으로 걸린다. 고칠 법: 판정 창을 엔진별로 가른다. 전과 후 양쪽에 5건 이상 있는 엔진만 비교하고, 그런 엔진이 없으면 판정을 미룬다(35일 지나면 「표본 부족」). 7일 적중률 표(208행 이하)는 이미 엔진별로 모으니 그대로 둬도 된다.

## Should Fix
- academy/scripts/write-news.mjs:192 — `쓴자리.includes(다듬기(s.주소))` 는 앞부분만 같아도 맞는다. 검색 결과 `https://blog.naver.com/abc` 가 근거의 `https://blog.naver.com/abcdef/123` 에 걸린다. 검색 결과가 호스트 뿌리 주소면 그 호스트 전체에 걸린다. 드물지만 안 읽은 문서가 출처가 되는 같은 종류의 틈이다. 권장: 쓴자리에서 URL 을 뽑아(`/https?:\/\/[^\s"')\]]+/g`) 같은 다듬기로 정규화한 Set 을 만들고, 그 Set 과 정확히 같은지로 맞춘다.

## Escalate to Architect
- 엔진 교체 전후 측정을 어떻게 이어 볼지. 엔진별로 따로 판정할지, 교체일을 기준선 재설정으로 볼지는 방법론 결정이다. Must Fix 의 코드 해법은 보수적 기본값(같은 엔진끼리만)이다.

## Cleared
3차: 84a6344 의 claude-code.mjs·ai-measure.mjs·write-news.mjs 변경과 82f751c 를 확인했다. claude-code 경로는 통과다. 남은 것은 판정 창에서 엔진이 섞이는 문제다.
