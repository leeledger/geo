# Review Request — Step 27 (운영 위생 D12~D16)
Date: 2026-09-30
Ready for Review: YES
Status: DONE (D12 는 설정 없음으로 건너뜀 — 아래)

## D12 리드 알림 — 코드 없음
- health.mjs 의 「메일」은 코드가 아니다. `.github/workflows/watch.yml` 이 health.mjs 종료코드 1 로 실패하면 GitHub 가 저장소 주인에게 보내는 실패 알림이다. 서비스·env 없음(저장소 전체에 nodemailer/resend/SMTP 0건).
- web Vercel env 이름만 확인(`npx vercel env ls`): ANTHROPIC_API_KEY, LLM_PROXY_TOKEN, OPENROUTER_API_KEY, GROQ_API_KEY, ADMIN_ID, ADMIN_PASSWORD, ADMIN_TOKEN, IP_HASH_SALT, DATABASE_URL. 메일 설정 없음.
- 그래서 설계서대로 건너뛰고 지금처럼 할 일로만(company.mjs 431·474 `lead-new`). KG-27-1.

## Files Changed
- academy/scripts/health.mjs:35-36 — llms.txt 검사를 `c.llmsTxt` 인 고객만 (D13)
- academy/clients.mjs:34-35, 66-67 — 학원·아이로그 `llmsTxt: true` (둘 다 /llms.txt 200 확인, 동작 불변)
- tools/submit-gsc.mjs:16-19, 24, 27-30 — SITE·PROP 하드코딩 → clients.mjs. `--client`/CLIENT_ID 없으면 CLIENTS[0](학원) = 예전과 같음 (D14)
- web/lib/pilot-intake.ts (새 파일) — makeQuestions(학원이면 옛 20문항 그대로 / 아니면 업종 무관), auditSources·auditFields(교육청·과정은 학원만), nextAlias(「고객 A/B…」, 빈 글자부터) (D15)
- web/lib/pilot-actions.ts:9, 16(삭제), 42-44, 50 — 위 함수 사용. alias 는 insert 값에만, on conflict 는 alias 안 건드림 → 기존 고객 불변
- web/app/admin/pilots/page.tsx:47, 51-52 — 등록 칸 이름 「학원명」→「상호」, 업종 칸 안내(학원 판별 말). 관리 화면만, 공개 문구 아님
- academy/scripts/company.mjs:183-189 — ensure 에서 geo.client_hours 생성 + RLS (D16)
- web/db/schema.sql:169-178 · academy/db/schema.sql:166-175 — geo.client_hours 같은 줄
- web/lib/hours-actions.ts:14 — 주석만(입력 때 DDL 은 company 가 돌기 전 대비로 둠)

## 확인
- 순수 함수 시험 13개 통과(scratchpad, node --experimental-strip-types): 학원 20문항이 HEAD 의 makeQuestions 와 deepEqual(수학학원·코딩학원), 치과 20문항에 학원|수업|체험|교육청|배우 없음, 브랜드 3문항 끝, 출처 4/3·칸, 별칭 A → 빈 곳 B → 26개 뒤 AA
- submit-gsc 고르기 가짜 실행: 기본 → robotncoding.com / sc-domain:robotncoding.com, `--client ilog` → ilog.ai.kr
- health URL 목록: 두 고객 모두 llms.txt 포함(예전과 같음)
- node --check health·company·submit-gsc, web tsc 0. DB 쓰기·실측정·배포 안 함

## Open Questions
- 학원 판별이 업종 칸 글자(`/학원|교습소|공부방/`)다. 「수학」처럼 과목만 쓰면 일반 문장으로 간다 — 그래서 칸 안내를 바꿨다. 칸을 따로 둘지 Arch 판단
- 일반 20문항 문구(pilot-intake.ts 27-31)는 제가 지었다. 「오래 운영한 곳」「설명을 잘해주는 곳」 같은 말이 괜찮은지 봐 주세요
- 「로봇교실」은 학원으로 안 친다(요가교실 같은 오판 방지). 교육청 등록 로봇교실이면 업종에 「로봇학원」을 쓰게 해야 한다
- 별칭 동시 등록 경쟁(같은 글자)은 막지 않았다 — 관리자 1인

## Out of Scope (logged in BUILD-LOG)
- KG-27-1 리드 알림 메일 설정 없음(원장 몫)
- KG-27-2 기존 외부 고객 alias 옛 문구 — DB 한 번 수정 필요
- KG-27-3 write-draft 인격 고정
- KG-27-4 신청서 「과정·대상」 문구
- KG-27-5 client_hours RLS 새로 켜짐
