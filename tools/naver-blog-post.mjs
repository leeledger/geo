/**
 * 네이버 블로그에 글을 올린다.
 *
 * 사이트(robotncoding.com)에 올린 글을 네이버에도 올린다.
 * 네이버는 robots.txt 로 AI 크롤러를 막기 때문에 여기 올린 글은 AI 에게는
 * 없는 글이다. 그래도 네이버 검색으로 들어오는 학부모가 있으니 올린다.
 * 원본은 사이트고, 여기는 사본이다.
 *
 * 화면 구조 (읽어서 확인한 것):
 *   iframe PostWriteForm.naver
 *     제목  .se-documentTitle  (안내문 "제목")
 *     본문  .se-component.se-text  (안내문 "글감과 함께 …")
 *     사진  툴바 버튼 → 파일 선택창 (input[type=file] 은 누르기 전엔 없다)
 *     발행  오른쪽 위 → 설정 패널 → 다시 발행
 *
 * 그림은 SVG 를 PNG 로 구워서 올린다. 네이버 에디터는 SVG 를 안 받는다.
 *   node svg-to-png.mjs ../academy/public/blog/<슬러그>
 *
 *   node naver-blog-post.mjs --dry    발행 직전까지만 (초안으로 남는다)
 *   node naver-blog-post.mjs          발행까지
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BLOG_ID = process.env.NAVER_BLOG_ID || "force11";
const DRY = process.argv.includes("--dry");
const IMG = path.resolve("../academy/public/blog/koding-gyoyukgwa-ai-gyoyugui-chai");

const TITLE = "코딩 교육이랑 AI 교육이 다른 건가요?";

/** 글 = 문단과 그림을 순서대로 늘어놓은 것 */
const BLOCKS = [
  { t: `상담에서 자주 듣는 말입니다. "요즘 AI가 코딩을 다 해준다던데, 그럼 AI를 가르쳐야 하나요 코딩을 가르쳐야 하나요?"` },
  { t: `같은 것으로 보이지만 다릅니다. 그리고 이 차이는 생각보다 늦게, 대개 중학교에 가서 드러납니다.` },
  { img: "cover.png" },

  { t: `■ "AI로 만들었어요"라는 말` },
  { t: `아이가 뭔가를 만들어 와서 "AI로 만들었어요"라고 합니다. 수업에서 이 말을 들으면 저는 결과물을 먼저 보지 않습니다. 같은 말이 두 가지 전혀 다른 상황을 가리키기 때문입니다.` },
  { t: `하나는 무엇을 만들지 자기가 정하고, AI에게 시키고, 나온 것을 보고 고친 경우입니다. 다른 하나는 AI가 준 것을 그대로 낸 경우입니다.` },
  { t: `결과물만 보면 구분이 안 됩니다. 오히려 두 번째가 더 그럴듯할 때도 많습니다. 그래서 초등학교 때는 대체로 그냥 넘어갑니다.` },

  { t: `■ 중학교에서 갈립니다` },
  { t: `초등학교 과제는 대개 "만들어 오기"입니다. 만들어 가면 됩니다.` },
  { t: `중학교부터는 "왜 이렇게 만들었는지 설명하기"가 붙습니다. 수행평가가 그렇고, 발표가 그렇고, 나중에 생활기록부가 그렇습니다. 저희가 입시를 지도하면서 가장 많이 확인하는 지점도 여기입니다.` },
  { t: `이때 자기가 정하고 시킨 아이는 설명할 것이 있습니다. 받아 적은 아이는 설명할 것이 없습니다. 실력이 갑자기 벌어진 것이 아니라, 그동안 안 보이던 차이가 그제야 보이는 것입니다.` },

  { t: `■ 그럼 무엇을 가르쳐야 하나` },
  { t: `코딩을 가르치지 말자는 이야기가 아닙니다. 순서가 있다는 이야기입니다.` },
  { t: `코딩에서 배우는 것은 '시키는 법'입니다. 순서를 정하고, 반복할 곳을 찾고, 조건을 나눕니다. 이건 AI가 대신 써 줘도 없어지지 않습니다. AI가 쓴 코드가 틀렸을 때 어디가 틀렸는지 아는 힘이 여기서 나옵니다.` },
  { t: `AI 교육에서 배우는 것은 '무엇을 시킬지 정하는 법'입니다. 지금 뭐가 문제인지, 그중에 무엇부터 풀지, 나온 답이 맞는지. 이건 문법을 아무리 외워도 따라오지 않습니다. 문제를 스스로 정의해 본 적이 있어야 생깁니다.` },
  { img: "two-skills.png" },

  { t: `■ 오히려 말과 글입니다` },
  { t: `이과 공부만 시키면 되겠다고 생각하기 쉬운데, 저는 반대로 봅니다.` },
  { t: `AI에게 일을 시키려면 말로 정확하게 설명할 수 있어야 합니다. 애매하게 시키면 애매한 것이 나옵니다. 그리고 나온 것을 보고 "이건 내가 원한 게 아니다"라고 말하려면, 원한 것이 무엇이었는지 자기가 알고 있어야 합니다.` },
  { t: `읽고 쓰는 힘이 코딩의 반대편에 있는 게 아니라, AI를 쓰는 데 필요한 조건이 된 셈입니다. 저희가 수업에서 만든 것을 말로 설명하게 시키는 이유가 이것입니다.` },

  { t: `■ 집에서 확인해 보는 법` },
  { t: `아이가 만든 것을 가져오면 잘 만들었는지 보지 마시고, 이렇게 물어보십시오.` },
  { t: `"이거 왜 만들었어?"` },
  { t: `"처음에 뭐부터 했어?"` },
  { t: `"안 될 때 뭘 바꿨어?"` },
  { img: "three-questions.png" },
  { t: `셋 다 답이 나오면 아이가 한 것입니다. 첫 번째부터 막히면 AI가 한 것입니다. 혼낼 일은 아닙니다. 지금 어디쯤 와 있는지 아는 데 쓰시면 됩니다.` },
  { t: `그리고 첫 번째 질문에 답이 나오는 아이는 도구가 또 바뀌어도 대체로 괜찮습니다. 바뀌는 건 도구고, 그 질문에 답하는 힘은 도구가 바뀌어도 남습니다.` },

  { t: `― 로봇&코딩학원 (서울 송파구 석촌동 274-8 2층)` },
  { t: `상담 02-422-0525 · 카카오톡 http://pf.kakao.com/_Bxhxbxjxb/chat` },
  { t: `글 전문 https://robotncoding.com/blog/koding-gyoyukgwa-ai-gyoyugui-chai` },
];

