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
  headless: true,
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

const CHECKS = [
  { name: "Google Search Console", url: "https://search.google.com/search-console", bad: /accounts\.google\.com|search-console\/about|\/welcome/ },
  { name: "네이버 서치어드바이저", url: "https://searchadvisor.naver.com/console/board", bad: /nid\.naver\.com/ },
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
