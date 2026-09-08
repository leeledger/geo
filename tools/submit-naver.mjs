/**
 * 네이버 서치어드바이저 — 웹페이지 수집 요청.
 *
 * IndexNow 로 이미 알렸지만, 서치어드바이저의 "웹페이지 수집" 은 별도 경로다.
 * 하루 한도가 있어 주요 페이지만 넣는다.
 *
 * open-session.mjs 로 로그인해 둔 프로필을 그대로 쓴다.
 *
 *   node submit-naver.mjs
 *   node submit-naver.mjs --all      사이트맵 전체에서 앞 10개
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const SITE = "https://robotncoding.com";
const ALL = process.argv.includes("--all");

/** 넣을 주소. 한도가 있으니 중요한 것부터. */
async function targets() {
  if (!ALL) return [`${SITE}/`, `${SITE}/blog`];
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, 10);
}

const urls = await targets();
console.log(`수집 요청할 주소 ${urls.length}개`);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

// 서치어드바이저는 사이트별 URL 에 siteUrl 파라미터가 들어간다.
const REQ = "https://searchadvisor.naver.com/console/request/crawl?site=" +
  encodeURIComponent(SITE + "/");

await page.goto(REQ, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

// 로그인 안 돼 있으면 로그인 화면으로 튄다
if (/nid\.naver\.com|login/i.test(page.url())) {
  console.log("\n로그인이 안 돼 있습니다. 먼저 `node open-session.mjs` 로 로그인해 주세요.");
  await ctx.close();
  process.exit(1);
}

console.log("현재 페이지:", page.url());

for (const u of urls) {
  try {
    // 입력창을 찾는다 — 화면 구조가 바뀔 수 있어 여러 후보를 본다
    const input = page.locator(
      'input[placeholder*="URL"], input[type="text"]:visible, input[name*="url" i]'
    ).first();
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("");
    // 도메인 뒤 경로만 넣는 UI 가 많다. 우선 전체 주소로 시도한다.
    await input.fill(u);
    await page.waitForTimeout(400);

    const btn = page.getByRole("button", { name: /확인|요청|제출/ }).first();
    await btn.click({ timeout: 6000 });
    await page.waitForTimeout(2500);
    console.log("  ✓ 요청:", u);
  } catch (e) {
    console.log("  ✗ 실패:", u, "—", e.message.split("\n")[0].slice(0, 90));
    console.log("    화면 구조가 바뀌었을 수 있습니다. 창을 확인해 주세요.");
    break;
  }
}

console.log("\n창을 열어 둡니다. 결과를 확인하고 닫으세요. (30초 후 자동 종료)");
await page.waitForTimeout(30000);
await ctx.close();
