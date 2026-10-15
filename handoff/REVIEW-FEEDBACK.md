# Review Feedback — Step 50
Date: 2026-10-15
Ready for Builder: YES

## Must Fix
None.

## Should Fix
- web/lib/ops.ts:336 (confidence: 8/10). The funnel counts leads only when `scan_id is not null or source = 'free_scan'`, so `platform_check` and `no_site` leads never reach `leads30d`. It does not break anything, and leaving them out of `scanToLeadPct` is arguably correct because these paths create no scans. But the owner will not see the new leads in that count. This needs a product call (see Escalate). Do not change it inside Step 50.
- KG-50-7, rate limit trusts x-forwarded-for (confidence: 9/10). This is not new: `git log -S x-forwarded-for` traces it to 20ff4f0, the initial build, and Step 50 did not touch clientIp/rateLimited. On Vercel the edge overwrites X-Forwarded-For with the real client IP, so a client cannot spoof it there. It is only bypassable off-Vercel. The limiter is also per-instance memory. Keep it logged. It does not block this step.

## Escalate to Architect
- Should /admin/ops "30일 리드" (leads30d) include `platform_check` / `no_site` leads? I cannot settle this at the code level. It changes the sales-funnel number the owner reads, and the brief (D160) is silent on it.

## Appendix (confidence < 7, no action required)
- web/lib/robots.ts:29 (4/10). `User-agent: Googlebot/2.1` is stored as `googlebot/2.1` and does not match the `Googlebot` id, so the bot falls to `*`. RFC 9309 expects product tokens without a version. None of the hosts measured so far do this.
- safeFetch rejects port/userinfo on every hop (line 119), but [50-S] does not test those two cases on a redirect hop. They are cheap to add next time.

## Cleared
Reviewed all of the following and they pass:
- **SSRF guard.** safeFetch takes https only, checks the allowlist by exact host match (tistory by anchored regex only), and rejects any port or userinfo. It re-checks every redirect hop with `redirect: "manual"`, follows at most 3 hops, shares one 8s timeout across the call, caps the body at 2MB and sends no credentials. The only fetches in platform-check go through it, and the robots URL is built from an allowlisted host.
- **No stored XSS.** api/lead `no_site` rebuilds the questions from `clean()`ed fields and drops the client's `concerns`. /admin renders them as React text, and nothing in the change uses innerHTML.
- **Truth.** Every platform sentence comes from a live robots/page fetch. Yeti on Naver hosts is marked self, left out of counts, and shown as 「… 자체 검색 — 이 규칙으로 판단 못 함」. A 429, 5xx or no response gives 「확인하지 못했습니다」 with the honest siteband-scan UA.
- **robots.ts matcher.** I ran 19 unit cases of my own: longest match, Allow wins ties, `*`, `$`, merging repeated UA groups, several UAs in one group, case, empty Disallow, falling back to `*`, BOM and comments. All behave as RFC 9309 specifies.
- **FAQ and hero.** One FAQ array feeds both the screen and the JSON-LD (11 = 11). Hero max is 371 (limit 400). The new copy follows the brief's wording.
- **Verify script.** A diff against step49 shows only the 4 old assertions documented in REVIEW-REQUEST changed. Test leads and scans were deleted by id.
- **Screenshots.** B-naver, B-instagram, B-fail and C-questions look right.
- Deviations 1–9 are accepted.
