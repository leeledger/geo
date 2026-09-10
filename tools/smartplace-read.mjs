/**
 * 스마트플레이스 상세설명·대표키워드를 통째로 읽는다.
 *
 * 덮어쓰기 전에 지금 뭐가 들어 있는지 전부 봐야 한다.
 * 앞부분 90자만 보고 고치면 뒤에 있던 정보를 조용히 날린다.
 * 대표키워드도 앞선 판에서 「비어 있다」고 잘못 읽은 적이 있다 —
 * 입력칸은 「새로 추가」용이고 이미 넣은 건 칩(chip)으로 그려져 있었다.
 *
 *   node smartplace-read.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const BIZ = process.env.SMARTPLACE_ID || "5013357";
const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1000 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto(`https://new.smartplace.naver.com/bizes/place/${BIZ}/details?menu=info`,
  { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5500);

const r = await page.evaluate(() => {
  const tas = [...document.querySelectorAll("textarea")];
  const detail = tas.find((t) => /상세설명/.test(
    t.closest("div")?.parentElement?.innerText ?? "")) ?? tas[0];

  // 대표키워드 — 입력칸 둘레의 상자를 통째로 읽는다.
  // 이미 넣은 키워드는 칩으로 그려져 있어서 input.value 로는 안 잡힌다.
  let kwBox = null;
  for (const el of document.querySelectorAll("div, section")) {
    const t = el.innerText ?? "";
    if (t.includes("대표키워드") && t.length < 700) kwBox = el;
  }

  return {
    detail: detail?.value ?? "",
    detailMax: detail?.maxLength > 0 ? detail.maxLength : null,
    kwText: kwBox?.innerText?.replace(/\n+/g, " | ").slice(0, 500) ?? "(못 찾음)",
    kwChips: kwBox
      ? [...kwBox.querySelectorAll("li, .chip, [class*=keyword], [class*=tag]")]
          .map((x) => x.innerText.trim()).filter((x) => x && x.length < 25).slice(0, 15)
      : [],
  };
});

console.log("── 상세설명 ──");
console.log(`  ${r.detail.length}자${r.detailMax ? ` / ${r.detailMax}` : ""}`);
console.log("┌─────────────────────────────────────────────");
r.detail.split("\n").forEach((l) => console.log("│ " + l));
console.log("└─────────────────────────────────────────────");

console.log("\n── 대표키워드 ──");
console.log(`  화면 글자: ${r.kwText}`);
console.log(`  칩: ${r.kwChips.length ? r.kwChips.join(" · ") : "(없음)"}`);

await page.screenshot({ path: "smartplace-detail.png" }).catch(() => {});
await new Promise((x) => setTimeout(x, 1500));
await ctx.close().catch(() => {});
