// 고객 설정을 DB 로(Step 37) 단위 시험 — 가짜 행·가짜 q 만. DB·네트워크·Claude 없음.
//   node scripts/test-clients.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIENTS, lit, 고객설정, loadClients, 고객고르기, bySlug, indexClients } from "../clients.mjs";
import { 고객사말 } from "../masks.mjs";
import { 측정설정 } from "../measure-targets.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참) => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}`); } };
const 던짐 = async (f) => { try { await f(); return null; } catch (e) { return e; } };
/** stderr 를 잠깐 받아 둔다 — loadClients 의 경고 줄을 본다 */
const 받기 = async (f) => {
  const 원래 = console.error, 줄 = [];
  console.error = (...a) => 줄.push(a.join(" "));
  try { return { 값: await f(), 줄 }; } finally { console.error = 원래; }
};

// ─────────────────────────────────────────── lit — 사람 말을 글자 그대로
봄("lit C++ 학원", new RegExp(lit("C++ 학원")).test("우리 C++ 학원") && !new RegExp(lit("C++ 학원")).test("CC 학원"));
봄("lit a.b 는 axb 에 안 걸림", new RegExp(lit("a.b")).test("a.b") && !new RegExp(lit("a.b")).test("axb"));
봄("lit (주)", new RegExp(lit("(주)아이로그")).test("(주)아이로그") && !new RegExp(lit("(주)아이로그")).test("주아이로그"));
const 특수 = ".*+?^${}()|[]\\";
봄("lit 특수 글자 전부", new RegExp(`^${lit(특수)}$`).test(특수));

// ─────────────────────────────────────────── 고객설정 — 기본값 전 칸
const 행 = { id: 77, slug: "new-co", name: "새고객", domain: "https://www.New-Co.kr/home", answer_pattern: "새고객|new-co\\.kr", relation: "외부", status: "active", config: {} };
const 새 = 고객설정(행, {});
봄("domain 정리", 새.domain === "new-co.kr");
봄("brandRe 기본 = 도메인만", 새.brandRe.test("new-co.kr 에서") && !새.brandRe.test("새고객") && !새.brandRe.test("new-coxkr"));
봄("answerRe = answer_pattern(i)", 새.answerRe.test("NEW-CO.KR") && 새.answerRe.flags.includes("i"));
봄("presenceRe 없음", 새.presenceRe === null);
봄("queries = site: + 브랜드 이름, 경쟁 없음", JSON.stringify(새.queries) === JSON.stringify([
  { id: "idx", q: "site:new-co.kr", kind: "색인" }, { id: "b1", q: "새고객", kind: "브랜드" }]));
봄("빠짐에 경쟁 없음", 새.빠짐.includes("queries.compete 없음"));
봄("llmsTxt false · gsc false · publishes false", 새.llmsTxt === false && 새.gsc === false && 새.publishes === false);
봄("siteLog 기본", 새.siteLog === "방문 기록 장치 없음" && 새.출처.siteLog === "기본");
봄("indexnow 기본 우리·키 없음", 새.indexnow.mode === "우리" && 새.indexnowKey === undefined);
봄("brandHit null", 새.loop.brandHit === null);
봄("homeLd @type + 도메인", 새.loop.homeLd.length === 2 && 새.loop.homeLd[0].test('"@type"') && 새.loop.homeLd[1].test("https://new-co.kr/"));
봄("homeLdMissing", 새.loop.homeLdMissing === "홈 JSON-LD 에 @type 또는 new-co.kr 없음");
봄("homeLdFix 기본", 새.loop.homeLdFix === "고객 사이트는 우리 저장소에서 고치지 않습니다. 고객 담당에게 넘깁니다.");
봄("draft session · draftWhere", 새.loop.draft === "session" && 새.loop.draftWhere === "deliverables/new-co/guide/ 제안");
봄("probes variants · forms", 새.loop.probes === "variants" && JSON.stringify(새.loop.probeVariants.forms) === JSON.stringify(["{기능} 추천", "{기능} 무료"]));
봄("strip 은 g · 틀 말 6개", 새.loop.probeVariants.strip.flags.includes("g") && "pdf 합치기 추천 무료 방법 사이트 앱 프로그램".replace(새.loop.probeVariants.strip, "").replace(/\s+/g, " ").trim() === "pdf 합치기");
봄("seeds 기본 빈", Array.isArray(새.loop.probeVariants.seeds) && !새.loop.probeVariants.seeds.length);
봄("offsite 두 줄 · 이름만 들어감", 새.loop.offsite.length === 2 && 새.loop.offsite[0].includes("새고객 사실") && !새.loop.offsite.join("").includes("문서딱"));
봄("marketing 기본 꺼짐", 새.marketing.enabled === false && !새.marketing.pages.length && 새.marketing.disclosure === null);
봄("blogDays [1,4] · blogProfile", JSON.stringify(새.marketing.blogDays) === "[1,4]" && 새.marketing.blogProfile === ".browser-profile-new-co");
봄("blogId 는 env NAVER_BLOG_ID_NEW_CO", 고객설정(행, { NAVER_BLOG_ID_NEW_CO: "blog1" }).marketing.blogId === "blog1" && 새.marketing.blogId === null);
봄("코드 덩어리와 같은 칸", ["brandRe", "answerRe", "queries", "llmsTxt", "publishes", "siteLog", "gsc", "loop", "marketing"].every((k) => k in 새));
봄("출처 표시", 새.출처.brandRe === "기본" && 새.출처.queries === "기본" && 새.출처.name === "입력");
봄("answer_pattern 없음 → 빠짐", 고객설정({ ...행, answer_pattern: null }, {}).빠짐.includes("answerRe 없음"));

