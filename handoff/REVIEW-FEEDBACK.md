# Review Feedback — commits 06387f9 + 3384cf9 (provider fall-through, 2차)
Date: 2026-09-21
Ready for Builder: YES

## Must Fix
- None. The 1차 Must Fix is resolved: Gemini gets `{ json: true }` (responseMimeType only, no post schema). The 물어보기 모양 validators reject JSON with no `items` array or with an empty `body`, and move on to the next provider.

## Should Fix
- writer-common.mjs:80 (모델변수) — When WRITER_PROVIDER is unset, WRITER_MODEL still applies to *every* provider, so the leak from 1차 remains in that configuration. Not live: write.yml and optimize.yml both set vars.WRITER_PROVIDER=gemini, and company.yml does not pass WRITER_MODEL. — Recommendation: apply WRITER_MODEL only to the provider 공급자만들기() picks automatically. Or document that WRITER_MODEL requires WRITER_PROVIDER. Log to BUILD-LOG if not fixed inline.

## Verified (1차 items)
- WRITER_MODEL scoping per provider when WRITER_PROVIDER is set: OK.
- write-draft fall-through covers non-OK responses, network errors (.catch), truncation, and parse failure or missing body. `data`/`text` are now block-scoped and have no uses after the loop. `공급자` holds the winner, so review_notes 모델 is correct. The 78 gate checks 공급자들().length.
- Proxy cap: route.ts:63 sends `x-proxy-cap`. 재시도 returns immediately on it. 물어보기 breaks out of the OpenRouter models, skips anthropic(중계), and still tries gemini and groq. Paid models are skipped after a 402.
- maxTokens is passed through as given (the proxy clamps at 16000).
- 돈없음 is now a structured flag, true only when every failure was a 402. The empty-200 case from :free models counts as a real failure, which is correct given the fallbacks exist.
- write.yml: code is captured in both branches. The draft fallback is skipped when news already appended `slug=` (GITHUB_OUTPUT is per-step, so there's no stale match). The 78 → 0 mapping still holds.

## Escalate to Architect
- None.

## Cleared
Provider fall-through across writer-common, company.mjs, write-draft, write.yml and the proxy cap header was reviewed and passes. One low-severity config-dependent leak remains as Should Fix.
