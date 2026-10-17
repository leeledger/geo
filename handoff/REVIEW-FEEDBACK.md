# Review Feedback — Step 56 (+ D246) · round 2 (D247–D250)
Date: 2026-10-17
Ready for Builder: YES

## Must Fix
None.

## Should Fix
None open from round 1. All three are resolved:
- D248, asks/page.tsx:90: a no-site client's chip now reads `이름 n / N · 링크 해당없음(사이트 없음)`. The "/ n" after 해당없음 is gone.
- D249, company.mjs:934: announce returns 완료 「사이트 없음 — 색인 알림 해당없음」 before any URL is built. No `https://null` task can be created.
- REVIEW-REQUEST now describes the daily-agent content branch correctly.

## Escalate to Architect
None. The round 1 escalation is answered by D250:
- When the key file is the only gap, the keyfile line becomes 사람 with an internal 할일. That opens setup-keyfile, titled 「내부 — 고객에게 안 물음」.
- setup-send stays closed, and no 보낼글 is produced.
- test-client-copy finds 0 forbidden words.

## Cleared
- **D247 Must Fix is resolved.**
  - I re-ran my own loop over 업종표 × 모든시군구 (58 × 206 = 11,948 combinations), template-only, through 거르기. **0 combinations fall below 17.** Round 1 had 171.
  - When the short and full region names are the same, 틀검색어 adds 의도표.더 (8 fixed words) and synonyms × intents. Everything still comes from the fixed tables.
  - 거르기 now checks the exclusion words per whitespace token. 「중구 인테리어 추천」 survives, and a real 「구인」 token is still dropped.
- **Re-run results.**
  - Tests: test-clients 110, test-auto-setup-core 156, test-client-core 241, test-client-copy 11, test-client-status 14, test-onboard-core 18, test-docttak 35, test-ilog-loop 42. All 0 fail.
  - tsc exits 0.
  - `next build` exits 0. I ran it myself.
- Round 1 clearances stand.
