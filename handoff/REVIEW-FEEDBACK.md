# Review Feedback — Step 44
Date: 2026-10-13
Ready for Builder: YES

## Must Fix
None.

## Should Fix
None blocking. One note for Arch, no action needed from Bob:
- academy/public/llms.txt:3 (confidence: 6/10). The blockquote still says 「코딩·로봇·AI 교육 전문 학원」. The brief did not ask to change it, and it stays consistent with ogDescription. Leave it unless Arch wants the term made uniform.

## Escalate to Architect
None.

## Answer to Bob's question (KNOWN 4 pairs)
The approach is acceptable. test-faq-sync.mjs:54-62 allows only exact (home, schema) string pairs keyed on the home text. Any other mismatch, any reorder, or any edit to one of those 4 pairs still FAILs, so the guard does not loosen anywhere else. The comment at :52-53 says to remove entries once KG-44-3 is fixed. That is the right shape for a known-gap allowlist. Do not widen it to fuzzy matching.

## Fact check
- 1단계 그림·음성 AI → llms.txt 154. 2단계 얼굴 인식·감정 분류·학습 데이터 → 158. 3단계 자연어 코딩, 우리말 설명→코드 → 163. 4단계 「AI를 참고 도구로」 → 168, so 「5단계 전부」 holds. 5단계 AI API 서비스 → 172. AI 시대 코딩 초5~중3·24주 → 225. AI 튜터 정답 코드 안 줌·채울 칸 → 195-196. Nothing fabricated.
- The FAQ answer text matches the locked text in ARCHITECT-BRIEF.md:67/70 character for character, in all 3 places.
- AI-tone: no 서론, no empty emphasis, no vague endings. It says what the academy does not do (「하지 않는 것도 있습니다」). It closes on a selection criterion, not 「오세요」. Test MARKS 0.
- home.html:928 uses `&amp;`. schema.json parses as valid JSON. name/alternateName are untouched.
- Test run: 23 PASS · 0 FAIL.

## Cleared
I reviewed and passed the meta/schema/home/llms 「AI학원」 changes, the new locked FAQ in 3 places, and test-faq-sync.mjs. All facts trace to existing llms.txt lines, the markup is consistent and escaped, and the JSON is valid.
