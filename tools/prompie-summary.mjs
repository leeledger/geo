/**
 * 오늘학교 — 학원 요약 정보.
 *
 * 토글이 Bootstrap custom-switch 다. input 은 opacity:0 으로 깔려 있고
 * 보이는 건 label 이다. input 을 force 로 누르면 체크는 되는데 페이지 핸들러가
 * 안 돌아서 화면은 「숨김」 그대로고 아래 항목도 안 나온다.
 * label 을 눌러야 한다.
 *
 * 켜는 값은 robotncoding.com 에 적힌 것만이다.
 *   대상  「초등 1학년~중학생 및 성인 (만 7세~성인)」 → 초등·중학생·성인
 *   형태  「소그룹 및 개별 맞춤 코칭」, 「4단계는 개별 코칭 중심」 → 일대일
 * 고등학생과 소그룹 인원(2~4인/5~9인)은 사이트에 없다. 켜지 않는다.
 *
 *   node prompie-summary.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const URL_ = "https://academy.prompie.com/administrators/wibhx5b/academies/141931/info/edit/";

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1100 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());
const say = (s) => console.log(`  ${s}`);

await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);

/**
 * 스위치는 label 을 눌러야 핸들러가 돈다.
 * 다만 label 이 0 크기(::before 로 그린 스위치)라 플레이라이트 클릭이 안 먹는다.
 * 브라우저 안에서 직접 click() 을 호출한다 — 아래 체크박스들은 이 방식으로 됐다.
 */
const flip = async (id) =>
  page.evaluate((i) => {
    const inp = document.getElementById(i);
    if (!inp) return "없음";
    if (inp.checked) return "이미 켜짐";
    const l = document.querySelector(`label[for="${i}"]`);
    if (l) l.click(); else inp.click();
    return inp.checked ? "켬" : "실패";
  }, id).then(async (r) => { await page.waitForTimeout(1200); return r; });

for (const id of ["id_by_review", "id_by_period", "id_by_purpose", "id_by_rating"]) {
  say(`${id} ${await flip(id)}`);
}
await page.waitForTimeout(1500);

// 이제 뭐가 보이는지 다시 읽는다
const vis = await page.evaluate(() =>
  [...document.querySelectorAll("input, select, textarea")]
    .filter((e) => e.type !== "hidden" && e.offsetParent !== null)
    .map((e) => ({ id: e.id || e.name, t: e.type, chk: e.checked,
      lab: (document.querySelector(`label[for="${CSS.escape(e.id)}"]`)?.innerText || "").trim().slice(0, 24),
      val: (e.value || "").slice(0, 24) })));
console.log(`\n  보이는 칸 ${vis.length}개`);
for (const f of vis) console.log(`   ${f.t === "checkbox" ? `[${f.chk ? "v" : " "}]` : `(${f.t})`} ${(f.lab || f.id).slice(0, 26).padEnd(28)} ${f.val}`);

// ── 확실한 것만 켠다
console.log();
for (const name of ["초등학생", "중학생", "성인", "일대일"]) {
  const r = await page.evaluate((nm) => {
    for (const l of document.querySelectorAll("label")) {
      if (l.innerText.trim() !== nm) continue;
      const id = l.getAttribute("for");
      const inp = id ? document.getElementById(id) : l.querySelector("input");
      if (!inp) return "input 없음";
      if (inp.checked) return "이미 켜짐";
      l.click();
      return inp.checked ? "켬" : "실패";
    }
    return "라벨 없음";
  }, name);
  say(`${name} ${r}`);
}

// 과목 — maxlength 30. 서버가 빈 값을 "None" 문자열로 내려보낸다.
const subj = page.locator("#subjects");
if (await subj.count()) {
  const cur = (await subj.inputValue().catch(() => "")).trim();
  if (!cur || cur === "None") {
    await subj.fill("코딩, 로봇, AI, 파이썬, 알고리즘").catch(async () => {
      // 아직 안 보이면 값만 직접 넣는다
      await page.evaluate(() => {
        const e = document.getElementById("subjects");
        e.value = "코딩, 로봇, AI, 파이썬, 알고리즘";
        e.dispatchEvent(new Event("input", { bubbles: true }));
        e.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
    say(`과목 = ${await subj.inputValue().catch(() => "?")}`);
  } else say(`과목 이미 있음 (${cur})`);
}

await page.screenshot({ path: "prompie-summary-before.png", fullPage: true }).catch(() => {});
const save = page.getByRole("button", { name: /저장/ }).first();
if (await save.count()) { await save.click().catch(() => {}); say("저장하기 눌렀습니다"); await page.waitForTimeout(5000); }

// 넘긴 것과 저장된 것은 다르다. 다시 읽어 확인한다.
await page.goto(URL_, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const after = await page.evaluate(() => {
  const on = [...document.querySelectorAll("input[type=checkbox]")].filter((c) => c.checked)
    .map((c) => (document.querySelector(`label[for="${CSS.escape(c.id)}"]`)?.innerText || c.id).trim().slice(0, 20));
  return { on, subj: document.getElementById("subjects")?.value || "", disp: document.getElementById("review_display")?.innerText || "" };
});
console.log(`\n  다시 읽음 — 표시상태 「${after.disp}」`);
console.log(`  켜진 항목: ${after.on.join(" · ") || "없음"}`);
console.log(`  과목: ${after.subj}`);
await page.screenshot({ path: "prompie-summary-after.png", fullPage: true }).catch(() => {});

await new Promise((r) => setTimeout(r, 1500));
await ctx.close().catch(() => {});
