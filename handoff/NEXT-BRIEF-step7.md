# Architect Brief (초안) — Step 7
*우선순위 높음 — Step 3 배포 직후 바로 한다 (공개 문구가 광고하는 기능이 운영에서 깨져 있다).*

---

## Step 7 — 아이로그 기출 분석이 단종 모델로 실패하고 크레딧만 빠진다 · 에이전트 챗 기본 모델 단종 (KG-3, KG-16)

저장소: `C:\dev\자동피드백생성기`.

### 지금 문제 (Arch 확인, 2026-09-12)
- Groq 모델 목록(`GET https://api.groq.com/openai/v1/models`, 9.12 조회) 14개 — **비전 모델이 하나도 없다.** `meta-llama/llama-4-scout-17b-16e-instruct` 없음, `llama-3.3-70b-versatile` 없음. 남은 것: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.6-27b`, `qwen/qwen3.8-27b`, `groq/compound`, `groq/compound-mini` 등
- **기출 분석(KG-16)** `app/api/exams/route.ts:62-116` — `deductAiCredit(EXAM_ANALYZE=100)` 을 먼저 하고 `groqClient.analyzeExamPaper`(`lib/ai/groq-client.ts:283-396`, 모델 `:287` llama-4-scout) 를 부른다. 모델이 없으니 던지고, **환불이 없다.** 원장은 분석을 누를 때마다 100P 를 잃고 기출이 쌓이지 않는다 → 「학교별 기출로 예상 문제」 기능 전체가 막힌다
- **에이전트 챗(KG-3)** `app/api/agent/chat/route.ts:15` 기본 모델 `llama-3.3-70b-versatile`, `:18-25` `LIVE_GROQ_MODELS` 에 단종 모델이 들어 있어 폴백도 단종 모델로 간다
- 이미 운영 중인 Claude Vision 경로가 있다: `lib/ai/claude-client.ts:624-690` `callClaudeVision`(1회 재시도, base64 + mime), 자동채점·답안지 정답 추출이 쓴다. 운영 환경변수에 `ANTHROPIC_API_KEY` 있음
- 환불 헬퍼: `chargeAiCredit(academyId, userId, amount, memo)` — 출제 실패 환불에 이미 쓴다(`exams/route.ts:186-190,209-214`)

### Decisions (Arch, 원장 위임)
- 기출 분석을 **Claude Vision 으로 옮긴다.** `claudeClient.analyzeExamPaper(images, metadata)` 를 새로 만들고 `callClaudeVision` 을 쓴다. 출력 JSON 모양은 지금 groq 판과 같게(`school_name`, `exam_info`, `analysis{total_questions,difficulty_breakdown,key_concepts,trend_summary}`, `questions[]{number,content,choices,answer,explanation,difficulty,concepts}`) — 뒤따르는 저장 코드(`exams/route.ts:111-140`)를 안 바꾸려고
  - 이미지는 DB 에 data URL 또는 순수 base64 로 들어 있다. data URL 이면 mime 을 거기서, 아니면 `image/jpeg`
  - 한 번에 넣는 장수는 자동채점과 같은 상한을 쓴다(`grading-service` 의 제한 확인). 넘으면 나눠 부르고 questions 를 이어 붙인다 (지금 groq 판의 배치 방식과 같음)
  - JSON 파싱 실패는 에러로 던진다
- `exams/route.ts` analyze 분기: 분석 호출을 try/catch 로 감싸 **실패하면 100P 환불**(`chargeAiCredit`, 메모 「환불: 기출 분석 실패」), `ai_analysis_status` 를 `'failed'` 로 남기고(컬럼·허용값 확인, 없으면 건드리지 않음), 사용자에게 원문 오류 대신 「기출 분석에 실패했습니다. 크레딧은 돌려드렸습니다. 다시 시도해 주세요.」. 원본 base64 는 실패 시 **지우지 않는다**(재시도 가능해야 함)
- `groqClient.analyzeExamPaper` 는 지우지 말고 `@deprecated` 주석 (롤백 안전, 기존 `generateMockExam` 과 같은 관례)
- 에이전트 챗: `DEFAULT_MODEL` 기본값 `openai/gpt-oss-120b`, `LIVE_GROQ_MODELS` 에서 `llama-3.3-70b-versatile`·`llama-3.1-8b-instant` 등 목록에 없는 모델 제거 (9.12 조회 목록 기준). `AGENT_MODEL` 환경변수는 운영에 없음
- 비용 단가(`AI_COSTS.EXAM_ANALYZE=100`)는 그대로 — 가격 결정은 이번 범위 밖

### Build Order
1. `lib/ai/claude-client.ts` — `analyzeExamPaper`
2. `app/api/exams/route.ts` — 분석 호출 교체, 실패 환불·상태·문구
3. `lib/ai/groq-client.ts` — deprecated 주석
4. `app/api/agent/chat/route.ts` — 기본 모델·목록
5. `npm run build`

### Flags
- Flag: 실제 Claude·Groq API 호출 테스트는 하지 않는다(과금·저작권 이미지). 코드 경로·타입으로 확인. 순수 함수(mime 판별, 배치 나누기, JSON 병합)는 로컬 스텁으로 확인해도 된다
- Flag: 프롬프트는 groq 판의 요구(순수 JSON, 필드)를 그대로 옮기되 Claude 에 맞게 「JSON 만 출력」을 분명히
- Flag: DB 스키마 변경·커밋·푸시·배포 금지

### Definition of Done
- [ ] 분석이 `claudeClient.analyzeExamPaper` 를 부르고 출력 모양이 저장 코드와 맞음
- [ ] 분석 실패 시 100P 환불·원본 유지·사용자 문구
- [ ] 에이전트 기본 모델·허용 목록에 단종 모델 없음
- [ ] `npm run build` 성공
