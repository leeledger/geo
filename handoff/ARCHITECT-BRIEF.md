# Architect Brief — Step 13 · 현황판 맨 위 「성장」
*Arch 작성 2026-09-22. Step 12 는 끝났다(BUILD-LOG). 이 파일은 Step 13 만.*

---

## Goal
/admin/ops 를 열면 10초 안에 「늘고 있나, 어디서」가 보인다. 지표마다 지금 값 · 같은 조건 이전 값 대비 변화 · 추세선 · 「뜻 / 좋아지려면」 한 줄씩.

## 왜
원장(9/22): 「실제로 얼마나 성장하고 있는지 가늠이 힘들다」. 지금 KPI 칸은 누적값·마지막 날 값뿐이라 비교 기준이 없다.
DB 에 시계열은 이미 있다(9/22 조회로 확인):
- crawl_hits 9/06~ 매일 · site_pages 는 오늘 것뿐(9/22, 1번 47쪽 · 2번 10쪽)
- 누적 커버리지(지금 47쪽 기준): 구글 15→47 · 네이버 1→44(9/17 점프)→47 · 빙 0→1→5. 이 그림 하나가 KG-21 이 풀린 날을 보여 준다
- serp_checks 경쟁 6개 질의: 9/10~ 매일 4/6. 9/21 은 빙만 돌았다(네이버 행 없음) — 불완전한 날. 9/22 네이버 웹문서 경쟁 2건 1위 첫 등장
- ai_measurements: 엔진·방법 4쌍. 같은 쌍 2회 이상은 openrouter/api-openrouter-web-exa 뿐(9/17 20문항, 9/18 11문항 — 공통 11문항 기준 언급 3→3, 인용 0→0). claude-code-web 는 9/22 1회차
- posts: 착수(9/05) 이후 14편(9/08 9 · 9/09 2 · 9/12 1 · 9/21 1 · 9/22 1). 그 전 날짜 글은 옮겨 온 옛 글
- inquiries 2건(9/10, 네이버플레이스, 결과 미입력) · geo.leads 0건 · geo.scans 실사용(cited-rescan 제외) 9/05 17 · 9/10 3 · 9/14 2
- agent_activity 실패: 최근 7일 33건 / 그 전 7일 3건(활동량 자체도 늘었다)

