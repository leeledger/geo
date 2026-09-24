/**
 * 런즈 티처스 로그인 — 카카오 2단계 인증은 원장이 카카오톡에서 「확인」만 누른다. 나머지는 도구가.
 *
 * 원장(2026-09-24): 「런즈 티처스 등록 너가 알아서 해」. 가입은 카카오 로그인뿐이고, 카카오가 2단계 인증을 건다.
 * 우회하지 않는다 — 확인을 기다린다(최대 5분). 「이 브라우저에서 2단계 인증 사용 안 함」은 켠다(다음부터 확인이 덜 뜨게).
 * 로그인 뒤 화면을 읽어 찍는다 — 학원 등록·정보 입력은 그다음 단계에서 화면을 보고 짠다.
 *
 *   node learns-login.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1280, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul",
});
const p = ctx.pages()[0] ?? (await ctx.newPage());
const 줄 = (t) => t.split("\n").map((s) => s.trim()).filter(Boolean).join(" | ");
try {
  await p.goto("https://learns.partners/services/promotion", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(5000);
  const popup = ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null);
  await p.getByText("무료로 바로 시작하기").first().click({ timeout: 8000 });
  let w = (await popup) ?? p;
  await w.waitForTimeout(5000);
  if (/accounts\.kakao\.com/.test(w.url())) {
    await w.locator("input[name=isRememberBrowser]").check({ timeout: 3000 }).catch(() => {});
    console.log("카카오톡에 온 로그인 확인 메시지에서 「확인」을 눌러 주세요 (5분 안)");
    const t0 = Date.now();
    while (Date.now() - t0 < 5 * 60 * 1000 && /accounts\.kakao\.com|kauth\.kakao\.com/.test(w.url())) await w.waitForTimeout(2000);
  }
  await w.waitForTimeout(8000);
  const 됨 = !/kakao\.com/.test(w.url());
  console.log(됨 ? `로그인 됨 — ${w.url()}` : `5분 안에 확인이 안 됐습니다 — ${w.url()}`);
  console.log(줄(await w.locator("body").innerText().catch(() => "")).slice(0, 2500));
  const fields = await w.$$eval("input, button, select, textarea", (els) => els.map((e) => `${e.tagName}:${e.type || ""}:${e.name || e.placeholder || (e.innerText || "").trim().slice(0, 24)}`));
  console.log("FIELDS:", fields.slice(0, 60).join(" / "));
  await w.screenshot({ path: "learns-after-login.png", fullPage: true });
  process.exitCode = 됨 ? 0 : 1;
} catch (e) {
  console.log("ERR", String(e.message).split("\n")[0]);
  process.exitCode = 1;
}
await ctx.close();
