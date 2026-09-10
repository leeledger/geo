/**
 * 남은 탭 — 시설 및 편의사항 · 주요 수업정보 · 커리큘럼.
 *
 * 세 탭 다 처음엔 칸이 안 보인다. 요약 정보와 같은 구조라면
 * 맨 위 custom-switch 를 켜야 아래가 나온다. 스위치는 label 을 눌러야 하고
 * label 이 0 크기라 브라우저 안에서 click() 을 호출해야 한다.
 *
 *   node prompie-rest.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const B = "https://academy.prompie.com/administrators/wibhx5b";
const TABS = [
  ["시설 및 편의사항", `${B}/academies/141931/additional-info/edit/`],
  ["주요 수업정보", `${B}/academies/141931/additional-class-info/edit/`],
  ["커리큘럼", `${B}/academy/manage/curriculum/list/`],
];

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1100 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());

for (const [name, url] of TABS) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // custom-switch 를 전부 켠다
  const flipped = await page.evaluate(() => {
    const done = [];
    for (const inp of document.querySelectorAll("input.custom-control-input[type=checkbox]")) {
      if (inp.checked) { done.push(`${inp.id}(이미)`); continue; }
      const l = document.querySelector(`label[for="${inp.id}"]`);
      if (l) l.click(); else inp.click();
      done.push(`${inp.id}${inp.checked ? "" : "(실패)"}`);
    }
    return done;
  });
  await page.waitForTimeout(2000);

  const r = await page.evaluate(() => {
    const f = [...document.querySelectorAll("input, textarea, select")]
      .filter((e) => e.type !== "hidden" && e.offsetParent !== null)
      .map((e) => ({
        id: e.id || e.name, t: e.type || e.tagName.toLowerCase(), chk: e.checked,
        lab: (document.querySelector(`label[for="${CSS.escape(e.id || "x")}"]`)?.innerText || e.closest("label")?.innerText || "").trim().slice(0, 26),
        ph: e.placeholder || "", val: (e.value || "").slice(0, 30),
        opts: e.tagName === "SELECT" ? [...e.options].map((o) => o.text.trim()).filter(Boolean).slice(0, 16) : null,
      }));
    const btns = [...new Set([...document.querySelectorAll("button, a.btn")].map((b) => b.innerText.trim()).filter(Boolean))].slice(0, 10);
    const body = (document.querySelector("main, .container, form")?.innerText || "").slice(0, 300);
    return { f, btns, body };
  });

  console.log(`\n══ ${name}  (보이는 칸 ${r.f.length})`);
  console.log(`  스위치: ${flipped.join(" · ") || "없음"}`);
  for (const x of r.f) {
    console.log(`   ${x.t === "checkbox" ? `[${x.chk ? "v" : " "}]` : `(${x.t})`} ${(x.lab || x.id).slice(0, 28).padEnd(30)} ${x.val || (x.ph ? "힌트:" + x.ph.slice(0, 26) : "")}`);
    if (x.opts?.length) console.log(`        선택: ${x.opts.join(" / ").slice(0, 110)}`);
  }
  console.log(`  버튼: ${r.btns.join(" · ").slice(0, 110)}`);
  if (!r.f.length) console.log(`  본문: ${r.body.replace(/\n+/g, " ").slice(0, 200)}`);
  await page.screenshot({ path: `prompie-${name.replace(/[ /]/g, "")}.png`, fullPage: true }).catch(() => {});
}

await new Promise((r) => setTimeout(r, 1500));
await ctx.close().catch(() => {});
