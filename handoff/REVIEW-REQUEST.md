# Review Request — Step 13 (현황판 「성장 — 늘고 있나」)
Date: 2026-09-22
Ready for Review: YES

## Files Changed
- web/lib/growth.ts:1-366 — 새 파일. `readGrowth(client)`: 오늘(KST)을 SQL 에서 한 번 받고 모든 쿼리에 $ 파라미터로 넘긴다. 조각마다 `part()` try/catch → null. 커버리지 114 · AI 152 · 경쟁 195-231 · 크롤 233 · 발행 252 · 문의 287 · 사이티드 302 · 에이전트 317 · 주별 요약 330
- web/app/admin/ops/Growth.tsx:1-520 — 새 서버 컴포넌트. 판정 줄(223 judged), 칸 8개, Change(112, 기호+절대 차+이전 값+좋아짐/나빠짐 글자), Spark(133, non-scaling-stroke + HTML 점), 발행 주별 막대, 차트 카드(456), 표로 보기(464)
- web/app/admin/ops/CoverageChart.tsx:1-166 — 새 클라이언트 컴포넌트. 한 축 선 3개, 끝 라벨 14px 미만이면 합침, 헤어라인+툴팁(좌우 뒤집기), tabIndex=0 + ←→/Home/End, aria-live 읽기 줄
- web/lib/ops.ts:13 — `pool` export
- web/app/admin/ops/page.tsx:10-11, 201-210, 272-273 — import, Promise.all 에 readGrowth(통째 실패 → {g:null, err}), `<Growth>` 를 err 다음·AgentBoard 앞에

## 숫자 대조 (2026-09-22, 로컬 렌더 = 운영 DB)
- 커버리지 끝값 구글 47 · 네이버 47 · 빙 5 / 47쪽 ✓. 네이버 9/16 1 → 9/17 44 ✓. 구글 9/06 15 ✓. 끝 라벨 「구글·네이버 47」 합쳐짐 ✓
- AI: 맨 위 claude-code-web(claude-code-headless-websearch) 9/22 언급 4/20 · 인용 0/20 「이 방법으로는 1회차」 ✓. openrouter 「공통 11문항: 언급 3→3 · 인용 0→0」 ✓. chatgpt-web-logged-out · claude-code-websearch 1회차 ✓
- 경쟁 4/6(9/22), 9/15 4 → 그대로. 9/21 불완전으로 빠짐 ✓. 「네이버 통합 4 · 네이버 웹문서 2(최고 1위) · 빙 0」 ✓
- 크롤러 검색 262 · 그 전 204 / AI 260 · 그 전 433 ✓
- 발행: 최근 7일 2 · 그 전 3. 주별 8/31주 0 · 9/7주 12 · 9/14주 0 · 9/21주 2 = 14편 ✓ (옛 글 없음). 연속 1주
- 문의 30일 2 · 결과 미입력 2 · 리드 0 ✓ · 무료 진단 22회
- 실패 7일 33 · 그 전 3 ✓. 활동 7일은 233(브리프 예시 239 — 조회 시점 차이, 같은 필터)
- 판정 줄: 좋아진 것 2(커버리지·학원 문의) · 그대로 2(경쟁·리드) · 나빠진 것 2(발행·에이전트 실패) · 비교 못 함 1(AI)

## ?c=ilog
에러 없이 렌더. AI·문의·발행 「기록 없음」 + 「비교할 이전 값 없음」, 발행 「이 고객사 글은 이 DB 에 없다」, 문의 「상담 기록이 아직 없다」. 커버리지 구글 1 · 네이버 2 · 빙 3 / 10쪽

## 화면 확인 (스크린샷은 저장소 밖 C:\Users\force\AppData\Local\Temp\claude\)
- growth-{robotncoding,ilog}-{1280,390}.png · growth-hover-{1280,390}.png · growth-hover-right-{1280,390}.png · growth-keyboard-{1280,390}.png · growth-table-{1280,390}.png
- 1280·390 모두 가로 스크롤 없음, 콘솔 오류 0. 끝 라벨 오른쪽 끝이 상자 안(390: 329 < 345). 툴팁이 뷰포트 안(390: 90~200px), 오른쪽 끝에서 왼쪽으로 뒤집힘. 키보드 ←← 로 9/20 툴팁 + aria-live 문장
- 기존 섹션 h2 순서 그대로: 직원별 업무 현황 · 오늘의 운영 기록 · 고객사 성과 지표 · 하루 시간표 · 사람만 할 수 있는 일 · 크롤러 커버리지 · 검색에 처음 나온 날 · 최근 발행

## Open Questions
- Growth 타입에 `inquiries.ever` · `weeks` 두 칸을 더했다(BUILD-LOG 에 이유). 괜찮은가
- AI 칸 판정은 언급 수 기준. 인용 기준이 맞다면 한 줄 바꾸면 된다
- 판정 줄에 칸 이름을 흐리게 붙였다 — 브리프는 숫자만. 빼라면 뺀다
- 차트는 고정 viewBox 대신 잰 폭으로 그린다(390px 글자 크기 때문)
- 경쟁 추세선: 9/21 이 빠져서 9/22 점이 선과 떨어져 홀로 있다 — 의도대로(0 으로 안 메움)

## Out of Scope (logged in BUILD-LOG)
- `.ops-disclosure` 도 globals details 흰 배경 영향 가능성
- next dev 가 만드는 web/AGENTS.md · web/CLAUDE.md
- ops.ts 기존 리드 필터와 성장 칸 리드 기준 차이
