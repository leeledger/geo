/**
 * 케이스 스터디 리포트 생성.
 *
 * 이 사업에서 파는 것은 "사이트를 잘 만들어 드립니다"가 아니라
 * "움직였는지 숫자로 보여 드립니다"다. 그 증거를 매번 손으로 정리하면
 * 고객사가 늘어나는 순간 무너진다. 그래서 DB 에서 뽑아 페이지를 만든다.
 *
 * 정직하게 쓴다는 원칙:
 *  - 아직 모르는 것은 "모른다"고 적는다. 인용률은 아직 안 셌다.
 *  - 우리가 한 일과 아직 안 한 일을 구분해서 적는다.
 *  - 기준선 없이 "좋아졌다"고 말하지 않는다.
 *
 * 공개본은 가린다 (09.11 「너무 적나라하게 다 보인다」).
 *  - 학원 이름·지역(구·동·생활권)·사이트 주소·경쟁 학원·글 주소를 가린다. 조합되면 특정된다.
 *  - 달력 날짜는 착수 기준 「N일차」로 바꾼다. 날짜는 늙고, 도메인 등록일과 맞춰 보면 특정된다.
 *  - 원본이 필요하면 --private 로 뽑되 web/public 에 두지 않는다.
 *
 *   node scripts/case-report.mjs --out ../web/public/case/academy.html
 *   node scripts/case-report.mjs --private --out ../../probe/data/case-private.html
 */
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { MASKS } from "../masks.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PRIVATE = process.argv.includes("--private");
const START = new Date("2026-09-05T00:00:00+09:00");
const CLIENT_ID = 1;

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

// ── 데이터 수집
const [posts] = (await pool.query(
  // 새로 쓴 글과 옛 글(시작 전 날짜로 옮겨 온 것)을 가른다 — 합쳐서 「처음 0」 옆에 두면 다 우리가 쓴 것처럼 읽힌다(10/13 검증)
  `select count(*)::int n, (count(*) filter (where published_at >= $2))::int new, coalesce(sum(length(body)),0)::int chars
     from academy.posts where client_id=$1 and published`, [CLIENT_ID, START],
)).rows;
const [drafts] = (await pool.query(
  `select count(*)::int n from academy.posts where client_id=$1 and not published`, [CLIENT_ID],
)).rows;
const crawl = (await pool.query(`
  select bot, vendor, count(*)::int hits, count(distinct path)::int pages,
         min(seen_at) first_seen, max(seen_at) last_seen
    from academy.crawl_hits where client_id=$1
   group by bot, vendor order by max(seen_at) desc`, [CLIENT_ID])).rows;
const firstHit = (await pool.query(
  `select min(seen_at) t from academy.crawl_hits where client_id=$1`, [CLIENT_ID],
)).rows[0]?.t;
/**
 * 크롤러 분류는 판별표(academy/lib/bots.ts) 한 곳에서 읽는다 — 「AI 학습·검색」 칸과 「검색 색인」 칸.
 * 어느 칸에도 없는 봇은 「기타」다. AI 로 부풀리지 않는 쪽이 기본이다(전에는 「검색이 아니면 AI」라 새 봇이 AI 로 들어갔다).
 * 전에는 둘을 합쳐 「AI 크롤러 방문」이라 적었고(검색 590회 포함), 다음엔 Applebot(검색용)을 AI 로 셌다 — 2026-09-22 두 번 정정
 */
