/**
 * 유튜브 채널 이름만 바꾼다.
 *
 * aria-label 로 찾으면 될 때도 있고 안 될 때도 있다. 같은 화면인데 렌더에 따라
 * aria-label 이 붙기도 하고 비어 있기도 했다. 그래서 그걸로 찾지 않는다.
 *
 * 대신 화면에 보이는 입력칸 중 검색창(#query-input)을 뺀 첫 번째를 쓴다.
 * 위에서부터 이름 → 핸들 → 설명 순서라 이 자리는 안 바뀐다.
 *
 * 주의: 이름은 14일에 2번만 바꿀 수 있다. 확인하고 돌릴 것.
 *
 *   node yt-name.mjs            바꾸고 게시
 *   node yt-name.mjs --dry      지금 값만 보기
 */
import { chromium } from "playwright";
import path from "node:path";

const NAME = process.env.YT_NAME || "로봇&코딩 AI";
const DRY = process.argv.includes("--dry");

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1500, height: 960 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("dialog", async (d) => { console.log("  · " + d.message().slice(0, 70)); await d.accept().catch(() => {}); });

await page.goto("https://studio.youtube.com/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
if (/accounts\.google\.com/.test(page.url())) {
  console.log("로그인이 필요합니다 (최대 10분).");
  const t0 = Date.now();
  while (Date.now() - t0 < 600000 && /accounts\.google\.com/.test(page.url())) await page.waitForTimeout(3000);
  await page.waitForTimeout(9000);
}
const cid = (page.url().match(/channel\/(UC[\w-]+)/) || [])[1];
await page.goto(`https://studio.youtube.com/channel/${cid}/editing/images`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(13000);

/** 검색창을 뺀, 화면에 보이는 첫 입력칸에 포커스를 준다 */
const info = await page.evaluate(() => {
  const found = [];
  const walk = (r, d = 0) => {
    if (d > 30 || !r.querySelectorAll) return;
    for (const n of r.querySelectorAll("input")) {
      const rc = n.getBoundingClientRect();
      if (rc.width > 0 && rc.height > 0 && n.id !== "query-input" && n.type !== "hidden") {
        found.push({ el: n, y: rc.top + window.scrollY });
      }
      if (n.shadowRoot) walk(n.shadowRoot, d + 1);
    }
    for (const n of r.querySelectorAll("*")) if (n.shadowRoot) walk(n.shadowRoot, d + 1);
  };
  walk(document, 0);
  found.sort((a, b) => a.y - b.y);
  const first = found[0];
  if (!first) return null;
  first.el.scrollIntoView({ block: "center" });
  first.el.focus();
  return { value: first.el.value, y: Math.round(first.y), count: found.length };
});

if (!info) { console.log("이름 칸을 못 찾았습니다."); await ctx.close(); process.exit(1); }
console.log(`입력칸 ${info.count}개 · 이름 칸 y=${info.y} · 현재값 "${info.value}"`);

if (DRY) { console.log("--dry 입니다. 바꾸지 않았습니다."); await page.waitForTimeout(20000); await ctx.close(); process.exit(0); }
if (info.value === NAME) { console.log("이미 같은 이름입니다."); await ctx.close(); process.exit(0); }

await page.waitForTimeout(800);
await page.keyboard.press("Control+A");
await page.keyboard.press("Delete");
await page.waitForTimeout(400);
await page.keyboard.type(NAME, { delay: 30 });
await page.waitForTimeout(1500);

const after = await page.evaluate(() => document.activeElement && document.activeElement.value);
console.log("입력 후:", JSON.stringify(after));

const pub = page.getByRole("button", { name: /^(게시|PUBLISH)$/ }).first();
if (await pub.isEnabled().catch(() => false)) {
  await pub.click().catch(() => {});
  await page.waitForTimeout(12000);
  console.log("게시했습니다");
} else {
  console.log("게시 버튼이 비활성입니다 — 창에서 직접 눌러 주세요");
}

await page.waitForTimeout(30000);
await ctx.close();