// config 가 이긴다 · derived 는 그 다음
const 입력 = 고객설정({ ...행,
  config: { v: 1, brandWords: ["새고객 본점"], hitWords: ["C++ 수업"], queries: { compete: ["코딩 학원", "C++ 학원"], brand: ["새고객 후기"] },
    llmsTxt: false, gsc: true, siteLog: "기록 장치 단 날 2026-10-01", indexnow: { mode: "우리", key: "abcdef0123456789" },
    loop: { draftWhere: "고객 CMS", seeds: ["pdf 병합"] },
    marketing: { enabled: true, pages: [{ all: [["pdf"], ["합치", "병합"]], guide: "/guide/a/", tool: "/a/" }], disclosure: "직접 만든 곳입니다", blogId: "myblog" } },
  derived: { llmsTxt: { ok: true }, homeLdTypes: ["WebSite", "Organization"] } }, {});
봄("config brandWords", 입력.brandRe.test("새고객 본점") && !입력.brandRe.test("new-co.kr") && 입력.출처.brandRe === "입력");
봄("hitWords → brandHit (lit)", 입력.loop.brandHit.test("c++ 수업 해요") && !입력.loop.brandHit.test("cc 수업"));
봄("경쟁·브랜드 검색어", 입력.queries.map((x) => `${x.id}:${x.q}`).join("|") === "idx:site:new-co.kr|c1:코딩 학원|c2:C++ 학원|b1:새고객 후기");
봄("config llmsTxt false 가 derived true 를 이김", 입력.llmsTxt === false && 입력.출처.llmsTxt === "입력");
봄("derived llmsTxt 는 config 없을 때", 고객설정({ ...행, derived: { llmsTxt: { ok: true } } }, {}).llmsTxt === true
  && 고객설정({ ...행, derived: { llmsTxt: { ok: true } } }, {}).출처.llmsTxt === "점검");
봄("derived homeLdTypes 첫 것(Organization 먼저)", 입력.loop.homeLd.length === 3 && 입력.loop.homeLd[2].test('"Organization"') && 입력.loop.homeLdMissing.includes("Organization"));
봄("indexnow 키", 입력.indexnowKey === "abcdef0123456789");
봄("고객 배포면 키 안 씀", 고객설정({ ...행, config: { indexnow: { mode: "고객 배포", key: "abcdef0123456789" } } }, {}).indexnowKey === undefined);
봄("seeds · draftWhere", 입력.loop.probeVariants.seeds[0] === "pdf 병합" && 입력.loop.draftWhere === "고객 CMS");
봄("marketing 켜짐", 입력.marketing.enabled && 입력.marketing.pages.length === 1 && 입력.marketing.disclosure === "직접 만든 곳입니다" && 입력.marketing.blogId === "myblog");
봄("빠짐 = 없음", 입력.빠짐.length === 0);

// config 형 오류 — 그 칸만 기본값, 고객은 산다
const 틀림 = 고객설정({ ...행, config: { brandWords: "new-co", queries: { compete: "코딩 학원" }, gsc: "yes", hitWords: [1],
  indexnow: { mode: "우리", key: "../../etc" }, loop: { offsite: ["한 줄"] }, marketing: { enabled: true, pages: [{ all: "pdf", guide: "/g/", tool: "/t/" }], blogDays: [9] } } }, {});
