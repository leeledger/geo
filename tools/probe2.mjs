import { chromium } from "playwright";
import path from "node:path";
const PROFILE = path.join(process.cwd(), ".browser-profile");
const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, viewport: { width: 1440, height: 940 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://search.google.com/search-console", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
console.log("콘솔 도착 주소:");
console.log("  " + page.url());
const m = page.url().match(/resource_id=([^&]+)/);
console.log("  속성 ID:", m ? decodeURIComponent(m[1]) : "(주소에 없음)");
const body = await page.locator("body").innerText().catch(()=>"");
console.log("\n화면 앞 300자:");
console.log(body.replace(/\n{2,}/g,"\n").slice(0,300));
console.log("\n상단 입력창 후보:");
for (const sel of ['input[aria-label*="검사"]','input[placeholder*="검사"]','input[type="text"]']) {
  const n = await page.locator(sel).count();
  if (n) console.log(`  ${sel} → ${n}개`);
}
await page.waitForTimeout(3000);
await ctx.close();
