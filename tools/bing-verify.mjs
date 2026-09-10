/**
 * 빙 웹마스터 — robotncoding.com 이 실제로 붙었는지, 사이트맵이 들어갔는지 본다.
 *
 * 가져오기 화면이 "성공"이라고 말한 것과 실제로 색인이 도는 것은 다르다.
 * 화면 글자만 믿지 않고 사이트맵 상태를 직접 확인한다.
 *
 *   node bing-verify.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const SITE = "https://robotncoding.com/";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());
const say = (s) => console.log(`  ${s}`);

// 사이트맵 화면으로 바로 간다. siteUrl 을 쿼리로 받는다.
const q = encodeURIComponent(SITE);
await page.goto(`https://www.bing.com/webmasters/sitemaps?siteUrl=${q}`,
  { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(6000);

say(`주소 ${page.url().slice(0, 90)}`);
const body = await page.locator("body").innerText().catch(() => "");
say(`sitemap.xml ${/sitemap\.xml/i.test(body) ? "보임" : "없음"}`);

// 사이트맵이 없으면 직접 넣는다
if (!/sitemap\.xml/i.test(body)) {
  const add = page.getByRole("button", { name: /submit|제출|add|추가/i }).first();
  if (await add.count()) {
    await add.click().catch(() => {});
    await page.waitForTimeout(2500);
    const box = page.locator('input[type=text], input[type=url]').first();
    if (await box.count()) {
      await box.fill(`${SITE}sitemap.xml`);
      const ok = page.getByRole("button", { name: /submit|제출|확인|ok/i }).last();
      await ok.click().catch(() => {});
      say("사이트맵을 직접 제출했습니다");
      await page.waitForTimeout(5000);
    }
  } else {
    say("제출 버튼을 못 찾았습니다 — 화면을 저장합니다");
  }
}

await page.screenshot({ path: "bing-sitemap.png" }).catch(() => {});
const fin = await page.locator("body").innerText().catch(() => "");
// 상태 줄만 뽑아 본다
for (const l of fin.split("\n").map((x) => x.trim()).filter(Boolean)) {
  if (/sitemap|URL|성공|Success|Pending|오류|Error|discovered|submitted/i.test(l) && l.length < 90) {
    say(`· ${l}`);
  }
}

await new Promise((r) => setTimeout(r, 2000));
await ctx.close().catch(() => {});
