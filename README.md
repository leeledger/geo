# AGO / GEO — AI 답변 노출 측정

ChatGPT·Gemini·Claude·Perplexity 답변에 브랜드가 인용되는지를 **표본과 신뢰구간까지 붙여** 측정하고,
원인이 자사 사이트인지 제3자 문서인지 가려내는 도구 모음.

## 구성

```
web/      Next.js 앱 — 랜딩페이지 + 무료 진단 + 리드 수집
probe/    측정 하니스 (CLI, 의존성 0)
research/ 시장 조사
```

## web — 랜딩 + 무료 진단

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

> 프로젝트 경로에 `&` 가 있으면 Windows에서 `node_modules/.bin` 셸 심이 깨진다.
> `package.json` 스크립트는 `node ./node_modules/next/dist/bin/next` 로 우회해 둠.

**환경변수** — `.env.example` 참조. Supabase 키가 없으면 `.data/*.jsonl` 파일 폴백으로 동작한다(개발 전용).
배포 전 `web/supabase/schema.sql` 을 실행하고 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 를 설정할 것.

## probe — 측정 하니스

```bash
cd probe
node src/scan.js example.co.kr              # 사이트 GEO 진단 (키 불필요)
node src/rank-enrich.js                     # 검색 상위 문서의 브랜드 구성 확인
node src/analyze.js --search-only           # 검색 측 분석

# AI 측 (수동 수집 경로 — API 키 불필요)
node src/manual-import.js --engine chatgpt
node src/extract-rules.js --engine chatgpt
node src/analyze.js --engine chatgpt

# 통합 진단
node src/diagnose.js <brand_id> --engine websearch
node src/render-report.js <brand_id>
```

자세한 사용법은 [`probe/README.md`](probe/README.md).

## 측정 결과 (2026-09, 자체 측정)

| 항목 | 값 | 표본 |
|---|---|---|
| 검색 순위로 설명되지 않는 AI 노출 | 43.7% | 프롬프트 12개 · 실행 15회 |
| 같은 질문 반복 시 브랜드 집합 변동 | 27.8% | 반복 3문항 |
| 사이트 GEO 점수의 AI 노출 설명력 | 20.4% | 브랜드 21곳 · 실행 8회 |
| 사이트 점수 60점 이상 | 5 / 26곳 | 도메인 26개 스캔 |

**전부 표본이 작다.** 방향 신호이지 확정치가 아니며, 대외 발행 전 표본 확대가 필요하다.
