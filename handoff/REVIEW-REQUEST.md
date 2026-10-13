# Review Request — Step 44 (「AI학원」 검색어)
Date: 2026-10-13
Ready for Review: YES
Status: DONE (배포 전 — Richard PASS 뒤 오케스트레이터가 vercel --prod)

## Files Changed
- academy/content/meta.json:2-3 — title 「코딩·로봇·AI학원」, description 첫 문장 「코딩·로봇·AI학원입니다」. ogTitle·ogDescription 그대로
- academy/content/schema.json:19 — #org description 「코딩·로봇·AI학원입니다」. name·alternateName 그대로
- academy/content/schema.json:307-314 — FAQPage 석촌호수 문답 바로 뒤 새 Question (잠긴 질문, text = 두 문단 공백 이음)
- academy/content/home.html:925-931 — #faq 석촌호수 문답 바로 뒤 새 <details>, 이웃과 같은 마크업, `&amp;`
- academy/public/llms.txt:1 · 39 — 1행·짧은 버전 「AI학원」
- academy/public/llms.txt:269-281 — 「## AI학원을 찾는 분께 (AI Classes)」 절, AI 리터러시 절 끝·FAQ 절 앞
- academy/public/llms.txt:353-355 — FAQ 절 끝에 잠긴 문답(석촌호수 문답이 llms FAQ 엔 없어서 브리프대로 끝에)
- academy/scripts/test-faq-sync.mjs (새) — 홈↔스키마 FAQ 순서·글자, 잠긴 문답 3곳(질문·답 글자까지), llms 절 자리, AI학원 1회(title·description·#org), name/alternateName 오염 없음, 새 문구 MARKS 0. 줄바꿈 CRLF 를 LF 로 맞춰 읽음

## 검증
- `node academy/scripts/test-faq-sync.mjs` → 23 PASS · 0 FAIL, exit 0 (KNOWN 4줄 출력)
- 음성: HEAD 내용 사본으로 돌리면 12 FAIL·exit 1. 홈만 새 문답 + 스키마 HEAD → 순서 FAIL
- `node ./node_modules/typescript/bin/tsc --noEmit -p .` (academy) → 0
- 「AI학원」 grep: meta 2 · schema 3 · home 3 · llms 7 줄, 다른 파일 0 — 브리프 Acceptance 자리와 일치

## Open Questions
- 기존 13문답 중 4쌍(10~13번)이 홈·스키마 글자가 다르다. 순서는 맞다. 브리프대로 안 고쳤고, 테스트는 그 4쌍만 정확한 글자쌍으로 허용(KNOWN 출력)하고 나머지 어긋남은 FAIL 로 둠. 이 방식이 괜찮은지 봐 주세요 — 허용 목록 없이 엄격히 하면 Acceptance(PASS)를 못 맞춘다
- llms.txt 새 FAQ 답은 기존 문답처럼 줄을 접지 않고 문단당 한 줄. 테스트가 잠긴 글자를 그대로 대조하려고. 기존 llms 절 끝 두 줄(280-281)도 브리프 그대로 둘로 나뉨
- 사실 대조: 학년·주수·AI 튜터 문구를 llms.txt 154·158·161·172·196·225행과 맞춰 봄. 어긋남 없음

## Out of Scope (logged in BUILD-LOG)
- KG-44-3 홈↔스키마 FAQ 글자 다름 4쌍 (D104)
- KG-44-1 /ai 페이지, KG-44-2 스마트플레이스 대표키워드(원장 몫)
- tools/naver-place-check.mjs 는 오케스트레이터 변경 — 안 건드림
