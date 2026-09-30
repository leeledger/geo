// 사람 방문 기록(Step 29) 단위 시험 — 가짜 요청만, DB·네트워크 없음.
//   node --experimental-strip-types academy/scripts/test-visit.mjs
// 1) lib/visit.ts 분류(들어온 곳·사람/봇·문서 요청·기기·방문자 해시·받는 쪽 검사)
// 2) 세 저장소 사본이 같은지(web/lib/visit.ts · 자동피드백생성기/lib/cited-visit.ts — 없으면 건너뜀)
// 3) 표 DDL·중복 무시 insert 가 네 곳(web lib·academy route·schema.sql 둘)에서 같은지
// 하나라도 틀리면 종료코드 1.
import fs from "node:fs";
import assert from "node:assert/strict";

const here = (p) => new URL(p, import.meta.url);
const V = await import(here("../lib/visit.ts"));

let fail = 0, pass = 0;
const t = (name, f) => {
  return Promise.resolve().then(f).then(() => { pass++; }, (e) => { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); });
};

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const doc = (extra = {}) => new Headers({ "user-agent": CHROME, "sec-fetch-dest": "document", ...extra });
const req = (url, headers = {}, method = "GET") =>
  new Request(url, { method, headers: { "user-agent": CHROME, "sec-fetch-dest": "document", "x-forwarded-for": "1.2.3.4, 10.0.0.1", ...headers } });
const OWN = "robotncoding.com";

// ── 들어온 곳
const refCases = [
  [null, null, "direct", ""],
  ["", null, "direct", ""],
  ["not a url", null, "direct", ""],
  ["https://chatgpt.com/", null, "ai", "chatgpt.com"],
  ["https://chat.openai.com/c/1", null, "ai", "chatgpt.com"],
  ["https://www.perplexity.ai/search?q=x", null, "ai", "perplexity.ai"],
  ["https://gemini.google.com/app", null, "ai", "gemini.google.com"],
  ["https://claude.ai/chat/1", null, "ai", "claude.ai"],
  ["https://copilot.microsoft.com/", null, "ai", "copilot.microsoft.com"],
  ["https://www.google.com/", null, "search", "google.com"],
  ["https://www.google.co.kr/", null, "search", "google.co.kr"],
  ["https://search.naver.com/search.naver?query=x", null, "search", "search.naver.com"],
  ["https://m.search.naver.com/search.naver?query=x", null, "search", "search.naver.com"],
  ["https://m.blog.naver.com/abc/1", null, "sns", "blog.naver.com"],
  ["https://blog.naver.com/abc/1", null, "sns", "blog.naver.com"],
  ["https://cafe.naver.com/x", null, "sns", "cafe.naver.com"],
  ["https://search.daum.net/search?q=x", null, "search", "search.daum.net"],
  ["https://www.bing.com/", null, "search", "bing.com"],
  ["https://duckduckgo.com/", null, "search", "duckduckgo.com"],
  ["https://l.instagram.com/?u=x", null, "sns", "l.instagram.com"],
  ["https://t.co/abc", null, "sns", "t.co"],
  ["https://www.youtube.com/watch?v=1", null, "sns", "youtube.com"],
  ["https://robotncoding.com/blog/a", null, "internal", "robotncoding.com"],
  ["https://www.robotncoding.com/", null, "internal", "robotncoding.com"],
  ["https://example.org/x", null, "other", "example.org"],
  // utm 이 먼저
  [null, "chatgpt.com", "ai", "chatgpt.com"],
  ["https://www.google.com/", "chatgpt.com", "ai", "chatgpt.com"],
  [null, "perplexity", "ai", "perplexity.ai"],
  [null, "naver", "search", "naver"],
  [null, "naver_blog", "sns", "naver_blog"],
  [null, "instagram", "sns", "instagram"],
  [null, "newsletter", "other", "newsletter"],
  // SNS utm 은 같거나 접두어만 — 중간에 든 글자로 세지 않는다
  [null, "facebook_ad", "sns", "facebook_ad"],
  [null, "kakao_ch", "sns", "kakao_ch"],
  [null, "navercafe", "sns", "navercafe"],
  [null, "feedback", "other", "feedback"],
  [null, "myblog", "other", "myblog"],
  [null, "newsband", "other", "newsband"],
];
for (const [ref, utm, kind, host] of refCases) {
  await t(`ref ${ref} utm=${utm}`, () => {
    const r = V.classifyRef(ref, OWN, utm);
    assert.equal(r.ref_kind, kind);
    assert.equal(r.ref_host, host);
  });
}

