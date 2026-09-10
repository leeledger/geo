/**
 * 빙 웹마스터 ← 구글 서치콘솔 가져오기.
 *
 * 화면을 읽어 가며 한 단계씩 간다. 경로나 셀렉터를 추측하면 404 나 헛클릭을 맞는다.
 * 각 단계마다 무엇을 봤고 무엇을 눌렀는지 찍는다 — 조용히 실패하면 원인을 못 찾는다.
 *
 * 구글 OAuth 동의 화면이 나오면 거기서 멈춘다.
 * 남의 계정 권한을 넘기는 화면은 사람이 눌러야 한다.
 *
 *   node bing-import.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const HOME = "https://www.bing.com/webmasters/home";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));

const page = ctx.pages()[0] ?? (await ctx.newPage());
const shot = (n) => page.screenshot({ path: `bing-${n}.png` }).catch(() => {});
const say = (s) => console.log(`  ${s}`);

await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(4000);
say(`주소 ${page.url().slice(0, 80)}`);

let body = await page.locator("body").innerText().catch(() => "");
if (/robotncoding/i.test(body)) {
  say("robotncoding.com 이 이미 등록되어 있습니다. 할 일 없음.");
  await ctx.close().catch(() => {});
  process.exit(0);
}

// ── 1. Import 누르기
const imp = page.getByRole("button", { name: /^import$/i })
  .or(page.getByRole("link", { name: /^import$/i })).first();
if (!(await imp.count())) {
  say("Import 버튼을 못 찾았습니다.");
  await shot("noimport");
  await ctx.close().catch(() => {});
  process.exit(1);
}
await imp.click();
say("Import 눌렀습니다");
await page.waitForTimeout(5000);
await shot("1-import");

// Import 를 누르면 「무엇을 가져오는가」 안내 모달이 먼저 뜬다.
// 여기서 Continue 를 눌러야 구글 인증으로 넘어간다.
// 앞선 판은 이 모달을 못 보고 사이트 목록을 찾다가 「없음」이라고 했다.
const cont = page.getByRole("button", { name: /^(continue|계속)$/i }).first();
if (await cont.count()) {
  await cont.click().catch(() => {});
  say("안내 모달에서 Continue 눌렀습니다");
  await page.waitForTimeout(6000);
  await shot("1b-continue");
}

// 구글 로그인/동의는 새 창으로 뜨는 경우가 많다
const pages = ctx.pages();
const gp = pages.find((p) => /accounts\.google|google\.com/.test(p.url())) ?? page;
say(`현재 ${pages.length}개 탭 · 활성 ${gp.url().slice(0, 70)}`);

if (/accounts\.google/.test(gp.url())) {
  await gp.waitForTimeout(3000);
  const t = await gp.locator("body").innerText().catch(() => "");
  await gp.screenshot({ path: "bing-2-google.png" }).catch(() => {});

  // 계정 선택 화면이면 골라 준다. 동의 화면이면 사람에게 넘긴다.
  if (/계속|Continue|허용|Allow/.test(t) && /액세스|access|권한|permission/i.test(t)) {
    console.log(`
  ─────────────────────────────────────────────
  구글 동의 화면입니다.

  빙에게 서치콘솔 읽기 권한을 넘기는 화면이라 여기는 직접 눌러 주세요.
  「계속」 또는 「허용」 입니다.

  누르시면 제가 이어서 사이트를 고르고 가져옵니다.
  (나중에 myaccount.google.com 에서 언제든 회수할 수 있습니다)
  ─────────────────────────────────────────────
`);
    // 동의 뒤 빙으로 돌아올 때까지 기다린다
    const started = Date.now();
    while (Date.now() - started < 6 * 60 * 1000) {
      const back = ctx.pages().find((p) => /bing\.com\/webmasters/.test(p.url()));
      if (back) { say("빙으로 돌아왔습니다"); break; }
      await new Promise((r) => setTimeout(r, 3000));
    }
  } else {
    say("구글 계정 선택 화면 — 계정을 고릅니다");
    const acct = gp.locator('[data-identifier], [role="link"]').first();
    if (await acct.count()) { await acct.click().catch(() => {}); await gp.waitForTimeout(4000); }
  }
}

// ── 2. 빙으로 돌아와 사이트 고르기
const bp = ctx.pages().find((p) => /bing\.com\/webmasters/.test(p.url())) ?? page;
await bp.bringToFront().catch(() => {});
await bp.waitForTimeout(4000);
await bp.screenshot({ path: "bing-3-select.png" }).catch(() => {});

body = await bp.locator("body").innerText().catch(() => "");
say(`화면에 robotncoding ${/robotncoding/i.test(body) ? "보임" : "없음"}`);

if (/robotncoding/i.test(body)) {
  // 체크박스를 켜고 가져오기
  const cb = bp.locator('input[type=checkbox]').first();
  if (await cb.count()) { await cb.check().catch(() => {}); say("사이트를 골랐습니다"); }
  const go = bp.getByRole("button", { name: /import|가져오기|add|추가/i }).first();
  if (await go.count()) {
    await go.click().catch(() => {});
    say("가져오기 눌렀습니다");
    await bp.waitForTimeout(8000);
  }
}

await bp.screenshot({ path: "bing-4-done.png" }).catch(() => {});
const fin = await bp.locator("body").innerText().catch(() => "");
say(`결과: robotncoding ${/robotncoding/i.test(fin) ? "등록됨" : "아직 안 보임"}`);
say("화면을 bing-1~4.png 로 저장했습니다");

await new Promise((r) => setTimeout(r, 2000));
await ctx.close().catch(() => {});