const 판별표 = (() => {
  try { return fs.readFileSync(new URL("../lib/bots.ts", import.meta.url), "utf8"); } catch { return ""; }
})();
const 칸이름 = (글) => [...글.matchAll(/\[\/[^\n]*?\/i,\s*"([^"]+)"/g)].map((m) => m[1]);
const 경계 = 판별표.indexOf("// ── 검색 색인");
if (경계 < 0) throw new Error("bots.ts 에서 「검색 색인」 칸을 못 찾음 — 분류 없이 숫자를 내지 않는다");
const AI봇 = new Set(칸이름(판별표.slice(0, 경계)));
const 검색봇 = new Set(칸이름(판별표.slice(경계)));
const 분류 = (bot) => (AI봇.has(bot) ? "AI" : 검색봇.has(bot) ? "검색" : "기타");

/**
 * 일별 기록 — academy.snapshots.crawl_total 은 고객사를 가리지 않고 crawl_hits 전체를 센다(snapshot 라우트).
 * 그래서 17일차 누적 1822 가 머리 숫자 1486 보다 컸다(다른 고객사 방문 포함). 이 고객사 행만, 한 정의로 다시 센다.
 * 누적 = 그날 KST 자정까지. 날짜는 스냅샷이 찍힌 날들을 그대로 쓴다
 */
const snaps = (await pool.query(`
  select s.day::text as day,
    (select count(*)::int from academy.posts p where p.client_id=$1 and p.published
        and p.published_at < ((s.day + 1)::timestamp at time zone 'Asia/Seoul')) posts,
    (select count(*)::int from academy.crawl_hits h where h.client_id=$1 and h.bot = any($2)
        and h.seen_at < ((s.day + 1)::timestamp at time zone 'Asia/Seoul')) ai_total,
    (select count(*)::int from academy.crawl_hits h where h.client_id=$1 and h.bot = any($3)
        and h.seen_at < ((s.day + 1)::timestamp at time zone 'Asia/Seoul')) search_total,
    (select array_agg(distinct h.vendor order by h.vendor) from academy.crawl_hits h where h.client_id=$1
        and h.seen_at < ((s.day + 1)::timestamp at time zone 'Asia/Seoul')) vendors
  from academy.snapshots s order by s.day`, [CLIENT_ID, [...AI봇], [...검색봇]])).rows;

/**
 * 명시 허용 수와 판별 수는 저장소 파일에서 센다. 전에는 손으로 적은 「17종」(타임라인)과 진단 도구가 센 「11종」(진단표)이
 * 한 페이지에 같이 있었다 — 정의가 달랐다. 이제 둘 다 robots.txt 에서 센 같은 숫자다
 */
const robots = (() => {
  try { return fs.readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8"); } catch { return ""; }
})();
/**
 * robots.txt 의 User-agent 줄에는 방문하는 크롤러와 방문하지 않는 제어 토큰이 섞여 있다.
 * Google-Extended·Applebot-Extended 는 「AI 학습에 써도 된다」는 허락 표시일 뿐 따로 오지 않는다 — 크롤러 수에 넣지 않는다
 */
const 제어토큰 = new Set(["Google-Extended", "Applebot-Extended"]);
const 허용봇 = [...robots.matchAll(/User-agent:\s*(\S+)\s*\n\s*Allow:\s*\//gi)].map((m) => m[1]).filter((b) => b !== "*");
const 허용크롤러 = 허용봇.filter((b) => !제어토큰.has(b));
const 허용 = { 전체: 허용봇.length, 토큰: 허용봇.length - 허용크롤러.length,
  AI: 허용크롤러.filter((b) => 분류(b) === "AI").length, 검색: 허용크롤러.filter((b) => 분류(b) === "검색").length, 기타: 허용크롤러.filter((b) => 분류(b) === "기타").length };
const 판별 = { AI: AI봇.size, 검색: 검색봇.size };

let aiRounds = [];
try {
  aiRounds = (await pool.query(`
    select measured_on::text as measured_day, collection_method, engine,
           count(*)::int n, count(*) filter (where cited)::int cited,
           count(*) filter (where mentioned and not cited)::int mentioned
      from academy.ai_measurements where client_id=$1
     group by measured_on, collection_method, engine order by measured_on`, [CLIENT_ID])).rows;
} catch { /* 이전 배포에서는 표가 없을 수 있다 */ }

/**
 * 측정 방법과 반복 비율 (Step 23 D3). 위 aiRounds 숫자는 그대로 두고 표시만 더한다.
 * 곳(collection_method)마다 방법·기간·표본을 적고, 적중은 한 번 나온 것이 아니라 「최근 7일 n번 중 k번」으로 센다.
 * 비율은 곳별로만 — 방법이 다른 숫자를 한 비율로 합치지 않는다.
 */
let 방법들 = [], 칠일 = [];
try {
  방법들 = (await pool.query(`
    select collection_method, max(engine) as engine, count(*)::int n, count(distinct measured_on)::int days,
           min(measured_on)::text as first, max(measured_on)::text as last,
           count(*) filter (where raw is not null)::int as kept
      from academy.ai_measurements where client_id=$1
     group by collection_method order by collection_method`, [CLIENT_ID])).rows;
  칠일 = (await pool.query(`
    select prompt_id, max(stage) as stage, max(prompt_text) as q, collection_method,
           count(*)::int n, count(*) filter (where mentioned or cited)::int k
      from academy.ai_measurements
     where client_id=$1 and measured_on > (now() at time zone 'Asia/Seoul')::date - 7
     group by prompt_id, collection_method`, [CLIENT_ID])).rows;
} catch { /* 표가 없으면 이 절을 안 쓴다 */ }

/**
 * 처음과 지금 (2026-10-12). 같은 곳·같은 질문만 비교한다 — 곳마다 처음 잰 7일과 마지막 7일, 이름 질문은 뺀다.
 * 두 7일에 모두 물은 질문만 센다. ChatGPT 는 첫 주에 동네 질문만 물었던 날이 있어 질문 묶음이 달랐다.
 * 잰 날이 14일이 안 되면 두 7일이 겹치므로 비교하지 않는다.
 * 9/24 부터만 센다 — 4곳 매일 측정이 그날 시작했고(Step 20), Claude 는 9/22 오후에 출처 판정이 바뀌었다(84a6344).
 * 그 전 날을 넣으면 처음 7일에 판정 방식 둘이 섞인다 (Richard 10-12)
 */
const 비교시작 = "2026-09-24";
let 비교 = [];
try {
  const rows = (await pool.query(`
    with d as (select collection_method m, prompt_id, measured_on, mentioned, cited,
        dense_rank() over (partition by collection_method order by measured_on) r,
        dense_rank() over (partition by collection_method order by measured_on desc) rr
      from academy.ai_measurements
     where client_id=$1 and coalesce(stage,'') <> 'brand' and measured_on >= $2::date)
    select m, prompt_id, case when r<=7 then 'a' else 'b' end w, min(measured_on)::text f, max(measured_on)::text l,
           count(*)::int n, count(*) filter (where mentioned or cited)::int k, count(*) filter (where cited)::int c
      from d where (r<=7 or rr<=7) and m in (select m from d group by m having max(r) >= 14)
     group by 1,2,3`, [CLIENT_ID, 비교시작])).rows;
  const 긴곳 = new Set(rows.map((r) => r.m));
  for (const m of [...긴곳].sort()) {
    const mine = rows.filter((r) => r.m === m);
    const 둘다 = new Set(mine.filter((r) => r.w === "a").map((r) => r.prompt_id)
      .filter((p) => mine.some((r) => r.w === "b" && r.prompt_id === p)));
    const 합 = (w) => mine.filter((r) => r.w === w && 둘다.has(r.prompt_id)).reduce((s, r) => ({
      n: s.n + r.n, k: s.k + r.k, c: s.c + r.c, f: !s.f || r.f < s.f ? r.f : s.f, l: !s.l || r.l > s.l ? r.l : s.l,
    }), { n: 0, k: 0, c: 0, f: "", l: "" });
    const a = 합("a"), b = 합("b");
    if (a.n && b.n) 비교.push({ m, 질문: 둘다.size, a, b });
  }
} catch { /* 표가 없으면 비교를 안 쓴다 */ }

// 검색 노출 — 엔진마다 마지막으로 잰 날의 상태와, 각 질의가 처음 잡힌 날
// 전에는 전체에서 가장 최근 날 하나만 봐서, 아침에 빙만 먼저 돈 날은 네이버 줄이 통째로 빠졌다.
// 하루에 두 번 돌면 같은 질의가 두 줄 들어온다. 질의마다 한 줄, 걸린 쪽을 남긴다.
const serpRaw = (await pool.query(
  `select engine, kind, query, hit, rank, day::text as day from academy.serp_checks
    where client_id=$1 and (engine, day) in
      (select engine, max(day) from academy.serp_checks where client_id=$1 group by engine)
    order by engine, kind desc, query`,
  [CLIENT_ID],
)).rows;
const serpBy = new Map();
for (const r of serpRaw) {
  const k = `${r.engine}|${r.query}`;
  const p = serpBy.get(k);
  if (!p || (r.hit && (!p.hit || (r.rank ?? 99) < (p.rank ?? 99)))) serpBy.set(k, r);
}
const serp = [...serpBy.values()];
/**
 * 처음 나온 날이 그 엔진을 처음 잰 날과 같으면 「처음 나온 날」이 아니라 「재기 시작한 날 이미 나와 있었다」다.
 * 빙은 10-12 부터 진짜 브라우저로 잰다(그 전 fetch 기록은 가짜 결과라 academy.serp_checks_bing_fetch_void 로 옮겼다)
 */
const serpFirst = (await pool.query(
  `select h.engine, h.query, min(h.day) d,
          min(h.day) = (select min(day) from academy.serp_checks a where a.client_id=$1 and a.engine=h.engine) as at_start
     from academy.serp_checks h
    where h.client_id=$1 and h.hit group by h.engine, h.query order by min(h.day), h.engine`, [CLIENT_ID],
)).rows;

// 사이트 점수 (probe 측정 결과)
let scan = null;
try {
  scan = JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), "..", "probe", "data", "scans", "robotncoding.com.json"), "utf8"));
} catch {}