for (const b of BLOCKS) {
  if (b.img && !fs.existsSync(path.join(IMG, b.img))) {
    console.error(`그림이 없습니다: ${b.img}\n  먼저 svg-to-png.mjs 를 돌리세요.`);
    process.exit(1);
  }
}

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("dialog", async (d) => { console.log("  · " + d.message().slice(0, 70)); await d.accept().catch(() => {}); });

await page.goto(`https://blog.naver.com/${BLOG_ID}?Redirect=Write`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(11000);

if (/nid\.naver\.com/.test(page.url())) {
  console.log("네이버 로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).");
  const t0 = Date.now();
  while (Date.now() - t0 < 8 * 60 * 1000 && /nid\.naver\.com/.test(page.url())) await page.waitForTimeout(2500);
  await page.waitForTimeout(9000);
}

const F = page.frames().find((f) => /PostWriteForm/i.test(f.url()));
if (!F) { console.error("에디터 프레임을 못 찾았습니다."); await ctx.close(); process.exit(1); }

// 작성 중이던 글 복구 팝업 — '취소' 를 정확히 맞춘다.
// /취소/ 로 두면 툴바의 '취소선' 이 걸린다.
const restore = F.getByRole("button", { name: "취소", exact: true }).first();
if (await restore.isVisible().catch(() => false)) {
  await restore.click().catch(() => {});
  console.log("이전 임시저장 팝업을 닫았습니다");
  await page.waitForTimeout(1500);
}

// ── 제목
await F.locator(".se-documentTitle").first().click();
await page.waitForTimeout(700);
await page.keyboard.type(TITLE, { delay: 12 });
console.log("제목 입력");
await page.waitForTimeout(900);

// ── 본문으로 이동
await F.locator(".se-component.se-text").first().click();
await page.waitForTimeout(900);

/** 사진 넣기 — 누르기 전에는 input[type=file] 이 없다. 파일 선택창을 기다린다. */
async function insertImage(file) {
  const chooser = page.waitForEvent("filechooser", { timeout: 20000 });
  await F.getByRole("button", { name: /사진/ }).first().click();
  const fc = await chooser;
  await fc.setFiles(path.join(IMG, file));
  // 업로드가 끝나고 문서에 붙을 때까지 기다린다
  await page.waitForTimeout(9000);
  // 커서를 문서 끝으로 돌려놓지 않으면 그림 앞에 글이 들어간다
  await page.keyboard.press("Control+End");
  await page.waitForTimeout(700);
}

let n = 0;
for (const b of BLOCKS) {
  if (b.img) {
    await insertImage(b.img);
    console.log(`  [사진] ${b.img}`);
    continue;
  }
  await page.keyboard.type(b.t, { delay: 6 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(220);
  n++;
}
console.log(`본문 ${n}문단 · 사진 ${BLOCKS.filter((b) => b.img).length}장`);

if (DRY) {
  console.log("\n--dry 입니다. 발행하지 않았습니다. 창에서 직접 확인하세요 (90초).");
  await page.waitForTimeout(90000);
  await ctx.close();
  process.exit(0);
}

// ── 발행 : 오른쪽 위 발행 → 설정 패널 → 다시 발행
await F.getByRole("button", { name: /^발행/ }).first().click({ timeout: 10000 });
await page.waitForTimeout(3000);

const confirm = F.getByRole("button", { name: /^발행$/ }).last();
await confirm.click({ timeout: 10000 });
await page.waitForTimeout(12000);

console.log("\n발행 후 주소:", page.url().slice(0, 110));
const ok = !/PostWriteForm/.test(page.url());
console.log(ok ? "✓ 발행된 것으로 보입니다" : "화면이 그대로입니다. 창을 확인해 주세요");

await page.waitForTimeout(25000);
await ctx.close();
