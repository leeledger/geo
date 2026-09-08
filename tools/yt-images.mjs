/**
 * 유튜브 채널 배너·프로필 사진 올리기 — 올라갔는지 확인까지 한다.
 *
 * 앞선 판이 틀렸다. 파일 선택창에 파일을 넘긴 것만 보고 "✓ 올림"을 찍었는데,
 * 실제로는 배너가 안 올라가 있었고 프로필은 검은 원만 저장돼 있었다.
 * 넘긴 것과 저장된 것은 다르다. 미리보기 이미지가 실제로 바뀌었는지를 본다.
 *
 * 자르기 창을 반드시 기다린다. 창이 뜨기 전에 '완료'를 누르면 엉뚱하게 잘린다.
 *
 *   node yt-images.mjs banner    배너만
 *   node yt-images.mjs avatar    사진만
 *   node yt-images.mjs           둘 다
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const DIR = path.resolve("../academy/public/youtube");
const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const JOBS = [
  { key: "banner", name: "배너", file: "banner.png", btn: /^업로드$/, idx: 0 },
  { key: "avatar", name: "사진", file: "avatar.png", btn: /^(변경|업로드)$/, idx: 0, after: true },
];
const jobs = want.length ? JOBS.filter((j) => want.includes(j.key)) : JOBS;

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

/** 화면에 그려진 미리보기 이미지들의 주소. 저장 전후를 비교하는 데 쓴다. */
async function shots() {
  return page.evaluate(() => {
    const out = [];
    const walk = (r, d = 0) => {
      if (d > 30 || !r.querySelectorAll) return;
      for (const n of r.querySelectorAll("img")) {
        const rc = n.getBoundingClientRect();
        if (rc.width > 40) out.push(n.src || "");
      }
      for (const n of r.querySelectorAll("*")) if (n.shadowRoot) walk(n.shadowRoot, d + 1);
    };
    walk(document, 0);
    return out;
  });
}

for (const job of jobs) {
  const p = path.join(DIR, job.file);
  if (!fs.existsSync(p)) { console.log(`✗ ${job.name} — 파일 없음`); continue; }

  // 항목마다 화면을 새로 연다. 앞 작업 뒤 화면이 다시 그려져 버튼 자리가 바뀐다.
  await page.goto(`https://studio.youtube.com/channel/${cid}/editing/images`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(12000);

  const before = await shots();

  let chooser = null;
  const wait = page.waitForEvent("filechooser", { timeout: 25000 })
    .then((c) => { chooser = c; }).catch(() => {});

  try {
    const all = page.getByRole("button", { name: job.btn });
    const n = await all.count();
    const shown = [];
    for (let i = 0; i < n; i++) if (await all.nth(i).isVisible().catch(() => false)) shown.push(all.nth(i));
    if (!shown.length) throw new Error("버튼이 안 보입니다");
    const btn = shown[job.idx] ?? shown[0];

    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);
    await btn.click({ timeout: 12000 });
    await wait;
    if (!chooser) throw new Error("파일 선택창이 안 열림");
    await chooser.setFiles(p);

    // 자르기 창이 뜰 때까지 기다린다. 뜨기 전에 누르면 엉뚱하게 잘린다.
    const done = page.getByRole("button", { name: /^(완료|Done)$/ }).first();
    await done.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    if (await done.isVisible().catch(() => false)) {
      await page.waitForTimeout(2500);      // 자르기 틀이 자리 잡을 시간
      await done.click();
      console.log(`  ${job.name}: 자르기 완료`);
    } else {
      console.log(`  ${job.name}: 자르기 창이 안 떴습니다`);
    }
    await page.waitForTimeout(6000);

    // 게시
    const pub = page.getByRole("button", { name: /^(게시|PUBLISH)$/ }).first();
    if (await pub.isEnabled().catch(() => false)) {
      await pub.click().catch(() => {});
      await page.waitForTimeout(12000);
    } else {
      console.log(`  ${job.name}: 게시 버튼이 비활성입니다`);
    }

    // ── 확인. 넘긴 것 말고 저장된 것을 본다.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(12000);
    const after = await shots();
    const fresh = after.filter((s) => s && !before.includes(s));
    if (fresh.length) {
      console.log(`  ✓ ${job.name} 저장 확인 — 새 이미지 ${fresh.length}개`);
      console.log(`      ${fresh[0].slice(0, 80)}`);
    } else {
      console.log(`  ✗ ${job.name} 저장 안 됨 — 화면의 이미지가 그대로입니다`);
    }
  } catch (e) {
    await wait;
    console.log(`  ✗ ${job.name} — ${e.message.split("\n")[0].slice(0, 80)}`);
  }
}

console.log("\n창을 40초 열어 둡니다.");
await page.waitForTimeout(40000);
await ctx.close();
