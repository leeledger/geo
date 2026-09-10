/**
 * 스마트플레이스 상세설명을 다시 쓴다.
 *
 * 왜:
 *   네이버 AI 가 이 학원을 설명할 때 플레이스 정보를 읽는다. 지금 나오는 답이
 *   「석촌동에 있고 무선 인터넷과 남녀 구분 화장실을 제공합니다」였다.
 *   편의시설 태그만 읽고 답한 것이다 — 소개글에 쓸 문장이 없으니까.
 *   무엇을 가르치는지, 누가 가르치는지가 한 줄도 없었다.
 *
 * 반드시 지킬 것:
 *   지금 들어 있는 188자 중 대부분이 **법정 게시 사항**이다.
 *   「학원의 설립·운영 및 과외교습에 관한 법률 제15조제3항」 교습비 게시.
 *   이걸 지우면 법을 어긴다. 그대로 두고 위에 내용을 더한다.
 *
 * 글자 제한:
 *   가운뎃점(·)이 막힌다. 넣으면 저장이 조용히 안 된다 — 오류 메시지 없이
 *   테두리만 빨개지고 저장 버튼이 안 먹는다. 실제로 한 번 당했다.
 *   쉼표, 괄호, 물결, 느낌표, 줄바꿈은 된다 (smartplace-charcheck.mjs 로 확인).
 *   원본 글이 법률 이름을 「설립 . 운영」으로 쓴 것도 같은 이유로 보인다.
 *
 * 문장은 짧게 끊는다. AI 는 문단 단위로 잘라 인용한다 —
 * 한 문장이 길면 통째로 버려지고, 너무 짧으면 문맥이 없다.
 *
 * 사실은 전부 robotncoding.com 의 구조화 데이터에서 가져왔다. 지어낸 것은 없다.
 *
 *   node smartplace-write-intro.mjs          미리보기만
 *   node smartplace-write-intro.mjs --apply  실제로 저장
 */
import { chromium } from "playwright";
import path from "node:path";

const BIZ = process.env.SMARTPLACE_ID || "5013357";
const APPLY = process.argv.includes("--apply");

/** 지금 들어 있는 법정 게시 블록. 글자 하나 안 바꾸고 그대로 뒤에 붙인다. */
const LEGAL = `초급 Dream 16만원 월 756분
응용 Smart 19만원 월 840분
심화 Premium 20만원 월 1008분

학원의 설립 . 운영 및 과외교습에 관한 법률 제15조제3항에 따라 교습비등을 위와 같이 게시합니다.`;

const INTRO = `코딩을 가르치지 않습니다. 생각하는 방법을 가르칩니다.

개발자 출신 원장이 직접 지도합니다. 의료정보시스템, 생산과 물류 ERP, 쇼핑몰, 금융사 콜센터 시스템을 개발했습니다. 중앙대학교 산학 자문위원과 학기 특강 교수를 맡았습니다.

7세부터 성인까지 다섯 단계로 나눠 가르칩니다. 블록코딩으로 순차, 반복, 조건을 익히고, 정렬과 탐색 알고리즘을 거쳐 파이썬 문법과 자료구조로 넘어갑니다. 그다음이 동적 계획법, 그래프 알고리즘, 대회 준비, 마지막이 진로 프로젝트와 학생부 포트폴리오입니다.

파이썬, 자바, 자바스크립트, SQL, 아두이노, 마이크로비트, 엔트리를 다룹니다.

원장이 직접 만든 학습 프로그램을 씁니다. 70개 과정, 1,597개 챕터입니다. 채점 기준은 정답 코드와 같은지가 아니라 프로그램이 실제로 작동했는지입니다. AI 튜터는 정답 코드를 주지 않고 어긋난 곳과 골격만 짚습니다.

수업이 끝나면 학습 성장 리포트를 보냅니다. 태도, 집중력, 학습 의지, 이해력, 표현력, 창의성 여섯 영역으로 자라는 방향을 기록합니다. 쌓인 기록은 진학 상담에 낼 수 있는 포트폴리오가 됩니다.

지도한 학생들이 한국코드페어 금상, 학생발명품대회 최우수상, 서울특별시교육청 과학전람회 중등부 최우수상, 스팀컵 로봇코딩 부문 금상을 받았습니다. 학생 특허 2건을 아이디어 단계부터 출원까지 지도해 등록했습니다. KAIST, 한국과학영재학교, 선린인터넷고등학교로 진학했고 서울대학교 의과대학 수시 입시를 지도했습니다.

수업 시간은 초등 저학년 90분, 초등 고학년 이상 120분입니다. 헬리오시티 가락초등학교 후문 앞에 있습니다.`;

