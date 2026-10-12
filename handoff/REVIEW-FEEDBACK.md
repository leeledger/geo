# Review Feedback — case-report plain words + 처음 vs 지금 (re-review)
Date: 2026-10-12
Ready for Builder: YES

## Must Fix
None.

## Should Fix
- academy/scripts/case-report.mjs, TODO Bing entry (confidence: 7) — The text says `Bing 에는 아직 한 번도 안 나왔다`, but the condition checks only `serp`, which is the latest day per engine. If Bing hits once and then drops, the TODO still says 「한 번도」 and is false. — Fix: also require no Bing row in `serpFirst`, or change the wording to 「지금 Bing 에는 안 나온다」.
- academy/scripts/case-report.mjs, above `판정` (confidence: 9) — The old doc comment `/** 5%p 넘게 움직였을 때만 늘었다/줄었다 … */` is still there above the new 10%p comment and now contradicts the code. — Fix: delete it.

## Escalate to Architect
None. The coordinator decided the threshold: 10%p for 「늘었다」, 5–10%p marked as possible noise.

## Cleared
Every Must Fix and Should Fix item from the first review is resolved:
- The column is labelled 「시작 전」, so it no longer clashes with day-1 = 30 posts.
- The baseline and current query sets are described accurately, and a note says they differ.
- The engine is labelled 네이버 웹문서.
- The Bing TODO is conditional.
- 판정 uses unrounded ratios with the 10/5%p bands.
- The comparison is anchored at 비교시작 2026-09-24. That is after the 84a6344 detector change, and the ≥14-day check runs in SQL on the filtered days.

In the regenerated HTML, masking is still clean: no academy name, domain, area names, rival brands or /blog/ paths.
