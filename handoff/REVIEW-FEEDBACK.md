# Review Feedback — Step 47 (47a + 47b + D131–D134)
Date: 2026-10-15
Ready for Builder: YES
Verdict: PASS — Must Fix 0

## Must Fix
None.

## Should Fix
1. handoff/research/step47/assertions-nullops.txt (confidence: 8/10) — The nullops run was written at 20:51. ops.ts was last edited at 20:53 and page.tsx at 20:54, so this artifact predates the final D133 code. I read the null path in the code and it is sound. ops.ts:450-451 `return { ...empty, err: ... }` gives rivalLatest:null. page.tsx:187 `ops.ok && ops.serp.rivalLatest && ops.serp.rivalLatest.total` then hides the cell. Still, re-run nullops before deploy so the evidence matches the code that ships.
2. web/app/page.tsx:50, :547 (confidence: 7/10) — FAQ 3 and the #price sub hard-code 「39만원」, 「250만원」 and 「80만원」. Meanwhile JSON-LD :43 reads `PILOT.price` and llms.txt reads the constants. Today the values agree (services.ts:47 "390,000원", :169, :269). If the price changes, the FAQ and its FAQPage JSON-LD will go stale while the Offer stays correct. Log as a KG. Not in this step's scope.
3. web/lib/ops.ts:158-161 (confidence: 6/10, verify this) — rivalLatest picks the engine from the single latest row. If that engine's run was partial or still in progress, the hero shows a smaller denominator (e.g. 「1 / 2」). That is honest but looks odd. A cheap guard: show the cell only when the denominator equals rivalTotal. This is Arch's call, so it is not blocking.
4. Deploy precondition, not code — next.config.mjs:15-16 sends the old host to https://cited.kr. Run `curl -sI https://cited.kr/` and get 200 with valid TLS before `--prod`. Otherwise every old-domain visitor gets sent to a broken host.

## Escalate to Architect
None. D134 is logged in BUILD-LOG.

## Checks performed
1. Numbers trace to sources. 6 spot-checks against probe/data, all match:
   - targets-scored.json: n=34, >60 = 7, <40 = 17, max 80
   - 80-point company (도토) 3/15 = 20.0%, and 19-point company (영림원) 8/15 = 53.3%, per report.websearch.txt
   - diagnoses/younglimwon.json thirdParty totalDocs 14, mine 9; doto.json 14 / 0
   - doto verdict 「사이트는 됐는데 안 불립니다」 matches the #diff card word for word
   - hero 3/6 · 빙 · 10/15 checked against the DB by verify (assertions.txt 20:57, after the last edit, ALL PASS)
   - 188→933, 32편 and 0/8 carried over unchanged from the old public/llms.txt
2. 「도입 사례」 in web/: it remains only in comments (landing.css:571, globals.css:316, page.tsx:25, place.ts:4). It appears nowhere in rendered text. PriceCalc:112 and SiteNav are fixed per D131/D122.
3. Copy: no fear-selling, no empty emphasis (searched for 다양한·매우·정말·놀라운·혁신·필수·늦습니다, 0 hits), short sentences. "Not for you" is stated in #who (3 items) and #price (「그 도구가 낫습니다」), and FAQ 4 says the client can do it themselves.
4. Redirect: the destination is a literal on a different host, so it cannot loop. `/api` and `/api/*` are excluded (404/400/405 asserted), `/apifoo` is redirected, query strings are kept (`/admin/ops?key=x`), and multi-segment paths are kept.
5. The FAQ and FAQPage JSON-LD both map the same `FAQ` const (page.tsx:105 and :617), so they match 1:1.
6. llms.txt route: it reads only NEXT_PUBLIC_SITE_URL (cleaned) and the PILOT/CITED_ABOUT constants. No secrets or env values leak.
7. ops.ts rivalLatest: `day` comes from `max(day)::text` and is sliced as a string (page.tsx:189). It is never passed through Date, so the UTC pitfall does not apply. checked_at is compared by epoch. A null day or no rival rows returns null, and DB failure goes through the catch to empty. No throw.

## Cleared
I reviewed 47a (site.ts, llms.txt route, 308, canonical/metadataBase, sitemap/robots), 47b (copy, order, FAQ/JSON-LD), and D131–D133 (PriceCalc pill, section backgrounds, rivalLatest hero cell). All of it passes. Step 47 is clear.
