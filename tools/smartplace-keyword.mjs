/**
 * 스마트플레이스 대표키워드를 넣고 뺀다.
 *
 * 원장(2026-09-24): 「플레이스에 올리는 것도 직접 에이전트가 하도록」. 전에는 「원장님이 하실 일」로 올렸다.
 * 로그인은 tools/.browser-profile 세션을 쓴다(open-session.mjs 로 원장이 한 번 로그인). 로컬 에이전트가 place-keyword 일감으로 부른다.
 *
 * 화면(읽어서 확인한 것, 2026-09-24): 업체정보 → 기본 정보 → 「대표키워드를 적어주세요」
 *   단어 1개씩, 최대 5개, 한 단어 15자. 칩마다 「삭제」, 입력칸 옆 「추가」. 맨 아래 「저장하기」.
 *   5개가 꽉 차 있으면 넣기 전에 하나를 빼야 한다 — --remove 없이 꽉 차 있으면 아무것도 안 바꾸고 끝낸다.
 *
 *   node smartplace-keyword.mjs --add 잠실코딩학원 --remove 송파코딩
 *   node smartplace-keyword.mjs --list                지금 키워드만 읽는다
 *   node smartplace-keyword.mjs ... --dry             저장 직전까지만
 *
 * 끝 줄: 「KEYWORDS=a,b,c」 (저장 뒤 다시 읽은 것) · 로그인 풀림이면 「로그인이 안 돼 있습니다」 + 종료 2
 */
import { chromium } from "playwright";
import path from "node:path";

const BIZ = process.env.SMARTPLACE_ID || "5013357"; // 로봇앤코딩학원
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ADD = arg("--add");
const REMOVE = arg("--remove");
const DRY = process.argv.includes("--dry");
const LIST = process.argv.includes("--list");
const MAX = 5;

if (!LIST && !ADD && !REMOVE) { console.log("사용법: --add 단어 [--remove 단어] [--dry] | --list"); process.exit(1); }
if (ADD && ADD.length > 15) { console.log(`「${ADD}」는 15자를 넘습니다`); process.exit(1); }

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("dialog", async (d) => { console.log("  · " + d.message().slice(0, 80)); await d.accept().catch(() => {}); });

const 끝내기 = async (code) => { await ctx.close().catch(() => {}); process.exit(code); };

const 열기 = async () => {
  await page.goto(`https://new.smartplace.naver.com/bizes/place/${BIZ}/details?menu=basic`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  if (/nid\.naver\.com/.test(page.url())) { console.log("로그인이 안 돼 있습니다."); await 끝내기(2); }
};

/**
 * 키워드 칩. 구조(2026-09-24 HTML 을 읽어 확인):
 *   input[name=keyword] + button.Tags_btn_tag(추가) / span.Tags_tag(단어 + button.Tags_btn_close > 「삭제」)
 * 클래스 뒤 해시는 배포마다 바뀌니 앞부분만 맞춘다
 */
const 칩 = 'span[class*="Tags_tag__"]';
const 읽기 = async () => {
  if (!(await page.locator('input[name="keyword"]').count())) return null;
  return page.locator(칩).evaluateAll((els) => els.map((e) => (e.textContent || "").replace(/삭제\s*$/, "").trim()).filter(Boolean));
};

await 열기();
const 전 = await 읽기();
if (!전) { console.log("대표키워드 칸을 못 찾았습니다 — 화면이 바뀌었을 수 있습니다"); await page.screenshot({ path: "smartplace-keyword-miss.png" }); await 끝내기(1); }
console.log("지금:", 전.join(", ") || "(없음)");
if (LIST) { console.log(`KEYWORDS=${전.join(",")}`); await 끝내기(0); }

if (ADD && 전.includes(ADD) && (!REMOVE || !전.includes(REMOVE))) {
  console.log(`이미 들어 있습니다: ${ADD}`);
  console.log(`KEYWORDS=${전.join(",")}`);
  await 끝내기(0);
}
if (ADD && !전.includes(ADD) && 전.length >= MAX && !(REMOVE && 전.includes(REMOVE))) {
  console.log(`${MAX}개가 꽉 차 있습니다. 뺄 단어(--remove)가 없어 바꾸지 않습니다.`);
  await 끝내기(1);
}

// ── 빼기: 그 단어 칩의 「삭제」
if (REMOVE && 전.includes(REMOVE)) {
  let removed = false;
  const n = await page.locator(칩).count();
  for (let i = 0; i < n && !removed; i++) {
    const c = page.locator(칩).nth(i);
    const w = ((await c.textContent()) || "").replace(/삭제\s*$/, "").trim();
    if (w !== REMOVE) continue;
    await c.scrollIntoViewIfNeeded().catch(() => {});
    await c.locator('button[class*="Tags_btn_close"]').click({ timeout: 5000 });
    removed = true;
  }
  await page.waitForTimeout(1200);
  console.log(removed ? `뺌: ${REMOVE}` : `「${REMOVE}」 삭제 버튼을 못 찾았습니다`);
  if (!removed) { await page.screenshot({ path: "smartplace-keyword-miss.png" }); await 끝내기(1); }
}

// ── 넣기: 입력칸(0/15자 옆)에 치고 「추가」
if (ADD && !전.includes(ADD)) {
  const 칸 = page.locator('input[name="keyword"]').first();
  await 칸.scrollIntoViewIfNeeded().catch(() => {});
  await 칸.click({ timeout: 8000 });
  await 칸.fill(ADD);
  await page.waitForTimeout(600);
  await page.locator('button[class*="Tags_btn_tag"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  console.log(`넣음: ${ADD}`);
}

const 중간 = await 읽기();
console.log("저장 전:", (중간 ?? []).join(", "));
if (DRY) { console.log("--dry 라 저장하지 않았습니다."); await page.waitForTimeout(8000); await 끝내기(0); }

// ── 저장하기 → 새로 읽어 확인. 화면에 남은 것만 믿지 않는다(CLAUDE.md: 넘긴 것과 저장된 것은 다르다)
await page.getByRole("button", { name: /^저장하기$/ }).first().click({ timeout: 10000 });
await page.waitForTimeout(8000);
await 열기();
const 후 = await 읽기();
const ok = (!ADD || 후?.includes(ADD)) && (!REMOVE || !후?.includes(REMOVE));
console.log(ok ? "✓ 저장 확인" : "✗ 다시 읽으니 바뀌지 않았습니다");
console.log(`KEYWORDS=${(후 ?? []).join(",")}`);
await 끝내기(ok ? 0 : 1);
