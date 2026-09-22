# Review Feedback — 랜딩 대체값 494bbc4 · Step 14a 수정 3853b31 · Step 14b fb324d0 · 보안 93fb90f
Date: 2026-09-23
Ready for Builder: NO
(전부 이미 배포됨)

## Must Fix
1. **web/lib/admin-auth.ts `isAdmin` — 비밀이 없으면 관리 화면 전체가 열린다.**
   `const s = secret(); if (!s) return true;` 는 로컬 개발 편의로 둔 것이다. 그런데 운영에서 ADMIN_PASSWORD·ADMIN_TOKEN 이 둘 다 빠지면(환경변수 이름 실수, 새 Vercel 프로젝트, BOM 이 붙은 값을 지운 뒤 재등록 전 등) 모든 서버 동작·/api/admin/*·7개 화면이 로그인 없이 열린다. 오늘 서버 동작 11개에 guard 를 단 이유가 이 한 줄로 무너진다.
   고치는 법: `if (!s) return process.env.NODE_ENV !== "production";`. 운영에서 비밀이 없으면 닫힌다. `credentialsOk` 는 이미 닫혀 있다. 이번 커밋이 만든 문제는 아니지만 이번 보안 수정의 전제라 여기서 막는다.

## Should Fix
- **web/lib/admin-actions.ts `signIn` — `redirect(String(form.get("to")))` 를 검사하지 않는다.** 로그인 화면이 dest 를 걸러서 넘기고, Next 서버 동작은 출처 검사를 하니 지금은 뚫기 어렵다. 그래도 enter/route.ts 와 같은 규칙(`/^\/admin(\/|$|\?)/` + `//` 거부)을 여기에도 건다. 규칙을 한 함수(`safeAdminPath`)로 모아 login·enter·signIn 이 같이 쓴다.
- **쿠키 값이 영구 고정이다.** `cookieValue() = HMAC(secret, adminId)` 라 늘 같은 값이다. maxAge 12시간은 브라우저 쪽 만료일 뿐이다. 쿠키가 한 번 새면 비밀을 바꿀 때까지 영원히 유효하고, 로그아웃도 서버에서 무효화하지 못한다. 발급 시각을 서명에 넣고(`${id}.${iat}` 를 HMAC) `isAdmin` 에서 12시간이 넘으면 거부한다.
- **addClientInquiry(공개, pilot-actions.ts:57) — 공개로 둔다는 가정은 맞다.** inquiry_key 는 `gen_random_uuid()`(122비트)이고 status 준비·진행 파일럿만 받는다 — 링크를 받은 고객만 쓰는 능력 주소다. 다만 입력 검사가 모자라다:
  - (a) `source`·`channel` 을 화면의 선택지(AI·네이버검색…·전화·카카오·방문)로 제한하지 않고 길이도 자르지 않는다. 아무 문자열이나 들어가 성장 칸 「출처별」과 파일럿 보고서에 그대로 뜬다. 허용 목록 밖이면 거부한다.
  - (b) `day` 가 `current_date` 라 DB(UTC) 날짜로 적힌다. KST 00:00~08:59 에 적은 상담이 전날로 들어간다. `(now() at time zone 'Asia/Seoul')::date` 로 바꾼다.
  - (c) uuid 가 아닌 key 가 오면 Postgres 형변환 오류로 동작이 예외를 던진다(500). 쿼리 전에 uuid 꼴을 검사하고 조용히 돌아간다(getPilotByInquiryKey 는 try 로 감싸 이미 null).
  - (d) 요청 수 제한이 없다. 링크가 새면 기록을 부풀릴 수 있다. 우선 같은 key 로 1분에 N건 넘으면 거부하는 간단한 제한을 둔다(DB count).
- **옛 열쇠(?key=) 노출 — enter 경로는 나아졌지만 없어지지는 않았다.** 열쇠가 여전히 요청 주소에 실린다.
  - Vercel 요청 로그에 쿼리가 남는다.
  - 즐겨찾기·주소창 기록에도 남는다(enter 가 쿠키로 바꾼 뒤 열쇠 없는 주소로 보내는 건 맞다).
  - `secret()` 은 ADMIN_PASSWORD 가 없으면 ADMIN_TOKEN 을 비밀번호와 쿠키 서명 키로 쓴다. 열쇠 = 비밀번호 = 서명 키다.
  권고:
  - (1) ADMIN_PASSWORD 를 따로 정해 열쇠와 비밀번호를 가른다.
  - (2) 즐겨찾기를 로그인으로 옮긴 뒤 옛 열쇠 받기를 끄고 ADMIN_TOKEN 을 교체한다(Step 13 에서 권한 교체와 같이).
  - (3) /admin 과 /admin/enter 응답에 `Referrer-Policy: no-referrer` 를 준다.
  (1)(2) 는 원장 결정이라 아래 Escalate 에도 올린다.
- web/app/admin/pilots — `D(x)`·`day(x)` 가 Date 를 `toISOString().slice(0,10)` 로 자른다. date 칼럼(started_on·ends_on)은 Vercel(UTC)에서 맞다. timestamptz 칼럼에 쓰이면 KST 날짜가 하루 어긋난다. 날짜는 SQL 에서 `::text` 로 받는 저장소 규칙대로 바꾼다.

## Escalate to Architect
- **옛 열쇠 주소를 언제 끊을지, ADMIN_PASSWORD 를 따로 둘지.** 스크립트·즐겨찾기가 ?key= 를 쓰고 있어 끊는 날은 원장이 정한다. 끊는 날에 ADMIN_TOKEN 교체를 같이 한다(Step 13 권고).

## Cleared
- **494bbc4 랜딩**: 대체 숫자(8·460·43·6·2위)를 모두 없앴다. 못 읽으면 null 이고 그 칸·문장을 숨기며 Count 는 「—」다. 플레이스 순위는 KST 오늘 기준 14일 안에 잰 것만, 측정일 「m/dd 측정」을 붙인다. 쿼리는 파라미터를 쓰고 실패하면 null 이다. 지어낸 숫자가 사라졌다.
- **3853b31 14a 수정**: 지난 Must 3·Should 들이 다 풀렸다.
  - `dueSlots` 가 8일을 거슬러 보고 요일 제한과 90분 유예를 반영한다. 놓친 어제·월요일 일이 지연으로 뜬다.
  - todo-text.ts 는 investigate(R5 는 facts 의 쪽수·vendor 로 「빙이 우리 글 47쪽 중 5쪽만 읽었습니다」)·repair-approval·workflow-failed 의 문장을 새로 만든다. 나머지는 어절 경계에서 자르고 외톨이 조사를 지우며, 최근 3일 조치는 「조치 중」으로 흐리게 맨 뒤로 보낸다.
  - 옮긴 줄은 「실행 완료/실패」다. 수리공은 옮긴 줄을 빼고 판정하고, 7일 합침이 0 이면 「쉬는 중 · 합친 수리 없음」이다. 검토 불합격은 막힘으로 안 친다.
  - 막힘에 「n일 전」이 붙는다. PC 는 한 번 비면 회색 「PC 꺼짐」, 두 번이면 지연이다(Arch). API 오류 원문은 서버 로그에만 남는다.
- **fb324d0 14b**: 관리 화면 7개를 새로 그렸다. 화면 글은 React 텍스트다. dangerouslySetInnerHTML 은 CSS 문자열과 초안 render(esc 를 먼저 거친 기존 코드)뿐이다. `kstToday` 는 +9h 로 계산한다. pilots.ts 별칭(`as day`)은 올바르게 고쳤다.
- **93fb90f 보안**: "use server" 모듈 9개를 모두 봤다.
  - inquiry·lead·outreach·pilot·draft·task·brief 의 모든 동작이 isAdmin 을 거친다.
  - admin-actions 의 signIn/signOut 은 로그인 자체라 맞다. inquiries.ts 는 "use server" 가 아니다(주석에만 나옴).
  - 빠진 곳은 의도한 addClientInquiry 하나뿐이다.
  - enter/route.ts: 열쇠가 틀리면 로그인 화면으로 보낸다. 맞으면 httpOnly·SameSite=Lax·운영 Secure·path=/·12h 쿠키와 no-store 를 주고 열쇠 없는 /admin 경로로 보낸다. `to` 는 `/admin` 안쪽만 받고 `//` 는 거부하며, 출처는 요청 origin 으로 고정해 바깥으로 튀지 않는다.
  - 공개 API(crawl·lead·scan)는 설계상 공개이고 이번 범위 밖이다. llm·pilots prompts·admin agents 는 검사가 있다.