봄("brandWords 글자 → 기본 도메인", 틀림.brandRe.test("new-co.kr") && 틀림.빠짐.includes("config.brandWords 형이 틀림"));
봄("compete 글자 → 빈 + 빠짐", !틀림.queries.some((x) => x.kind === "경쟁") && 틀림.빠짐.includes("config.queries.compete 형이 틀림"));
봄("gsc 글자 → false", 틀림.gsc === false && 틀림.빠짐.includes("config.gsc 형이 틀림"));
봄("hitWords 숫자 → null", 틀림.loop.brandHit === null && 틀림.빠짐.includes("config.hitWords 형이 틀림"));
봄("키 모양 틀림 → 안 씀", 틀림.indexnowKey === undefined && 틀림.빠짐.includes("config.indexnow.key 형이 틀림"));
봄("offsite 한 줄 → 기본 두 줄", 틀림.loop.offsite.length === 2 && 틀림.빠짐.includes("config.loop.offsite 형이 틀림"));
봄("pages 틀림 → 그 줄 빠짐", !틀림.marketing.pages.length && 틀림.빠짐.includes("config.marketing.pages 형이 틀림"));
봄("blogDays 9 → 기본", JSON.stringify(틀림.marketing.blogDays) === "[1,4]" && 틀림.빠짐.includes("config.marketing.blogDays 형이 틀림"));
봄("config 가 배열 → {} + 빠짐", 고객설정({ ...행, config: [] }, {}).빠짐.includes("config 형이 틀림"));
// 길이 상한 — 자르지 않고 칸 전체를 기본값
const 김 = 고객설정({ ...행, config: { brandWords: ["가".repeat(41)], queries: { compete: Array.from({ length: 21 }, (_, i) => `말${i}`) } } }, {});
봄("41자 말 → 기본 + 「말이 너무 김」", 김.brandRe.test("new-co.kr") && 김.빠짐.includes("config.brandWords 말이 너무 김"));
봄("21개 목록 → 빈 + 「말이 너무 김」", !김.queries.some((x) => x.kind === "경쟁") && 김.빠짐.includes("config.queries.compete 말이 너무 김"));
봄("40자 20개는 받음", 고객설정({ ...행, config: { queries: { compete: Array.from({ length: 20 }, () => "가".repeat(40)) } } }, {}).queries.filter((x) => x.kind === "경쟁").length === 20);

// ─────────────────────────────────────────── pages all — 문서딱 11줄을 all 로 옮겨도 같은 페이지를 고르나
const 문서딱 = bySlug("docttak", CLIENTS);
const 옮김 = [
  [["정부24"]], [["pdf"], ["합치", "병합"]], [["pdf"], ["용량"]], [["증명사진"], ["용량"]], [["사진"], ["용량", "kb"]], [["여권"]],
  [["공무원"]], [["큐넷"]], [["증명사진"], ["사이즈", "규격"]], [["hwpx"]], [["hwp", "한글파일"], ["pdf"]],
].map((all, i) => ({ all, guide: 문서딱.marketing.pages[i].guide, tool: 문서딱.marketing.pages[i].tool, ...(문서딱.marketing.pages[i].also ? { also: 문서딱.marketing.pages[i].also } : {}) }));
const 가짜문서딱 = 고객설정({ id: 90, slug: "fake-docttak", name: "가짜", domain: "docttak.com", config: { marketing: { enabled: true, pages: 옮김, disclosure: "x" } } }, {});
봄("11줄 다 읽힘", 가짜문서딱.marketing.pages.length === 11);
// 문서딱 승인 검색어(keyword) 17개 — geo.pilot_questions client_id=3 approved, 2026-10-05 조회
const 승인 = ["pdf 합치기 무료", "아이폰 pdf 합치기", "pdf 합치기 방법", "안전한 pdf 합치기", "파일 안 올리는 pdf 합치기", "pdf 용량 줄이기",
  "정부24 pdf 용량", "사진 용량 줄이기", "사진 kb 줄이기", "증명사진 용량 줄이기", "여권사진 규격", "증명사진 사이즈", "공무원 시험 사진 규격",
  "큐넷 사진 규격", "한글파일 pdf로 변환", "hwp pdf 변환", "hwpx 열기"];
