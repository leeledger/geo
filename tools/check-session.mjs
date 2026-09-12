/**
 * 저장된 세션이 살아 있는지 확인한다.
 *
 * 브라우저를 강제로 끄면 쿠키가 디스크에 안 써지는 경우가 있다.
 * 자동화를 돌리기 전에 이걸로 먼저 확인한다.
 *
 *   node check-session.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,  // 네이버는 헤드리스를 막는다
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

const CHECKS = [
  { name: "Google Search Console", url: "https://search.google.com/search-console", bad: /accounts\.google\.com|search-console\/about|\/welcome/ },
  { name: "네이버 서치어드바이저", url: "https://searchadvisor.naver.com/console/board", bad: /nid\.naver\.com/ },
  // 서치어드바이저와 블로그는 세션이 따로 논다. 서치어드바이저가 로그아웃이어도
  // 블로그 글쓰기는 멀쩡히 되는 일이 실제로 있었다(2026-09-12).
  // 그걸 「네이버 로그아웃」으로 읽고 발행을 포기해 원장에게 재로그인을 두 번 요청했다.
  // 이관이 걸린 자리는 이쪽이므로 발행 도구가 실제로 여는 주소를 그대로 본다.
  {
    name: "네이버 블로그 글쓰기",
    url: `https://blog.naver.com/${process.env.NAVER_BLOG_ID || "force11"}?Redirect=Write`,
    bad: /nid\.naver\.com/,
  },
];

for (const c of CHECKS) {
  try {
    await page.goto(c.url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(2500);
    const ok = !c.bad.test(page.url());
    console.log(`  ${ok ? "✓ 로그인됨" : "✗ 로그아웃"}  ${c.name}`);
    if (!ok) console.log(`      → ${page.url().slice(0, 90)}`);
  } catch (e) {
    console.log(`  ? 확인 실패  ${c.name} — ${e.message.split("\n")[0].slice(0, 60)}`);
  }
}

const cookies = await ctx.cookies();
const g = cookies.filter((c) => /google/.test(c.domain)).length;
const n = cookies.filter((c) => /naver/.test(c.domain)).length;
console.log(`\n  쿠키: 구글 ${g}개 · 네이버 ${n}개 (전체 ${cookies.length}개)`);

await ctx.close();
