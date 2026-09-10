/**
 * 상세설명에 어떤 글자가 허용되는지 직접 시험한다.
 *
 * 화면 안내: 「한글, 영문, 한자, 일본어, 숫자, 특수문자(-_():&![]..%+~@*^'/?°C※<>)만 입력 가능」
 * 목록에 쉼표(,)와 가운뎃점(·)이 없다. 원본 글이 법률 이름을 「설립 . 운영」으로
 * 쓴 이유가 이것 같다 — 쓴 사람도 여기서 막혔던 것이다.
 *
 * 안내 문구를 믿고 추측하지 말고 하나씩 넣어 본다.
 * 저장 버튼이 활성화되는지로 판정한다.
 *
 *   node smartplace-charcheck.mjs
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

const idx = await page.evaluate(() => {
  const tas = [...document.querySelectorAll("textarea")];
  return tas.findIndex((t) => /상세설명/.test(t.closest("div")?.parentElement?.innerText ?? ""));
});
const box = page.locator("textarea").nth(idx);
const ORIGINAL = await box.inputValue();
console.log(`  원본 ${ORIGINAL.length}자 — 시험 뒤 되돌립니다\n`);

/** 넣어 보고 오류 표시가 뜨는지 본다 */
async function test(label, text) {
  await box.click();
  await page.keyboard.press("Control+A");
  await box.fill(text);
  await page.waitForTimeout(900);
  const bad = await page.evaluate((i) => {
    const ta = document.querySelectorAll("textarea")[i];
    // 오류일 때 테두리가 빨개진다. 클래스명은 바뀔 수 있으니 실제 색을 본다.
    const c = getComputedStyle(ta).borderColor;
    const m = c.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
    return m[0] > 180 && m[1] < 130;   // 붉은 계열
  }, idx);
  console.log(`  ${bad ? "✗ 막힘" : "○ 됨  "}  ${label}`);
  return !bad;
}

await test("한글만", "코딩을 가르치지 않습니다 생각하는 방법을 가르칩니다");
await test("쉼표 ,", "파이썬, 자바, 자바스크립트를 다룹니다");
await test("가운뎃점 ·", "순차·반복·조건을 익힙니다");
await test("느낌표 !", "좋습니다!");
await test("줄바꿈", "첫 줄\n둘째 줄");
await test("괄호 ()", "초등 저학년(90분) 고학년(120분)");
await test("물결 ~", "7세~성인");

// 원래대로 되돌린다. 시험하다 남의 글을 망가뜨리면 안 된다.
await box.click();
await page.keyboard.press("Control+A");
await box.fill(ORIGINAL);
await page.waitForTimeout(600);
console.log(`\n  원본으로 되돌렸습니다 (${(await box.inputValue()).length}자)`);

await new Promise((r) => setTimeout(r, 1500));
await ctx.close().catch(() => {});