## 결정 (Bob 이 추측하지 말 것)
1. **새 파일로 분리.** `web/lib/growth.ts`(readGrowth) · `web/app/admin/ops/Growth.tsx`(서버, 칸+표) · `web/app/admin/ops/CoverageChart.tsx`(클라이언트, 선그래프+툴팁). readOps·기존 칸은 건드리지 않는다. 기존 파일 수정은 둘뿐: `web/lib/ops.ts` 의 `pool` 을 `export` · `page.tsx` 에 `<Growth>` 끼우기
2. **자리:** page.tsx 에서 고객사 줄·err 다음, `<AgentBoard>` 앞. 기존 섹션은 전부 아래로 그대로
3. **차트 라이브러리 안 쓴다.** 손 SVG. 새 패키지 0
4. **날짜 경계는 전부 KST.** 하루 = `(ts at time zone 'Asia/Seoul')::date`, 오늘 = `(now() at time zone 'Asia/Seoul')::date`. JS 표시는 `timeZone:"Asia/Seoul"`. `toISOString().slice(0,10)` 로 날짜를 만들지 않는다(UTC 함정). 날짜는 SQL 에서 `::text` 로 받는다
5. **비교 창:** 최근 7일 = 오늘-6~오늘, 그 전 7일 = 오늘-13~오늘-7. 달력 주로 비교하지 않는다 — 이번 주가 2일째라 늘 떨어져 보인다. 문의·리드만 30일 대 30일
6. **고객사별.** academy 쿼리는 전부 `client_id = $1`(파라미터). 스키마 이름은 client.schema 를 `/^[a-z_]+$/` 로 검사하고 넣는다. `academy.snapshots` 는 고객사가 섞여서 쓰지 않는다
7. **AI 측정은 엔진+방법 쌍 안에서만 비교.** 다른 쌍끼리 개선률 금지. 비교는 **두 회차 공통 prompt_id 만**(질문별 `bool_or(mentioned)`, `bool_or(cited)`). 공통이 0이면 「비교 불가」
8. **경쟁 검색어는 kind='경쟁' 만**(지역은 9/10 에 끊겨 분모가 바뀐다). 하루 값 = 어느 엔진에서든 걸린 질의 수(기존 rivalTally 규칙). **그날 엔진 수 < 최근 14일 최대 엔진 수면 불완전한 날** → 추세선 빈칸. 비교 = 가장 최근 완전한 날 vs 그보다 7일 이상 앞선 가장 최근 완전한 날(없으면 비교 없음)
9. **크롤러 구분:** 검색 색인 = google·naver·microsoft·duckduckgo. 나머지는 AI. (Step 11: 합쳐 세서 1486 을 AI 방문이라 한 적이 있다)
10. **★ 답변 색인 커버리지:** google·naver·microsoft 셋. 분모 = 지금 site_pages 수(0행이면 coverage_by_vendor 뷰의 발행 글 규칙: /blog/슬러그 + / + /blog). 날짜 d 값 = 지금 목록의 쪽 중 d 까지 한 번이라도 읽어 간 쪽 수. **화면에 「지금 있는 N쪽 기준 누적」이라고 적는다** — 과거에는 그 쪽이 없었을 수 있다. Brave 는 로봇이 이름을 안 밝혀 못 센다 — 칸 아래에 그렇게 적는다
11. **좋아짐의 방향:** 위가 좋음 = AI 언급·인용, 커버리지, 경쟁 검색어, 발행, 문의, 리드. 아래가 좋음 = 실패·사람 대기. **중립 = 크롤러 방문 수**(다 읽고 나면 줄어든다. 판단은 커버리지로). 중립은 회색 – 표시, 판정 줄에서 뺀다
12. **없는 값은 지어내지 않는다.** 이전 값이 없으면 변화 자리에 「비교할 이전 값 없음」(AI 는 「이 방법으로는 1회차 — 비교할 이전 회차 없음」). 0 과 「기록 없음」을 가른다(쿼리 실패 = null → 「확인 못함」)
13. **증감률(%)은 쓰지 않는다.** 절대 차 + 이전 값: 「▲ +4쪽 · 7일 전 1쪽」. 작은 수에서 +300% 같은 소리가 나온다
14. **색:** 계열색은 검증된 셋만, 순서 고정: google `#1F9E90` · naver `#7C8AF2` · microsoft(빙) `#C27A14`. 넷째 계열색을 만들지 않는다. 변화 표시는 기존 상태색(`--ok` `--crit`, 중립 `--mut`) + ▲▼– 기호 + 글자(색만으로 뜻을 싣지 않는다). 값·라벨·범례 글자는 잉크색(`--ink` `--ink2` `--mut`) — 계열색 글자 금지. 추세선은 `--faint` 선 + 마지막 점만 `--acc`
15. **판정 줄은 규칙 계산:** 「최근 7일 — 좋아진 것 A · 그대로 B · 나빠진 것 C · 비교 못 함 D」. good 방향 기준으로 센다(실패가 줄면 좋아진 것). 중립 칸 제외. 문장으로 꾸미지 않는다

## Build Order