// ── 사람의 문서 요청
const docCases = [
  ["보통 페이지", "GET", "/", doc(), true],
  ["블로그 글", "GET", "/blog/%ED%95%9C", doc(), true],
  ["POST", "POST", "/", doc(), false],
  ["HEAD", "HEAD", "/", doc(), false],
  ["UA 없음", "GET", "/", new Headers({ "sec-fetch-dest": "document" }), false],
  ["헤드리스", "GET", "/", doc({ "user-agent": "Mozilla/5.0 HeadlessChrome/120" }), false],
  ["카톡 미리보기", "GET", "/", doc({ "user-agent": "facebookexternalhit/1.1;kakaotalk-scrap/1.0" }), false],
  ["모니터", "GET", "/", doc({ "user-agent": "UptimeRobot/2.0 monitor" }), false],
  ["Lighthouse", "GET", "/", doc({ "user-agent": CHROME + " Chrome-Lighthouse" }), false],
  ["_next", "GET", "/_next/data/x.json", doc(), false],
  ["api", "GET", "/api/lead", doc(), false],
  ["admin", "GET", "/admin", doc(), false],
  ["admin 하위", "GET", "/admin/ops", doc(), false],
  ["administer 는 사람 쪽", "GET", "/administer", doc(), true],
  ["정적 파일", "GET", "/blog/a.png", doc(), false],
  ["llms.txt", "GET", "/llms.txt", doc(), false],
  ["RSC", "GET", "/blog", doc({ rsc: "1" }), false],
  ["router prefetch", "GET", "/blog", doc({ "next-router-prefetch": "1" }), false],
  ["브라우저 prefetch", "GET", "/blog", doc({ "sec-purpose": "prefetch;prerender" }), false],
  ["purpose prefetch", "GET", "/blog", doc({ purpose: "prefetch" }), false],
  ["fetch 요청(empty)", "GET", "/blog", doc({ "sec-fetch-dest": "empty" }), false],
  ["이미지 요청", "GET", "/blog", doc({ "sec-fetch-dest": "image" }), false],
  ["sec-fetch 없음 + html", "GET", "/", new Headers({ "user-agent": CHROME, accept: "text/html,application/xhtml+xml" }), true],
  ["sec-fetch 없음 + json", "GET", "/", new Headers({ "user-agent": CHROME, accept: "application/json" }), false],
];
for (const [name, m, p, h, want] of docCases) {
  await t(`문서 ${name}`, () => assert.equal(V.isHumanDocument(m, p, h), want));
}

