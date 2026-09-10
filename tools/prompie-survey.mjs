/**
 * 각 탭의 칸을 읽는다. 채우지는 않는다.
 * 탭은 별도 주소다 — getByText 로 누르면 화면이 안 넘어간다.
 */
import { chromium } from "playwright";
import path from "node:path";

const B = "https://academy.prompie.com/administrators/wibhx5b";
const TABS = [
  ["소개", `${B}/academy/manage/info/`],
  ["사진/영상", `${B}/academy/manage/portfolio/list/`],
  ["학원 요약 정보", `${B}/academies/141931/info/edit/`],
  ["시설 및 편의사항", `${B}/academies/141931/additional-info/edit/`],
  ["시간표", `${B}/academies/141931/timetables/`],
  ["주요 수업정보", `${B}/academies/141931/additional-class-info/edit/`],
  ["커리큘럼", `${B}/academy/manage/curriculum/list/`],
];

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1000 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());

for (const [name, url] of TABS) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const r = await page.evaluate(() => {
    const fields = [];
    for (const el of document.querySelectorAll("input, textarea, select, [contenteditable='true']")) {
      if (el.type === "hidden") continue;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      let lab = "";
      if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) lab = l.innerText.trim(); }
      if (!lab) { const w = el.closest("label"); if (w) lab = w.innerText.trim().slice(0, 40); }
      if (!lab) { let p = el.parentElement; for (let i = 0; i < 3 && p; i++, p = p.parentElement) { const l = p.querySelector("label"); if (l) { lab = l.innerText.trim().slice(0, 40); break; } } }
      fields.push({
        t: el.tagName.toLowerCase() + (el.type ? ":" + el.type : ""),
        id: el.id || el.name || "",
        lab, ph: el.placeholder || "",
        val: (el.value ?? el.innerText ?? "").toString().slice(0, 45),
        chk: el.type === "checkbox" || el.type === "radio" ? el.checked : undefined,
        opts: el.tagName === "SELECT" ? [...el.options].map((o) => o.text.trim()).filter(Boolean).slice(0, 18) : null,
      });
    }
    const btns = [...document.querySelectorAll("button, a.btn, input[type=submit]")]
      .map((b) => (b.innerText || b.value || "").trim().slice(0, 20)).filter(Boolean);
    return { fields, btns: [...new Set(btns)].slice(0, 12), head: document.querySelector("h1,h2,h3")?.innerText.slice(0, 50) || "" };
  });

  console.log(`\n══ ${name}  (${r.fields.length}칸)  ${r.head}`);
  for (const f of r.fields) {
    const v = f.chk !== undefined ? `[${f.chk ? "v" : " "}]` : (f.val ? "= " + f.val : (f.ph ? "힌트:" + f.ph.slice(0, 34) : ""));
    console.log(`   ${f.t.padEnd(16)} ${(f.lab || f.id).slice(0, 26).padEnd(28)} ${v}`);
    if (f.opts?.length) console.log(`      선택: ${f.opts.join(" / ").slice(0, 120)}`);
  }
  console.log(`   버튼: ${r.btns.join(" · ')".replace("')", "")).slice(0, 120)}`);
}

await new Promise((r) => setTimeout(r, 1200));
await ctx.close().catch(() => {});