### 1. `web/lib/growth.ts` — `readGrowth(client: Client): Promise<Growth>`
조각마다 따로 try/catch(한 표가 없어도 나머지는 뜬다). 조각 실패 = 그 자리 null.
```ts
type Dir = "up" | "down" | "flat" | "none";
type Delta = { now: number | null; prev: number | null; dir: Dir; good: "up" | "down" | "neutral" };
type Growth = {
  today: string;                       // KST YYYY-MM-DD
  days: string[];                      // 최근 14일 KST (추세선 x)
  coverage: { total: number; series: { vendor: "google" | "naver" | "microsoft"; label: string; points: { day: string; pages: number }[] }[] } | null;
  ai: { engine: string; method: string; rounds: { day: string; prompts: number; mentioned: number; cited: number }[];
        compare: { common: number; prevDay: string; mentioned: [number, number]; cited: [number, number] } | null }[] | null;
  rival: { daily: { day: string; won: number | null; total: number; engines: number }[];
           latest: { day: string; won: number; total: number; byEngine: { engine: string; hit: number; best: number | null }[] } | null;
           prev: { day: string; won: number } | null; partialDays: string[] } | null;
  crawl: { search: Delta; ai: Delta; daily: { day: string; search: number; ai: number }[] } | null;
  posts: { last7: Delta; sinceDays: number | null; streakWeeks: number; weekly: { week: string; n: number; partialDays: number | null }[] } | null;
  inquiries: { last30: Delta; bySource: { source: string; n: number }[]; unresolved: number } | null;
  sales: { leads30: Delta; scans30: Delta } | null;      // 사이티드 전체 — 고객사 무관
  agents: { fail7: Delta; total7: number; waitingHuman: number } | null;
};
```
쿼리(값은 전부 $ 파라미터, S = 검사한 스키마, T = 오늘 KST date):
- 오늘: `select (now() at time zone 'Asia/Seoul')::date::text as today`
- 커버리지: 쪽 목록 `select path from S.site_pages where client_id=$1`. 처음 읽은 날 `select vendor, path, min((seen_at at time zone 'Asia/Seoul')::date)::text as first from S.crawl_hits where client_id=$1 and vendor = any($2) and path = any($3) group by 1,2`. x축 = 셋 중 가장 이른 first ~ 오늘(14일로 자르지 않는다 — 이 차트는 착수부터). 점 = 날짜별 first <= d 개수, JS 로 누적
- AI: `select measured_on::text as day, engine, collection_method as method, prompt_id, bool_or(mentioned) as m, bool_or(cited) as c from academy.ai_measurements where client_id=$1 group by 1,2,3,4`. JS 에서 (engine,method) → 날짜 회차. compare = 쌍의 마지막 회차와 바로 앞 회차의 공통 prompt_id 로 센다. 쌍 정렬 = 마지막 회차 날짜 내림차순
- 경쟁: `select day::text as day, count(distinct engine)::int as engines, count(distinct query)::int as total, count(distinct query) filter (where hit)::int as won from S.serp_checks where client_id=$1 and kind='경쟁' and day > T-14 group by day`. 불완전한 날은 won=null, partialDays 에 넣는다. latest 엔진별: `select engine, count(distinct query) filter (where hit)::int as hit, min(rank) filter (where hit) as best from S.serp_checks where client_id=$1 and kind='경쟁' and day=$2 group by engine`. 엔진 이름: naver_all 「네이버 통합」 · naver 「네이버 웹문서」 · bing 「빙」(기존 page.tsx 표기와 같게). 네이버 통합은 순위가 없다 — best null 이면 순위를 안 적는다
- 크롤: 최근 14일 하루별 `count(*) filter (where vendor = any($2))` = search, 나머지 = ai. 7일 합 두 개로 Delta(good: neutral)
- 발행: `published and published_at >= client.startedOn(KST 자정)` 만(옛 글 제외). 최근 7일/그 전 7일 편수. 주 = 월요일 시작 KST `date_trunc('week', published_at at time zone 'Asia/Seoul')`, 착수 주~이번 주 전부(0편 주 포함 — generate_series). 첫 주·이번 주는 partialDays(그 주에 센 날 수). streakWeeks = 이번 주부터 거꾸로 1편 이상인 연속 주(이번 주가 아직 0편이면 지난주부터 — 진행 중인 주로 끊지 않는다). sinceDays = T − 마지막 발행 KST 날짜
- 문의: `S.inquiries where client_id=$1`, `day` 기준 30일/그 전 30일, 30일 source 별 건수, `enrolled is null` 전체 건수
- 사이티드: `geo.leads` 전체 30/30(created_at KST), `geo.scans where user_agent is distinct from 'cited-rescan'` 30/30
- 에이전트: `geo.agent_activity where (client_id=$1 or client_id is null)` 최근 7일/그 전 7일 `not ok` 수 + 최근 7일 전체 수(기존 ops.ts 필터와 같게). `geo.agent_tasks where client_id=$1 and status='사람 대기'` 개수
- Delta.dir: now 나 prev 가 null 이면 none. 같으면 flat

