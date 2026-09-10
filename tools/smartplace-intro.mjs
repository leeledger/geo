/**
 * 스마트플레이스 — 상세설명(소개글)을 본다.
 *
 * 왜 하냐면:
 *   네이버 AI 가 이 학원을 설명할 때 플레이스 정보를 읽는다. 지금 나오는 답이
 *   「석촌동에 있고 무선 인터넷과 남녀 구분 화장실을 제공합니다. 주차가 불가능하므로…」였다.
 *   편의시설 태그만 읽고 답한 것이다 — 소개글에 쓸 내용이 없으니까.
 *
 *   무엇을 가르치는 학원인지, 누가 가르치는지, 어떤 성과가 있었는지가
 *   한 줄도 안 들어가 있다. 학부모가 AI 에게 물으면 화장실 이야기를 듣는다.
 *
 *   플레이스 소개글이 곧 네이버 AI 의 답이다. 여기가 GEO 에서 가장 싼 자리다.
 *
 * 첫 판은 읽기만 한다. 어떤 칸이 있고 지금 뭐가 들어 있는지 봐야
 * 무엇을 넣을지 정할 수 있다.
 *
 *   node smartplace-intro.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const BIZ = process.env.SMARTPLACE_ID || "5013357"; // 로봇앤코딩학원
const PROFILE = path.join(process.cwd(), ".browser-profile");

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
// 성공이 alert 로 오는 화면이 있다. 핸들러가 없으면 조용히 닫힌다.
ctx.on("dialog", (d) => d.accept().catch(() => {}));

const page = ctx.pages()[0] ?? (await ctx.newPage());
const say = (s) => console.log(`  ${s}`);

await page.goto(`https://new.smartplace.naver.com/bizes/place/${BIZ}/details?menu=info`, {
  waitUntil: "domcontentloaded", timeout: 60000,
});
await page.waitForTimeout(5000);
say(`주소 ${page.url().slice(0, 95)}`);

if (/nid\.naver\.com|\/login/.test(page.url())) {
  console.log(`
  ─────────────────────────────────────────────
  네이버 로그인이 필요합니다. 이 창에서 로그인해 주세요.
  최대 10분 기다립니다.
  ─────────────────────────────────────────────
`);
  const t0 = Date.now();
  while (Date.now() - t0 < 10 * 60 * 1000) {
    if (page.isClosed()) break;
    if (!/nid\.naver\.com|\/login/.test(page.url())) { say("✓ 로그인 확인"); break; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  await page.goto(`https://new.smartplace.naver.com/bizes/place/${BIZ}/details?menu=info`,
    { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(4000);
}

// 화면에 있는 입력칸을 통째로 읽는다. 경로나 셀렉터를 추측하면 헛클릭한다.
const dump = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("input, textarea, [contenteditable='true']")) {
    if (el.type === "hidden" || el.type === "file") continue;
    if (!el.offsetParent && el.tagName !== "TEXTAREA") continue;
    let lab = "";
    let p = el.parentElement;
    for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
      const h = p.querySelector("label, h3, h4, strong, .title");
      if (h && h.innerText.trim()) { lab = h.innerText.trim().slice(0, 30); break; }
    }
    const v = (el.value ?? el.innerText ?? "").toString();
    out.push({
      tag: el.tagName.toLowerCase(), id: el.id || el.name || "",
      lab, ph: el.placeholder || "", len: v.length, head: v.slice(0, 90),
      max: el.maxLength > 0 ? el.maxLength : null,
    });
  }
  const heads = [...document.querySelectorAll("h2, h3")].map((h) => h.innerText.trim()).filter(Boolean).slice(0, 20);
  return { out, heads };
});

console.log(`\n── 화면의 제목들 ──`);
dump.heads.forEach((h) => console.log(`  ${h.slice(0, 40)}`));

console.log(`\n── 입력칸 ${dump.out.length}개 ──`);
for (const f of dump.out) {
  console.log(`  [${f.tag}] ${(f.lab || f.id || "?").padEnd(22)} ${f.len}자${f.max ? `/${f.max}` : ""}`);
  if (f.head) console.log(`        ${f.head.replace(/\s+/g, " ")}`);
  else if (f.ph) console.log(`        (빈칸) 힌트: ${f.ph.slice(0, 60)}`);
}

await page.screenshot({ path: "smartplace-info.png", fullPage: true }).catch(() => {});
console.log("\n  화면을 smartplace-info.png 로 저장했습니다.");
console.log("  창은 정상 종료합니다 — 그래야 쿠키가 남습니다.");

await new Promise((r) => setTimeout(r, 2000));
await ctx.close().catch(() => {});
