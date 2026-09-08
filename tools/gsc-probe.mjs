/**
 * Search Console 에 어떤 속성이 있고, URL 검사 화면이 어떤 주소인지 알아낸다.
 *
 * 콘솔 화면 구조와 속성 ID 형식(sc-domain: 인지 https:// 인지)을 추측하지 않고
 * 실제로 열어서 확인한다. 자동화가 실패하면 대개 여기서 어긋나 있다.
 *
 *   node gsc-probe.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto("https://search.google.com/search-console", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

console.log("도착 주소:", page.url());

// 주소창에 resource_id 가 들어 있으면 그게 속성 ID 다
const m = page.url().match(/resource_id=([^&]+)/);
if (m) console.log("속성 ID:", decodeURIComponent(m[1]));

// 속성 선택기를 열어 목록을 읽는다
try {
  const picker = page.locator('[aria-label*="속성"], [aria-label*="property" i]').first();
  await picker.click({ timeout: 6000 });
  await page.waitForTimeout(2000);
  const items = await page.locator('[role="option"], [role="menuitem"]').allInnerTexts();
  console.log("\n속성 목록:");
  items.slice(0, 12).forEach((t) => console.log("  ·", t.replace(/\s+/g, " ").trim().slice(0, 70)));
  await page.keyboard.press("Escape");
} catch {
  console.log("\n속성 선택기를 못 열었습니다. 화면을 직접 확인해 주세요.");
}

// URL 검사창이 있는지 확인
try {
  const box = page.getByPlaceholder(/URL 검사|Inspect any URL/i).first();
  await box.waitFor({ state: "visible", timeout: 6000 });
  console.log("\nURL 검사창: 있음 — 상단 입력창으로 넣을 수 있습니다");
} catch {
  console.log("\nURL 검사창: 상단에서 못 찾음");
}

console.log("\n창을 40초 열어 둡니다. 화면을 봐주세요.");
await page.waitForTimeout(40000);
await ctx.close();
