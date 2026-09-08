/**
 * 스마트플레이스 업체정보에 홈페이지 URL 을 연결한다.
 *
 * 왜 필요한가: 「석촌동 코딩학원」으로 검색하면 플레이스가 웹문서보다 위에 뜨고
 * 우리 업체가 1위인데, 거기서 사이트로 들어올 길이 없었다.
 * 등록된 URL 은 블로그 하나뿐이었다.
 *
 * 화면 흐름 (직접 읽어서 확인한 것):
 *   업체정보 → 정보 수정 → ?menu=additional
 *   "URL 추가" → 분류 선택(카페/일반/예약/밴드/페이스북/인스타그램/유튜브/스마트스토어)
 *   → URL 입력 → "추가하기" → "저장하기"
 * 홈페이지라는 분류는 없다. 일반이 그 자리다.
 *
 *   node smartplace-add-url.mjs            넣고 저장
 *   node smartplace-add-url.mjs --dry      저장 직전까지만
 */
import { chromium } from "playwright";
import path from "node:path";

const BIZ = process.env.SMARTPLACE_ID || "5013357"; // 로봇앤코딩학원
const URL_TO_ADD = process.env.PLACE_URL || "https://robotncoding.com";
const KIND = "일반";
const DRY = process.argv.includes("--dry");

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("dialog", async (d) => { console.log("  · " + d.message().slice(0, 70)); await d.accept().catch(() => {}); });

await page.goto(`https://new.smartplace.naver.com/bizes/place/${BIZ}/details?menu=additional`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(9000);

if (/nid\.naver\.com/.test(page.url())) {
  console.log("로그인이 안 돼 있습니다.");
  await ctx.close();
  process.exit(1);
}

const before = await page.locator("body").innerText().catch(() => "");
if (before.includes(URL_TO_ADD.replace(/^https?:\/\//, ""))) {
  console.log("이미 등록돼 있습니다:", URL_TO_ADD);
  await ctx.close();
  process.exit(0);
}

// ── URL 추가
const add = page.getByText("URL 추가", { exact: false }).first();
await add.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(700);
await add.click({ timeout: 8000 });
await page.waitForTimeout(2500);

// ── 분류: 일반
// 드롭다운일 수도, 그냥 나열된 버튼일 수도 있다. 보이면 그대로 누르고
// 안 보이면 "분류 선택"을 먼저 열어 본다.
let picked = await page.getByText(KIND, { exact: true }).first()
  .click({ timeout: 4000 }).then(() => true).catch(() => false);
if (!picked) {
  await page.getByText("분류 선택", { exact: false }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  picked = await page.getByText(KIND, { exact: true }).first()
    .click({ timeout: 6000 }).then(() => true).catch(() => false);
}
console.log(picked ? `분류: ${KIND}` : "분류를 못 골랐습니다 — 기본값으로 진행");
await page.waitForTimeout(1200);

// ── URL 입력
const box = page.getByPlaceholder(/URL을 입력/).first();
await box.click({ timeout: 8000 });
await box.fill(URL_TO_ADD);
await page.waitForTimeout(800);
console.log("입력:", URL_TO_ADD);

// ── 추가하기
await page.getByRole("button", { name: /^추가하기$/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(2500);

const mid = await page.locator("body").innerText().catch(() => "");
const listed = mid.includes("robotncoding.com");
console.log("목록에 올라옴:", listed ? "예" : "아니오");

if (DRY) {
  console.log("\n--dry 라 저장하지 않았습니다.");
  await page.waitForTimeout(20000);
  await ctx.close();
  process.exit(0);
}

// ── 저장하기
await page.getByRole("button", { name: /^저장하기$/ }).first().click({ timeout: 10000 });
await page.waitForTimeout(9000);

// ── 저장됐는지 새로 읽어서 확인한다. 화면에 남아 있는 것만 보고 믿지 않는다.
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
const after = await page.locator("body").innerText().catch(() => "");
console.log(after.includes("robotncoding.com")
  ? "\n✓ 저장 확인 — 플레이스에 홈페이지가 연결됐습니다"
  : "\n✗ 저장 뒤 다시 읽으니 없습니다. 화면을 확인해 주세요");

const at = after.indexOf("운영중인 홈페이지");
if (at >= 0) console.log("  " + after.slice(at, at + 260).replace(/\n+/g, " · "));

await page.waitForTimeout(15000);
await ctx.close();
