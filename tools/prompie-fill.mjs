/**
 * 오늘학교 학원 프로필 채우기.
 *
 * 값은 전부 robotncoding.com 의 구조화 데이터(JSON-LD)에서 가져온다.
 * 지어낸 값은 하나도 넣지 않는다 — 학원 소개가 사업 전체의 근거다.
 *
 * 1단계: 기본 정보를 채우고 저장한다
 * 2단계: 나머지 탭을 돌며 어떤 칸이 있는지 읽어 둔다 (채우지는 않는다)
 *
 *   node prompie-fill.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const BASE = "https://academy.prompie.com/administrators/wibhx5b/academy/manage";

/** 전부 robotncoding.com 에 적혀 있는 값이다 */
const F = {
  tel: "02-422-0525",
  site: "https://robotncoding.com",
  detail: "2층",
};

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());
const say = (s) => console.log(`  ${s}`);

await page.goto(`${BASE}/profile/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

if (/login/i.test(page.url())) {
  say("로그인이 풀렸습니다. prompie-profile.mjs 로 다시 로그인해 주세요.");
  await ctx.close().catch(() => {});
  process.exit(1);
}

// ── 1. 기본 정보
console.log("\n【 기본 정보 】");

// 전화번호·주소는 readonly 다. 옆의 「수정」을 눌러야 열린다.
// 화면에 그렇게 적혀 있었는데 처음엔 그냥 채우려다 30초를 날렸다.
const unlock = async (label) => {
  const row = page.locator("div", { has: page.locator(`label:has-text("${label}")`) });
  const btn = page.getByText("수정", { exact: true });
  const c = await btn.count();
  for (let i = 0; i < c; i++) {
    const b = btn.nth(i);
    const near = await b.evaluate((el, lb) => {
      let p = el.parentElement;
      for (let k = 0; k < 4 && p; k++, p = p.parentElement) if (p.innerText.includes(lb)) return true;
      return false;
    }, label).catch(() => false);
    if (near) { await b.click().catch(() => {}); await page.waitForTimeout(1200); return true; }
  }
  return false;
};

// ── 전화번호
const telBox = page.locator("#phone_number");
if (await telBox.getAttribute("readonly") !== null) {
  const ok = await unlock("전화번호");
  say(ok ? "전화번호 「수정」 눌렀습니다" : "전화번호 수정 버튼을 못 찾았습니다");
}
const telVal = await telBox.inputValue().catch(() => "");
if (!telVal) {
  // 「수정」이 새 입력칸(newNumberInput)을 띄우는 구조일 수도 있다
  const nn = page.locator("#newNumberInput");
  if (await nn.count() && await nn.isVisible().catch(() => false)) {
    // 모달 안내가 「숫자만 기입」이고 input 이 type=number 다
    await nn.fill(F.tel.replace(/-/g, ""));
    // 버튼 이름이 「변경하기」다. 추가·등록·확인으로 찾다가 못 찾아서
    // 모달이 열린 채로 남았고, 그게 저장 버튼을 가려 아무것도 저장이 안 됐다.
    const upd = page.locator("#numberUpdateBtn");
    if (await upd.count()) {
      await upd.click().catch(() => {});
      await page.waitForTimeout(2500);
      say(`전화번호 ${F.tel} — 「변경하기」 눌렀습니다`);
    } else say("변경하기 버튼을 못 찾았습니다");
    // 모달이 정말 닫혔는지 본다. 안 닫혔으면 뒤가 전부 막힌다.
    await page.locator("#phoneEditModal").waitFor({ state: "hidden", timeout: 8000 })
      .then(() => say("모달 닫힘 확인"))
      .catch(() => say("모달이 아직 떠 있습니다"));
  } else {
    await telBox.fill(F.tel).catch((e) => say("전화 입력 실패: " + e.message.slice(0, 60)));
    say(`전화번호 ${F.tel}`);
  }
} else say(`전화번호 이미 있음 (${telVal})`);

// ── 웹사이트
const urlBoxes = page.locator('input[type="url"]');
const n = await urlBoxes.count();
say(`url 칸 ${n}개`);
if (n) {
  const w = urlBoxes.nth(0);
  const cur = await w.inputValue().catch(() => "");
  if (!cur) { await w.fill(F.site); say(`웹사이트 ${F.site}`); }
  else say(`웹사이트 이미 있음 (${cur})`);
}

// ── 교육청 등록 주소 노출 — 켠다. 동네 학원은 주소가 보여야 찾아온다.
const cb = page.locator('input[type="checkbox"]').first();
if (await cb.count()) {
  if (!(await cb.isChecked())) { await cb.check().catch(() => {}); say("교육청 등록 주소 노출 켬"); }
  else say("교육청 등록 주소 노출 이미 켜짐");
}

await page.screenshot({ path: "prompie-before-save.png", fullPage: true }).catch(() => {});
const save = page.getByRole("button", { name: /저장/ }).first();
if (await save.count()) {
  await save.click();
  say("저장하기 눌렀습니다");
  await page.waitForTimeout(5000);
} else say("저장 버튼을 못 찾았습니다");

await page.screenshot({ path: "prompie-after-save.png", fullPage: true }).catch(() => {});

// ── 2. 나머지 탭 구조를 읽어 둔다
const TABS = ["소개", "사진/영상", "학원 요약 정보", "시설 및 편의사항", "시간표", "주요 수업정보", "커리큘럼"];
for (const t of TABS) {
  const tab = page.getByRole("link", { name: t }).or(page.getByText(t, { exact: true })).first();
  if (!(await tab.count())) { console.log(`\n【 ${t} 】 탭을 못 찾음`); continue; }
  await tab.click().catch(() => {});
  await page.waitForTimeout(3500);
  const fs = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("input, textarea, select, [contenteditable=true]")) {
      if (el.type === "hidden") continue;
      let lab = "";
      if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) lab = l.innerText.trim(); }
      if (!lab) { let p = el.parentElement; for (let i = 0; i < 3 && p; i++, p = p.parentElement) { const l = p.querySelector("label"); if (l) { lab = l.innerText.trim().slice(0, 45); break; } } }
      out.push({
        t: el.tagName.toLowerCase() + (el.type ? `:${el.type}` : ""),
        lab: lab || el.name || el.id || "",
        ph: el.placeholder || "",
        val: (el.value || el.innerText || "").slice(0, 50),
        opts: el.tagName === "SELECT" ? [...el.options].map((o) => o.text.trim()).slice(0, 14) : null,
      });
    }
    return out;
  });
  console.log(`\n【 ${t} 】 ${fs.length}칸  ${page.url().replace(/.*manage/, "…")}`);
  for (const f of fs.slice(0, 22)) {
    console.log(`   [${f.t}] ${f.lab.slice(0, 30).padEnd(32)} ${f.val ? "= " + f.val : (f.ph ? "힌트: " + f.ph.slice(0, 40) : "")}`);
    if (f.opts) console.log(`        선택: ${f.opts.join(" / ").slice(0, 100)}`);
  }
}

console.log("\n  구조를 다 읽었습니다.");
await new Promise((r) => setTimeout(r, 1500));
await ctx.close().catch(() => {});
