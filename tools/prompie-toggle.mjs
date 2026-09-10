/**
 * 「직접 입력한 학원정보 보여주기」 토글의 실물을 찾는다.
 * input[type=checkbox] 의 첫 번째를 눌렀더니 엉뚱한 것이었다 —
 * 숨어 있는 id_by_review 였고, 화면의 스위치는 그대로 「숨김」이었다.
 */
import { chromium } from "playwright";
import path from "node:path";

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1100 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://academy.prompie.com/administrators/wibhx5b/academies/141931/info/edit/",
  { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);

const info = await page.evaluate(() => {
  // 「보여주기」가 들어간 가장 안쪽 상자를 찾는다
  let host = null;
  for (const el of document.querySelectorAll("div, section, form, li")) {
    if (el.innerText && el.innerText.includes("직접 입력한 학원정보 보여주기") && el.innerText.length < 200) host = el;
  }
  if (!host) return { found: false };
  // 스위치는 이 div 의 형제다. 두 단계 위 상자를 통째로 본다.
  const box = host.parentElement?.parentElement ?? host.parentElement ?? host;
  return {
    found: true,
    html: box.outerHTML.slice(0, 2000),
    inputs: [...box.querySelectorAll("input")].map((i) => ({
      id: i.id, name: i.name, type: i.type, checked: i.checked,
      cls: (i.className || "").slice(0, 50),
      vis: getComputedStyle(i).display + "/" + getComputedStyle(i).opacity,
    })),
    labels: [...box.querySelectorAll("label")].map((l) => ({
      for: l.getAttribute("for"), cls: (l.className || "").slice(0, 50), txt: l.innerText.slice(0, 30),
    })),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2600));
await new Promise((r) => setTimeout(r, 1000));
await ctx.close().catch(() => {});
