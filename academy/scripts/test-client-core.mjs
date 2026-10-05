// 고객사 등록·세팅 점검·체크리스트·동기화·지우기(Step 38) 단위 시험 — 가짜 q·가짜 fetch 만. DB·네트워크 없음.
//   node scripts/test-client-core.mjs
import fs from "node:fs";
import { CODE_CLIENTS, 고객설정 } from "../clients.mjs";
import {
  AI_BOTS, CODE_SLUGS, answerPattern, nextAlias, 입력검사, 등록, 고치기, 폼값, robots막힘, ld타입, 세팅점검,
  체크리스트, 요약, 일감계획, 재점검고르기, 지우기, 파이프, 오류말,
} from "../../web/lib/client-core.mjs";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };

// ─────────────────────────────────────────── 목록 맞춤
const 봇원문 = fs.readFileSync(new URL("../../web/lib/crawler-class.ts", import.meta.url), "utf8");
const 봇칸 = /export const AI_BOTS = \[([\s\S]*?)\];/.exec(봇원문)?.[1] ?? "";
const 봇들 = [...봇칸.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
봄("AI_BOTS = crawler-class.ts AI_BOTS", 봇들.length > 0 && JSON.stringify(봇들) === JSON.stringify(AI_BOTS), 봇들.join(","));
봄("CODE_SLUGS = clients.mjs CODE_CLIENTS", JSON.stringify(CODE_CLIENTS.map((c) => c.slug)) === JSON.stringify(CODE_SLUGS));

// ─────────────────────────────────────────── answerPattern — 한 인자 글자 그대로(Step 37 전 구현을 그대로 베낌)
const 옛한글 = /[가-힣]/;
function 옛word(w) {
  const ch = [...w];
  return ch.map((c, i) => {
    const e = c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/&/g, "(?:&|&amp;)");
    return i > 0 && 옛한글.test(c) && 옛한글.test(ch[i - 1]) ? "\\s?" + e : e;
  }).join("");
}
function 옛answerPattern(raw) {
  const terms = [...new Set(raw.split(/[,，]/).map((s) => s.trim().replace(/\s+/g, " ")).filter((s) => s.length >= 2 && s.length <= 40))].slice(0, 10);
  if (!terms.length) return null;
  const one = (t) => t.split(" ").map(옛word).join("\\s*");
  return terms.map(one).join("|");
}
const 표본 = ["미소치과", "로봇&코딩학원, robotncoding.com", "C++ 코딩, (주)아이로그", "a", "", " , ", "가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하",
  "하나,둘둘,셋셋,넷넷,다섯,여섯,일곱,여덟,아홉,열열,열하나,열둘", "문서딱，docttak.com", "  띄어   쓴   이름  ", "a/b.c?d"];
봄("answerPattern 한 인자 = 옛 결과 글자 그대로", 표본.every((s) => answerPattern(s) === 옛answerPattern(s)), 표본.find((s) => answerPattern(s) !== 옛answerPattern(s)));
봄("answerPattern exclude 빈 글자 = 한 인자", 표본.every((s) => answerPattern(s, "") === 옛answerPattern(s)));
{
  const re = new RegExp(answerPattern("로봇&코딩학원, robotncoding", "똑똑한"), "i");
  봄("제외 앞말 — 「똑똑한 로봇&코딩학원」 안 셈", !re.test("똑똑한 로봇&코딩학원 강남점") && !re.test("똑똑한로봇&코딩학원"));
  봄("제외 앞말 — 우리 이름은 셈", re.test("송파 로봇&코딩학원") && re.test("로봇&amp;코딩학원") && re.test("ROBOTNCODING"));
  봄("제외 앞말 — 다른 말에도 붙음", !re.test("똑똑한 robotncoding"));
  const re2 = new RegExp(answerPattern("미소치과", "새로운, 행복한"), "i");
  봄("제외 앞말 여럿", !re2.test("행복한 미소치과") && !re2.test("새로운미소 치과") && re2.test("강남 미소 치과"));
}