### 2. `web/app/admin/ops/Growth.tsx` (서버 컴포넌트, props `{ g: Growth | null; err?: string; client: Client | null }`)
```
<section class="gr">
  h2 「성장 — 늘고 있나」   sub 「최근 7일을 그 전 7일과 비교합니다(문의·리드는 30일). 오늘 {today} KST」
  판정 줄 (결정 15)
  ① 레퍼런스 증거   [AI 답변] [★ 답변 색인 커버리지] [경쟁 검색어] [크롤러 방문] [학원 문의]
  ② 꾸준한 발행     [발행]
  ③ 첫 고객         [사이티드 리드·진단]
     운영           [막힌 곳]
  <CoverageChart>
  <details> 표로 보기
</section>
```
칸(stat tile) 계약, 위에서 아래로: 이름(콜론 없음) · 값(큰 글씨, 비례 숫자 — `tabular-nums` 금지) · 변화 줄(기호 + 절대 차 + 이전 값, 결정 13) · 추세선(3번) · 작은 줄(세부) · 「뜻 …」 · 「좋아지려면 …」. 문구는 아래 그대로 쓴다. 숫자는 데이터에서.

- **AI 답변** — 값: 가장 최근 회차 「언급 m/N · 인용 c/N」. 쌍마다 한 줄(엔진 · 날짜 · 언급/인용 · 비교). 비교: compare 있으면 「공통 k문항: 언급 a→b · 인용 x→y」, 없으면 「이 방법으로는 1회차 — 비교할 이전 회차 없음」. 칸의 변화 줄은 가장 최근 쌍의 compare 로(없으면 none). 추세선: 가장 최근 쌍의 회차별 언급 수. 뜻 「AI 가 학원 이름을 부르는가. 엔진·방법이 다르면 합치지 않는다」 좋아지려면 「같은 엔진·방법으로 다시 잰다. 인용은 그 엔진이 찾는 검색 색인에 들어가야 생긴다」
- **★ 답변 색인 커버리지** — 값: 셋 중 가장 낮은 곳 「빙 5/47쪽」. 작은 줄: 「구글 47 · 네이버 47 · 빙 5 — 지금 47쪽 기준」(각 이름 앞 계열색 짧은 선 키). 변화: 가장 낮은 곳의 오늘 vs 7일 전(단위 쪽). 추세선: 가장 낮은 곳 14일. 뜻 「AI 가 답할 때 찾는 검색 색인에 우리 쪽이 몇 쪽 들어갔나」 좋아지려면 「제일 낮은 곳을 민다. 빙이면 빙 제출·IndexNow — ChatGPT 검색과 Copilot 이 빙을 쓴다」. 맨 아래 「Brave(→Claude)는 로봇이 이름을 안 밝혀 여기서 못 센다. AI 답변 칸의 claude-code-web 인용으로 본다」
- **경쟁 검색어** — 값: latest 「won/total」 + 날짜. 작은 줄: 엔진별 「네이버 통합 4 · 네이버 웹문서 2(최고 1위) · 빙 0」. 변화: latest vs prev. 추세선: daily(불완전한 날은 끊김). partialDays 가 있으면 「9/21 은 일부 엔진만 잼 — 뺐다」. 뜻 「학원 이름 없이 지역·업종으로 찾을 때 나오는가」 좋아지려면 「그 검색어에 답하는 글을 쓰고 색인을 민다」
- **크롤러 방문** (중립) — 값: 최근 7일 합(검색+AI). 작은 줄 「검색 색인 262 · 그 전 204 / AI 260 · 그 전 433」. 추세선: 14일 합계. 뜻 「로봇이 다녀간 횟수. 한 번 다 읽고 나면 줄어든다」 좋아지려면 「횟수보다 커버리지를 본다. 새 글을 내면 다시 온다」
- **학원 문의** — 값: 30일 건수. 작은 줄: 출처별 「네이버플레이스 2」. 결과 미입력이 있으면 「결과 미입력 N건 →」 /admin/inquiry 링크. 0건이면 「0건 — 노출이 문의로 이어지는지 아직 못 잰다」. 추세선 없음(건수가 작다). 뜻 「노출이 실제 문의로 이어졌나. 상담에서 “어떻게 알고 오셨어요”로만 잰다」 좋아지려면 「상담마다 30초 기록」
- **발행** — 값: 최근 7일 편수. 작은 줄 「마지막 {sinceDays}일 전 · 연속 {streakWeeks}주」. 추세선 대신 주별 작은 막대(착수 주~이번 주, 막대 폭 24px 이하 · 끝 4px 둥글게 · 막대 사이 2px 틈, 1편 높이에 가는 실선 목표선, 부분 주는 흐리게 + `<title>` 「9/21 주 · 2일째 · 2편」). 뜻 「주 1편이 끊기면 크롤러가 뜸해지고 레퍼런스가 늙는다」 좋아지려면 「이번 주 0편이면 초안 검토 → 발행」. 착수 뒤 글 0편이면 「이 고객사 글은 이 DB 에 없다」
- **사이티드 리드·진단** — 이름 옆 「사이티드 전체」 꼬리표(고객사 탭과 무관). 값: 리드 30일. 작은 줄 「무료 진단 {scans30}회 · 사내 재진단 제외」. 뜻 「첫 고객 후보가 들어오고 있나」 좋아지려면 「영업판의 통화 대상부터」 + /admin/outreach 링크
- **막힌 곳** — 값: 사람 대기 N건. 작은 줄 「실패 7일 33 / 활동 239 · 그 전 7일 실패 3」. 변화는 실패 수(good: down). 뜻 「에이전트가 멈춘 자리」 좋아지려면 「사람 대기부터 푼다 — 아래 에이전트 판」

