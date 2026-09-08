/**
 * 이미 올린 네이버 글에 태그를 넣는다.
 *
 * 앞서 올릴 때 발행 설정 패널을 건드리지 않고 바로 발행해서 태그가 비어 있었다.
 * 네이버에서 태그는 검색으로 들어오는 통로라 비워 두면 안 된다.
 *
 * 흐름: 글 수정 → 발행 누르면 설정 패널이 열림 → 태그 칸 → 다시 발행
 *
 *   node naver-blog-tags.mjs --probe   패널에 뭐가 있는지만 보기
 *   node naver-blog-tags.mjs           태그 넣고 다시 발행
 */
import { chromium } from "playwright";
import path from "node:path";

const BLOG_ID = process.env.NAVER_BLOG_ID || "force11";
const LOG_NO = process.env.NAVER_LOG_NO || "224405281285";
const PROBE = process.argv.includes("--probe");

/**
 * 태그는 학부모가 실제로 검색창에 치는 말로 넣는다.
 * 지역 이름이 먼저다 — 이 채널로 오는 사람은 대개 동네부터 찾는다.
 * '문제정의' 같은 말은 글의 주제이긴 해도 아무도 그렇게 검색하지 않는다.
 */
const TAGS = [
  "송파코딩학원",
  "석촌동코딩학원",
  "잠실코딩학원",
  "초등코딩학원",
  "코딩학원추천",
  "AI교육",
  "AI코딩",
  "코딩교육",
  "로봇코딩",
  "중학생코딩",
  "초등코딩",
  "송파로봇학원",
];

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("dialog", async (d) => { console.log("  · " + d.message().slice(0, 70)); await d.accept().catch(() => {}); });

await page.goto(
  `https://blog.naver.com/PostWriteForm.naver?blogId=${BLOG_ID}&logNo=${LOG_NO}&Redirect=Update`,
  { waitUntil: "domcontentloaded" },
);
await page.waitForTimeout(12000);

if (/nid\.naver\.com/.test(page.url())) {
  console.log("로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).");
  const t0 = Date.now();
  while (Date.now() - t0 < 8 * 60 * 1000 && /nid\.naver\.com/.test(page.url())) await page.waitForTimeout(2500);
  await page.waitForTimeout(9000);
}

const F = page.frames().find((f) => /PostWriteForm/i.test(f.url())) || page.mainFrame();
console.log("에디터:", F.url().slice(0, 90));

const title = await F.locator(".se-documentTitle").first().innerText().catch(() => "");
console.log("불러온 글:", title.replace(/\s+/g, " ").trim().slice(0, 50));

// 발행을 누르면 설정 패널이 열린다
await F.getByRole("button", { name: /^발행/ }).first().click({ timeout: 10000 });
await page.waitForTimeout(3500);

if (PROBE) {
  console.log("\n── 패널 글자 ──");
  console.log((await F.locator("body").innerText().catch(() => "")).replace(/\n{2,}/g, "\n").slice(-900));
  console.log("\n── 입력란 ──");
  for (const i of (await F.locator("input, textarea").all()).slice(0, 30)) {
    if (!(await i.isVisible().catch(() => false))) continue;
    const ph = (await i.getAttribute("placeholder").catch(() => "")) || "";
    const nm = (await i.getAttribute("name").catch(() => "")) || "";
    const id = (await i.getAttribute("id").catch(() => "")) || "";
    console.log(`   ph="${ph.slice(0, 40)}" name="${nm.slice(0, 24)}" id="${id.slice(0, 28)}"`);
  }
  console.log("\n── 버튼 ──");
  for (const b of (await F.getByRole("button").all())) {
    const t = (await b.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    if (t && t.length < 20 && (await b.isVisible().catch(() => false))) console.log(`   "${t}"`);
  }
  console.log("\n--probe 입니다. 아무것도 저장하지 않았습니다. 60초 열어 둡니다.");
  await page.waitForTimeout(60000);
  await ctx.close();
  process.exit(0);
}

// ── 검색 허용 먼저 확인한다.
// 이게 꺼져 있으면 태그를 아무리 넣어도 네이버 검색에 안 잡힌다.
// 태그부터 챙기다가 정작 이걸 놓치면 헛일이다.
for (const [id, name] of [
  ["publish-option-search", "검색 허용"],
  ["publish-option-outside", "외부 공유 허용"],
]) {
  const c = F.locator(`#${id}`);
  if (!(await c.count())) continue;
  const on = await c.isChecked().catch(() => null);
  if (on === false) {
    await c.check({ force: true }).catch(() => {});
    console.log(`${name}: 꺼져 있어서 켰습니다`);
  } else {
    console.log(`${name}: ${on === true ? "켜져 있음" : "확인 못함"}`);
  }
}

// ── 태그 넣기
const box = F.locator('#tag-input, input[placeholder*="태그"], input[id*="tag"]').first();
if (!(await box.isVisible().catch(() => false))) {
  console.log("태그 입력란을 못 찾았습니다. --probe 로 화면을 확인하세요.");
  await page.waitForTimeout(30000);
  await ctx.close();
  process.exit(1);
}

const before = await F.locator(".tag_area, [class*='tag_list']").first().innerText().catch(() => "");
let added = 0;
for (const t of TAGS) {
  if (before.includes(t)) continue;
  await box.click();
  await page.keyboard.type(t, { delay: 18 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  added++;
}
console.log(`태그 ${added}개 입력`);

// ── 다시 발행
await F.getByRole("button", { name: /^발행$/ }).last().click({ timeout: 10000 });
await page.waitForTimeout(12000);
console.log("주소:", page.url().slice(0, 110));
console.log(!/PostWriteForm/.test(page.url()) ? "✓ 수정 발행된 것으로 보입니다" : "화면이 그대로입니다 — 확인 필요");

await page.waitForTimeout(20000);
await ctx.close();