// ── 기기
await t("기기", () => {
  assert.equal(V.deviceOf(CHROME), "desktop");
  assert.equal(V.deviceOf(IPHONE), "mobile");
  assert.equal(V.deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(V.deviceOf("Mozilla/5.0 (Linux; Android 14; SM-S918N) Mobile Safari/537.36"), "mobile");
});

// ── KST 날짜
await t("KST 날짜 — UTC 15시는 한국 다음 날", () => {
  assert.equal(V.kstDay(Date.parse("2026-09-30T14:59:59Z")), "2026-09-30");
  assert.equal(V.kstDay(Date.parse("2026-09-30T15:00:00Z")), "2026-10-01");
});

// ── 보낼 기록
const DAY1 = Date.parse("2026-09-30T03:00:00Z");
const DAY2 = Date.parse("2026-10-01T03:00:00Z");
await t("소금 없으면 null", async () => assert.equal(await V.readVisit(req("https://robotncoding.com/"), undefined, DAY1), null));
await t("봇 같은 UA 는 null", async () =>
  assert.equal(await V.readVisit(req("https://robotncoding.com/", { "user-agent": "SomeCrawler/1.0" }), "s", DAY1), null));
await t("보낼 기록 모양 · IP 없음 · 물음표 뒤 버림", async () => {
  const v = await V.readVisit(req("https://robotncoding.com/blog/a?name=홍길동&utm_source=chatgpt.com",
    { referer: "https://www.google.com/" }), "s", DAY1);
  assert.deepEqual(Object.keys(v).sort(), ["device", "path", "ref_host", "ref_kind", "visitor"]);
  assert.equal(v.path, "/blog/a");
  assert.equal(v.ref_kind, "ai");
  assert.equal(v.ref_host, "chatgpt.com");
  assert.match(v.visitor, /^[0-9a-f]{16}$/);
  assert.ok(!JSON.stringify(v).includes("1.2.3.4"));
  assert.ok(!JSON.stringify(v).includes("홍길동"));
});
await t("같은 날 같은 사람은 같은 visitor, 다음 날·다른 소금·다른 IP 는 다름", async () => {
  const a = (await V.readVisit(req("https://robotncoding.com/"), "s", DAY1)).visitor;
  const b = (await V.readVisit(req("https://robotncoding.com/blog/x"), "s", DAY1 + 3600_000)).visitor;
  const c = (await V.readVisit(req("https://robotncoding.com/"), "s", DAY2)).visitor;
  const d = (await V.readVisit(req("https://robotncoding.com/"), "t", DAY1)).visitor;
  const e = (await V.readVisit(req("https://robotncoding.com/", { "x-forwarded-for": "5.6.7.8" }), "s", DAY1)).visitor;
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.notEqual(a, e);
});
await t("사이트 안 이동은 internal", async () => {
  const v = await V.readVisit(req("https://www.robotncoding.com/blog/b", { referer: "https://robotncoding.com/" }), "s", DAY1);
  assert.equal(v.ref_kind, "internal");
});

// ── 받는 쪽 검사
const good = { path: "/a", ref_host: "chatgpt.com", ref_kind: "ai", visitor: "0123456789abcdef", device: "mobile" };
await t("cleanVisit 통과", () => assert.deepEqual(V.cleanVisit(good), good));
await t("cleanVisit 거절", () => {
  for (const bad of [null, "x", {}, { ...good, path: "a" }, { ...good, visitor: "XYZ" }, { ...good, visitor: "0123" },
    { ...good, ref_kind: "robot" }, { ...good, device: "tv" }, { ...good, path: 5 }]) {
    assert.equal(V.cleanVisit(bad), null, JSON.stringify(bad));
  }
});
await t("cleanVisit 길이·글자 자르기", () => {
  const v = V.cleanVisit({ ...good, path: "/" + "a".repeat(999), ref_host: "<script>" + "b".repeat(300) });
  assert.equal(v.path.length, 300);
  assert.equal(v.ref_host.length, 100);
  assert.ok(!/[<>]/.test(v.ref_host));
});

// ── 사본 대조
const mine = fs.readFileSync(here("../lib/visit.ts"), "utf8").replace(/\r\n/g, "\n");
for (const [name, u] of [
  ["web/lib/visit.ts", here("../../web/lib/visit.ts")],
  ["자동피드백생성기/lib/cited-visit.ts", here("../../../자동피드백생성기/lib/cited-visit.ts")],
]) {
  if (!fs.existsSync(u)) { console.log(`- ${name} 없음 — 대조 건너뜀`); continue; }
  await t(`사본 같음 ${name}`, () => assert.ok(fs.readFileSync(u, "utf8").replace(/\r\n/g, "\n") === mine, "academy/lib/visit.ts 와 다르다"));
}

// ── 아이로그 랜딩·로그인 쿠키 (Arch 29) — 파일이 없으면 건너뜀
const landingFile = here("../../../자동피드백생성기/lib/cited-landing.ts");
if (!fs.existsSync(landingFile)) console.log("- 자동피드백생성기/lib/cited-landing.ts 없음 — 건너뜀");
else {
  const L = await import(landingFile);
  const cases = [
    ["/", null, true], ["/features", "", true], ["/guide/abc", "theme=dark", true], ["/terms", null, true], ["/privacy", null, true],
    ["/dashboard", null, false], ["/attendance-keypad", null, false], ["/guidebook", null, false], ["/p/abc", null, false],
    ["/", "authjs.session-token=x", false],
    ["/", "theme=dark; __Secure-authjs.session-token=x", false],
    ["/guide/a", "__Secure-authjs.session-token.0=x; __Secure-authjs.session-token.1=y", false],
    ["/", "authjs.csrf-token=x; authjs.callback-url=y", true],
    ["/", "my-authjs.session-token=x", true],
  ];
  for (const [p, c, want] of cases) await t(`아이로그 랜딩 ${p} ${c}`, () => assert.equal(L.countsAsLanding(p, c), want));
}

// ── 받는 라우트: 학원은 키 없으면 닫힘 · 표가 있으면 DDL 안 돌림 (Richard 29)
await t("학원 /api/visit fail closed", () =>
  assert.ok(fs.readFileSync(here("../app/api/visit/route.ts"), "utf8").includes(`if (!key || req.headers.get("x-crawl-key") !== key)`)));
await t("표가 있으면 DDL 건너뜀 두 곳", () => {
  for (const f of ["../app/api/visit/route.ts", "../../web/lib/visits.ts"]) {
    assert.ok(fs.readFileSync(here(f), "utf8").includes("to_regclass('geo.site_visits')"), f);
  }
});

// ── DDL·insert 대조
const norm = (s) => s.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/\s*;\s*$/, "").trim();
const block = (file, re) => {
  const m = fs.readFileSync(here(file), "utf8").match(re);
  if (!m) throw new Error(`${file} 에서 못 찾음`);
  return norm(m[0]);
};
const TABLE = /create table if not exists geo\.site_visits \([\s\S]*?device text not null default ''\s*\)/;
const INDEX = /create index if not exists site_visits_client_day_idx on geo\.site_visits \(client_id, day\)/;
const INSERT = /insert into geo\.site_visits[\s\S]*?interval '1 minute'\)/;
const files = ["../../web/lib/visits.ts", "../app/api/visit/route.ts", "../../web/db/schema.sql", "../db/schema.sql"];
await t("표 DDL 네 곳 같음", () => { const [a, ...r] = files.map((f) => block(f, TABLE)); for (const x of r) assert.equal(x, a); });
await t("인덱스 네 곳 같음", () => { for (const f of files) block(f, INDEX); });
await t("RLS 네 곳", () => {
  for (const f of files) assert.ok(fs.readFileSync(here(f), "utf8").includes("alter table geo.site_visits enable row level security"), f);
});
await t("중복 무시 insert 두 곳 같음", () => assert.equal(block(files[0], INSERT), block(files[1], INSERT)));

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