// 가림 규칙(MASKS)은 academy/masks.mjs 에 있다 — sales.mjs 의 가림 검사와 같은 목록을 쓴다
const mask = (s) => PRIVATE ? String(s) : MASKS.reduce((t, [re, r]) => t.replace(re, r), String(s));
const esc = (s) => mask(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const nth = (t) => Math.floor((new Date(t).getTime() - START.getTime()) / 86400000) + 1;
const hm = (t) => new Date(t).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });
const d = (t) => !t ? "—" : PRIVATE
  ? new Date(t).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" })
  : `${nth(t)}일차 ${hm(t)}`;
const day = (t) => !t ? "—" : PRIVATE
  ? new Date(t).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" })
  : `${nth(t)}일차`;
/** TIMELINE 의 "09.05" 같은 표기를 공개본에서는 일차로 */
const dt = (s) => PRIVATE ? s : `${nth(`2026-${s.replace(".", "-")}T12:00:00+09:00`)}일차`;

// ── 착수 전 기준선 (착수일 실측)
const BASELINE = [
  ["송파구 석촌동 코딩학원 추천", "오늘학교 · 순위닷"],
  ["서울 송파구 초등학생 코딩학원 추천", "오늘학교 · 순위닷 · 모하지"],
  ["석촌동 로봇 코딩 배우는 학원", "로보티즈 · 디랩 · 글로벌리더센터"],
  ["송파 로봇코딩학원 초등학생", "송파런 · 로보티즈 · 디랩"],
  ["로봇앤코딩학원 (브랜드)", "강남점 카카오채널 · learns.academy 대치동"],
  ["site:robotncoding.com", "색인 0건"],
];

/** 진단 항목 이름 — 전문 용어는 괄호에만 남긴다 (2026-10-12 「글귀가 너무 어렵다」) */
const CHECK_KO = {
  crawler: "AI·검색 프로그램 출입 허용", llmstxt: "AI 용 안내문 (llms.txt)", sitemap: "사이트 지도",
  ssr: "프로그램 없이도 글이 보이나", schema: "학원 정보 표시 (구조화 데이터)", chunk: "잘라 쓰기 좋은 문단", patterns: "질문형 제목 · 숫자",
};

// 착수일에 손으로 적은 「스키마 19종」은 진단표(20종)와 어긋났고 데이터로 다시 확인할 수 없어 뺐다(2026-09-22)
const TIMELINE = [
  ["09.05", "시작 · 검색 결과부터 기록", "학부모가 칠 만한 검색어 6개를 넣었다. 6개 모두 이 학원이 안 나왔다. 위쪽은 전부 학원 모음 사이트였다."],
  ["09.05", "학원 사이트 열기", `AI·검색 프로그램이 들어와 읽도록 하나하나 허락했다(지금 ${허용.AI + 허용.검색 + 허용.기타}종). AI 가 읽을 안내문과 학원 정보 표시도 넣었다.`],
  ["09.05", "네이버 블로그 글 32편 옮기기", "네이버 블로그는 AI 프로그램이 못 들어오게 막혀 있다. AI 입장에선 없는 글이었다. 그래서 학원 사이트로 옮겼다. 사진 69장도 같이."],
  ["09.05", "구글·빙·네이버에 사이트 등록", "검색엔진에 「이 사이트 주인이 나다」를 확인받고, 글 목록(34쪽)을 냈다."],
  ["09.05", "누가 읽으러 오는지 기록 시작", `AI 프로그램 ${판별.AI}종, 검색 프로그램 ${판별.검색}종을 알아보고 방문을 남긴다. AI 답에 이름이 나오기 전, 가장 먼저 움직이는 숫자다.`],
  ["09.05", "매일 자동 기록", "날마다 글 수와 방문 수를 자동으로 남긴다."],
  ["09.06", "구글 지도(비즈니스 프로필) 등록", "구글 AI 와 Gemini 가 동네 학원을 물으면 이 정보를 쓴다. 원장 본인 인증이 필요해 대신 해 줄 수 없는 일이다."],
  ["09.06", "오늘학교 학원 목록 등록 신청", "「송파구 코딩학원」 목록에 이 학원이 없었다. 심사 대기중."],
  ["09.10", "네이버 플레이스 소개글 188자 → 933자", "네이버 AI 가 소개글에서 쓸 말을 못 찾았다. 그래서 「무선 인터넷과 남녀 구분 화장실을 제공합니다」라고만 답하고 있었다."],
];

const TODO = [
  ["오늘학교 등록 확인", "심사 대기중. 통과하면 「송파구 코딩학원」 목록에 들어간다."],
  ["런즈 · 순위닷 등록", "같은 소개 문장을 그대로 쓴다. 곳마다 말이 다르면 AI 가 다른 학원으로 볼 수 있다."],
  // 손으로 적은 「아직 안 나왔다」는 늙는다 — 측정에 Bing 노출이 하나도 없을 때만 띄운다
  ...(serp.some((r) => r.engine === "bing") && !serp.some((r) => r.engine === "bing" && r.hit)
    ? [["Bing 검색에 나오게 하기", "지금 Bing 에는 안 나온다. ChatGPT 검색이 Bing 을 쓰니 다음으로 풀 일이다."]] : []),
  ["같은 방법으로 계속 재기", "AI·질문·재는 방법을 바꾸지 않는다. 방법이 다른 숫자는 합치지 않는다."],
];

