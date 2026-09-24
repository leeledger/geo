# Review Feedback — Step 18
Date: 2026-09-24
Ready for Builder: YES

## Must Fix
- None.

## Should Fix
- web/app/admin/admin.css:92 — `button:disabled:not([data-busy])` is a global rule. It also dims LoginForm's button while `busy` is true. That looks intended, but it's broader than SubmitButton. Leave it as is. Just know it's there.
- After deploy, check that `X-Vercel-Id` reads `...::sin1` and measure /admin/ops TTFB again. Log the new figure in BUILD-LOG next to the 6.4s. The ~30 sequential queries are still there. Moving region cuts the per-query round trip, but the query count doesn't change. If TTFB is still well over 1s, open a separate step (Promise.all or fewer queries). Do not do it in this step.

## Escalate to Architect
- None.

## Cleared
- vercel.json (single-region `sin1` is valid on Hobby; web/ is the Vercel project root and has no other vercel.json or crons to conflict).
- SubmitButton: React 19.1 builds the action FormData with the submitter, so `data.get("outcome")` matches the pressed button in Todo's two-button form. Enter-key implicit submit also carries the default button as submitter. `disabled={도해수 === 0}` still holds, now as `disabled || pending`.
- Server components importing the client button is fine.
- All 21 replacements, including the 7 that had no `type` attr: outreach, pilots, and the 5 in pilots/[id]. Every one sits inside a `<form action={serverAction}>`. None was meant to be non-submit, and no string-URL forms exist where useFormStatus would never go pending.
- The only raw `<button>` left is LoginForm, which has its own busy state.
- Spinner uses `rotate` and respects reduced motion.
- Region-sensitive code: /api/llm calls api.anthropic.com and openrouter.ai, and /api/scan fetches public sites. All work from Singapore. No geo/IP-header logic in web.
- tsc --noEmit: clean (exit 0).
