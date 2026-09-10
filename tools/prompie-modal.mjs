/**
 * 전화번호 「수정」 모달 안에 뭐가 있는지 본다.
 * 모달을 안 닫으면 저장 버튼을 가려서 아무것도 저장이 안 된다.
 */
import { chromium } from "playwright";
import path from "node:path";

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1000 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://academy.prompie.com/administrators/wibhx5b/academy/manage/profile/",
  { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

// 전화번호 수정 열기
for (const b of await page.getByText("수정", { exact: true }).all()) {
  const near = await b.evaluate((el) => {
    let p = el.parentElement;
    for (let k = 0; k < 4 && p; k++, p = p.parentElement) if (p.innerText.includes("전화번호")) return true;
    return false;
  }).catch(() => false);
  if (near) { await b.click(); break; }
}
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const m = document.querySelector("#phoneEditModal");
  if (!m) return { found: false };
  return {
    found: true,
    text: m.innerText.slice(0, 400),
    buttons: [...m.querySelectorAll("button, a.btn, input[type=submit]")].map((b) => ({
      txt: (b.innerText || b.value || "").trim().slice(0, 30),
      id: b.id, cls: (b.className || "").slice(0, 60), type: b.type || "",
    })),
    inputs: [...m.querySelectorAll("input, select")].map((i) => ({
      id: i.id, name: i.name, type: i.type, ph: i.placeholder || "", val: i.value,
      opts: i.tagName === "SELECT" ? [...i.options].map((o) => o.text) : null,
    })),
  };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: "prompie-modal.png" }).catch(() => {});
await new Promise((r) => setTimeout(r, 1200));
await ctx.close().catch(() => {});