// ─────────────────────────────────────────── 입력검사
const 좋은폼 = {
  name: "미소치과", slug: "miso-dental", domain: "https://www.Miso-Dental.co.kr:8443/about?x=1",
  answer_terms: "미소치과, miso-dental.co.kr", answer_exclude: "", compete: "송파 치과\n잠실 치과 추천\n임플란트 잘하는 곳\n",
  brand: "", address_part: "", phone_last4: "", relation: "외부", want_gsc: "on",
};
{
  const r = 입력검사(좋은폼);
  봄("입력검사 통과", r.ok, r.오류.join(" / "));
  봄("도메인 정리 — 스킴·www·포트·경로·대소문자", r.칸.domain === "miso-dental.co.kr");
  봄("브랜드 검색어 기본 [이름]", JSON.stringify(r.칸.brand) === '["미소치과"]');
  봄("경쟁 검색어 줄마다·빈 줄 뺌", r.칸.compete.length === 3);
  봄("시험 끔·GSC 켬", r.칸.test === false && r.칸.wantGsc === true);
  봄("GSC 체크 없음 → 끔", 입력검사({ ...좋은폼, want_gsc: undefined }).칸.wantGsc === false);
  봄("시험 체크", 입력검사({ ...좋은폼, test: "on" }).칸.test === true);
}
const 거부 = (덮기, 말) => { const r = 입력검사({ ...좋은폼, ...덮기 }); return !r.ok && r.오류.some((x) => x.includes(말)); };
봄("이름 빈 값", 거부({ name: "" }, "이름은 2~40자"));
봄("이름 한 글자", 거부({ name: "미" }, "이름은 2~40자"));
봄("이름 41자", 거부({ name: "가".repeat(41) }, "이름은 2~40자"));
봄("slug 대문자", 거부({ slug: "Miso" }, "영문 관리명"));
봄("slug 빈 값", 거부({ slug: "" }, "영문 관리명"));
봄("slug 41자", 거부({ slug: "a".repeat(41) }, "영문 관리명"));
봄("도메인 빈 값", 거부({ domain: "" }, "도메인을 넣어"));
봄("도메인 http://10.0.0.1:3000/x", 거부({ domain: "http://10.0.0.1:3000/x" }, "IP 주소"));
봄("도메인 IPv6", 거부({ domain: "http://[::1]:3000/" }, "IP 주소"));
봄("도메인 localhost", 거부({ domain: "http://localhost:3000" }, "localhost"));
봄("도메인 점 없음", 거부({ domain: "intranet" }, "점이 없습니다"));
봄("도메인 한글", 거부({ domain: "미소치과.kr" }, "영문 도메인만"));
봄("도메인 user@host", 입력검사({ ...좋은폼, domain: "https://x@miso.kr/" }).칸.domain === "miso.kr");
봄("이름 판별 말 빈 값", 거부({ answer_terms: " , " }, "하나는"));
봄("이름 판별 말 한 글자", 거부({ answer_terms: "미, 미소치과" }, "2~40자"));
봄("이름 판별 말 11개", 거부({ answer_terms: Array.from({ length: 11 }, (_, i) => `이름${i}`).join(",") }, "10개까지"));
봄("제외 앞말 한 글자", 거부({ answer_exclude: "새" }, "제외할 앞말"));
봄("경쟁 검색어 2개", 거부({ compete: "a 치과\nb 치과" }, "3~8개"));
봄("경쟁 검색어 9개", 거부({ compete: Array.from({ length: 9 }, (_, i) => `치과 ${i}`).join("\n") }, "3~8개"));
봄("경쟁 검색어 41자", 거부({ compete: `송파 치과\n잠실 치과\n${"가".repeat(41)}` }, "2~40자"));
봄("브랜드 검색어 6개", 거부({ brand: "a1\na2\na3\na4\na5\na6" }, "5개까지"));
봄("전화 끝자리 3개", 거부({ phone_last4: "052" }, "숫자 4개"));
봄("주소 일부 41자", 거부({ address_part: "가".repeat(41) }, "주소 일부"));
봄("relation 이상", 거부({ relation: "남" }, "자사·외부"));