const TITLE = PRIVATE ? "로봇&amp;코딩학원 · AI 노출 기록" : "코딩·로봇 학원 한 곳 · AI 답변에 이름이 나오기까지";
const rivalHit = serp.some((r) => r.hit && r.kind === "경쟁");
/** 엔진이 셋이다. 전에는 「naver 가 아니면 Bing」이라 통합검색 노출이 Bing 으로 찍혔다. */
const ENG = { naver: "네이버 웹문서", naver_all: "네이버 통합검색", bing: "Bing" };
const eng = (e) => ENG[e] ?? e;
const KIND = { 색인: "사이트 등록 확인", 브랜드: "학원 이름", 경쟁: "동네 검색어" };
const STAGE = { local: "동네 학원 찾기", problem: "고민 상담", consider: "고르는 기준", brand: "학원 이름 (확인용)" };
const VENDOR = {
  openai: "OpenAI (ChatGPT)", anthropic: "Anthropic (Claude)", google: "구글", microsoft: "마이크로소프트 (Bing)",
  naver: "네이버", apple: "애플", meta: "메타", perplexity: "퍼플렉시티", amazon: "아마존", bytedance: "바이트댄스", duckduckgo: "덕덕고",
};
const vendor = (v) => VENDOR[v] ?? v;
const 퍼센트 = (k, n) => n ? Math.round((k / n) * 100) : 0;
/**
 * 같은 질문을 매일 되풀이하니 날마다 흔들리는 폭이 표본 수만 볼 때보다 크다. n≈120 에서 5%p 는 오차 한 칸 정도다 (Richard 10-12).
 * 그래서 10%p 넘어야 「늘었다」, 5~10%p 는 「흔들림일 수 있음」을 붙인다. 비율은 반올림 전 값으로 뺀다
 */
const 판정 = (a, b) => {
  const d = (b.k / b.n - a.k / a.n) * 100;
  return d >= 10 ? "늘었다" : d >= 5 ? "조금 늘었다 (흔들림일 수 있음)"
    : d <= -10 ? "줄었다" : d <= -5 ? "조금 줄었다 (흔들림일 수 있음)" : "비슷";
};
// 머리 숫자는 학원 이름 없이 친 동네 검색어만 — 이름 검색은 성과로 세지 않는다
const 네이버 = serp.filter((r) => r.engine === "naver" && r.kind === "경쟁");
const 네이버나옴 = 네이버.filter((r) => r.hit);
const 빙 = serp.filter((r) => r.engine === "bing" && r.kind === "경쟁");
const AI방문 = crawl.filter((r) => 분류(r.bot) === "AI").reduce((s, r) => s + r.hits, 0);
const 검색방문 = crawl.filter((r) => 분류(r.bot) === "검색").reduce((s, r) => s + r.hits, 0);

/** 곳 이름과 방법 한 줄 (web/lib/asks.ts howOf 와 같은 말) */
const 곳이름 = (m) => /^chatgpt/.test(m) ? "ChatGPT" : /^perplexity/.test(m) ? "퍼플렉시티" : /^gemini/.test(m) ? "Gemini"
  : /claude/.test(m) ? "Claude" : /openrouter/.test(m) ? "OpenRouter" : m.replace(/^api-/, "");
const 방법글 = (m) =>
  m.endsWith("-web-logged-out") ? "로그아웃 화면 · 한국어(ko-KR) · 하루 1회"
  : m === "claude-code-headless-websearch" ? "Claude Code(Max) 웹 검색 경유 — claude.ai 화면과 다를 수 있음 · 하루 1회"
  : m.startsWith("api-") ? "API 경유 — 소비자 화면이 아님"
  : "손으로 잰 기록";
const 방법줄 = 방법들.map((r) =>
  `<b>${esc(곳이름(r.collection_method))}</b> — 방법: ${esc(방법글(r.collection_method))} · 기간 ${day(r.first)}~${day(r.last)} (잰 날 ${r.days}일) · 표본 ${r.n}`);
const 원문보관 = 방법들.reduce((a, r) => a + r.kept, 0);
const 표본합 = 방법들.reduce((a, r) => a + r.n, 0);
const 칠일곳 = [...new Set(칠일.map((r) => r.collection_method))].sort();
const 칠일질문 = [...new Map(칠일.map((r) => [r.prompt_id, r])).values()]
  .sort((a, b) => (Number(a.prompt_id.replace(/\D/g, "")) || 0) - (Number(b.prompt_id.replace(/\D/g, "")) || 0));
const 칸 = (pid, m) => 칠일.find((r) => r.prompt_id === pid && r.collection_method === m);

