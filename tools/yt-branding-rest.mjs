/**
 * 유튜브 채널 프로필 마무리 — 워터마크·채널 이름·설명.
 *
 * 배너와 사진은 이미 올렸다. 나머지가 실패한 이유는 id 로 찾았기 때문이다.
 * (#upload-button 같은 id 는 어떤 렌더에서는 붙고 어떤 렌더에서는 안 붙는다.)
 * 화면을 다시 읽어 보니 aria-label 이 안정적이었다.
 *
 *   채널 이름  input[aria-label="채널 이름 입력"]
 *   핸들      input[aria-label="핸들 설정"]      (이미 robotncoding 이라 건드리지 않는다)
 *   설명      #textbox  (contenteditable div)
 *   워터마크   두 번째 "업로드" 버튼 (첫 번째는 배너)
 *
 *   node yt-branding-rest.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const DIR = path.resolve("../academy/public/youtube");
const NAME = "로봇&코딩 AI";
const DESC = `AI로 바뀌는 것들을 직접 써 보고 이야기합니다.

병원 정보시스템, 공장 ERP, 콜센터 시스템을 만들던 사람입니다. 지금은 아이들에게 AI로 만드는 법을 가르치고 있습니다.

새 도구가 나올 때마다 소개하는 채널은 이미 많습니다. 여기서는 실제로 시켜 보고, 어디까지 되고 어디서 막히는지를 봅니다. 답이 틀렸을 때 어디가 틀렸는지 짚는 쪽이 오래 남습니다.

다루는 것
· AI에게 시켜서 실제로 만들어 보기
· 새로 나온 도구, 써 보고 남는 것만
· AI 시대에 일하는 법과 공부하는 법
· 아이 교육 — 학부모가 실제로 묻는 질문들

매주 수요일에 올립니다.

robotncoding.com
서울 송파구 석촌동 · 상담 02-422-0525`;

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
  console.log("로그인이 필요합니다. 창에서 로그인해 주세요 (최대 10분).");
  const t0 = Date.now();
  while (Date.now() - t0 < 600000 && /accounts\.google\.com/.test(page.url())) await page.waitForTimeout(3000);
  await page.waitForTimeout(9000);
}
const cid = (page.url().match(/channel\/(UC[\w-]+)/) || [])[1];
if (!cid) { console.log("채널 ID 를 못 찾았습니다"); await ctx.close(); process.exit(1); }

await page.goto(`https://studio.youtube.com/channel/${cid}/editing/images`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(11000);

// 아래까지 훑어야 워터마크 구역이 그려진다
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(450); }
await page.waitForTimeout(2000);

// ── 워터마크 : 보이는 "업로드" 중 두 번째 (첫 번째는 배너)
const wm = path.join(DIR, "watermark.png");
if (!fs.existsSync(wm)) {
  console.log("watermark.png 가 없습니다");
} else {
  let chooser = null;
  const wait = page.waitForEvent("filechooser", { timeout: 25000 })
    .then((c) => { chooser = c; }).catch(() => {});
  try {
    const ups = page.getByRole("button", { name: "업로드", exact: true });
    const n = await ups.count();
    const shown = [];
    for (let i = 0; i < n; i++) if (await ups.nth(i).isVisible().catch(() => false)) shown.push(ups.nth(i));
    console.log(`업로드 버튼 ${shown.length}개 보임`);
    const btn = shown[shown.length - 1];          // 마지막 = 워터마크
    if (!btn) throw new Error("업로드 버튼 없음");
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(700);
    await btn.click({ timeout: 12000 });
    await wait;
    if (!chooser) throw new Error("파일 선택창이 안 열림");
    await chooser.setFiles(wm);
    await page.waitForTimeout(8000);
    const done = page.getByRole("button", { name: /^(완료|저장|Done)$/ }).first();
    if (await done.isVisible().catch(() => false)) { await done.click().catch(() => {}); await page.waitForTimeout(5000); }
    console.log("  ✓ 워터마크");
  } catch (e) {
    await wait;
    console.log("  ✗ 워터마크 —", e.message.split("\n")[0].slice(0, 70));
  }
}

// ── 채널 이름
try {
  const el = page.locator('input[aria-label="채널 이름 입력"]').first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click({ timeout: 10000 });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(400);
  await page.keyboard.type(NAME, { delay: 25 });
  console.log("  ✓ 채널 이름 —", NAME);
  await page.waitForTimeout(900);
} catch (e) {
  console.log("  ✗ 채널 이름 —", e.message.split("\n")[0].slice(0, 70));
}

// ── 설명 : contenteditable 이라 fill 이 안 먹는다. 눌러서 직접 친다.
try {
  const el = page.locator("#textbox").first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click({ timeout: 12000 });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(400);
  // 줄바꿈이 있는 글은 한 번에 치면 중간에 끊긴다. 줄 단위로 넣는다.
  const lines = DESC.split("\n");
  for (const [i, line] of lines.entries()) {
    if (line) await page.keyboard.type(line, { delay: 3 });
    if (i < lines.length - 1) await page.keyboard.press("Enter");
  }
  console.log("  ✓ 채널 설명");
  await page.waitForTimeout(1200);
} catch (e) {
  console.log("  ✗ 채널 설명 —", e.message.split("\n")[0].slice(0, 70));
}

// ── 게시
const pub = page.getByRole("button", { name: /^(게시|PUBLISH)$/ }).first();
if (await pub.isEnabled().catch(() => false)) {
  await pub.click().catch(() => {});
  await page.waitForTimeout(11000);
  console.log("\n게시했습니다");
} else {
  console.log("\n게시 버튼이 비활성입니다 — 바뀐 게 없거나 직접 눌러야 합니다");
}

await page.waitForTimeout(50000);
await ctx.close();
