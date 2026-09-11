/**
 * Bing 웹마스터에 사이트맵을 제출한다 — 사이트는 이미 추가돼 있어야 한다.
 *
 * 9.11 확인: robotncoding.com 은 9/5 제출·9/10 크롤 성공(45개 발견).
 * ilog.ai.kr 은 사이트만 추가돼 있고 사이트맵이 0 이었다. 그래서 빙이 페이지를 모른다.
 *
 *   node bing-submit-sitemap.mjs https://ilog.ai.kr/
 *
 * 로그인은 .browser-profile 에 남아 있는 세션을 쓴다. 로그인 화면이 뜨면 멈춘다.
 * 화면이 예상과 다르면 누르지 않고 찍기만 하고 끝낸다.
 */
import { chromium } from "playwright";
import path from "node:path";

const SITE = process.argv[2];
if (!SITE || !/^https:\/\/[^/]+\/$/.test(SITE)) {
  console.log("사용: node bing-submit-sitemap.mjs https://도메인/");
  process.exit(1);
}
const SITEMAP = `${SITE}sitemap.xml`;
const PROFILE = path.join(process.cwd(), ".browser-profile");
const OUT = process.env.SHOT_DIR || process.cwd();

const res = await fetch(SITEMAP);
if (!res.ok || !(await res.text()).includes("<urlset")) {
  console.log(`사이트맵이 안 열립니다: ${SITEMAP} (${res.status})`);
  process.exit(1);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const shot = (name) => page.screenshot({ path: path.join(OUT, `bing-sitemap-${name}.png`) });

try {
  await page.goto(`https://www.bing.com/webmasters/sitemaps?siteUrl=${encodeURIComponent(SITE)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(8000);

  if (/login\.live\.com|login\.microsoftonline|accounts\.google/.test(page.url())) {
    console.log("로그인이 필요합니다. 사람이 로그인해야 합니다.");
    await shot("login");
    process.exit(2);
  }

  const already = await page.getByText(SITEMAP, { exact: false }).count();
  if (already > 0) {
    console.log(`이미 제출돼 있습니다: ${SITEMAP}`);
    await shot("already");
    process.exit(0);
  }

  // 코파일럿 안내 같은 팝업이 가리면 닫는다
  const notNow = page.getByRole("button", { name: /^Not now$/i });
  if (await notNow.isVisible().catch(() => false)) await notNow.click();

  await page.getByRole("button", { name: /Submit sitemap/i }).first().click();
  await page.waitForTimeout(2500);
  await shot("dialog");

  const input = page.locator('input[type="text"]:visible, input[type="url"]:visible').last();
  if (!(await input.isVisible().catch(() => false))) {
    console.log("주소 입력칸을 못 찾았습니다. bing-sitemap-dialog.png 를 보세요.");
    process.exit(3);
  }
  await input.fill(SITEMAP);
  await page.waitForTimeout(800);

  const submit = page.getByRole("button", { name: /^Submit$/i }).last();
  if (!(await submit.isVisible().catch(() => false))) {
    console.log("제출 버튼을 못 찾았습니다. bing-sitemap-dialog.png 를 보세요.");
    process.exit(3);
  }
  await submit.click();
  await page.waitForTimeout(6000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await shot("after");

  const listed = await page.getByText(SITEMAP, { exact: false }).count();
  console.log(listed > 0 ? `제출됨: ${SITEMAP}` : "제출 뒤 목록에 안 보입니다. bing-sitemap-after.png 를 보세요.");
  process.exitCode = listed > 0 ? 0 : 4;
} finally {
  await ctx.close();
}