const out = `<title>${TITLE}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap">
<style>
:root{--bg:#F8F7F4;--card:#FFF;--sunken:#F1EFE9;--line:#E3E0D8;--line-2:#EDEBE4;
  --ink:#15171A;--ink-2:#4A4E54;--ink-3:#8A8375;--accent:#B5760A;--ok:#2F7D5B;--wait:#9A7B2E}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0F1319;--card:#161C25;--sunken:#1A212B;--line:#252E3B;--line-2:#1E2631;
  --ink:#E9EDF3;--ink-2:#A9B3C1;--ink-3:#6F7A8A;--accent:#F5A623;--ok:#3DD6A0;--wait:#E0B85C}}
:root[data-theme="dark"]{--bg:#0F1319;--card:#161C25;--sunken:#1A212B;--line:#252E3B;--line-2:#1E2631;
  --ink:#E9EDF3;--ink-2:#A9B3C1;--ink-3:#6F7A8A;--accent:#F5A623;--ok:#3DD6A0;--wait:#E0B85C}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"Noto Sans KR",system-ui,sans-serif;font-size:15px;line-height:1.75;-webkit-font-smoothing:antialiased;word-break:keep-all}
.mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
.wrap{max-width:880px;margin:0 auto;padding:0 24px}
header{padding:62px 0 30px;border-bottom:1px solid var(--line)}
.eb{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
h1{font-size:clamp(26px,4vw,36px);font-weight:900;letter-spacing:-.035em;line-height:1.24;margin:12px 0 14px}
.dek{font-size:15.5px;color:var(--ink-2);max-width:70ch;margin:0}
.dek b{color:var(--ink)}
h2{font-size:19px;font-weight:800;letter-spacing:-.025em;margin:48px 0 5px}
h2 .n{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-3);letter-spacing:.1em;margin-right:9px;font-weight:400}
.sub{color:var(--ink-2);font-size:14.5px;margin:0 0 16px;max-width:70ch}
.sub b{color:var(--ink)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:18px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 17px}
.kpi .v{font-family:"IBM Plex Mono",monospace;font-size:26px;font-weight:500;color:var(--ink);letter-spacing:-.02em}
.kpi .v small{font-size:13px;color:var(--ink-3);margin-left:3px}
.kpi .k{font-size:12.5px;color:var(--ink-3);margin-top:5px}
.kpi.hi .v{color:var(--accent)}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);margin-top:14px}
table{border-collapse:collapse;width:100%;font-size:14.2px;min-width:520px}
th,td{text-align:left;padding:11px 15px;border-bottom:1px solid var(--line-2);vertical-align:top}
thead th{background:var(--sunken);font-size:11.5px;letter-spacing:.07em;color:var(--ink-3);font-weight:600;white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td.m{font-family:"IBM Plex Mono",monospace;font-size:13px;color:var(--ink-3);white-space:nowrap}
td b{color:var(--ink)}
.no{color:var(--ink-3)}
.bar{display:inline-block;width:78px;height:5px;border-radius:4px;background:var(--sunken);
  overflow:hidden;vertical-align:middle;margin-right:9px}
.bar i{display:block;height:100%;background:var(--accent)}
.tl{border-left:2px solid var(--line);padding-left:20px;margin-top:16px}
.tl .e{position:relative;padding-bottom:19px}
.tl .e::before{content:"";position:absolute;left:-25px;top:9px;width:8px;height:8px;border-radius:50%;
  background:var(--accent);border:2px solid var(--bg)}
.tl .e .d{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--ink-3)}
.tl .e .t{font-size:15.5px;font-weight:700;margin:2px 0 4px}
.tl .e p{margin:0;font-size:14.2px;color:var(--ink-2);line-height:1.75}
.box{border-left:3px solid var(--accent);background:color-mix(in oklab,var(--accent) 7%,var(--bg));
  border-radius:0 12px 12px 0;padding:17px 20px;margin-top:20px}
.box p{margin:0 0 9px;font-size:14.5px;color:var(--ink-2);line-height:1.85}
.box p:last-child{margin-bottom:0}
.box b{color:var(--ink)}
.todo{display:flex;flex-direction:column;gap:9px;margin-top:14px}
.td{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:14px 16px}
.td .h{font-size:14.8px;font-weight:700;color:var(--ink);margin-bottom:4px}
.td p{margin:0;font-size:13.8px;color:var(--ink-2);line-height:1.7}
footer{padding:40px 0 68px;margin-top:42px;border-top:1px solid var(--line);color:var(--ink-3);font-size:12.5px}
</style>

<header><div class="wrap">
  <div class="eb">원장이 직접 운영하는 학원으로 시험 중</div>
  <h1>${TITLE}</h1>
  <p class="dek">
    ${PRIVATE
      ? `서울 송파구 석촌동 코딩·로봇·AI 학원. 시작 <b>2026년 9월 5일</b>. 만든 시각 ${d(new Date())}.`
      : `저희가 직접 운영하는 코딩·로봇 학원에서 먼저 해 본 기록입니다. <b>학원 이름·동네·사이트 주소·다른 학원 이름은 가렸습니다.</b>
    날짜는 시작한 날을 1일차로 셉니다. 오늘이 ${nth(new Date())}일차입니다.`}
    숫자는 전부 <b>학원 기록에서 자동으로</b> 가져왔습니다. 아직 모르는 것은 모른다고 적었습니다.
  </p>
</div></header>

<div class="wrap">

  <h2><span class="n">00</span>한눈에 — 처음과 지금</h2>
  <p class="sub">시작한 날과 오늘을 나란히 놓았습니다.</p>
  <div class="tw"><table>
    <thead><tr><th>무엇을 봤나</th><th>시작 전</th><th>지금 (${nth(new Date())}일차)</th></tr></thead>
    <tbody>
      <tr><td>학원 사이트에 올린 글</td><td class="no">0편</td><td><b>새로 쓴 글 ${posts.new}편</b> (그 전 블로그 글 ${posts.n - posts.new}편을 옮겨 와 모두 ${posts.n}편)</td></tr>
      <tr><td>학원 이름 없이 동네 검색어로 찾을 때</td><td class="no">그때 고른 동네 검색어 4개 모두 안 나옴</td><td>${네이버.length ? `<b>${eng("naver")} — 지금 재는 동네 검색어 ${네이버.length}개 중 ${네이버나옴.length}개 나옴</b>${네이버나옴.some((r) => r.rank === 1) ? ` (1위 ${네이버나옴.filter((r) => r.rank === 1).length}개)` : ""}` : "아직 안 잼"}${빙.length ? `<br>Bing ${빙.length}개 중 ${빙.filter((r) => r.hit).length}개` : ""}</td></tr>
      <tr><td>AI·검색 프로그램이 읽으러 온 횟수</td><td class="no">0회</td><td><b>${(AI방문 + 검색방문).toLocaleString()}회</b> (AI ${AI방문.toLocaleString()} · 검색 ${검색방문.toLocaleString()})</td></tr>
      ${scan ? `<tr><td>사이트 점검 점수</td><td class="no">83점</td><td><b>${scan.total}점</b></td></tr>` : ""}
    </tbody>
  </table></div>
${비교.length ? `
  <p class="sub" style="margin-top:22px"><b>AI 에게 물었을 때 이 학원 이름이 나왔나.</b>
    같은 질문을 매일 한 번씩 묻습니다. 처음 잰 7일과 최근 7일을 비교했습니다. 학원 이름을 직접 넣은 질문은 뺐습니다.</p>
  <div class="tw"><table>
    <thead><tr><th>AI</th><th>처음 7일</th><th>최근 7일</th><th>이 학원 사이트 링크까지</th><th>결과</th></tr></thead>
    <tbody>${비교.map(({ m, a, b }) => `<tr>
      <td><b>${esc(곳이름(m))}</b></td>
      <td class="m">${a.n}번 중 ${a.k}번 (${퍼센트(a.k, a.n)}%)</td>
      <td class="m"><b>${b.n}번 중 ${b.k}번 (${퍼센트(b.k, b.n)}%)</b></td>
      <td class="m">${a.c}번 → ${b.c}번</td>
      <td>${판정(a, b)}</td></tr>`).join("")}
    </tbody>
  </table></div>
  <p class="sub" style="margin-top:8px">${day(`${비교시작}T12:00:00+09:00`)}부터 셉니다. 네 AI 를 매일 같은 방법으로 재기 시작한 날입니다. 두 기간에 모두 물은 질문만 셌습니다.
    같은 질문을 매일 되풀이하면 답이 조금씩 흔들립니다. 그래서 10%p 넘게 움직여야 「늘었다」고 적고, 5~10%p 는 흔들림일 수 있다고 적습니다. AI 마다 재는 방법이 달라 서로 합치지 않습니다.</p>` : ""}
  <p class="sub" style="margin-top:8px">검색 줄의 「시작 전」과 「지금」은 검색어 묶음이 다릅니다. 시작 전에는 동네 검색어 4개를 손으로 넣어 봤고, 지금은 매일 동네 검색어 ${네이버.length || 빙.length}개를 자동으로 잽니다. 같은 검색어끼리 비교한 건 아닙니다.</p>

  <h2><span class="n">01</span>시작할 때는 어땠나</h2>
  <p class="sub">
    학부모가 실제로 칠 만한 검색어 6개를 넣고 <b>무엇이 나오는지</b> 적었습니다.
    이걸 먼저 적어 두지 않으면 나중에 「좋아졌다」는 말은 느낌일 뿐입니다.
  </p>
  <div class="tw"><table>
    <thead><tr><th>검색어</th><th>이 학원</th><th>대신 나온 곳</th></tr></thead>
    <tbody>${BASELINE.map(([q, w]) =>
      `<tr><td>${esc(q)}</td><td class="no">안 나옴</td><td class="m">${esc(w)}</td></tr>`).join("")}
    </tbody>
  </table></div>
  <div class="box"><p>
    <b>6개 모두 안 나왔습니다.</b> 더 눈여겨볼 점 —
    위쪽에 <b>학원 홈페이지가 하나도 없었습니다.</b> 전부 학원 모음 사이트였습니다.
    홈페이지만 잘 만들어서는 이 검색어에서 모음 사이트를 못 이긴다는 뜻입니다.
  </p></div>

  <h2><span class="n">02</span>지금까지 한 일</h2>
  <div class="tl">${TIMELINE.map(([when, t, p]) =>
    `<div class="e"><div class="d">${dt(when)}</div><div class="t">${esc(t)}</div><p>${esc(p)}</p></div>`).join("")}
  </div>

  <h2><span class="n">03</span>사이트는 얼마나 갖춰졌나</h2>
  <div class="kpis">
    <div class="kpi hi"><div class="v">${scan ? scan.total : "—"}<small>/100</small></div><div class="k">사이트 점검 점수 (처음 83)</div></div>
    <div class="kpi"><div class="v">${posts.new}<small>편</small></div><div class="k">시작 뒤 새로 쓴 글 (옮겨 온 글 ${posts.n - posts.new}편 별도)</div></div>
    <div class="kpi"><div class="v">${Number(posts.chars).toLocaleString()}<small>자</small></div><div class="k">글 분량 합계</div></div>
  </div>
${scan ? `
  <p class="sub" style="margin-top:18px">점검 점수는 항목별로 이렇게 나왔습니다. 문단 점수가 낮은 건 한 문단이 너무 길거나 짧아 AI 가 잘라 쓰기 어려운 곳이 많다는 뜻입니다.</p>
  <div class="tw"><table>
    <thead><tr><th>점검 항목</th><th>점수</th><th>무엇을 봤나</th></tr></thead>
    <tbody>${Object.entries(scan.checks).map(([k, v]) => `<tr>
      <td>${CHECK_KO[k] || k}</td>
      <td class="m"><span class="bar"><i style="width:${v.score}%"></i></span>${v.score}</td>
      <td>${esc(
        k === "crawler" ? `AI 프로그램 ${허용.AI}종 · 검색 프로그램 ${허용.검색}종${허용.기타 ? ` · 기타 ${허용.기타}종` : ""}에 출입 허락` :
        k === "sitemap" ? `검색엔진에 알려 준 쪽 ${v.urls}개` :
        k === "ssr" ? `한 쪽 평균 ${v.avgTextLen}자 · 내용이 빈약한 쪽 ${v.thinPages}개` :
        k === "schema" ? `학원 정보 ${v.types.length}종 표시 · 오류 ${v.invalid}개` :
        k === "chunk" ? `문단 ${v.paragraphs}개 중 알맞은 길이 ${v.inBand}개` :
        k === "patterns" ? `질문으로 된 제목 ${v.questionHeadings}개 · 숫자가 든 문장 ${v.numericFacts}개` :
        `안내문 ${v.sections}개 항목`)}</td></tr>`).join("")}
    </tbody>
  </table></div>` : ""}

  <h2><span class="n">04</span>누가 읽으러 왔나</h2>
  <p class="sub">
    AI 답에 이름이 나오기까지는 몇 주가 걸립니다. 그 전에 먼저 움직이는 게
    <b>AI·검색 프로그램이 실제로 사이트를 읽으러 왔는가</b>입니다.
    이건 사이트가 직접 기록하지 않으면 알 수 없습니다.
  </p>
${crawl.length ? `
  <div class="kpis">
    <div class="kpi hi"><div class="v">${AI방문.toLocaleString()}<small>회</small></div><div class="k">AI 프로그램이 온 횟수</div></div>
    <div class="kpi"><div class="v">${검색방문.toLocaleString()}<small>회</small></div><div class="k">검색 프로그램이 온 횟수 (구글·Bing·네이버 등)</div></div>${crawl.some((r) => 분류(r.bot) === "기타") ? `
    <div class="kpi"><div class="v">${crawl.filter((r) => 분류(r.bot) === "기타").reduce((s, r) => s + r.hits, 0)}<small>회</small></div><div class="k">어느 쪽인지 모르는 프로그램</div></div>` : ""}
  </div>
  <div class="tw"><table>
    <thead><tr><th>프로그램 이름</th><th>종류</th><th>회사</th><th>온 횟수</th><th>읽은 쪽</th><th>처음 온 날</th><th>마지막 온 날</th></tr></thead>
    <tbody>${crawl.map((r) => `<tr>
      <td><b>${esc(r.bot)}</b></td><td class="m">${분류(r.bot)}</td><td>${esc(vendor(r.vendor))}</td>
      <td class="m">${r.hits}</td><td class="m">${r.pages}</td>
      <td class="m">${day(r.first_seen)}</td><td class="m">${day(r.last_seen)}</td></tr>`).join("")}
    </tbody>
  </table></div>
  <div class="box"><p>
    <b>처음 온 건 ${d(firstHit)}.</b> 사이트 주소를 연결한 다음 날 새벽입니다.
    ${crawl.some((r) => r.vendor === "anthropic")
      ? "Claude 를 만드는 회사의 프로그램이 출입 규칙을 먼저 읽고, 옮겨 온 블로그 글을 가져갔습니다."
      : ""}
    ${(() => {
      const search = crawl.filter((r) => 분류(r.bot) === "검색");
      if (!search.length) return "검색 프로그램은 아직 안 왔습니다. 등록 직후라 정상입니다.";
      return "검색 프로그램도 왔습니다 — "
        + search.map((r) => `${esc(vendor(r.vendor))} ${r.hits}회`).join(", ") + ".";
    })()}
  </p></div>
