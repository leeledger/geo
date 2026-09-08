/**
 * URL 검사 화면에 실제로 무엇이 있는지 읽는다.
 *
 * 버튼 이름을 추측하면 계속 빗나간다. 화면의 버튼 목록과 본문을 그대로 찍어
 * 무엇을 눌러야 하는지 눈으로 확인한 뒤 자동화한다.
 *
 *   node gsc-inspect-probe.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const PROP = "sc-domain:robotncoding.com";
const URL = "https://robotncoding.com/";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

const inspect =
  "https://search.google.com/search-console/inspect?resource_id=" +
  encodeURIComponent(PROP) + "&id=" + encodeURIComponent(URL);

await page.goto(inspect, { waitUntil: "domcontentloaded" });
console.log("도착:", page.url().slice(0, 110));

// 검사 결과가 뜨는 데 시간이 걸린다
await page.waitForTimeout(14000);

const body = await page.locator("body").innerText().catch(() => "");
console.log("\n── 화면 글자 (앞 700자) ──");
console.log(body.replace(/\n{2,}/g, "\n").slice(0, 700));

console.log("\n── 버튼 목록 ──");
const btns = await page.getByRole("button").all();
for (const b of btns.slice(0, 30)) {
  const t = (await b.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const aria = (await b.getAttribute("aria-label").catch(() => "")) || "";
  const vis = await b.isVisible().catch(() => false);
  if (t || aria) console.log(`  ${vis ? "보임" : "숨김"}  "${t.slice(0, 40)}"${aria ? ` [${aria.slice(0, 40)}]` : ""}`);
}

console.log("\n── 링크 중 '요청' 들어간 것 ──");
const links = await page.getByRole("link").all();
for (const l of links.slice(0, 40)) {
  const t = (await l.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  if (/요청|index/i.test(t)) console.log(`  "${t.slice(0, 50)}"`);
}

console.log("\n창을 60초 열어 둡니다. 직접 보시고 어떤 버튼인지 알려주세요.");
await page.waitForTimeout(60000);
await ctx.close();
