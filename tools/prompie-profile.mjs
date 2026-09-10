/**
 * 오늘학교 아카데미 — 학원 프로필 채우기.
 *
 * AI 가 지역 질문에 답할 때 이 목록을 읽는 걸 확인했다.
 * 「송파구 코딩학원 9개, 평균 평점 4.7」이 여기서 나왔고 우리는 그 9개에 없었다.
 *
 * 첫 판은 화면을 읽기만 한다. 항목을 모르고 채우면 엉뚱한 칸에 값이 들어간다.
 * 지어낸 값은 하나도 넣지 않는다 — 학원 소개는 사업 전체의 근거다.
 *
 *   node prompie-profile.mjs           읽기만
 *   node prompie-profile.mjs --fill    채우기
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const URL_ = "https://academy.prompie.com/administrators/wibhx5b/academy/manage/profile/";
const FILL = process.argv.includes("--fill");

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(4000);

const url = page.url();
console.log(`  주소 ${url.slice(0, 95)}`);

if (/login|signin|accounts/i.test(url)) {
  console.log(`
  ─────────────────────────────────────────────
  오늘학교 로그인이 필요합니다.

  이 창에서 로그인해 주세요. 최대 10분 기다립니다.
  로그인되면 제가 항목을 읽고 이어서 합니다.
  ─────────────────────────────────────────────
`);
  const t0 = Date.now();
  while (Date.now() - t0 < 10 * 60 * 1000) {
    if (page.isClosed()) break;
    if (!/login|signin|accounts/i.test(page.url())) { console.log("  ✓ 로그인 확인\n"); break; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  await page.goto(URL_, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(4000);
}

// ── 폼 항목을 통째로 읽는다. 이름·종류·현재값·선택지까지.
const fields = await page.evaluate(() => {
  const out = [];
  const labelOf = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return l.innerText.trim();
    }
    const w = el.closest("label");
    if (w) return w.innerText.trim().slice(0, 60);
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
      const l = p.querySelector("label");
      if (l) return l.innerText.trim().slice(0, 60);
    }
    return "";
  };
  for (const el of document.querySelectorAll("input, textarea, select")) {
    if (el.type === "hidden") continue;
    const r = {
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      name: el.name || el.id || "",
      label: labelOf(el),
      value: (el.value || "").slice(0, 120),
      required: !!el.required,
      placeholder: el.placeholder || "",
      maxlength: el.maxLength > 0 ? el.maxLength : null,
    };
    if (el.tagName === "SELECT") {
      r.options = [...el.options].map((o) => o.text.trim()).slice(0, 25);
    }
    if (el.type === "checkbox" || el.type === "radio") r.checked = el.checked;
    out.push(r);
  }
  return out;
});

console.log(`  항목 ${fields.length}개\n`);
for (const f of fields) {
  const need = f.required ? "*" : " ";
  const val = f.value ? `= ${f.value}` : (f.checked !== undefined ? `= ${f.checked}` : "(비어 있음)");
  console.log(`  ${need} [${f.type || f.tag}] ${(f.label || f.name).slice(0, 34).padEnd(36)} ${val}`);
  if (f.placeholder) console.log(`      힌트: ${f.placeholder.slice(0, 70)}`);
  if (f.maxlength) console.log(`      최대: ${f.maxlength}자`);
  if (f.options) console.log(`      선택: ${f.options.join(" / ").slice(0, 110)}`);
}

await page.screenshot({ path: "prompie-profile.png", fullPage: true }).catch(() => {});
console.log("\n  화면을 prompie-profile.png 로 저장했습니다.");

if (!FILL) {
  console.log("  읽기만 했습니다. 채우려면 --fill 로 다시 부르세요.");
  await new Promise((r) => setTimeout(r, 1500));
  await ctx.close().catch(() => {});
  process.exit(0);
}
