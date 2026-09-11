/**
 * 네이버 서치어드바이저 — 사이트맵·RSS 제출.
 *
 * 9.12 확인: robotncoding.com 은 소유확인은 됐는데 「제출된 사이트맵: 데이터가 없습니다」였다.
 * 네이버 크롤러(Yeti) 커버리지가 45쪽 중 1쪽(2.2%)에 머문 이유다 (정찰 이슈 #2).
 *
 *   node naver-sa-submit.mjs https://robotncoding.com sitemap /sitemap.xml
 *   node naver-sa-submit.mjs https://robotncoding.com rss /rss.xml
 *
 * 자동입력 방지(캡차)가 뜨면 멈춘다 — 우회하지 않는다.
 */
import { chromium } from "playwright";
import path from "node:path";

const [SITE, KIND, REL] = process.argv.slice(2);
if (!SITE || !["sitemap", "rss"].includes(KIND) || !REL?.startsWith("/")) {
  console.log("사용: node naver-sa-submit.mjs https://도메인 sitemap|rss /경로");
  process.exit(1);
}
const FULL = `${SITE}${REL}`;
const PROFILE = path.join(process.cwd(), ".browser-profile");
const OUT = process.env.SHOT_DIR || process.cwd();

const res = await fetch(FULL);
const body = await res.text();
if (!res.ok || !/<(urlset|sitemapindex|rss|feed)\b/.test(body)) {
  console.log(`주소가 사이트맵/RSS 가 아닙니다: ${FULL} (${res.status})`);
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
const shot = (n) => page.screenshot({ path: path.join(OUT, `naver-submit-${KIND}-${n}.png`), fullPage: true });

try {
  await page.goto(`https://searchadvisor.naver.com/console/site/request/${KIND}?site=${encodeURIComponent(SITE)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(6000);
  if (/nid\.naver\.com/.test(page.url())) {
    console.log("로그인이 필요합니다.");
    process.exit(2);
  }

  if (await page.getByText(FULL, { exact: false }).count()) {
    console.log(`이미 제출돼 있습니다: ${FULL}`);
    await shot("already");
    process.exit(0);
  }

  const input = page.locator('input[type="text"]:visible, input:not([type]):visible').first();
  if (!(await input.isVisible().catch(() => false))) {
    console.log("입력칸을 못 찾았습니다.");
    await shot("noinput");
    process.exit(3);
  }
  // 입력칸 앞에 도메인이 붙어 있는 화면이면 경로만, 아니면 전체 주소
  const prefilled = (await input.inputValue().catch(() => "")) || "";
  const placeholder = (await input.getAttribute("placeholder")) || "";
  const value = prefilled.startsWith(SITE) || placeholder === SITE ? FULL : FULL;
  await input.fill(value);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^확인$/ }).first().click();
  await page.waitForTimeout(5000);

  if (await page.getByText(/자동등록을 방지|보안절차/).count()) {
    console.log("캡차가 떴습니다 — 사람이 입력해야 합니다.");
    await shot("captcha");
    process.exit(4);
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await shot("after");
  const ok = await page.getByText(REL, { exact: false }).count();
  console.log(ok ? `제출됨: ${FULL}` : `목록에 안 보입니다. naver-submit-${KIND}-after.png 를 보세요.`);
  process.exitCode = ok ? 0 : 5;
} finally {
  await ctx.close();
}