const 고른것 = (pages, t) => pages.find((x) => x.re.test(t))?.guide ?? "-";
const 다름 = 승인.filter((t) => 고른것(문서딱.marketing.pages, t) !== 고른것(가짜문서딱.marketing.pages, t));
if (다름.length) for (const t of 다름) console.log(`  다름 | ${t} | 코드 ${고른것(문서딱.marketing.pages, t)} | all ${고른것(가짜문서딱.marketing.pages, t)}`);
봄(`승인 검색어 17개 같은 페이지 (다름 ${다름.length})`, 다름.length === 0);
봄("all 은 순서 무관", 가짜문서딱.marketing.pages[1].re.test("병합 PDF") && !문서딱.marketing.pages[1].re.test("병합 PDF"));
봄("all 대소문자 무시", 가짜문서딱.marketing.pages[9].re.test("HWPX 열기"));

// ─────────────────────────────────────────── loadClients — 가짜 q
const DB행 = [
  { id: 1, slug: "robotncoding", name: "로봇&코딩학원", domain: "robotncoding.com", status: "active", config: {} },
  { id: 2, slug: "ilog", name: "아이로그", domain: "ilog.ai.kr", status: "active", config: {} },
  { id: 3, slug: "docttak", name: "문서딱", domain: "docttak.com", status: "active", config: {} },
  { id: 9, slug: "zeta", name: "제타", domain: "zeta.kr", status: "active", answer_pattern: "제타", config: { queries: { compete: ["제타 검색"] } } },
  { id: 8, slug: "eta", name: "이타", domain: "eta.kr", status: "active", config: {} },
  { id: 12, slug: "e2e-x", name: "시험", domain: "x.kr", status: "test", config: {} },
];
/** status = any($1) 를 흉내 낸다. 순서는 id 순 */
const 가짜q = (행들) => async (sql, p) => 행들.filter((r) => p[0].includes(r.status)).sort((a, b) => a.id - b.id).map((r) => ({ r }));
{
  const { 값: l, 줄 } = await 받기(() => loadClients(가짜q(DB행)));
  봄("순서 = 코드 3곳 → DB id 순", l.map((c) => c.slug).join(",") === "robotncoding,ilog,docttak,eta,zeta");
  봄("코드 덩어리 그대로", l[0].presenceRe === CLIENTS[0].presenceRe && l[0].출처 === "코드" && l[1].answerRe === CLIENTS[1].answerRe);
  봄("DB 고객은 고객설정", l[4].출처.queries === "입력" && l[4].queries.some((x) => x.q === "제타 검색"));
  봄("test 행은 안 읽음", !l.some((c) => c.slug === "e2e-x"));
  봄("경고 없음", 줄.length === 0);
  const t = await loadClients(가짜q(DB행), { includeTest: true });
  봄("includeTest 면 test 행도", t.some((c) => c.slug === "e2e-x"));
  봄("slug 하나", (await loadClients(가짜q(DB행), { slug: "zeta" })).map((c) => c.id).join() === "9");
}
{
  const { 값: l, 줄 } = await 받기(() => loadClients(async () => { throw new Error("connection terminated"); }));
  봄("DB 던짐 → 코드 3곳", l.map((c) => c.slug).join(",") === "robotncoding,ilog,docttak");
  봄("DB 던짐 → stderr 한 줄", 줄.length === 1 && 줄[0].startsWith("DB 고객을 못 읽어 코드 고객 3곳만 돕니다"));
  봄("strict 면 던짐", (await 던짐(() => loadClients(async () => { throw new Error("x"); }, { strict: true })))?.message === "x");
  const { 값: n, 줄: 조용 } = await 받기(() => loadClients(null));
  봄("q 없음 → 코드 3곳 · 조용히", n.length === 3 && 조용.length === 0);
}
{
  const 어긋남 = DB행.map((r) => (r.slug === "ilog" ? { ...r, id: 22 } : r));
  const { 값: l, 줄 } = await 받기(() => loadClients(가짜q(어긋남)));
  봄("id 어긋남 → 코드 id", bySlug("ilog", l).id === 2 && !l.some((c) => c.id === 22));
  봄("id 어긋남 → 경고", 줄.some((s) => s.includes("ilog") && s.includes("코드 id 2") && s.includes("DB id 22")));
}

// ─────────────────────────────────────────── 고객고르기
{
  const q = 가짜q(DB행);
  봄("--client DB 고객", (await 고객고르기(["n", "x", "--client", "zeta"], q))[0].id === 9);
  봄("--client 시험 고객도 콕 집으면", (await 고객고르기(["n", "x", "--client", "e2e-x"], q))[0].slug === "e2e-x");
  const e = await 던짐(() => 고객고르기(["n", "x", "--client", "nope"], q));
  봄("없는 고객 → DB slug 도 나열", e?.message.startsWith("고객사 없음: nope") && e.message.includes("zeta") && e.message.includes("robotncoding"));
  const 원래 = process.env.CLIENT_ID;
  process.env.CLIENT_ID = "8";
  봄("CLIENT_ID DB 고객", (await 고객고르기(["n", "x"], q))[0].slug === "eta");
  if (원래 === undefined) delete process.env.CLIENT_ID; else process.env.CLIENT_ID = 원래;
  봄("아무것도 없으면 active 전부", (await 고객고르기(["n", "x"], q)).length === 5);
  봄("indexClients 는 목록을 받는다", indexClients(await loadClients(q)).map((c) => c.slug).join() === "robotncoding,docttak");
}