` : `<div class="box"><p>아직 온 기록이 없습니다. 등록 직후에는 정상입니다.</p></div>`}

  <h2><span class="n">05</span>검색하면 나오나</h2>
  <p class="sub">
    프로그램이 읽고 갔다고 해서 사람이 검색으로 찾을 수 있는 건 아닙니다.
    아래는 <b>매일 실제로 검색해 본 결과</b>입니다. 검색엔진마다 반영 속도가 달라 따로 봅니다.
  </p>
${serp.length ? `
  <div class="tw"><table>
    <thead><tr><th>어디서</th><th>무슨 검색어</th><th>검색어</th><th>결과</th></tr></thead>
    <tbody>${serp.map((r) => `<tr>
      <td class="m">${esc(eng(r.engine))}</td>
      <td class="m">${esc(KIND[r.kind] ?? r.kind)}</td>
      <td>${esc(r.query)}</td>
      <td class="m">${r.hit ? (r.rank ? `<b>${r.rank}위</b><br><small>${day(`${r.day}T12:00:00+09:00`)} 확인</small>` : `<b>나옴</b>`) : `<span class="no">안 나옴</span>`}</td>
    </tr>`).join("")}
    </tbody>
  </table></div>
${serpFirst.length ? `
  <div class="box"><p>
    <b>처음 나온 날.</b>
    ${serpFirst.map((f) =>
      `${esc(eng(f.engine))} &middot; ${esc(f.query)} &mdash; ${day(f.d)}${f.at_start ? " (재기 시작한 날 이미 나와 있었음)" : ""}`).join("<br>")}
  </p></div>` : ""}
