/**
 * 유튜브 채널 프로필을 채운다 — 배너·사진·이름·설명, 그리고 워터마크.
 *
 * 로그인은 사람이 직접 한다. 구글 계정은 자동 입력을 막는다.
 * 창을 열어 두고 로그인이 끝나면 이어서 진행한다.
 *
 * 화면 (읽어서 확인한 것): studio.youtube.com/channel/<ID>/editing/profile
 *   배너 이미지  "업로드"
 *   사진        "변경" / "삭제"
 *   이름 · 핸들 · 설명
 *   위쪽에 "게시"
 * 워터마크는 다른 자리에 있어 따로 찾는다.
 *
 *   node yt-branding.mjs --probe   보기만
 *   node yt-branding.mjs           채우고 게시
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const PROBE = process.argv.includes("--probe");
const DIR = path.resolve("../academy/public/youtube");

/**
 * 채널 이름을 '학원'으로 두지 않는다. 다루는 주제가 교육보다 넓다.
 * 배너에 이미 「로봇·코딩 AI」로 적혀 있어 그것과 맞춘다.
 * 핸들(@robotncoding)·도메인·블로그와도 같은 이름이라 흩어지지 않는다.
 */
const NAME = "로봇&코딩 AI";
const DESC = `AI로 바뀌는 것들을 직접 써 보고 이야기합니다.

병원 정보시스템, 공장 ERP, 콜센터 시스템을 만들던 사람입니다.
지금은 아이들에게 AI로 만드는 법을 가르치고 있습니다.

새 도구가 나올 때마다 소개하는 채널은 이미 많습니다.
여기서는 실제로 시켜 보고, 어디까지 되고 어디서 막히는지를 봅니다.
답이 틀렸을 때 어디가 틀렸는지 짚는 쪽이 오래 남습니다.

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

if (/accounts\.google\.com|ServiceLogin/.test(page.url())) {
  console.log("\n구글 로그인 화면입니다. 창에서 직접 로그인해 주세요 (최대 10분).\n");
  const t0 = Date.now();
  while (Date.now() - t0 < 10 * 60 * 1000 && /accounts\.google\.com|ServiceLogin/.test(page.url())) {
    await page.waitForTimeout(3000);
  }
  if (/accounts\.google\.com/.test(page.url())) { console.log("로그인 확인 실패"); await ctx.close(); process.exit(1); }
  await page.waitForTimeout(9000);
}

const cid = (page.url().match(/channel\/(UC[\w-]+)/) || [])[1];
if (!cid) { console.log("채널 ID 를 못 찾았습니다:", page.url()); await ctx.close(); process.exit(1); }
console.log("채널:", cid);

await page.goto(`https://studio.youtube.com/channel/${cid}/editing/images`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(10000);
console.log("화면:", page.url().slice(0, 90));

if (PROBE) {
  console.log("\n── 화면 글자 ──");
  console.log((await page.locator("body").innerText().catch(() => "")).replace(/\n{2,}/g, "\n").slice(0, 1200));
  await page.waitForTimeout(60000);
  await ctx.close();
  process.exit(0);
}

/**
 * 이미지 넣기.
 *
 * 처음엔 설명 문구가 든 div 를 골라 그 안에서 버튼을 찾았는데, hasText 로 거른 뒤
 * .last() 를 쓰니 버튼이 없는 깊은 div 가 잡혀서 계속 시간만 끌었다.
 * 화면을 읽어 보니 버튼마다 id 가 붙어 있고 위에서부터 순서가 정해져 있다.
 *   #upload-button  [0] 배너   [1] 워터마크
 *   #replace-button 사진 (화면 밖에 같은 id 가 하나 더 있어 보이는 것만 고른다)
 */
async function visible(sel, nth) {
  const all = page.locator(sel);
  const n = await all.count();
  const shown = [];
  for (let i = 0; i < n; i++) {
    const el = all.nth(i);
    if (await el.isVisible().catch(() => false)) shown.push(el);
  }
  return shown[nth ?? 0] ?? null;
}

async function put(name, sel, nth, file) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) { console.log(`  ✗ ${name} — 파일 없음 ${file}`); return; }

  // 파일 선택창을 안 띄우고 끝나도 이 약속이 미처리로 남지 않게 한다.
  // 앞서 여기서 프로세스가 통째로 죽었다.
  let chooser = null;
  const wait = page.waitForEvent("filechooser", { timeout: 25000 })
    .then((c) => { chooser = c; })
    .catch(() => {});

  try {
    const btn = await visible(sel, nth);
    if (!btn) { console.log(`  ✗ ${name} — 버튼이 안 보입니다 (${sel})`); await wait; return; }
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);
    await btn.click({ timeout: 12000 });
    await wait;
    if (!chooser) { console.log(`  ✗ ${name} — 파일 선택창이 안 열렸습니다`); return; }
    await chooser.setFiles(p);
    await page.waitForTimeout(8000);

    // 자르기 창이 뜨면 완료를 누른다
    for (const label of [/^완료$/, /^Done$/, /^저장$/]) {
      const d = page.getByRole("button", { name: label }).first();
      if (await d.isVisible().catch(() => false)) {
        await d.click().catch(() => {});
        await page.waitForTimeout(5000);
        break;
      }
    }
    console.log(`  ✓ ${name} ← ${file}`);
  } catch (e) {
    await wait;
    console.log(`  ✗ ${name} — ${e.message.split("\n")[0].slice(0, 80)}`);
  }
}

await put("배너", "#upload-button", 0, "banner.png");
await put("사진", "#replace-button", 0, "avatar.png");
await put("워터마크", "#upload-button", 1, "watermark.png");

/** 이름·설명 — 자리표시자로 찾는다. 라벨은 화면마다 달라진다. */
async function fill(name, sel, value) {
  try {
    const el = page.locator(sel).first();
    if (!(await el.isVisible().catch(() => false))) { console.log(`  · ${name} 칸 없음`); return; }
    await el.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.waitForTimeout(300);
    await page.keyboard.type(value, { delay: 4 });
    console.log(`  ✓ ${name}`);
    await page.waitForTimeout(800);
  } catch (e) {
    console.log(`  ✗ ${name} — ${e.message.split("\n")[0].slice(0, 70)}`);
  }
}

// 화면에서 읽은 id 를 쓴다. 라벨로 찾으면 언어 설정에 따라 빗나간다.
await fill("채널 이름", '#entity-name input, #entity-name textarea, #entity-name [contenteditable="true"]', NAME);
await fill("채널 설명", '#description-textbox textarea, #description-textbox [contenteditable="true"], #description-textbox #textbox', DESC);

// ── 게시
const publish = page.getByRole("button", { name: /^(게시|PUBLISH|Publish)$/ }).first();
if (await publish.isEnabled().catch(() => false)) {
  await publish.click().catch(() => {});
  await page.waitForTimeout(10000);
  console.log("\n게시했습니다");
} else {
  console.log("\n게시 버튼이 눌리지 않습니다 — 창에서 직접 눌러 주세요");
}

console.log("창을 70초 열어 둡니다.");
await page.waitForTimeout(70000);
await ctx.close();