칸 격자 `repeat(auto-fit, minmax(250px, 1fr))`, 묶음 제목(①②③·운영)은 격자 위 작은 눈썹글. 390px 에서 한 줄 한 칸. 한글 `word-break: keep-all`. CSS 는 page.tsx 처럼 `<style>` 로, 클래스 앞머리 `gr-`(기존 `.ops-*` 와 안 겹치게). 색은 기존 변수(--card --line --ink --ink2 --mut --faint --acc --ok --crit)

### 3. 추세선 — Growth.tsx 안 작은 함수 `Spark`
- 높이 32, 폭 100%. 선은 `vector-effect="non-scaling-stroke"` 로 늘려도 2px. 점은 늘어나면 찌그러지니 SVG 원 대신 HTML 절대 위치 점(8px + 2px 카드색 고리)으로 겹친다
- 선 2px `--faint`, 마지막 점만 `--acc`. null 은 끊는다(0 으로 메우지 않는다)
- 칸에 aria-label 「{첫 날} {값} → {마지막 날} {값}」. 날짜별 값은 표로 보기에 다 있다
- 값이 2개 미만이면 추세선 대신 「추세를 그리기엔 기록이 1회」

### 4. `web/app/admin/ops/CoverageChart.tsx` ("use client")
- 한 축. y = 읽어 간 쪽 수 0~total(눈금 0 · total 의 절반 반올림 · total), x = 첫날~오늘, 월요일마다 x 눈금(「9/7」). 격자 1px 실선 `--soft`(점선 금지), 축 글자 `--mut` + `tabular-nums`
- 선 3개(결정 14 색·순서), 2px, 둥근 이음·끝. 오른쪽 끝점 r=4 + 2px 카드색 고리 + 직접 라벨 「구글 47」「네이버 47」「빙 5」 — 글자는 잉크색. 끝 라벨 세로 간격이 14px 미만이면 밀어 떼지 말고 한 라벨로 합친다(「구글·네이버 47」). 지금 데이터가 정확히 이 경우다
- 범례: 차트 위 한 줄, 짧은 2px 선 키 + 이름(구글 · 네이버 · 빙)
- 호버: 세로 헤어라인이 가장 가까운 날짜에 붙고, 툴팁 하나에 세 계열 모두 — 값 먼저 굵게, 이름은 뒤에 흐리게, 앞에 선 키. 툴팁은 차트 상자 안에서 좌우를 뒤집어 화면 밖으로 안 나가게. 키보드: 차트에 `tabIndex=0`, 좌우 화살표로 날짜 이동, 포커스 때 같은 툴팁. 이름·라벨은 JSX 텍스트로만(`dangerouslySetInnerHTML` 금지)
- 제목 「★ 답변 색인 커버리지 — 착수부터 누적」 부제 「지금 있는 {total}쪽 중 한 번이라도 읽어 간 쪽. 과거에는 없던 쪽도 분모에 들어 있다」
- 높이는 x축 글자를 포함해 잡는다(안쪽 스크롤 금지). 폭 100%, viewBox 로 줄어든다. 390px 에서 끝 라벨이 안 잘리게 오른쪽 여백 확보
- 날짜가 하루뿐이면 선 대신 「하루치 — 추세 없음」. total 0 이면 「쪽 목록 없음」

