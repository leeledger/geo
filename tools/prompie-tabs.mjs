/**
 * 탭의 진짜 주소를 읽는다.
 * getByText 로 눌렀더니 화면이 안 넘어갔다. 탭이 링크면 href 를 봐야 한다.
 * 경로를 추측하면 404 를 맞는다 — 네이버에서 두 번 그랬다.
 */
import { chromium } from "playwright";
import path from "node:path";

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1000 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://academy.prompie.com/administrators/wibhx5b/academy/manage/profile/",
  { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

const links = await page.evaluate(() =>
  [...document.querySelectorAll("a")]
    .map((a) => ({ t: a.innerText.trim().slice(0, 24), href: a.getAttribute("href") || "" }))
    .filter((x) => x.t && /manage|profile|intro|photo|summary|facilit|schedule|class|curricul|소개|사진|요약|시설|시간표|수업|커리/i.test(x.t + x.href)));

console.log("── 관리 링크 ──");
const seen = new Set();
for (const l of links) {
  const k = l.t + l.href;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(`  ${l.t.padEnd(16)} ${l.href}`);
}

await new Promise((r) => setTimeout(r, 1200));
await ctx.close().catch(() => {});