${serp.some((r) => r.engine === "bing") ? `
  <div class="box"><p>
    <b>Bing 기록을 바로잡았습니다 (${day(`2026-10-12T12:00:00+09:00`)}).</b> 그 전까지는 Bing 에 「안 나옴」으로 적혀 있었습니다.
    재는 방법이 틀렸습니다. 프로그램으로 Bing 을 검색하면, Bing 은 검색어와 상관없는 결과를 내줍니다. 그걸 그대로 셌습니다.
    지금은 진짜 브라우저로 검색합니다. 그날 Bing 이 이상한 결과를 내면 「못 잼」으로 빼고 저장하지 않습니다.
    그래서 Bing 에 언제부터 나왔는지는 <b>모릅니다</b>. Bing 관리 화면에는 그날 이미 이 사이트 27쪽이 등록돼 있었습니다.
  </p></div>` : ""}
  <div class="box"><p>
    구글은 자동으로 검색해 보면 막혀서 여기서 세지 않습니다. 구글이 제공하는 관리 화면에서 쪽마다 따로 확인합니다.
    ${rivalHit
      ? `<b>학원 이름 없이 동네 이름만 친 검색어에도 나오기 시작했습니다.</b>
    학원 이름과 정확한 동네 이름으로 먼저 나왔고, 그다음에 동네 검색어가 붙었습니다.`
      : `<b>학원 이름 없이 동네 이름만 친 검색어에는 아직 안 나옵니다.</b>
    보통 학원 이름으로 먼저 나오고, 동네 검색어는 그다음입니다.`}
    ${serp.some((r) => r.engine === "bing") && !serp.some((r) => r.engine === "bing" && r.hit) ? `<b>Bing 에는 아직 하나도 안 나옵니다.</b> 이 기록의 가장 큰 빈칸입니다.` : ""}
  </p></div>
