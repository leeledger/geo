/**
 * Bing 웹마스터 화면을 한 번 열어 보고 찍는다. 아무것도 누르지 않는다.
 *
 * 빙 색인이 0 이다(bing-check.mjs). IndexNow 는 알림일 뿐이고, 실제 색인은
 * 빙 웹마스터에 사이트를 올려야 붙는다. 구글 서치콘솔에서 가져오기가 가장 짧다.
 * 로그인·동의 화면은 흐름이 자주 바뀌어서, 먼저 지금 무엇이 뜨는지 본다.
 *
 *   node bing-webmaster-look.mjs [url]
 *
 * submit-gsc.mjs 와 같은 브라우저 프로필(.browser-profile)을 쓴다. 둘을 동시에 돌리면 프로필이 잠긴다.
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const URL_ = process.argv[2] || "https://www.bing.com/webmasters/";
const OUT = process.env.SHOT_DIR || process.cwd();

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(URL_, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);

const shot = path.join(OUT, "bing-webmaster-look.png");
await page.screenshot({ path: shot });
const buttons = await page
  .locator("a:visible, button:visible")
  .evaluateAll((els) =>
    els.map((e) => (e.innerText || e.getAttribute("aria-label") || "").trim()).filter(Boolean).slice(0, 40),
  );

console.log("url:", page.url());
console.log("title:", await page.title());
console.log("buttons:", JSON.stringify(buttons));
console.log("shot:", shot);
await ctx.close();
