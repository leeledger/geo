/**
 * 유튜브 스튜디오에 영상을 올린다.
 *
 * 로그인은 사람이 직접 한다(yt-branding.mjs 와 같은 .browser-profile).
 * 단계마다 화면을 찍어 둔다 — 「올렸다」고 답하기 전에 그림으로 확인하려고.
 *
 *   node yt-upload.mjs <영상.mp4> --title "제목" --desc-file desc.txt [--vis PUBLIC|UNLISTED|PRIVATE] [--shots 폴더]
 *
 * 화면 (읽어서 확인한 것): 만들기 → 동영상 업로드 → 파일 → 세부정보(제목·설명·아동용 아님)
 *   → 다음 ×3 → 공개 범위 → 게시/저장. 끝나면 영상 주소가 대화상자에 뜬다.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(args.find((a) => /\.(mp4|mov|webm)$/i.test(a)) || "");
const TITLE = opt("--title", "");
const DESC = opt("--desc-file") ? fs.readFileSync(opt("--desc-file"), "utf8") : "";
const VIS = opt("--vis", "PUBLIC");
const SHOTS = path.resolve(opt("--shots", "yt-upload-shots"));
// 이미 올라간 영상 고치기 — 설명 바꾸기(--edit ID --desc-file) · 공개로 돌리기(--set-public ID).
// yt-api.mjs 가 감사 전이라 비공개로 잠긴 영상을 여기로 넘긴다.
const EDIT_ID = opt("--edit") || opt("--set-public");
const SET_PUBLIC = args.includes("--set-public");

if (!EDIT_ID && (!fs.existsSync(FILE) || !TITLE)) {
  console.log("사용법: node yt-upload.mjs <영상.mp4> --title \"제목\" --desc-file desc.txt [--vis PUBLIC]");
  console.log("       node yt-upload.mjs --edit <영상ID> [--desc-file d.txt] [--title \"…\"]   ·   --set-public <영상ID>");
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });
let n = 0;
const shot = async (page, name) => {
  const f = path.join(SHOTS, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: f }).catch(() => {});
  console.log(`  · ${name}`);
};

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1500, height: 960 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const fail = async (msg) => { console.log("✗ " + msg); await shot(page, "fail"); await ctx.close(); process.exit(1); };

await page.goto("https://studio.youtube.com/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);

if (/accounts\.google\.com|ServiceLogin/.test(page.url())) {
  console.log("\n구글 로그인 화면입니다. 창에서 직접 로그인해 주세요 (최대 10분).\n");
  const t0 = Date.now();
  while (Date.now() - t0 < 10 * 60 * 1000 && /accounts\.google\.com|ServiceLogin/.test(page.url())) {
    await page.waitForTimeout(3000);
  }
  if (/accounts\.google\.com/.test(page.url())) await fail("로그인 확인 실패");
  await page.waitForTimeout(9000);
}
const cid = (page.url().match(/channel\/(UC[\w-]+)/) || [])[1];
if (!cid) await fail("채널 ID 를 못 찾았습니다: " + page.url());
console.log("채널:", cid);

if (EDIT_ID) {
  await page.goto(`https://studio.youtube.com/video/${EDIT_ID}/edit`, { waitUntil: "domcontentloaded" });
  const d = page.locator("#description-textarea #textbox");
  await d.waitFor({ timeout: 60000 }).catch(() => {});
  if (!(await d.count())) await fail("편집 화면이 안 떴습니다");
  await page.waitForTimeout(3000);
  if (TITLE) {
    const t = page.locator("#title-textarea #textbox");
    await t.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Delete");
    await page.keyboard.insertText(TITLE);
  }
  if (DESC) {
    await d.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Delete");
    for (const [i, line] of DESC.replace(/\r/g, "").split("\n").entries()) {
      if (i) await page.keyboard.press("Shift+Enter");
      if (line) await page.keyboard.insertText(line);
    }
  }
  if (SET_PUBLIC) {
    await page.locator("ytcp-video-metadata-visibility").click();
    await page.waitForTimeout(1500);
    await page.locator('tp-yt-paper-radio-button[name="PUBLIC"]').click();
    await page.locator("ytcp-video-visibility-select #save-button, #save-button").first().click();
    await page.waitForTimeout(1500);
  }
  await shot(page, "edit-before-save");
  await page.locator("#save").click();
  await page.waitForTimeout(5000);
  await shot(page, "edit-saved");
  // 저장 후 다시 읽어 확인한다 — 넘긴 것과 저장된 것은 다르다
  await page.reload({ waitUntil: "domcontentloaded" });
  await d.waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const got = (await d.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const want = DESC.replace(/\s+/g, " ").trim();
  console.log(DESC ? (got === want ? "✓ 설명 저장 확인" : `? 설명이 다릅니다 (저장 ${got.length}자 / 보낸 ${want.length}자)`) : "");
  await shot(page, "edit-reloaded");
  await ctx.close();
  process.exit(0);
}

// 업로드 대화상자 — 주소로 바로 연다(만들기 메뉴가 판마다 달라서)
await page.goto(`https://studio.youtube.com/channel/${cid}/videos/upload?d=ud`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
const input = page.locator('input[type="file"]').first();
if (!(await input.count())) await fail("파일 입력칸이 없습니다");
await input.setInputFiles(FILE);
console.log("파일:", path.basename(FILE));

// 세부정보
const title = page.locator("#title-textarea #textbox");
await title.waitFor({ timeout: 60000 }).catch(() => {});
if (!(await title.count())) await fail("제목칸이 안 떴습니다");
await page.waitForTimeout(3000);
await title.click();
await page.keyboard.press("Control+A");
await page.keyboard.press("Delete");
await title.pressSequentially(TITLE, { delay: 15 });

const desc = page.locator("#description-textarea #textbox");
await desc.click();
for (const [i, line] of DESC.replace(/\r/g, "").split("\n").entries()) {
  if (i) await page.keyboard.press("Shift+Enter");
  if (line) await page.keyboard.insertText(line);
}
await page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').click();
await page.waitForTimeout(1000);
await shot(page, "details");

for (let i = 0; i < 3; i++) {
  await page.locator("#next-button").click();
  await page.waitForTimeout(2500);
}
await page.locator(`tp-yt-paper-radio-button[name="${VIS}"]`).click();
await page.waitForTimeout(1000);
await shot(page, "visibility");

// 처리(확인)가 안 끝나도 게시는 된다. 다만 업로드 자체는 끝나야 한다.
const t1 = Date.now();
while (Date.now() - t1 < 10 * 60 * 1000) {
  const txt = (await page.locator("ytcp-video-upload-progress").innerText().catch(() => "")) || "";
  if (!/업로드 중|Uploading/.test(txt)) break;
  await page.waitForTimeout(3000);
}
const link = await page.locator("ytcp-video-info a").first().getAttribute("href").catch(() => null);
await page.locator("#done-button").click();
await page.waitForTimeout(6000);
await shot(page, "done");

const closed = page.locator("ytcp-uploads-still-processing-dialog #close-button, ytcp-video-share-dialog #close-button");
if (await closed.count()) await closed.first().click().catch(() => {});
console.log(link ? `✓ 올림: ${link}` : "? 주소를 못 읽었습니다 — 화면 그림을 보세요");
await ctx.close();