` : `<div class="box"><p>아직 검색해 본 기록이 없습니다.</p></div>`}

  <h2><span class="n">06</span>AI 에게 물어보면 나오나</h2>
  <p class="sub">학부모가 AI 에게 할 법한 질문을 매일 같은 방법으로 묻고, 답에 이 학원 이름이나 사이트가 나오는지 셉니다.
    한 번 나온 걸로 「나온다」고 하지 않습니다. 7번 물어 몇 번 나왔는지로 셉니다.</p>
  ${칠일곳.length ? (() => {
    const 일반 = 칠일질문.filter((x) => x.stage !== "brand");
    const 이름 = 칠일질문.filter((x) => x.stage === "brand");
    const 합 = (m, list) => list.reduce((s, x) => { const c = 칸(x.prompt_id, m); return c ? { n: s.n + c.n, k: s.k + c.k } : s; }, { n: 0, k: 0 });
    return `<p class="sub" style="margin-top:14px"><b>최근 7일, 질문별로.</b></p>
  <div class="tw"><table>
    <thead><tr><th>질문 (종류)</th>${칠일곳.map((m) => `<th>${esc(곳이름(m))}</th>`).join("")}</tr></thead>
    <tbody>${일반.map((x) => `<tr>
      <td>${esc(x.prompt_id)} · ${esc(STAGE[x.stage] ?? x.stage ?? "")}${PRIVATE ? ` · ${esc(x.q)}` : ""}</td>
      ${칠일곳.map((m) => { const c = 칸(x.prompt_id, m); return `<td class="m">${c ? `${c.n}번 중 ${c.k}번` : "—"}</td>`; }).join("")}</tr>`).join("")}
      <tr><td><b>합계</b> (학원 이름 질문 빼고)</td>${칠일곳.map((m) => { const s = 합(m, 일반); return `<td class="m"><b>${s.n}번 중 ${s.k}번</b></td>`; }).join("")}</tr>
      ${이름.map((x) => `<tr>
      <td class="no">${esc(x.prompt_id)} · ${esc(STAGE[x.stage])}${PRIVATE ? ` · ${esc(x.q)}` : ""}</td>
      ${칠일곳.map((m) => { const c = 칸(x.prompt_id, m); return `<td class="m">${c ? `${c.n}번 중 ${c.k}번` : "—"}</td>`; }).join("")}</tr>`).join("")}
    </tbody>
  </table></div>
  ${이름.length ? `<p class="sub" style="margin-top:8px">학원 이름을 넣은 질문은 AI 가 이 학원을 제대로 아는지 보는 확인용입니다. 성과 숫자에 넣지 않습니다.</p>` : ""}`;
  })() : ""}
  <details style="margin-top:14px"><summary class="sub" style="cursor:pointer">재는 방법과 날짜별 원래 기록 보기</summary>
  <div class="box">
    ${방법줄.length ? `<p><b>AI 마다 잰 방법</b><br>${방법줄.join("<br>")}<br>
    답 원문과 출처 목록을 질문마다 보관합니다 (${표본합}건 중 ${원문보관}건). 나중에 다시 세어 볼 수 있습니다.</p>` : ""}
    <p><b>날짜별 기록 ${aiRounds.length}회</b> — 「링크」는 답에 이 학원 사이트 주소가 붙은 것, 「이름만」은 주소 없이 이름만 나온 것입니다.<br>
    ${aiRounds.map((r) => `${day(r.measured_day)} ${esc(곳이름(r.collection_method))}: 링크 ${r.cited}/${r.n} · 이름만 ${r.mentioned}/${r.n}`).join("<br>")}</p>
  </div>
  </details>

  <h2><span class="n">07</span>아직 모르는 것, 약한 점</h2>
  <div class="box">
    <p><b>원장 본인 학원이라 바로 고칠 수 있었습니다.</b> 다른 회사는 사이트 권한·담당자·결재가 있어 같은 일에 몇 주가 걸립니다.
    다음 고객사에서 확인할 것은 기술이 아니라 <b>걸리는 시간</b>입니다.</p>
    <p>시작할 때 AI 답에 학원 이름이 나오면, 출처는 학원 모음 사이트였습니다.
    그렇다면 사이트를 못 고치는 회사라도 길은 있습니다. 그때는 홈페이지 점수가 아니라 <b>모음 사이트에 올라가는 것</b>이 할 일이 됩니다.</p>
    <p>AI 를 보고 상담을 온 사람이 몇 명인지는 이 문서에서 아직 세지 않습니다.</p>
  </div>

  <h2><span class="n">08</span>다음에 할 일</h2>
  <div class="todo">${TODO.map(([h, p]) =>
    `<div class="td"><div class="h">${esc(h)}</div><p>${esc(p)}</p></div>`).join("")}
  </div>

${snaps.length > 1 ? `
  <h2><span class="n">09</span>날마다 쌓인 기록</h2>
  <p class="sub">이 학원 사이트에 온 것만, 그날 밤 12시(한국 시각)까지 쌓인 수입니다. 위 숫자와 같은 방법으로 셉니다.</p>
  <div class="tw"><table>
    <thead><tr><th>${PRIVATE ? "날짜" : "일차"}</th><th>올린 글</th><th>AI 프로그램 (누적)</th><th>검색 프로그램 (누적)</th><th>다녀간 회사 수</th></tr></thead>
    <tbody>${snaps.map((s) => `<tr>
      <td class="m">${day(`${s.day}T12:00:00+09:00`)}</td>
      <td class="m">${s.posts}</td><td class="m">${s.ai_total}</td><td class="m">${s.search_total}</td>
      <td class="m">${(s.vendors || []).length || "—"}</td></tr>`).join("")}
    </tbody>
  </table></div>` : ""}

</div>
<footer><div class="wrap mono">
  ${PRIVATE ? "robotncoding.com · " : ""}올리기 전 글 ${drafts.n}편 · 이 문서는 학원 기록에서 자동으로 만듭니다
</div></footer>`;

/**
 * 기본은 조각(fragment)을 표준출력으로 보낸다 — 아티팩트로 올릴 때 쓰던 방식이다.
 * --out 을 주면 그대로 브라우저에 띄울 수 있는 완결된 문서로 감싸서 파일에 쓴다.
 * 영업에서 링크로 보내려면 URL 이 있어야 하고, URL 로 열리려면 문서여야 한다.
 */
const outArg = process.argv.indexOf("--out");
if (outArg > 0 && process.argv[outArg + 1]) {
  const file = path.resolve(process.cwd(), process.argv[outArg + 1]);
  if (PRIVATE && /[\\/]public[\\/]/.test(file)) {
    console.error("✗ --private 원본은 public 폴더에 쓰지 않습니다.");
    process.exit(1);
  }
  const doc = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
${out.slice(0, out.indexOf("</style>") + 8)}
</head>
<body>
${out.slice(out.indexOf("</style>") + 8)}
</body>
</html>`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, doc, "utf8");
  console.log(`${path.relative(process.cwd(), file)} · ${doc.length.toLocaleString("ko-KR")}자`);
} else {
  process.stdout.write(out);
}
await pool.end();
