/**
 * 네이버 에디터에서 서식이 실제로 먹는지 시험한다. 발행하지 않는다.
 *
 * 드롭다운 안을 뒤지는 건 부서지기 쉽다. 대신 두 가지만 본다.
 *   1) Ctrl+B 로 굵게가 되는가 — 되면 문단을 토막내 치면서 굵게를 켜고 끌 수 있다
 *   2) 구분선·인용구 버튼이 눌리는가 — 한 번 누르면 끝이라 안 부서진다
 *
 * 글자 크기 드롭다운은 마지막에 본다. 안 되면 굵게와 구분선만으로 간다.
 *
 *   node naver-fmt-probe.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const BLOG_ID = process.env.NAVER_BLOG_ID || "force11";

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto(`https://blog.naver.com/${BLOG_ID}?Redirect=Write`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(12000);

const F = page.frames().find((f) => /PostWriteForm/i.test(f.url()));
if (!F) { console.log("에디터를 못 찾았습니다"); await ctx.close(); process.exit(1); }

const cancel = F.getByRole("button", { name: "취소", exact: true }).first();
if (await cancel.isVisible().catch(() => false)) { await cancel.click().catch(() => {}); await page.waitForTimeout(1200); }

await F.locator(".se-component.se-text").first().click();
await page.waitForTimeout(800);

// ── 1) Ctrl+B 토글
await page.keyboard.type("보통글자 ");
await page.keyboard.press("Control+b");
await page.keyboard.type("굵은글자");
await page.keyboard.press("Control+b");
await page.keyboard.type(" 다시보통");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);

const bold = await F.evaluate(() => {
  const c = document.querySelector(".se-main-container") || document.body;
  const b = [...c.querySelectorAll("b, strong")].map((e) => e.textContent.trim()).filter(Boolean);
  return b;
});
console.log("Ctrl+B 결과 — 굵게 잡힌 글자:", bold.length ? JSON.stringify(bold) : "(없음)");

// ── 2) 구분선
const hrBtn = F.getByRole("button", { name: "구분선 추가", exact: true }).first();
const hrOk = await hrBtn.click({ timeout: 6000 }).then(() => true).catch(() => false);
await page.waitForTimeout(1800);
const hrCount = await F.locator(".se-component.se-horizontalLine").count().catch(() => 0);
console.log(`구분선 — 클릭 ${hrOk ? "성공" : "실패"} · 문서에 ${hrCount}개`);

// ── 3) 인용구
await page.keyboard.press("Control+End");
await page.waitForTimeout(400);
const quoteBtn = F.getByRole("button", { name: "인용구 추가", exact: true }).first();
const qOk = await quoteBtn.click({ timeout: 6000 }).then(() => true).catch(() => false);
await page.waitForTimeout(1500);
if (qOk) { await page.keyboard.type("인용구 안에 들어간 문장"); await page.waitForTimeout(800); }
const qCount = await F.locator(".se-component.se-quotation").count().catch(() => 0);
console.log(`인용구 — 클릭 ${qOk ? "성공" : "실패"} · 문서에 ${qCount}개`);

// ── 4) 글자 크기 드롭다운이 열리는지만
await page.keyboard.press("Control+End");
await page.waitForTimeout(400);
const sizeBtn = F.getByRole("button", { name: /글자 크기/ }).first();
await sizeBtn.click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1500);
const sizes = await F.evaluate(() => {
  const sel = document.querySelector(".se-toolbar-option-font-size-code, [class*='font-size'] ul, [class*='fontsize'] ul");
  if (!sel) return null;
  return [...sel.querySelectorAll("li,button")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 14);
});
console.log("글자 크기 목록:", sizes ? JSON.stringify(sizes) : "(못 읽음)");

console.log("\n창을 40초 열어 둡니다. 발행하지 않았습니다.");
await page.waitForTimeout(40000);
await ctx.close();
