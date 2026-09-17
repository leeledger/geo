# Session Checkpoint — 2026-09-12
*Read this before reading anything else. If it covers current state, skip BUILD-LOG.*

---

## Where We Stopped (2026-09-17 갱신)

후속으로 영업·상담 마감 고리를 구현했다.

- 운영 대시보드에 `성과 담당` 직원을 추가. 최근 30일 무료 진단→리드 전환율, 새 리드, 등록 결과 미입력을 자기 업무로 보유
- 문의 화면에서 결과 미입력 건을 경고하고 `등록`·`안 함`으로 즉시 종결 가능
- 리드 큐에서 `새 문의 → 연락함 → 상담 대상 → 계약/종료` 상태 갱신 가능
- 무료 진단 CTA를 막연한 “AI 4곳 리포트”에서 진단 결과 기반 `30일 실행안 3가지`로 변경
- 진단 리드는 도메인·점수·유입 경로와 함께 저장돼 다시 설명할 필요가 없음

로봇&코딩학원 자사 실증을 기술 점수에서 실제 AI 답변·문의까지 잇는 작업을 완료했다.

- AI 측정 원본 표 `academy.ai_measurements`와 범용 import 스크립트 추가
- 09.10 Claude Code WebSearch 기준선 0/8을 DB에 복구
- 09.17 ChatGPT 비로그인 소비자 화면 부분 재측정: 지역 질문 2/2 학원 언급, 1/2 공식 사이트 직접 링크
- 엔진·방법·표본이 달라 개선률로 합치지 않도록 판정과 대시보드에 경고 표시
- 케이스 보고서를 고객사 1번 데이터로 한정. 기존 고객사 혼합 오류 제거
- 정찰의 브랜드 오경보 수정: 어느 엔진에서든 잡힌 질의는 전체 미노출로 경고하지 않음
- 문의 집계를 선택한 고객사로 한정
- 「오늘 한 일 · 마감분」을 「오늘의 운영 기록 · 자동 저장」으로 바꿔 의미를 명확히 함
- 사업성 검증 문서: `research/business-validation-2026-09-17.md`

현재 판정: 검색·플레이스·크롤러 진척은 있음. AI 인용 개선과 문의·등록 기여는 아직 미증명.
다음 핵심 증거는 같은 ChatGPT 조건 8개 이상 재측정과 기존 문의 2건의 등록 결과다.

---

## 이전 체크포인트 (2026-09-12)

아이로그 Step 1~8 전부 배포 완료. Richard 의 배포 후 검토까지 끝났고 후속 수정도 운영에 올라가 있다.

- **Must Fix 3건**(돈 새는 길) — cfbe688. 출결이 발신번호 확인 전에 잔액을 예약하던 것, 문자 로그 INSERT 가 던지면 잔액만 사라지던 것, 무제한 패스 학원에 없던 크레딧이 생기던 기출 분석 환불
- **요금 표기** — 2f869a5. 랜딩 AI 단가에 「1P=1원」 기준을 붙였다. 운영 확인
- **출결 죽은 분기** — 91c6ba3. `if (result)` 는 바로 위에서 만든 객체라 늘 참이었다. 동작 그대로
- **유령 환불 점검** — 기출 분석 경로 0건. 자동채점에서 1건(5/22, 무제한 학원 +120P) 나왔으나 `grading-service.ts:116` 가드가 붙기 전 기록이다. 회수하지 않고 기록만 남겼다
- **색인 알림** — IndexNow 로 아이로그 10쪽·학원 45쪽. Bing·네이버 둘 다 200
- **보안** — `.browser-profile/`(네이버·구글 로그인 쿠키 18MB)이 저장소 루트에 추적되지 않은 채 있었다. 67e96e1 로 막았다

## 다음 행동 (로그인이 저장돼야 시작된다)

**9.12 오전 시도는 로그인이 저장되지 않아 못 했다.** `open-session.mjs` 는 「✓ 네이버 로그인 확인」을 찍었지만,
창을 닫은 뒤 `check-session.mjs` 는 구글·네이버 둘 다 「로그아웃」이라고 한다(쿠키는 15개 남았다).
**「로그인 상태 유지」를 켜지 않으면 창을 닫을 때 세션이 사라진다** — open-session 이 띄우는 경고 그대로다.
다시 할 때는 그 체크박스를 켜고, 끝나면 `node tools/check-session.mjs` 로 ✓ 두 개를 먼저 확인한다.

도구는 전부 `.browser-profile` 을 배타적으로 잡는다 — 병렬로 돌리면 프로필 잠금에 걸린다. 한 번에 하나씩:

```
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"   # Git Bash 면 반드시 (아래 주의)
```

