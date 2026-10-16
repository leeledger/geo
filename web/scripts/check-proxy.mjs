// web/proxy.ts 의 갈림길 시험 (Step 51). node --experimental-strip-types web/scripts/check-proxy.mjs
// 하나라도 틀리면 종료코드 1.
import fs from "node:fs";
import { decide } from "../lib/cited-proxy.ts";
import { identify } from "../lib/bots.ts";

let fail = 0;
const eq = (name, got, want) => {
  if (got === want) console.log(`ok   ${name}`);
  else { fail++; console.error(`FAIL ${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};

const UA = {
  GPTBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
  ClaudeBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  PerplexityBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  human: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
};
const run = (pathname, ua, { cookie = null, hasKey = true } = {}) =>
  decide({ pathname, cookie, hasKey, isBot: !!identify(ua) });

// 키 없음
eq("키 없음 · 봇", run("/", UA.GPTBot, { hasKey: false }), null);
eq("키 없음 · 사람", run("/", UA.human, { hasKey: false }), null);

// 봇
for (const b of ["GPTBot", "ClaudeBot", "PerplexityBot"]) {
  eq(`identify ${b}`, identify(UA[b])?.bot, b);
  eq(`${b} / → crawl`, run("/", UA[b]), "crawl");
  eq(`${b} /llms.txt → crawl`, run("/llms.txt", UA[b]), "crawl");
}
eq("봇 + cited_admin 쿠키 → crawl", run("/", UA.GPTBot, { cookie: "cited_admin=x" }), "crawl");

// 사람
eq("사람 / → visit", run("/", UA.human), "visit");
eq("사람 /geo → visit", run("/geo", UA.human), "visit");
eq("사람 cited_admin → null", run("/", UA.human, { cookie: "cited_admin=x" }), null);
eq("사람 다른 쿠키 뒤 cited_admin → null", run("/", UA.human, { cookie: "a=1; cited_admin=x" }), null);
eq("사람 비슷한 쿠키 → visit", run("/", UA.human, { cookie: "not_cited_admin=x; cited_admin_x=1" }), "visit");

// 경로
for (const p of ["/api/x", "/api", "/admin", "/admin/ops"]) {
  eq(`사람 ${p} → null`, run(p, UA.human), null);
  eq(`봇 ${p} → null`, run(p, UA.GPTBot), null);
}
eq("/administer 는 막지 않음(경로 단위)", run("/administer", UA.human), "visit");

// 쿠키 이름 글자 = lib/admin-auth.ts COOKIE
const auth = fs.readFileSync(new URL("../lib/admin-auth.ts", import.meta.url), "utf8");
const mine = fs.readFileSync(new URL("../lib/cited-proxy.ts", import.meta.url), "utf8");
eq("admin-auth COOKIE = cited-proxy ADMIN_COOKIE",
  auth.match(/const COOKIE = "([^"]+)"/)?.[1], mine.match(/const ADMIN_COOKIE = "([^"]+)"/)?.[1]);

// matcher — proxy.ts 의 문자열을 그대로 읽어 정규식으로
const proxy = fs.readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const lit = proxy.match(/matcher:\s*\[\s*("(?:[^"\\]|\\.)*")/)?.[1];
if (!lit) { fail++; console.error("FAIL proxy.ts 에서 matcher 를 못 찾음"); }
else {
  const re = new RegExp("^" + JSON.parse(lit) + "$");
  for (const p of ["/", "/geo", "/llms.txt", "/robots.txt", "/sitemap.xml", "/step51-verify-bot"]) eq(`matcher 걸림 ${p}`, re.test(p), true);
  for (const p of ["/api/crawl", "/admin", "/admin/ops", "/_next/static/x.js", "/_next/image", "/a.png", "/v/b.mp4", "/favicon.ico"])
    eq(`matcher 안 걸림 ${p}`, re.test(p), false);
}

console.log(fail ? `\n${fail}건 실패` : "\n전부 통과");
process.exit(fail ? 1 : 0);
