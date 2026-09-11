/**
 * 네이버 서치어드바이저 — 사이트를 추가하고 소유확인 방법 화면까지 간다.
 *
 * 9.11 확인: 계정에 robotncoding.com 만 있고 ilog.ai.kr 은 없다.
 * 네이버 AI 브리핑·통합검색 노출은 서치어드바이저 등록·사이트맵 제출이 출발점이다.
 *
 *   node naver-sa-add-site.mjs https://ilog.ai.kr          사이트 추가 → 소유확인 화면 찍기
 *   node naver-sa-add-site.mjs https://ilog.ai.kr --verify 소유확인 버튼 누르기(메타태그 배포 뒤)
 *
 * 로그인은 .browser-profile 세션. 로그인 화면이 뜨면 멈춘다.
 * 화면에서 naver-site-verification 메타태그 값을 찾으면 출력한다 — 값은 공개 메타태그라 비밀이 아니다.
 */
import { chromium } from "playwright";
import path from "node:path";

const SITE = process.argv[2];
const VERIFY = process.argv.includes("--verify");
if (!SITE || !/^https:\/\/[^/]+$/.test(SITE)) {
  console.log("사용: node naver-sa-add-site.mjs https://도메인 [--verify]");
  process.exit(1);
}
const PROFILE = path.join(process.cwd(), ".browser-profile");
const OUT = process.env.SHOT_DIR || process.cwd();

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const shot = (n) => page.screenshot({ path: path.join(OUT, `naver-sa-${n}.png`), fullPage: true });
const texts = async () =>
  page.locator("button:visible, a:visible, label:visible, input:visible").evaluateAll((els) =>
    els.map((e) => (e.innerText || e.value || e.getAttribute("placeholder") || e.getAttribute("aria-label") || "").trim())
       .filter(Boolean).slice(0, 60));

try {
  await page.goto("https://searchadvisor.naver.com/console/board", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  if (/nid\.naver\.com/.test(page.url())) {
    console.log("로그인이 필요합니다.");
    await shot("login");
    process.exit(2);
  }

  // 소유확인 전에는 목록에 안 뜬다. 확인 단계는 확인 화면으로 바로 간다
  if (VERIFY) {
    await page.goto(`https://searchadvisor.naver.com/console/verify?site=${encodeURIComponent(SITE)}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
  }
  const listed = VERIFY ? 1 : await page.getByText(SITE, { exact: true }).count();
  if (VERIFY) {
    // 아래 공통 흐름으로
  } else if (!listed) {
    const input = page.locator('input[type="text"]:visible, input[type="url"]:visible').first();
    if (!(await input.isVisible().catch(() => false))) {
      console.log("사이트 입력칸을 못 찾았습니다.");
      await shot("board");
      console.log("texts:", JSON.stringify(await texts()));
      process.exit(3);
    }
    await input.fill(SITE);
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(6000);
  } else {
    console.log("이미 목록에 있습니다 — 사이트를 엽니다.");
    await page.getByText(SITE, { exact: true }).first().click();
    await page.waitForTimeout(6000);
  }

  await shot(VERIFY ? "before-verify" : "after-add");
  console.log("url:", page.url());
  console.log("texts:", JSON.stringify(await texts()));

  const html = await page.content();
  const meta = /naver-site-verification"?\s*content="([^"]+)"/.exec(html) || /naver-site-verification[^a-z0-9]+([a-f0-9]{20,})/i.exec(html);
  if (meta) console.log("verification:", meta[1]);

  if (VERIFY) {
    const tagOpt = page.getByText("HTML 태그", { exact: true }).first();
    if (await tagOpt.isVisible().catch(() => false)) await tagOpt.click();
    await page.waitForTimeout(1500);
    const btn = page.getByText("소유확인", { exact: true }).last();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(6000);
      await shot("after-verify");
      console.log("after verify url:", page.url());
      console.log("texts:", JSON.stringify(await texts()));
    } else {
      console.log("소유확인 버튼을 못 찾았습니다.");
    }
  }
} finally {
  await ctx.close();
}