1. `node tools/naver-sa-add-site.mjs https://ilog.ai.kr --verify` — 소유확인. 메타태그(`103285c0…acda13b`)는 운영 HTML 에서 확인했다. 캡차가 뜨면 사람이 10초
2. `node tools/naver-sa-submit.mjs https://ilog.ai.kr sitemap /sitemap.xml` — 사이트맵 200·10쪽 확인함
3. `node tools/naver-sa-submit.mjs https://robotncoding.com rss /rss.xml` — RSS 200·40건 확인함. 학원은 소유확인은 됐는데 제출이 비어 있었다(Yeti 커버리지 2.2% 의 원인)
4. `node tools/submit-gsc.mjs --client ilog` — 구글은 IndexNow 에 참여하지 않는다. 로그인 없으면 여기서 멈춘다

**주의 — 2·3번이 사용법만 찍으면 로그인 문제가 아니다.** Git Bash 가 `/sitemap.xml` 을
`C:/Program Files/Git/sitemap.xml` 로 바꿔 인자 검사에서 걸린 것이다. 위 `export` 를 빠뜨린 것 (9.12 에 당했다).
스크린샷은 `SHOT_DIR` 로 스크래치패드에 보낸다 — 기본값이 `cwd` 라 저장소 루트에 PNG 가 쌓인다.

---

## What Was Decided This Session

- 배포 게이트 상시 승인(원장). Richard 통과 + 운영 주소 확인이면 배포 후 보고
- **KG-2(7일 체험 만료)는 구현하지 않는다.** 지금 만료 검사를 켜면 `trial_ends_at` 이 없는 기존 학원이 한꺼번에 잠긴다. 쓰고 있는 학원을 말없이 막는 일이라 코드로 정할 게 아니다 — 원장이 기준을 정하면 넣는다
- Groq 모델 목록은 코드에 두되 `AGENT_MODEL` 환경변수도 허용 목록 검사를 거친다. 기동 시 `/models` 조회는 넣지 않는다
- 운영판 고리 애니메이션은 `prefers-reduced-motion` 을 무시한다 — 원장 PC 의 Windows 「애니메이션 효과」 꺼짐 때문에 멈춰 보였다 (d062c20)
- 아이로그 공개 문구는 코드 사실만. 홈페이지 마케팅 문구를 근거로 쓰지 않는다 (거짓 3건을 실어 보낸 뒤 만든 규칙)

## 도구 메모

- `tools/bing-webmaster-look.mjs` 는 이름과 달리 빙 웹마스터 지표를 보지 않는다. 사이트를 직접 열어 찍을 뿐이다. 빙 색인 확인에 쓰지 말 것
- 아이로그 배포는 `git push` 로 안 된다. `npx vercel --prod --yes`. 커밋 author 는 `71445292+leeledger@users.noreply.github.com`

---

## 남은 Known Gaps

- **KG-2** — 체험 만료 미동작. 위 판단대로 남긴다
- **KG-13** — 수납 안내 알림톡 템플릿이 등록돼 있지 않다. 원장이 카카오 채널에서 등록하면 `sendOneMessage`(ALIMTALK) 에 잇는다
- **KG-17** — 환불 정책 없음. 충전 잔액·무제한 이용권 중도 해지 기준을 원장이 정해야 약관에 넣는다

## 사람만 할 수 있는 일

1. 네이버 서치어드바이저 소유확인 캡차 (ilog.ai.kr)
2. 구글 로그인 — 아이로그 색인 요청이 여기서 막혀 있다
3. 수납 알림톡 템플릿 등록 (KG-13) · 환불 기준 (KG-17)
4. 다음 주 발행글 초안의 문장 2개 사실 확인 — 확인되면 도해·발행·네이버 이관까지 이어서 한다

---

## Resume Prompt

---

You are Arch on 사이티드(Cited) · AGO&GEO.
Read handoff/SESSION-CHECKPOINT.md, then ARCHITECT.md.
Confirm where we stopped and what the next action is. Then wait.

---

## Version Check
version_notified: v1.3.0

---

## 현재 체크포인트 (2026-09-17)

사이티드 첫 고객 유치를 위한 `/admin/outreach` 영업판을 구현했다. 송파·강동 후보 10곳은 공개 정보로만 사전 선별했으며, 원장 직접 상담·월 문의 5건 이상·단일 지점은 전화로 확인해야 한다. 우선순위 1은 넥스탑코딩정보보안학원, 헬로알고학원, 로보로보코딩랩학원이다. 다음 사람 행동은 영업판의 통화문으로 세 곳에 전화하고, 각 결과와 다음 행동을 바로 저장하는 것이다.

## 현재 체크포인트 (2026-09-17 · 매일 개선 루프)

로봇앤코딩은 자사 실증 파일럿(20문항·19업무)으로 등록됐다. 질문 20개는 승인 상태다. `optimize.yml`이 매일 07:05 병목을 만들고 Codex heartbeat가 07:20 실제 개선 작업을 수행한다. 오늘의 병목은 최신 AI 측정 2건으로 기준선 40건(20문항×2회)에 미달한 것이다. 대시보드 개선 담당이 이 실행 원장을 표시한다.
