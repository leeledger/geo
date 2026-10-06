# Review Feedback — Step 39 (39a·39b·39c) · 2026-10-06 · Ready for Builder: NO
## Must Fix
- tools/login-poll.mjs (기다림 note) + web/lib/login-core.mjs 오래된창요청닫기 (9/10) — note 를 쓸 때 `update geo.agent_tasks set last_error=$2 where id=$1` 이라 updated_at 이 그대로다. 그런데 닫기는 `status='로컬 대기' and updated_at < now() - interval '30 minutes'` 를 「PC 가 꺼져 있어 창을 못 열었습니다」로 실패 처리한다. local-agent 는 최대 90분 돈다. 그래서 PC 가 켜져 있는데도 30분 뒤 거짓 문구가 뜨고 요청이 버려진다(브리프의 「끝나면 엶」이 깨진다). 고칠 것: 기다리는 동안 매 poll 마다 `updated_at=now()` 를 함께 쓴다(PC 가 꺼지면 poll 이 없으니 30분 판정은 그대로 산다). 시험: 31분째 기다림 행은 닫히지 않는다.
## Should Fix
- 「.local-agent.lock 신선하면 프로필과 상관없이 기다림」 — 타당하다(프로필 기록이 없으니 충돌보다 늦게 뜨는 쪽이 낫다). 위를 고치면 최대 90분 늦을 수 있다. 이 사실을 BUILD-LOG 에 적는다.
- marketing-draft 관문에 「다른 고객 이름」 검사가 없다(5/10). 프롬프트에 c.name 만 들어가니 지금은 위험이 낮다. KG 로 적는다.
## Cleared
39a: 사실은 config.marketing.facts 에서만 온다. 비면 Claude 호출 0, 종료코드 0. 스냅샷은 export 된 프롬프트·관문·사실줄을 그대로 거친다. 다시 돌려 보니 같다(6242자). 39b: requestLogin 에 isAdmin 이 있다. 사람 대기 login-* 만 받는다. 프로필·sites 는 창요청검사 정규식과 화이트리스트로 거른다(블로그 경로는 고객 slug 에서). 잠금 순서, 종료코드 3, loginBusy 분리, 옛 작업 3개만 끄는 것 확인. test-login 56 통과. 39c: 권한판정은 늘 「모름」이고 config.gsc 는 「있음」일 때만 켜진다. 점검저장은 gscAccess 만 살리고 나머지 derived 는 예전처럼 둔다.

## 2차 (21a540e) · Ready for Builder: YES
- Must Fix 닫힘: 기다림 note 가 `set last_error=$2, updated_at=now() where id=$1 and status='로컬 대기'` 로 바뀌었다. 새 시험 「31분째 기다리는 행은 안 닫힘」과 「poll 끊긴 31분 행은 닫힘」 둘로 양쪽 길을 덮는다. test-login 56 통과.
- 새로 깨진 것 없음. poll 은 `order by updated_at` 이라 기다리는 행이 뒤로 돌아 다른 요청이 먼저 집힌다. 해가 아니라 득이다. 창 잠금 때문에 끝나는 길은 갱신을 안 하지만 그 창은 13분 상한이라 30분 판정에 안 걸린다. BUILD-LOG 기록 확인.
