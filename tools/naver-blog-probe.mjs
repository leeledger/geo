/**
 * 네이버 블로그 글쓰기 화면 구조를 읽는다. 아무것도 쓰지 않는다.
 *
 * 스마트에디터는 iframe 안에 들어 있고 버전마다 구조가 다르다.
 * 주소와 선택자를 추측하면 계속 빗나간다. 화면을 먼저 읽는다.
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
await page.waitForTimeout(10000);
console.log("주소:", page.url().slice(0, 120));

if (/nid\.naver\.com/.test(page.url())) {
  console.log("\n로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).");
  const t = Date.now();
  while (Date.now() - t < 8 * 60 * 1000 && /nid\.naver\.com/.test(page.url())) await page.waitForTimeout(2500);
  console.log("→", page.url().slice(0, 120));
  await page.waitForTimeout(8000);
}

console.log("\n── 프레임 ──");
for (const f of page.frames()) {
  console.log(`  ${f.name() || "(이름없음)"}  ${f.url().slice(0, 90)}`);
}

/**
 * 에디터 프레임 고르기.
 * 처음에 Redirect=Write 도 조건에 넣었더니 바깥 프레임이 잡혔다.
 * 바깥 주소에도 그 글자가 들어 있어서다. PostWriteForm 만 본다.
 */
let ed = page.frames().find((f) => /PostWriteForm/i.test(f.url()));
if (!ed) ed = page.frames().find((f) => f !== page.mainFrame() && !/about:blank|pstatic/.test(f.url()));
console.log("\n에디터 후보 프레임:", ed ? ed.url().slice(0, 90) : "(없음 · 메인 사용)");
const F = ed || page.mainFrame();

console.log("\n── 화면 글자 (앞 600자) ──");
console.log((await F.locator("body").innerText().catch(() => "")).replace(/\n{2,}/g, "\n").slice(0, 600));

console.log("\n── 편집 가능 영역 ──");
for (const sel of ['[contenteditable="true"]', "textarea", ".se-text-paragraph", ".se-component"]) {
  const n = await F.locator(sel).count().catch(() => 0);
  if (n) console.log(`  ${sel} → ${n}개`);
}

console.log("\n── 버튼 ──");
for (const b of (await F.getByRole("button").all()).slice(0, 40)) {
  const t = (await b.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  if (t && t.length < 24) console.log(`  "${t}"`);
}

console.log("\n창을 60초 열어 둡니다. 아무것도 쓰지 않았습니다.");
await page.waitForTimeout(60000);
await ctx.close();
