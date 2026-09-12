# Session Checkpoint — 2026-09-12
*Read this before reading anything else. If it covers current state, skip BUILD-LOG.*

---

## Where We Stopped (2026-09-12 오전 갱신)

아이로그 Step 1~8 전부 배포 완료. Richard 의 배포 후 검토까지 끝났고 후속 수정도 운영에 올라가 있다.

- **Must Fix 3건**(돈 새는 길) — cfbe688. 출결이 발신번호 확인 전에 잔액을 예약하던 것, 문자 로그 INSERT 가 던지면 잔액만 사라지던 것, 무제한 패스 학원에 없던 크레딧이 생기던 기출 분석 환불
- **요금 표기** — 2f869a5. 랜딩 AI 단가에 「1P=1원」 기준을 붙였다. 운영 확인
- **출결 죽은 분기** — 91c6ba3. `if (result)` 는 바로 위에서 만든 객체라 늘 참이었다. 동작 그대로
- **유령 환불 점검** — 기출 분석 경로 0건. 자동채점에서 1건(5/22, 무제한 학원 +120P) 나왔으나 `grading-service.ts:116` 가드가 붙기 전 기록이다. 회수하지 않고 기록만 남겼다
- **색인 알림** — IndexNow 로 아이로그 10쪽·학원 45쪽. Bing·네이버 둘 다 200
- **보안** — `.browser-profile/`(네이버·구글 로그인 쿠키 18MB)이 저장소 루트에 추적되지 않은 채 있었다. 67e96e1 로 막았다

## 다음 행동 (브라우저 로그인이 끝나는 대로)

원장이 `node tools/open-session.mjs` 로 로그인 중이다. **이 도구들은 전부 `.browser-profile` 을 쓴다 — 세션이 열려 있는 동안 같이 돌리면 충돌한다.** 끝난 뒤 순서대로:

1. `node tools/naver-sa-add-site.mjs https://ilog.ai.kr --verify` — 소유확인. 메타태그(`103285c0…acda13b`)는 운영 HTML 에서 확인했다. 캡차가 뜨면 사람이 10초
2. `node tools/naver-sa-submit.mjs https://ilog.ai.kr sitemap /sitemap.xml` — 사이트맵 200·10쪽 확인함
3. `node tools/naver-sa-submit.mjs https://robotncoding.com rss /rss.xml` — RSS 200·40건 확인함. 학원은 소유확인은 됐는데 제출이 비어 있었다(Yeti 커버리지 2.2% 의 원인)
4. `node tools/submit-gsc.mjs --client ilog` — 구글은 IndexNow 에 참여하지 않는다. 로그인 없으면 여기서 멈춘다

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
