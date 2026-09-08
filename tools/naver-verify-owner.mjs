/**
 * 네이버 서치어드바이저 — 사이트 소유확인.
 *
 * 네이버는 http 와 https 를 다른 사이트로 본다. https 를 따로 등록하지 않으면
 * 보안 인증서와 사이트맵이 계속 "확인중"에 머문다.
 *
 * 여기서 한참 헤맸다. 버튼은 분명히 눌리는데 화면이 그대로였다.
 * 원인은 성공 알림이 window.alert 이었던 것 — Playwright 는 dialog 핸들러가
 * 없으면 자동으로 취소해 버린다. 그래서 확인이 접수되지 않았다.
 * dialog 를 받아서 accept 하니 한 번에 통과했다.
 *
 * 인증 방식은 HTML 파일 업로드를 쓴다. 메타 태그 방식은 통과하지 않았는데,
 * 파일은 public/ 에 두면 그만이라 확실하다.
 *
 *   node naver-verify-owner.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const SITE = process.env.NAVER_SITE || "https://robotncoding.com";

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

let said = "";
page.on("dialog", async (d) => {
  said = d.message();
  await d.accept().catch(() => {});
});

await page.goto(
  "https://searchadvisor.naver.com/console/verify?site=" + encodeURIComponent(SITE),
  { waitUntil: "domcontentloaded" },
);
await page.waitForTimeout(8000);

if (/nid\.naver\.com/.test(page.url())) {
  console.log("로그인이 안 돼 있습니다. `node open-session.mjs` 를 먼저 돌리세요.");
  await ctx.close();
  process.exit(1);
}

// 첫 번째 라디오가 HTML 파일 업로드다
const radios = await page.locator('input[type="radio"]').all();
if (!radios.length) {
  console.log("소유확인 화면이 아닙니다. 이미 확인됐을 수 있습니다.");
  console.log(page.url());
  await ctx.close();
  process.exit(0);
}
await radios[0].check({ force: true }).catch(() => {});
await page.waitForTimeout(1200);

await page.getByRole("button", { name: /소유확인/ }).first().click({ timeout: 10000, force: true });
await page.waitForTimeout(12000);

console.log(said || "(알림 없음)");
console.log("→", page.url().slice(0, 90));

await page.waitForTimeout(5000);
await ctx.close();