// ─────────────────────────────────────────── 가짜 DB
/** 등록·고치기·지우기가 부르는 SQL 만 흉내 낸다. 불린 SQL 은 로그에 */
function 가짜DB({ clients = [], fk = [], 표 = [], 남김 = 0 } = {}) {
  const 로그 = [];
  const db = { clients: clients.map((c) => ({ ...c })), 로그, 지운순서: [] };
  db.q = async (s, p = []) => {
    const sql = s.replace(/\s+/g, " ").trim();
    로그.push(sql);
    if (/^(begin|commit|rollback)$/.test(sql) || sql.startsWith("alter table")) return [];
    if (sql.startsWith("select 1 from geo.clients where slug")) return db.clients.filter((c) => c.slug === p[0]).map(() => ({ "?column?": 1 }));
    if (sql.startsWith("select id, slug, domain from geo.clients")) return db.clients.map(({ id, slug, domain }) => ({ id, slug, domain }));
    if (sql.startsWith("select alias from geo.clients")) return db.clients.filter((c) => String(c.alias ?? "").startsWith("고객 ")).map((c) => ({ alias: c.alias }));
    if (sql.startsWith("insert into geo.clients")) {
      const id = 100 + db.clients.length;
      db.clients.push({ id, slug: p[0], name: p[1], domain: p[2], alias: p[3], relation: p[4], answer_pattern: p[5], status: p[6], config: JSON.parse(p[7]) });
      return [{ id }];
    }
    if (sql.startsWith("select id, domain, alias, relation")) return db.clients.filter((c) => c.slug === p[0]);
    if (sql.startsWith("update geo.clients set name")) {
      const c = db.clients.find((x) => x.id === p[0]);
      Object.assign(c, { name: p[1], domain: p[2], relation: p[3], alias: p[4], answer_pattern: p[5], config: JSON.parse(p[6]) });
      if (p[7]) c.derived = {};
      return [];
    }
    if (sql.startsWith("select id, status from geo.clients where slug")) return db.clients.filter((c) => c.slug === p[0]).map(({ id, status }) => ({ id, status }));
    if (sql.startsWith("select c.table_schema")) return 표;
    if (sql.startsWith("select id::text as id from geo.pilots")) return [{ id: "p-1" }];
    if (sql.startsWith("select cn.nspname")) return fk;
    if (sql.startsWith("with d as (delete from")) { db.지운순서.push(/delete from (\S+)/.exec(sql)[1]); return [{ n: 1 }]; }
    if (sql.startsWith("delete from geo.clients")) { db.clients = db.clients.filter((c) => c.id !== p[0]); return []; }
    if (sql.startsWith("select count(*)::int as n from geo.clients")) return [{ n: 0 }];
    if (sql.startsWith("select count(*)::int as n from")) return [{ n: /academy\.inquiries/.test(sql) ? 남김 : 0 }];
    throw new Error(`가짜 DB 가 모르는 SQL: ${sql.slice(0, 80)}`);
  };
  return db;
}
const 있는고객 = [
  { id: 1, slug: "robotncoding", name: "로봇&코딩학원", domain: "robotncoding.com", alias: "수도권 학원", status: "active" },
  { id: 3, slug: "docttak", name: "문서딱", domain: "docttak.com", alias: "고객 A", status: "active" },
  { id: 7, slug: "old-co", name: "옛고객", domain: "www.old-co.kr", alias: "고객 B", status: "active" },
];
const 칸 = 입력검사(좋은폼).칸;
{
  const db = 가짜DB({ clients: 있는고객 });
  const r = await 등록(db.q, 칸);
  const c = db.clients.find((x) => x.slug === "miso-dental");
  봄("등록 — 새 고객", r.ok && r.slug === "miso-dental" && c && db.로그.includes("commit"));
  봄("등록 — 외부 alias 다음 글자(고객 C)", c?.alias === "고객 C");
  봄("등록 — status active", c?.status === "active");
  봄("등록 — IndexNow 키 32자 영숫자·mode 우리", /^[0-9a-f]{32}$/.test(c?.config.indexnow.key ?? "") && c?.config.indexnow.mode === "우리");
  봄("등록 — config 칸", c?.config.v === 1 && c.config.gsc === false && c.config.wantGsc === true && c.config.queries.compete.length === 3
    && JSON.stringify(c.config.queries.brand) === '["미소치과"]' && JSON.stringify(c.config.answerTerms) === '["미소치과","miso-dental.co.kr"]'
    && Array.isArray(c.config.answerExclude) && Array.isArray(c.config.presence) && !("hitWords" in c.config));
  봄("등록 — answer_pattern = answerPattern(말, 제외)", c?.answer_pattern === answerPattern("미소치과,miso-dental.co.kr", ""));
  봄("등록 — 덮어쓰기 없음(on conflict 없음)", !db.로그.some((s) => s.includes("on conflict")));
  봄("등록 — 고객설정이 읽음", (() => { const x = 고객설정({ ...c, derived: {} }, {}); return x.빠짐.length === 0 && x.indexnowKey === c.config.indexnow.key && x.queries.filter((y) => y.kind === "경쟁").length === 3; })(),
    JSON.stringify(고객설정({ ...c, derived: {} }, {}).빠짐));
}
{
  const db = 가짜DB({ clients: 있는고객 });
  const r = await 등록(db.q, { ...칸, slug: "docttak" });
  봄("등록 — 코드 slug 거부(DB 안 건드림)", !r.ok && r.err === "slug-code" && db.로그.length === 0);
  const db2 = 가짜DB({ clients: 있는고객 });
  const r2 = await 등록(db2.q, { ...칸, slug: "old-co" });
  봄("등록 — DB slug 거부·rollback", !r2.ok && r2.err === "slug-taken" && db2.로그.includes("rollback") && !db2.로그.includes("commit"));
  const db3 = 가짜DB({ clients: 있는고객 });
  const r3 = await 등록(db3.q, { ...칸, domain: "old-co.kr" });
  봄("등록 — 같은 도메인(www 차이) 거부", !r3.ok && r3.err === "domain-taken" && db3.clients.length === 3);
  const db4 = 가짜DB({ clients: 있는고객 });
  const r4 = await 등록(db4.q, { ...칸, domain: "docttak.com", slug: "doc2" });
  봄("등록 — docttak.com 다시 거부", !r4.ok && r4.err === "domain-taken");
  const db5 = 가짜DB({ clients: 있는고객 });
  await 등록(db5.q, { ...입력검사({ ...좋은폼, relation: "자사", test: "on", address_part: "석촌동 274-8", phone_last4: "0525" }).칸 });
  const c5 = db5.clients.at(-1);
  봄("등록 — 자사 alias = 이름 · 시험 status test", c5.alias === "미소치과" && c5.status === "test");
  봄("등록 — presence·hitWords", JSON.stringify(c5.config.presence) === '["석촌동 274-8","0525"]' && JSON.stringify(c5.config.hitWords) === '["석촌동 274-8"]');
  봄("오류말 — 등록 거부 코드 전부 문구", ["slug-code", "slug-taken", "domain-taken", "not-test", "left"].every((k) => typeof 오류말[k] === "string"));
}
{
  const db = 가짜DB({ clients: [...있는고객, { id: 9, slug: "miso-dental", name: "미소치과", domain: "miso-dental.co.kr", alias: "고객 C", relation: "외부", status: "active",
    config: { v: 1, indexnow: { mode: "우리", key: "k".repeat(32) }, gsc: true, marketing: { enabled: true }, hitWords: ["옛"] }, derived: { checkedAt: "x" } }] });
  const r = await 고치기(db.q, "miso-dental", { ...칸, name: "미소치과의원", answerExclude: ["행복한"] });
  const c = db.clients.find((x) => x.id === 9);
  봄("고치기 — 같은 도메인이면 derived 그대로", r.ok && !r.도메인바뀜 && c.derived.checkedAt === "x" && c.name === "미소치과의원");
  봄("고치기 — 키·gsc·marketing 보존, hitWords 는 폼 값대로", c.config.indexnow.key === "k".repeat(32) && c.config.gsc === true && c.config.marketing.enabled && !("hitWords" in c.config));
  봄("고치기 — answer_pattern 다시 만듦(제외 앞말)", c.answer_pattern === answerPattern("미소치과,miso-dental.co.kr", "행복한"));
  const r2 = await 고치기(db.q, "miso-dental", { ...칸, domain: "new-miso.kr" });
  봄("고치기 — 도메인 바뀌면 derived {}", r2.ok && r2.도메인바뀜 && JSON.stringify(c.derived) === "{}" && c.domain === "new-miso.kr");
  const r3 = await 고치기(db.q, "miso-dental", { ...칸, domain: "docttak.com" });
  봄("고치기 — 남의 도메인 거부", !r3.ok && r3.err === "domain-taken");
  봄("고치기 — 코드 고객 거부", (await 고치기(db.q, "ilog", 칸)).err === "code-client");
  const 폼 = 폼값({ ...c, config: { ...c.config, presence: ["석촌동", "0525"], answerTerms: ["a1", "b2"], answerExclude: ["행복한"] } });
  봄("폼값 — 원문 말 되살림", 폼.answer_terms === "a1, b2" && 폼.answer_exclude === "행복한" && 폼.address_part === "석촌동" && 폼.phone_last4 === "0525" && 폼.compete.split("\n").length === 3);
  봄("nextAlias", nextAlias(["고객 A", "고객 B"]) === "고객 C" && nextAlias([]) === "고객 A");
}

