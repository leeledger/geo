/**
 * 네이버 블로그 글쓰기 화면의 제목·본문 요소를 읽는다. 아무것도 쓰지 않는다.
 *
 * 스마트에디터 ONE 은 iframe(PostWriteForm.naver) 안에 있다.
 * 바깥 프레임 주소에도 Redirect=Write 가 들어 있어서, 그걸 조건에 넣으면
 * 바깥이 잡힌다. PostWriteForm 만 봐야 한다.
 *
 *   node naver-blog-probe.mjs
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
page.on("dialog", async (d) => { console.log("DIALOG:", d.message().slice(0, 90)); await d.accept().catch(() => {}); });

await page.goto(`https://blog.naver.com/${BLOG_ID}?Redirect=Write`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(11000);

const F = page.frames().find((f) => /PostWriteForm/i.test(f.url())) || page.mainFrame();
console.log("에디터:", F.url().slice(0, 80));

// 작성 중이던 글 복구 팝업이 떠 있으면 걷어낸다
for (const name of [/취소/, /닫기/]) {
  const b = F.getByRole("button", { name }).first();
  if (await b.isVisible().catch(() => false)) {
    console.log("팝업 버튼 보임:", (await b.innerText().catch(() => "")).trim());
  }
}

console.log("\n── se 구성요소 ──");
for (const sel of [
  ".se-documentTitle", ".se-title-text", ".se-component.se-text",
  ".se-section-documentTitle", ".se-placeholder", ".se-text-paragraph",
  '[contenteditable="true"]',
]) {
  const n = await F.locator(sel).count().catch(() => 0);
  if (!n) continue;
  console.log(`  ${sel} → ${n}개`);
  for (let i = 0; i < Math.min(n, 3); i++) {
    const el = F.locator(sel).nth(i);
    const t = (await el.innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 40);
    const cls = ((await el.getAttribute("class").catch(() => "")) || "").slice(0, 70);
    console.log(`      [${i}] "${t}"  class=${cls}`);
  }
}

console.log("\n── 파일 입력 ──");
const fi = await F.locator('input[type="file"]').count().catch(() => 0);
console.log(`  input[type=file] → ${fi}개`);
for (let i = 0; i < fi; i++) {
  const el = F.locator('input[type="file"]').nth(i);
  console.log(`      [${i}] accept=${await el.getAttribute("accept").catch(() => "")} ` +
              `multiple=${await el.getAttribute("multiple").catch(() => null) !== null}`);
}

console.log("\n── 발행 흐름 버튼 ──");
for (const b of (await F.getByRole("button").all())) {
  const t = (await b.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  if (/발행|저장|사진/.test(t) && t.length < 20) console.log(`  "${t}"`);
}

console.log("\n창을 50초 열어 둡니다. 아무것도 쓰지 않았습니다.");
await page.waitForTimeout(50000);
await ctx.close();