const NEW = `${INTRO}\n\n${LEGAL}`;

console.log(`  새 상세설명 ${NEW.length}자 (지금 188자)\n`);
if (!APPLY) {
  console.log("┌─────────────────────────────────────────────");
  NEW.split("\n").forEach((l) => console.log("│ " + l));
  console.log("└─────────────────────────────────────────────");
  console.log("\n  미리보기입니다. 저장하려면 --apply 를 붙이세요.");
  process.exit(0);
}

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 1000 },
  locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
ctx.on("dialog", (d) => d.accept().catch(() => {}));
const page = ctx.pages()[0] ?? (await ctx.newPage());
const say = (s) => console.log(`  ${s}`);

await page.goto(`https://new.smartplace.naver.com/bizes/place/${BIZ}/details?menu=info`,
  { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5500);

// 상세설명 칸을 찾는다. 순서로 잡으면 화면이 바뀔 때 엉뚱한 칸에 들어간다.
const ta = page.locator("textarea").filter({ hasNotText: "찾아오는 길" }).first();
const found = await page.evaluate(() => {
  const tas = [...document.querySelectorAll("textarea")];
  const i = tas.findIndex((t) => /상세설명/.test(t.closest("div")?.parentElement?.innerText ?? ""));
  return { i, count: tas.length, cur: (tas[i]?.value ?? "").length };
});
say(`textarea ${found.count}개 · 상세설명은 ${found.i}번째 · 현재 ${found.cur}자`);
if (found.i < 0) { say("상세설명 칸을 못 찾았습니다."); await ctx.close(); process.exit(1); }

// 법정 게시 문구가 지금 정말 들어 있는지 다시 확인하고 나서 덮는다.
const hasLegal = await page.evaluate((i) =>
  (document.querySelectorAll("textarea")[i]?.value ?? "").includes("제15조제3항"), found.i);
if (!hasLegal) {
  say("⚠ 지금 상세설명에 법정 게시 문구가 없습니다. 확인이 필요합니다 — 멈춥니다.");
  await ctx.close(); process.exit(1);
}

const box = page.locator("textarea").nth(found.i);
await box.click();
await page.keyboard.press("Control+A");
await box.fill(NEW);
await page.waitForTimeout(800);
const got = (await box.inputValue()).length;
say(`넣었습니다 — ${got}자`);

await page.screenshot({ path: "smartplace-intro-before.png" }).catch(() => {});

// 넣자마자 오류 표시가 뜨는지 먼저 본다.
// 앞선 판은 가운뎃점 때문에 막혔는데 그걸 모르고 「저장 눌렀습니다」만 찍었다.
const bad = await page.evaluate((i) => {
  const ta = document.querySelectorAll("textarea")[i];
  const m = getComputedStyle(ta).borderColor.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  return m[0] > 180 && m[1] < 130;
}, found.i);
if (bad) {
  say("⚠ 입력값이 거부됐습니다 (허용 안 되는 글자). 저장하지 않고 멈춥니다.");
  await page.screenshot({ path: "smartplace-rejected.png" }).catch(() => {});
  await ctx.close(); process.exit(1);
}

const save = page.getByRole("button", { name: /^저장|수정 완료/ }).last();
if (await save.count()) {
  const on = await save.isEnabled().catch(() => false);
  say(`저장 버튼 ${on ? "활성" : "비활성"}`);
  await save.click({ timeout: 15000 }).catch((e) => say("클릭 실패: " + e.message.slice(0, 50)));
  await page.waitForTimeout(7000);
} else say("저장 버튼을 못 찾았습니다");

// 넘긴 것과 저장된 것은 다르다. 다시 읽어 확인한다.
await page.goto(`https://new.smartplace.naver.com/bizes/place/${BIZ}/details?menu=info`,
  { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5500);
const after = await page.evaluate(() => {
  const tas = [...document.querySelectorAll("textarea")];
  const i = tas.findIndex((t) => /상세설명/.test(t.closest("div")?.parentElement?.innerText ?? ""));
  const v = tas[i]?.value ?? "";
  return { len: v.length, legal: v.includes("제15조제3항"), head: v.slice(0, 60) };
});
say(`다시 읽음 — ${after.len}자 · 법정 문구 ${after.legal ? "있음" : "⚠ 없음"}`);
say(`앞부분: ${after.head}`);

await page.screenshot({ path: "smartplace-intro-after.png" }).catch(() => {});
await new Promise((r) => setTimeout(r, 2000));
await ctx.close().catch(() => {});