// ─────────────────────────────────────────── robots
봄("robots — 봇 이름 막힘", JSON.stringify(robots막힘("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /")) === '["GPTBot"]');
봄("robots — * 막힘 = 전부", robots막힘("User-agent: *\nDisallow: /").length === AI_BOTS.length);
봄("robots — * 막힘 + Allow: / 예외", robots막힘("User-agent: *\nDisallow: /\nAllow: /").length === 0);
봄("robots — * 막힘이어도 봇 묶음이 허용", !robots막힘("User-agent: *\nDisallow: /\n\nUser-agent: ClaudeBot\nAllow: /\n").includes("ClaudeBot")
  && robots막힘("User-agent: *\nDisallow: /\n\nUser-agent: ClaudeBot\nAllow: /\n").includes("GPTBot"));
봄("robots — 묶음 여러 UA", JSON.stringify(robots막힘("User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /")) === '["GPTBot","CCBot"]');
봄("robots — 빈 파일", robots막힘("").length === 0);
봄("robots — 일부만 막음(Disallow: /admin)", robots막힘("User-agent: *\nDisallow: /admin\nDisallow: /api/").length === 0);
봄("robots — 주석·대소문자", JSON.stringify(robots막힘("user-agent: gptbot # 막음\nDISALLOW: / \n")) === '["GPTBot"]');

