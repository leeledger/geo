# Review Request — Step 54 (계약 뒤 순서) · 리뷰 1차 반영
Date: 2026-10-17
Ready for Review: YES
Status: DONE — 커밋·푸시·배포 안 함(오케스트레이터 지시)

## Round 2 — Richard FAIL 반영 (Arch D218~D220)
- web/lib/onboard-core.mjs — 기록표 주소 기본값을 https://cited.kr 로 바꿈(SITE, 입력.site). 세팅·구축이고 연 날이 있으면 30일을 연 날 ~ 연 날+29 로 셈(pilot-plan.mjs 파일럿일정 과 같은 셈). period·day30·다음 고비가 같은 끝 날을 씀. 확인파일보냄 줄은 일수·재촉 글을 안 만듦
- web/lib/onboard.ts — site: SITE_URL(web/lib/site.ts) 을 넘김
- web/lib/onboard-core.d.mts — admin?: string 을 site?: string 으로
- academy/scripts/test-onboard-core.mjs — 새 시험 2개(기록표 https://cited.kr/record/ · 확인파일보냄 일수 없음). 시험 3 에 낡은 started_on·ends_on 단언 추가
- 결과: test-onboard-core 18/0 · test-client-core 188/0 · test-clients 99/0 · tsc 0 · next build 성공. --live 는 지시대로 다시 안 돌림(아래 스크린샷은 1차 것)
- 확인 요청: Arch 메시지는 「launch+30」이었다. company.mjs(pilot-plan.mjs 파일럿일정)의 실제 셈은 시작+29(첫날 포함 30일)라서 그것을 따랐다

## Files Changed (Round 1)
- web/lib/onboard-core.mjs (new) — 착수순서(입력, 오늘): 7단계·줄 id 고정, needs_build 로 순서 갈림, 띠(취소·리허설·자사·환불·기준선 전 개시), 요약·다음 고비, 고객 기다림 일수·재촉 글, dns 세 갈래. onboard입력검사(폼 검사). 환불문장 = refundGuide 글자 복사
- web/lib/onboard-core.d.mts (new) — 타입
- web/lib/onboard.ts (new) — getOnboard(slug): 고객 행 · 파일럿 하나(취소·리허설 아닌 것 먼저) → getPilot 재사용 · 체크리스트() · 로그인 일감(.catch → "못읽음") · crawl_hits n7·last(build 만, seen_at)
- web/lib/onboard-actions.ts (new) — saveOnboard: 관리자 확인 · 코드 고객 거부 · 검사 실패 → ?err=onboard · jsonb_set 한 문장
- web/app/admin/clients/[slug]/onboard/page.tsx (new) — 화면. data-stage/data-row/data-state/data-who, 보낼글 textarea + CopyButton, gsc 줄 markGscGranted, 링크는 /admin·http(s) 만, #situation 폼, 코드 고객 안내 한 줄
- web/app/admin/clients/clients.css — .ob-* · .cl-line(끝 28줄). 720px 아래 칸·칩 한 줄 + 사람말 한 줄
- web/app/admin/clients/[slug]/page.tsx:96 — sub 줄에 「계약 뒤 순서」 링크(코드 고객 빼고)
- web/app/admin/clients/page.tsx:69-76 — 고객 줄마다 링크. 카드가 이미 Link 라 div.cl-line 로 감싸 옆에 둠(a 안에 a 금지)
- web/app/admin/clients/ClientForm.tsx:47 — 등록 모드 도메인 설명 한 줄
- academy/scripts/test-onboard-core.mjs (new) — 브리프 시험 1~15 + 요약·영문 상태값
- academy/scripts/test-onboard-screen.mjs (new) — --live 끝에서 끝(--out 폴더로 사진)
- academy/scripts/test-client-core.mjs — 고치기·바깥글config 가 config.onboard 를 남기는지 단언 2개

## Results
- node academy/scripts/test-onboard-core.mjs → 16 통과 · 0 실패
- test-client-core 188/0 · test-client-status 14/0 · test-clients 99/0
- web: node ./node_modules/typescript/bin/tsc --noEmit → 0 오류 · next build 성공
- node academy/scripts/test-onboard-screen.mjs --live → 27 통과 · 0 실패 (두 번 돌림, 마지막은 화면 정리 뒤). 시험 고객 id 17 지움 — client_id·pilot_id 표 30칸 남은 행 0 · slug 0
- 스크린샷(저장소 밖):
  - C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\4532bd60-6822-4139-9841-8e77d27995eb\scratchpad\onboard-test-1440.png
  - C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\4532bd60-6822-4139-9841-8e77d27995eb\scratchpad\onboard-test-390.png
  - C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\4532bd60-6822-4139-9841-8e77d27995eb\scratchpad\onboard-cited-1440.png
  - C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\4532bd60-6822-4139-9841-8e77d27995eb\scratchpad\onboard-cited-390.png

## Open Questions
- KG-54-7: 착수 뒤·기준선 보고 전 파일럿이면 띠에 refundGuide 문장 「195,000원(50%) 돌려드림」이 그대로 나와 % 가 보인다. D212(글자 같음)와 「화면 % 없음」이 부딪힌다. 지금은 D212 를 따랐고, 시험 12 는 착수 전 띠를 본다. Arch 판단 필요
- Claude 세션 몫이 아직 안 끝난 줄은 상태 「도는 중」으로 했다(상태 목록에 세션 몫이 따로 없음) — B54-1
- dns 모름 물음 글: 사이트가 있으면 send 줄에만, 구축 연 날 전엔 dns 줄에 둔다(B54-2)
- 자사·리허설엔 재촉 글을 안 만든다. cited 화면에서 고객 기다림 3이 보이는 건 리허설 실데이터(B54-4)
- onboard.ts 의 글자로(): pg date → 로컬 날짜, timestamptz → ISO. 기존 파일럿 화면 D()(toISOString)는 KST PC 에서 하루 당겨질 수 있다 — 범위 밖, 손 안 댐
- 시험 고객 이름 「착수시험고객」이 test-onboard-screen.mjs 안에 있다(test-client-screen 의 「화면시험고객」과 같은 방식). 실제 고객 이름은 아님

## Out of Scope (logged in BUILD-LOG)
- KG-54-1~6 그대로 · KG-54-7 새로 적음