### 5. 표로 보기 (`<details>`, 차트 아래, `.ops-tw` 처럼 자체 가로 스크롤)
- 커버리지 날짜별 표: 날짜 · 구글 · 네이버 · 빙 (숫자 칸만 `tabular-nums`)
- 주별 요약 표(월요일 시작 KST, 착수 주~이번 주): 주 · 발행 · 크롤러 검색/AI · 주 마지막 날 ★커버리지(구/네/빙) · 경쟁 검색어(그 주 마지막 완전한 날) · AI 측정 회차(쌍 이름·날짜) · 문의. 부분 주는 「9/21 주 (2일째)」

### 6. page.tsx
- `readGrowth(client)` 를 기존 `Promise.all` 에 더한다. 던지면 잡아서 `{ g: null, err }` 로
- `<Growth />` 를 `{!d.ok && ...}` 다음, `<AgentBoard>` 앞에. 통째로 실패하면 섹션에 「성장 지표를 못 읽었습니다 — {이유}」 한 줄

## Out of Scope
- 기존 「고객사 성과 지표」 칸·AgentBoard·Brief·표 수정. 겹쳐도 이번엔 둔다(Known Gaps)
- 과거 site_pages 복원·새 표·새 크론·스냅샷 수정. DB 쓰기 0
- 날짜 범위 필터, 고객사 비교 화면, 내보내기
- 플레이스 순위 추세(9/08·9/09 이틀뿐, 이후 측정이 멈췄다 — Known Gaps)

## Acceptance
1. `web/` 에서 `node ./node_modules/typescript/bin/tsc --noEmit` 0 오류(npx 금지 — 경로의 &)
2. 로컬 렌더: `web/` 에서 `node ./node_modules/next/dist/bin/next dev -p 3013`(web/.env.local 에 운영 DATABASE_URL·ADMIN_TOKEN 이 있다). 인증은 `?key=` 옛 토큰 경로(isAdmin 이 ADMIN_TOKEN 과 비교). Playwright 스크립트는 **스크래치패드에** 두고 `C:/dev/AGO&GEO/tools/node_modules/playwright` 를 require. 토큰은 web/.env.local 에서 읽어 주소에만 쓰고 **출력·파일·커밋에 남기지 않는다**. 스크린샷 1280·390 폭 × `?c=robotncoding`·`?c=ilog`, 저장은 스크래치패드
3. 숫자 대조(9/22 기준. 날이 바뀌면 같은 쿼리로 다시 계산해 REVIEW-REQUEST 에 적는다):
   - 커버리지 끝값 구글 47 · 네이버 47 · 빙 5 / 47쪽. 네이버 선 9/16 1 → 9/17 44
   - AI: 가장 최근 = claude-code-web 9/22 언급 4/20 · 인용 0/20 「이 방법으로는 1회차」. openrouter 줄 「공통 11문항: 언급 3→3 · 인용 0→0」. chatgpt-web-logged-out·claude-code-websearch 줄은 1회차
   - 경쟁: 4/6(9/22). 9/21 불완전한 날로 빠짐. 엔진별 「네이버 웹문서 2(최고 1위)」
   - 크롤러: 검색 262 · 그 전 204 / AI 260 · 그 전 433
   - 발행: 착수 뒤 14편만. 옛 글(2019~2026.03) 안 들어감
   - 문의 30일 2 · 결과 미입력 2 · 리드 0
   - 실패 7일 33 · 그 전 3
4. `?c=ilog` 는 글·AI·문의가 없다 — 칸마다 「기록 없음」/「비교할 이전 값 없음」, 에러 없이 렌더
5. 390px 에서 페이지 가로 스크롤 없음, 끝 라벨 안 잘림, 툴팁이 화면 밖으로 안 나감. 마우스·키보드로 툴팁 확인(스크린샷 1장)
6. 기존 섹션(AgentBoard·Brief·고객사 성과 지표·크롤러 표·처음 나온 날·최근 발행) 그대로
7. 배포: web 은 `git push` → Vercel. push 전 `gh auth switch --user leeledger`. 운영 확인은 Arch