// ─────────────────────────────────────────── JSON-LD
{
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":["WebSite","Thing"]}]}</script>
    <script type='application/ld+json'>[{"@type":"LocalBusiness"}]</script><script type="application/ld+json">{깨짐</script>`;
  const r = ld타입(html);
  봄("JSON-LD — @graph·배열·@type 배열", ["Organization", "WebSite", "Thing", "LocalBusiness"].every((t) => r.types.includes(t)));
  봄("JSON-LD — 깨진 블록 셈", r.깨짐 === 1);
  봄("JSON-LD — 없음 = []", ld타입("<html></html>").types.length === 0);
}

// ─────────────────────────────────────────── 세팅점검 — 가짜 fetch
const 응답 = (status, body = "", type = "text/plain", headers = {}) => ({
  status, headers: { get: (k) => (k.toLowerCase() === "content-type" ? type : headers[k.toLowerCase()] ?? null) }, text: async () => body,
});
const 가짜fetch = (표) => async (url, init) => {
  const h = 표[url];
  if (h === undefined) return 응답(404, "Not Found", "text/html");
  if (h === "멈춤") return new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
  if (h instanceof Error) throw h;
  return typeof h === "function" ? h() : h;
};
const KEY = "a".repeat(32);
const D = "miso.kr", B = `https://${D}`;
const 홈html = `<html><head><script type="application/ld+json">{"@type":"Dentist"}</script></head>${"x".repeat(5000)}</html>`;
{
  const d = await 세팅점검(D, KEY, { fetch: 가짜fetch({
    [`${B}/`]: 응답(200, 홈html, "text/html"),
    [`${B}/robots.txt`]: 응답(200, `User-agent: *\nAllow: /\nSitemap: ${B}/sm.xml`),
    [`${B}/sm.xml`]: 응답(200, `<?xml version="1.0"?><urlset><url><loc>${B}/a</loc></url><url><loc>${B}/b</loc></url><url><loc>${B}/c</loc></url></urlset>`, "application/xml"),
    [`${B}/llms.txt`]: 응답(200, "# 미소치과\n송파 치과", "text/plain; charset=utf-8"),
    [`${B}/${KEY}.txt`]: 응답(200, `${KEY}\n`),
  }), now: () => new Date("2026-10-05T01:00:00Z") });
  봄("점검 — checkedAt", d.checkedAt === "2026-10-05T01:00:00.000Z");
  봄("점검 — home 200 · 앞 300자만", d.home.status === 200 && d.home.head.length === 300);
  봄("점검 — homeLdTypes", JSON.stringify(d.homeLdTypes) === '["Dentist"]');
  봄("점검 — robots 허용", d.robots.status === 200 && d.robots.blocked.length === 0 && d.robots.head.length <= 300);
  봄("점검 — robots 의 Sitemap: 줄 · 3쪽", d.sitemap.url === `${B}/sm.xml` && d.sitemap.pages === 3 && d.sitemap.ok === true && d.sitemap.kind === "urlset");
  봄("점검 — llms ok", d.llmsTxt.ok === true);
  봄("점검 — 키 파일 일치", d.indexnowFile.ok === true && d.indexnowFile.status === 200);
  봄("점검 — 오류 없음", d.errors.length === 0, d.errors.join(" / "));
  const 줄 = 체크리스트({ slug: "miso", name: "미소치과", domain: D, relation: "자사", config: { indexnow: { mode: "우리", key: KEY }, gsc: true, wantGsc: true } }, d);
  봄("체크리스트 — 모든 칸 됨(자사·GSC 받음)", 줄.filter((x) => !["measure", "offsite"].includes(x.id)).every((x) => x.상태 === "됨") && 요약(줄).사람 === 0 && 요약(줄).기다림 === 0,
    줄.map((x) => `${x.id}:${x.상태}`).join(" "));
  봄("체크리스트 — 자사는 파일럿 칸 해당없음 · 바깥 글 해당없음", 줄.find((x) => x.id === "measure").상태 === "해당없음" && 줄.find((x) => x.id === "offsite").상태 === "해당없음");
  봄("파이프 — 키 파일 열림 → indexnow", 파이프({ indexnow: { mode: "우리", key: KEY } }, d).indexnow === true);
}
{
  // 빠진 것 투성이: robots 가 GPTBot 막음 · /sitemap.xml 404 · llms 가 HTML 대체 페이지 · JSON-LD 없음 · 키 파일 404
  const d = await 세팅점검(D, KEY, { fetch: 가짜fetch({
    [`${B}/`]: 응답(200, "<html>홈</html>", "text/html"),
    [`${B}/robots.txt`]: 응답(200, "User-agent: GPTBot\nDisallow: /"),
    [`${B}/llms.txt`]: 응답(200, "<!doctype html><html>대체</html>", "text/html"),
  }) });
  봄("점검 — robots 막힘 GPTBot", JSON.stringify(d.robots.blocked) === '["GPTBot"]');
  봄("점검 — 사이트맵 404", d.sitemap.status === 404 && d.sitemap.ok === false && d.sitemap.url === `${B}/sitemap.xml`);
  봄("점검 — llms HTML 대체 페이지 = false", d.llmsTxt.ok === false && d.llmsTxt.status === 200);
  봄("점검 — JSON-LD 없음 []", Array.isArray(d.homeLdTypes) && d.homeLdTypes.length === 0);
  봄("점검 — 키 파일 404", d.indexnowFile.status === 404 && d.indexnowFile.ok === false);
  const row = { slug: "miso", name: "미소치과", domain: D, relation: "외부", config: { indexnow: { mode: "우리", key: KEY }, gsc: false, wantGsc: true } };
  const 줄 = 체크리스트(row, d, { pilot: null });
  const 사람칸 = 줄.filter((x) => x.상태 === "사람");
  봄("체크리스트 — 사람 칸 셋(보낼 것·GSC·파일럿)", JSON.stringify(사람칸.map((x) => x.id)) === '["send","gsc","measure"]', 사람칸.map((x) => x.id).join(","));
  const 보낼 = 줄.find((x) => x.id === "send");
  봄("체크리스트 — 전달 묶음 하나에 다섯 가지", /5가지/.test(보낼.할일) && 보낼.할일.includes(`${KEY}.txt`) && 보낼.할일.includes("GPTBot") && 보낼.할일.includes("sitemap.xml")
    && 보낼.할일.includes("llms.txt") && 보낼.할일.includes("ld+json"));
  봄("체크리스트 — 키 파일 이름·내용 그대로", 보낼.할일.includes(`${B}/${KEY}.txt`) && 보낼.할일.includes(`내용은 이 한 줄입니다: ${KEY}`));
  봄("체크리스트 — 빠진 사이트 칸은 기다림", ["robots", "sitemap", "llms", "jsonld", "keyfile"].every((id) => 줄.find((x) => x.id === id).상태 === "기다림"));
  봄("체크리스트 — wantGsc 끔 = 해당없음", 체크리스트({ ...row, config: { ...row.config, wantGsc: false } }, d).find((x) => x.id === "gsc").상태 === "해당없음");
  봄("체크리스트 — 파일럿 있고 질문 미승인 = 기다림", 체크리스트(row, d, { pilot: { id: "p", status: "진행", approved: false } }).find((x) => x.id === "measure").상태 === "기다림");
  봄("체크리스트 — 파일럿 승인 = 됨", 체크리스트(row, d, { pilot: { id: "p", status: "진행", approved: true } }).find((x) => x.id === "measure").상태 === "됨");
  봄("파이프 — 키 파일 없음 → indexnow 끔", 파이프(row.config, d).indexnow === false && 파이프({ marketing: { enabled: true } }, d).marketing === true && 파이프({}, {}).posts === false);
  // 동기화 계획
  const 계획 = 일감계획({ ...row, id: 9 }, 줄, "https://x.test");
  봄("동기화 — 사람 칸 셋을 연다(setup-<칸>)", JSON.stringify(계획.열기.map((t) => t.key)) === '["setup-send","setup-gsc","setup-measure"]');
  봄("동기화 — 제목은 사람 말", 계획.열기[0].title === "미소치과: 고객 담당에게 보낼 것이 있습니다" && 계획.열기[1].title === "미소치과: 구글 서치콘솔 권한을 받아 주세요"
    && 계획.열기[2].title === "미소치과: 파일럿을 시작해 주세요");
  봄("동기화 — 링크 /admin/clients/<slug> · 보낼 글이 detail", 계획.열기.every((t) => t.link === "https://x.test/admin/clients/miso") && 계획.열기[0].detail === 보낼.할일);
  const 다됨 = 일감계획({ ...row, id: 9 }, 체크리스트({ ...row, relation: "자사", config: { ...row.config, gsc: true } }, { ...d, robots: { status: 200, blocked: [] },
    sitemap: { status: 200, ok: true, pages: 1, url: "u" }, llmsTxt: { status: 200, ok: true }, homeLdTypes: ["X"], indexnowFile: { status: 200, ok: true } }));
  봄("동기화 — 됨이면 완료로 닫음 · 해당없음은 닫힘", 다됨.열기.length === 0 && 다됨.닫기.find((x) => x.key === "setup-send").status === "완료"
    && 다됨.닫기.find((x) => x.key === "setup-gsc").status === "완료" && 다됨.닫기.find((x) => x.key === "setup-measure").status === "닫힘");
  const 못열림 = 일감계획({ ...row, id: 9 }, 체크리스트(row, { checkedAt: "x", home: { status: null, error: "시간 초과" }, robots: { status: null }, sitemap: { status: null }, llmsTxt: { status: null }, indexnowFile: { status: null } }));
  봄("동기화 — 못 연 칸(기다림)은 보낼 것 일감을 안 건드림", !못열림.열기.some((t) => t.key === "setup-send") && !못열림.닫기.some((t) => t.key === "setup-send"));
}
{
  // sitemapindex — 자식 7개 중 같은 호스트 5개까지 셈 · 다른 호스트 자식은 안 엶
  const 자식 = Array.from({ length: 7 }, (_, i) => `${B}/s${i}.xml`);
  const 열린 = [];
  const 표 = {
    [`${B}/`]: 응답(200, "<html></html>", "text/html"),
    [`${B}/robots.txt`]: 응답(200, "User-agent: *\nDisallow:\nSitemap: https://cdn.other.com/sm.xml"),
    [`${B}/sitemap.xml`]: 응답(200, `<sitemapindex><sitemap><loc>https://cdn.other.com/x.xml</loc></sitemap>${자식.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join("")}</sitemapindex>`, "application/xml"),
  };
  for (const u of 자식) 표[u] = () => { 열린.push(u); return 응답(200, "<urlset><url><loc>a</loc></url><url><loc>b</loc></url></urlset>", "application/xml"); };
  const d = await 세팅점검(D, null, { fetch: 가짜fetch(표) });
  봄("점검 — 다른 호스트 Sitemap 줄 → /sitemap.xml", d.sitemap.url === `${B}/sitemap.xml` && d.errors.some((e) => e.includes("다른 호스트")));
  봄("점검 — sitemapindex 자식 5개까지·loc 셈", d.sitemap.kind === "index" && d.sitemap.children === 8 && d.sitemap.counted === 5 && d.sitemap.pages === 10 && 열린.length === 5);
  봄("점검 — 키 없으면 키 파일 안 엶", d.indexnowFile === undefined);
  봄("점검 — robots Disallow: (빈 값) = 허용", d.robots.blocked.length === 0);
}
{
  // 시간 초과 · 다른 호스트 redirect · www redirect · 연결 오류 · 깨진 JSON-LD
  const 시작 = Date.now();
  const d = await 세팅점검(D, KEY, { 한도: 60, 전체: 200, fetch: 가짜fetch({
    [`${B}/`]: 응답(301, "", "text/html", { location: "https://www.miso.kr/home" }),
    "https://www.miso.kr/home": 응답(200, `<script type="application/ld+json">{깨짐}</script>`, "text/html"),
    [`${B}/robots.txt`]: "멈춤",
    [`${B}/llms.txt`]: 응답(302, "", "text/html", { location: "https://evil.example/llms.txt" }),
    [`${B}/${KEY}.txt`]: new Error("getaddrinfo ENOTFOUND"),
    [`${B}/sitemap.xml`]: 응답(200, "<urlset></urlset>", "application/xml"),
  }) });
  봄("점검 — 같은 호스트 www redirect 따라감", d.home.status === 200 && Array.isArray(d.homeLdTypes));
  봄("점검 — 깨진 JSON-LD 는 오류 줄", d.errors.some((e) => e.includes("JSON-LD")));
  봄("점검 — 시간 초과 = status null · 오류", d.robots.status === null && /시간 초과/.test(d.robots.error) && d.robots.blocked === undefined);
  봄("점검 — 다른 호스트 redirect 안 따라감", d.llmsTxt.status === 302 && /다른 주소/.test(d.llmsTxt.error) && d.llmsTxt.ok === false);
  봄("점검 — 연결 오류 = status null · ok 없음", d.indexnowFile.status === null && d.indexnowFile.ok === undefined && /못 열림/.test(d.indexnowFile.error));
  봄("점검 — 빈 urlset = 0쪽 · ok false", d.sitemap.pages === 0 && d.sitemap.ok === false);
  봄("점검 — 전체 한도 안에 끝남", Date.now() - 시작 < 2000);
  const 줄 = 체크리스트({ slug: "m", name: "미", domain: D, relation: "외부", config: { indexnow: { mode: "우리", key: KEY } } }, d);
  봄("체크리스트 — 못 연 robots·키 파일 = 기다림(점검 못 함)", 줄.find((x) => x.id === "robots").상태 === "기다림" && /못 열었습니다/.test(줄.find((x) => x.id === "robots").사람말)
    && 줄.find((x) => x.id === "keyfile").상태 === "기다림");
  봄("체크리스트 — 점검 전 = 기다림", 체크리스트({ slug: "m", name: "미", domain: D, relation: "외부", config: {} }, {}).find((x) => x.id === "site").사람말.includes("점검 전"));
}

// ─────────────────────────────────────────── 재점검 고르기
{
  const 지금 = Date.parse("2026-10-05T12:00:00Z");
  const 행들 = [
    { id: 10, slug: "a", status: "active", derived: { checkedAt: "2026-10-05T11:00:00Z" } },      // 1시간 전 — 아직
    { id: 11, slug: "b", status: "active", derived: {} },                                         // 점검 없음 — 먼저
    { id: 12, slug: "c", status: "test", derived: {} },                                           // 시험 — 빼
    { id: 2, slug: "ilog", status: "active", derived: {} },                                       // 코드 고객 — 빼
    { id: 13, slug: "d", status: "active", derived: { checkedAt: "2026-10-03T00:00:00Z" } },
    { id: 14, slug: "e", status: "active", derived: { checkedAt: "2026-10-04T00:00:00Z" } },
    { id: 15, slug: "f", status: "active", derived: { checkedAt: "2026-10-04T06:00:00Z" } },
  ];
  const 고른 = 재점검고르기(행들, 지금).map((r) => r.slug);
  봄("재점검 — active·24h·코드 빼고·오래된 순 3곳", JSON.stringify(고른) === '["b","d","e"]', 고른.join(","));
  봄("재점검 — 시험 고객 제외", !재점검고르기(행들, 지금, 10).some((r) => r.status === "test"));
}

// ─────────────────────────────────────────── 지우기
{
  const 표 = [{ t: "geo.pilots", col: "client_id" }, { t: "geo.pilot_questions", col: "pilot_id" }, { t: "geo.agent_tasks", col: "client_id" }, { t: "academy.inquiries", col: "client_id" }];
  const fk = [{ child: "geo.pilot_questions", parent: "geo.pilots" }, { child: "geo.pilots", parent: "geo.clients" }, { child: "geo.agent_tasks", parent: "geo.clients" }];
  const db = 가짜DB({ clients: [{ id: 50, slug: "t1", status: "active" }], 표, fk });
  const r = await 지우기(db.q, "t1");
  봄("지우기 — test 아님 거부·rollback", !r.ok && r.err === "not-test" && db.로그.includes("rollback") && db.clients.length === 1 && !db.로그.some((s) => s.startsWith("with d as")));
  봄("지우기 — 코드 고객 거부", (await 지우기(db.q, "robotncoding")).err === "code-client");
  const db2 = 가짜DB({ clients: [{ id: 51, slug: "t2", status: "test" }], 표, fk });
  const r2 = await 지우기(db2.q, "t2");
  봄("지우기 — 시험 고객 · commit", r2.ok && db2.로그.includes("commit") && !db2.로그.includes("rollback") && db2.clients.length === 0);
  봄("지우기 — FK 자식부터(pilot_questions → pilots)", db2.지운순서.indexOf("geo.pilot_questions") < db2.지운순서.indexOf("geo.pilots") && db2.지운순서.length === 4, db2.지운순서.join(","));
  const db3 = 가짜DB({ clients: [{ id: 52, slug: "t3", status: "test" }], 표, fk, 남김: 1 });
  const r3 = await 지우기(db3.q, "t3");
  봄("지우기 — 남은 행 있으면 rollback·left", !r3.ok && r3.err === "left" && db3.로그.includes("rollback") && !db3.로그.includes("commit"));
  const db4 = 가짜DB({ clients: [{ id: 53, slug: "t4", status: "test" }], 표, fk: [{ child: "geo.pilots", parent: "geo.agent_tasks" }, { child: "geo.agent_tasks", parent: "geo.pilots" }] });
  let 던짐 = null;
  try { await 지우기(db4.q, "t4"); } catch (e) { 던짐 = e; }
  봄("지우기 — FK 고리면 던지고 rollback", 던짐 && /돌고 돌아/.test(던짐.message) && db4.로그.includes("rollback"));
  봄("지우기 — .catch 로 안 삼킴(소스)", !/\.catch\(\(\) => \{\}\)/.test(fs.readFileSync(new URL("../../web/lib/client-core.mjs", import.meta.url), "utf8")));
}

// ─────────────────────────────────────────── 고객설정 presence → presenceRe (KG-37-3)
{
  const 행 = { id: 77, slug: "new-co", name: "새고객", domain: "new-co.kr", answer_pattern: "새고객", status: "active", config: { queries: { compete: ["a b"] }, presence: ["석촌동 274-8", "0525", "a.b"] } };
  const x = 고객설정(행, {});
  봄("presence → presenceRe(글자 그대로)", x.presenceRe instanceof RegExp && x.presenceRe.test("주소 석촌동 274-8") && x.presenceRe.test("02-422-0525") && !x.presenceRe.test("axb") && x.출처.presenceRe === "입력");
  봄("presence 없음 → null", 고객설정({ ...행, config: {} }, {}).presenceRe === null && 고객설정({ ...행, config: {} }, {}).출처.presenceRe === "기본");
  봄("presence 형 틀림 → 빠짐·null", (() => { const y = 고객설정({ ...행, config: { presence: "석촌" } }, {}); return y.presenceRe === null && y.빠짐.includes("config.presence 형이 틀림"); })());
}

console.log(`${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
