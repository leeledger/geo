# AGO/GEO 실증 프로브

**답하려는 질문:** AI 답변에 등장하는 브랜드는 검색 순위로 얼마나 설명되는가?
설명되지 않는 부분(잔차)이 GEO 서비스의 시장이다. 잔차가 10% 미만이면 이 사업은 SEO 대행의
재포장이고, 30%를 넘으면 독립 상품으로 성립한다.

의존성 없음. Node 22+ 만 있으면 된다.

---

## 파이프라인

```
prompts/erp-kr.json          측정할 질문 50개 + 브랜드 유니버스(별칭 포함)
        │
        ├─ src/run.js         프롬프트 × 엔진 × 반복 실행 → data/responses.<engine>.jsonl
        │                     (실시간 웹 검색을 켠 채로 호출한다. 끄면 실험이 성립하지 않는다)
        │
        ├─ src/extract-run.js 답변 원문 → 구조화된 브랜드 언급 → data/mentions.<engine>.jsonl
        │
        ├─ src/rank-enrich.js 검색 상위 문서를 실제로 열어 브랜드 구성 확인 (키 불필요)
        │
        └─ src/analyze.js     상관·잔차 계산 → data/report.<engine>.json / .txt
```

## 실행

경로가 둘이다. **키가 없으면 A**, 자동화가 필요해지면 B.

### A. 수동 수집 — API 키 불필요 (권장 시작점)

웹 UI 답변은 API 응답과 다르다. 자체 시스템 프롬프트·검색 설정·개인화가 얹히기 때문이다.
잠재고객이 실제로 보는 화면을 재는 것이므로 **측정 목적으로는 이쪽이 더 정확하다.**

```bash
# 0) 검색 쪽 먼저 (키 불필요)
node src/rank-enrich.js
node src/analyze.js --search-only

# 1) 수집 워크벤치에서 질문을 복사해 엔진에 넣고 답변을 붙여넣는다
#    → "JSON 만들기" → 복사 → data/manual.chatgpt.json 로 저장

# 2) 파이프라인에 넣는다
node src/manual-import.js --engine chatgpt
node src/extract-rules.js --engine chatgpt    # 규칙 기반 추출, 키 불필요
node src/analyze.js --engine chatgpt
```

수집 규모는 **프롬프트 20개 × 2회차 × 엔진 2개 = 80건**이면 방향이 보인다.
50개 전부는 필요 없다. 다만 **회차는 반드시 2 이상** — 재현성이 이 실험에서 가장 설득력 있는 숫자다.

### B. API 수집 — 자동화가 필요할 때

고객 여러 곳을 주간으로 돌리는 단계에서는 수동이 불가능해진다.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node src/run.js --dry-run --repeats 3     # 규모·비용만
node src/run.js --limit 2 --repeats 1     # 스모크
node src/run.js --repeats 3               # 150 호출, 약 $1.5
node src/extract-run.js
node src/analyze.js
```

`run.js` 는 이미 수집한 조합을 건너뛴다. 중간에 죽어도 다시 돌리면 이어서 간다.

### 두 경로의 차이

| | 수동 (A) | API (B) |
|---|---|---|
| 노출률·점유율·서열·인용률 | 동일하게 정확 | 동일 |
| 추천 강도(stance) | 휴리스틱 — 참고용 | LLM 추출 |
| 속성 연상 | 측정 안 함 | 측정 |
| fan-out (내부 검색 쿼리) | **측정 불가** | 측정 |
| 측정 대상 | 소비자가 실제 보는 화면 | API 응답 |
| 규모 | 사람 시간에 비례 | 무제한 |

### 주요 옵션

| 옵션 | 의미 |
|---|---|
| `--engine anthropic\|openai\|gemini\|perplexity` | 대상 엔진 |
| `--repeats N` | 프롬프트당 반복 횟수. **2 이상이어야 재현성을 측정할 수 있다** |
| `--limit N` | 앞에서 N개 프롬프트만 |
| `--stage problem\|discovery\|comparison\|intent\|brand` | 퍼널 단계만 |
| `--concurrency N` | 동시 실행 (기본 4) |
| `--dry-run` | 호출 수·예상 비용만 출력 |

### 환경 변수

| 변수 | 기본값 | 비고 |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | 필수. 엔진 호출과 추출 양쪽에 쓰인다 |
| `ANTHROPIC_MODEL` | `claude-opus-5` | 측정 대상 모델 |
| `EXTRACT_MODEL` | `claude-opus-5` | 추출 단계. `claude-haiku-4-5` 로 바꾸면 이 단계 비용이 크게 준다 |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` / `PERPLEXITY_API_KEY` | — | 해당 엔진 사용 시 |

---

## 읽는 법

`analyze.js` 가 내는 숫자 중 결론에 해당하는 것:

| 값 | 의미 |
|---|---|
| **Spearman ρ** | AI 노출량과 검색 가시성의 순위 상관 |
| **잔차 (1−ρ²)** | 검색으로 설명되지 않는 비율. **이게 시장 규모다** |
| **top-10 밖 언급 비중** | 검색 상위에 없는 브랜드가 AI 답변에서 차지한 몫 |
| **순위 역전** | 검색 1위 브랜드와 AI 1순위 브랜드가 다른가 |
| **재현성 (Jaccard)** | 같은 질문을 반복했을 때 브랜드 집합이 얼마나 일치하는가. 낮으면 1회 조회 기반 리포트는 소음이다 |
| **fan-out** | 사용자 질문 1개가 검색 쿼리 몇 개로 분해되는가 |

---

## 알려진 한계

- **검색 순위가 실제 SERP 가 아니다.** 검색 도구가 반환한 결과 순서를 근사치로 쓴다.
  절대 순위가 아니라 상대 순위로만 읽어야 하고, 개인화·지역화가 빠져 있다.
  정밀하게 하려면 SerpAPI 같은 SERP 수집기를 붙여 `data/rankings.json` 을 교체할 것.
- **미검증 어댑터.** `anthropic` 외 세 어댑터는 키가 없어 한 번도 실행해보지 못했다.
  요청/응답 형태가 실제와 다를 수 있으므로 `--limit 1` 로 한 건 먼저 돌려 파서를 확인할 것.
  파싱이 틀리면 "언급 0건"으로 조용히 기록되어 결과 전체를 왜곡한다.
- **표본.** 프롬프트 50개·반복 3회는 방향을 보기 위한 최소 규모다. ρ 는 표본이 작으면 크게 흔들린다.
- **`data/manual.testrun.json` 은 합성 데이터다.** 파이프라인 점검용으로 손으로 쓴 가짜 답변이며
  실측이 아니다. 여기서 나온 ρ·잔차는 아무 의미가 없다. 실제 수집 전에 지워도 된다.
- **버티컬 1개의 결과는 그 버티컬의 것이다.** 다른 카테고리로 일반화하지 말 것.
  프롬프트 파일을 바꿔 최소 2~3개 버티컬에서 재현되는지 확인해야 한다.

## 다른 버티컬로 바꾸기

`prompts/` 에 같은 형식의 JSON 을 하나 더 만들고 `--prompts prompts/<파일>.json` 으로 지정한다.
필요한 것은 `brand_universe`(별칭 포함), `fanout_queries`, `prompts` 셋이다.
별칭 목록이 부실하면 언급을 놓친다 — `extract-run.js` 가 유니버스 밖 브랜드를 따로 출력하니
그걸 보고 채워 넣을 것.
