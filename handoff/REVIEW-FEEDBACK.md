# Review Feedback — Step 35 (D52~D56) + 2판
Date: 2026-10-02
Ready for Builder: YES

범위: git diff 130c47c..5e54bec. 확인: test-marketing 38 통과 · web tsc 0. DB 쓰기·Claude 호출·게시 없음.

## Must Fix
없음.

## Should Fix
- web/lib/marketing.ts:66 vs academy/scripts/pilot-report.mjs:311 (confidence: 7/10) — 같은 「AI 답 출처로 쓰였나」를 다른 칸으로 묶는다. 현황판은 `select m.engine, …`(모델별), 리포트는 `m.collection_method as engine`(곳별). 한 모델을 두 곳에서 재면 카드와 리포트의 「곳별 n개」가 달라진다. 영업에 나갈 숫자다. 둘 중 하나로 맞추기 — 리포트 관례(곳 = collection_method, 곳이름)를 따르는 쪽을 권한다. 합계 used/posted 는 같으니 지금은 고장이 아니다.
- academy/scripts/marketing-draft.mjs:220 (confidence: 5/10, verify) — 바깥 주소 관문 `p.바깥.some((h) => h.startsWith(u) || u.startsWith(h))`. 근거 페이지의 바깥 링크가 도메인 뿌리(예: https://www.gov.kr)면 그 도메인의 어떤 경로든 통과한다. 지어낸 깊은 주소가 새는 길이다. 정확히 같거나 끝 `/` 차이만 허용하도록 normUrl 비교로 좁히기.
- web/lib/marketing-actions.ts:47 (confidence: 6/10) — approveBlog 가 note 를 통째로 「게시 승인 …」으로 바꿔 「읽을 자리」 기록이 사라진다(marketing-core 주석상 의도). 나중에 「무엇을 읽고 승인했나」를 되짚을 수 없다. `'게시 승인 ' || to_char(…) || ' · ' || note` 로 앞에 붙이면 local-agent·naver-blog-post 의 `like '게시 승인%'` 는 그대로 돈다. 단 readSpots 가 SPOT_HEAD 로 시작할 때만 읽으니 카드 표시는 바꿀 필요 없음.
- tools/local-agent.mjs:191-194 (confidence: 6/10) — 「발행 전에 멈춤」은 시도를 닫힘으로 두어 다음 실행에 다시 시도한다. 원인이 고정(본문 서식 오류 등)이면 하루 두 번, 끝없이 실패 활동이 쌓인다. 같은 초안 닫힘 n회(예: 3) 넘으면 사람 대기로 올리기. BUILD-LOG 로 미뤄도 된다.
- tools/local-agent.mjs:186-188 (confidence: 5/10) — 사람이 확인 뒤 SQL 로 marketing_posts 를 「올림」으로 고치면 시도 일감이 「사람 대기」로 영영 남는다(sticky). 다음 실행에서 `status='올림'` 인 초안의 열린 marketing-attempt 를 완료로 닫는 한 줄이면 된다.

## Escalate to Architect
- 블로그 게시 승인을 note 앞머리로 둘지, 칸(approved_at)으로 둘지 — Bob 이 열어 둔 질문. 코드상 안전은 확인했다: 승인 표시를 쓰는 길은 approveBlog(guard + `status='초안' and channel='blog'`) 하나뿐이고, 초안 스크립트의 note 는 「읽을 자리: 」 또는 「자동 관문 탈락: 」로만 시작해 모델 출력이 승인으로 둔갑할 길이 없다. 그래도 note 는 자유 글 칸이라 사람이 손으로 고칠 때 우연히 승인이 될 수 있다. 칸으로 바꿀지는 Arch 결정.
- 「읽었어요 · 올려 주세요」 버튼이 본문 펼치지 않고도 눌린다. 사실 확인을 강제할지(펼친 뒤에만 활성) 제품 판단.

## Cleared
관문(숫자·규격 단위·사이트맵·바깥 주소·다른 방법·공개 문장)과 읽을 자리, 블로그 자동 게시의 이중 승인 확인(local-agent 선택 쿼리 + naver-blog-post 읽기 쿼리 둘 다 `note like '게시 승인%' and status='초안'`), NAVER_BLOG_ID 없으면 멈춤(.env.local 로딩 전에 검사해 학원 블로그 force11 로 새지 않음)·학원 꼬리 미부착·별도 프로필, 발행 버튼 뒤 실패는 사람 확인으로, marketing-actions 세 동작 모두 guard, optimize.yml 의 continue-on-error 와 `always() &&` 측정 실패 표시, KST 처리(오늘·created_on·posted_day·승인 시각), ai_measurements 는 읽기만(학원·아이로그 리포트는 올린 글이 없어 절이 안 생김, case-report 무변경), PIPES 3=docttak, dry 가 insert/create/alter 를 막고 claude-code 기록은 insert 뿐인 것까지 확인했고 통과다.