// ─────────────────────────────────────────── 측정설정 — 코드 3곳 값 그대로, DB 고객은 행에서
봄("측정설정 학원 = 코드 정규식(DB 칸 빔)", 측정설정({ id: 1, slug: "robotncoding", domain: "x", answer_pattern: "" }).answerRe === CLIENTS[0].answerRe
  && 측정설정({ id: 1, slug: "robotncoding", domain: "x" }).domain === "robotncoding.com");
봄("측정설정 DB 고객", 측정설정({ id: 9, slug: "zeta", name: "제타", domain: "https://Zeta.kr/", answer_pattern: "제타" }).domain === "zeta.kr");
봄("측정설정 이름 말 없음 → null", 측정설정({ id: 9, slug: "zeta", domain: "zeta.kr", answer_pattern: "" }) === null);

// ─────────────────────────────────────────── 가림 — DB 고객 이름·도메인이 고객사말에
{
  const 말 = 고객사말(await loadClients(가짜q(DB행), { includeTest: true }));
  봄("고객사말에 DB 고객 이름·도메인", ["제타", "zeta.kr", "이타", "eta.kr", "시험", "x.kr"].every((x) => 말.includes(x)));
  봄("고객사말에 코드 고객 그대로", ["로봇&코딩학원", "robotncoding.com", "아이로그", "docttak.com"].every((x) => 말.includes(x)));
  봄("brandRe·presenceRe 없어도 이름·도메인", 고객사말([{ name: "무명", domain: "mu.kr" }]).join() === "무명,mu.kr");
}

// ─────────────────────────────────────────── 가드 — 코드 목록을 바로 읽는 스크립트
const 뿌리 = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const 볼곳 = ["academy", "tools", "web/lib", "web/scripts", "web/app"];
const 파일들 = [];
const 돌기 = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", ".vercel"].includes(e.name) || e.name.startsWith(".browser-profile")) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) 돌기(p);
    else if (/\.(mjs|js|ts|tsx)$/.test(e.name)) 파일들.push(p);
  }
};
for (const d of 볼곳) if (fs.existsSync(path.join(뿌리, d))) 돌기(path.join(뿌리, d));
// import { … CLIENTS … } from "…clients.mjs" 또는 const { CLIENTS } = await import("…clients.mjs")
const 가져옴 = /(?:import\s*\{([^}]*)\}\s*from|\{([^}]*)\}\s*=\s*await\s+import\s*\()\s*["'][^"']*clients\.mjs["']/g;
const 걸림 = [];
for (const f of 파일들) {
  const 이름 = path.basename(f), 상대 = path.relative(뿌리, f).replace(/\\/g, "/");
  if (상대 === "academy/clients.mjs" || /^test-.*\.mjs$/.test(이름)) continue;
  const 글 = fs.readFileSync(f, "utf8");
  for (const m of 글.matchAll(가져옴)) {
    const 이름들 = (m[1] ?? m[2]).split(",").map((s) => s.trim().split(/\s+as\s+/)[0]);
    if (이름들.some((x) => x === "CLIENTS" || x === "selectClients")) 걸림.push(`${상대} — CLIENTS·selectClients`);
    if (이름들.includes("CODE_CLIENTS") && 상대 !== "academy/measure-targets.mjs") 걸림.push(`${상대} — CODE_CLIENTS(measure-targets 만)`);
  }
}
if (걸림.length) for (const x of 걸림) console.log(`  가드 | ${x}`);
봄(`가드: 스크립트에서 코드 목록 직접 import 0 (본 파일 ${파일들.length})`, 걸림.length === 0 && 파일들.length > 50);
// 가드 자체가 잡는지 — 가짜 글
const 가짜글 = 'import { CLIENTS as X, 세션글제목 } from "../clients.mjs";\nconst { selectClients } = await import("../academy/clients.mjs");';
봄("가드가 as·동적 import 도 잡음", [...가짜글.matchAll(가져옴)].length === 2);

console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
