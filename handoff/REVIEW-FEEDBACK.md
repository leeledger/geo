# Review Feedback — 학원 등록번호 표기 (robotncoding.com)
Date: 2026-10-13
Ready for Builder: YES

## Must Fix
None.

## Should Fix
None. The only variation is spacing: ai-work/llms.txt write "제7629호(" and the footers write "제7629호 (". That is cosmetic and the meaning is the same.

## Escalate to Architect
None.

## Cleared
Reviewed `git diff -- academy/` (6 files, +10/-2). Every location uses the same number 제7629호 and the same issuer 서울특별시강동송파교육지원청; the "교육장" suffix is dropped, which is correct for naming the office. The course type 학교교과교습학원 / 기타(로봇) appears in home.html and llms.txt and matches the certificate. No founder name, resident number or 송파대로37길 address appears anywhere in the diff. schema.json parses as valid JSON. Its only change is +5 lines adding `identifier` (PropertyValue) on the #org node (EducationalOrganization/LocalBusiness), not on the memberOf node, with no reformatting. Both JSX footer strings are correct text expressions with spacing kept on both sides of the separators. No other files under academy/ were touched.
