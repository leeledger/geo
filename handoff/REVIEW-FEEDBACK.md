# Review Feedback — commit 06387f9 (provider fall-through)
Date: 2026-09-21
Ready for Builder: NO

## Must Fix
- academy/scripts/company.mjs:100-111 + writer-common.mjs:~180-203 — Gemini fallback in the company loop sends the *blog-post* responseSchema (required: title, summary, tags, body, 확인필요) because p.요청() is called without options. The analysis prompt expects {"items":[...]}; Gemini is forced into the post shape, 읽기() parses it fine, returns success with no `items`. company.mjs:374 then records status "관찰", evidence "만든 일감 없음", nextTry +7 days. That is a silent false success that parks the task for a week. It will happen exactly when OpenRouter and Anthropic are both down (e.g. proxy daily cap). — Fix: let 요청 take an option that skips responseSchema (keep responseMimeType "application/json"), e.g. `p.요청(prompt, max, { 스키마: false })`, and pass it from company.mjs. Also treat a parsed JSON without the expected key as failure in the analysis caller (`if (!Array.isArray(ans.json.items))` -> 실패).

## Should Fix
- writer-common.mjs:95,144,166 + 26 (쓰기모델) — WRITER_MODEL is applied to every provider in 공급자들(). Set it for the primary (e.g. `gemini-3.6-flash`) and the openrouter fallback sends that name to the proxy (400 "중계하지 않는 모델"), anthropic sends it to Anthropic (400), and so on. Every fallback fails. Not live today (only vars.WRITER_PROVIDER=gemini is set; WRITER_MODEL is empty), but a single var change would quietly break all fallbacks. — Fix: apply WRITER_MODEL only to the provider that WRITER_PROVIDER picks. Fallbacks use their built-in defaults, or per-provider vars (GEMINI_MODEL, ANTHROPIC_MODEL, ...).
- write-draft.mjs:219-240 — Only a non-OK HTTP status moves on to the next provider. A 200 with empty or unparseable content, or a truncation (끊겼나, line 246), exits 1 with no fallback. That is the same failure mode this commit set out to fix: OpenRouter :free returns 200 with empty content, and Gemini can return 200 with no candidates or MAX_TOKENS. — Fix: move the text / 끊겼나 / 파싱 checks inside the loop and `continue` on failure. Keep the last error for the final message.
- write-draft.mjs:222 — `재시도` is not wrapped in `.catch`. A network error from the first provider (DNS, reset) throws out of main and no other provider is tried. company.mjs does catch this. — Fix: add the same `.catch((e) => ({ ok:false, status:0, text: async () => e.message }))`.
- write-draft.mjs:207 — The 78 "no settings" gate still uses the single 공급자만들기(). With WRITER_PROVIDER=gemini and no GEMINI_API_KEY, the script exits 78 (skip, green) even when the proxy/anthropic is available. — Fix: gate on `공급자들().length === 0`.
- writer-common.mjs:49-56 (재시도) with web/app/api/llm/route.ts:54-63 — The proxy's daily cap returns 429, which 재시도 treats as transient: 20+40+80 s waits, and each retry also bumps the counter. After the cap is hit, each company 물어보기 burns about 5 OpenRouter models × 140 s + anthropic 140 s ≈ 14 min against a 55-min job timeout. The OpenRouter and Anthropic modes share one counter. Dead OpenRouter models (credit 0: paid ones 402, free ones empty 200) cost about 5 cap slots per 물어보기 before Anthropic is reached, so an hourly loop can use up the 120/day cap and block Monday's write.yml. The OpenRouter burn existed before this commit; the change makes the cap the limit on the new fallback. — Fix: don't retry a 429 whose body says "중계 한도" (or return 503 / a distinct code from the proxy for cap). Consider skipping the rest of 모델들() after the first 402 in 물어보기.
- company.mjs:106 — `Math.min(maxTokens, p.최대토큰)` caps the anthropic fallback at 6000 tokens. The 다듬기 call (line 422, maxTokens 12000) returns the full rewritten body in JSON, so it will often truncate. The response is non-JSON but still billed, and the call falls through to the next provider. — Fix: for anthropic use maxTokens as given (the proxy already clamps at 16000).
- company.mjs:173 (돈없음) — The error string now joins every provider's message, so /402|credit/ matches (a) any OpenRouter 402 even when the real blocker was Anthropic or Gemini, and (b) "JSON 아님(402자)". A genuine failure can be filed as "크레딧이 없어 미룸". Low impact while OpenRouter sits at 0 credit. — Fix: return a structured `{ 돈없음: true }` flag only when every provider failed for payment reasons, or match `\b402\b` on the status field alone.
- write.yml:69-76 — News falls through to draft on *any* non-zero exit. write-news.mjs:217 appends `slug=` to GITHUB_OUTPUT before the log section. If news throws after that point (e.g. post.근거 is a non-iterable object -> main().catch sets exit 1), draft also runs. You get two drafts and two `slug=` lines, and the second wins in steps.write.outputs.slug. Unlikely, but it double-spends. — Fix: in the shell, skip the fallback when news already wrote a slug (e.g. `grep -q '^slug=' "$GITHUB_OUTPUT"`). Or have write-news set exitCode only before insert.

## Verified OK
- Exit codes in write.yml: after the inner `if ... fi`, `$?` is 0 when news succeeded and draft's code when draft ran. The 78 -> exit 0 mapping still works. `set +e` is present.
- DRAFT_SLUG / steps.write.outputs.slug: when news fails before insert, only write-draft appends `slug=`. The output is set correctly.
- Gemini body gets no `model` field in company.mjs (the override only applies to anthropic). The URL carries the model.
- Anthropic via proxy: URL `?provider=anthropic`, Bearer token, and `claude-sonnet-5` / `claude-opus-5` are on the proxy allowlist.
- write-draft `공급자` reassignment: after a successful break it holds the winning provider, so review_notes 모델 (line 304) is correct.
- No unbounded loops. Provider lists are finite and de-duplicated. company.mjs:387's own news -> draft fallback is separate from write.yml's and does not nest.

## Escalate to Architect
- None.

## Cleared
Not cleared. The one Must Fix (the Gemini schema causing a silent false "관찰" in the company analysis) blocks.
