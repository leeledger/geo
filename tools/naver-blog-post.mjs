/**
 * 사이트 글을 네이버 블로그로 옮긴다.
 *
 * 원본은 사이트(robotncoding.com)고 여기는 사본이다.
 * 네이버는 robots.txt 로 AI 크롤러를 막기 때문에 여기 올린 글은 AI 에게는 없는 글이다.
 * 그래도 네이버 검색으로 들어오는 학부모가 있으니 옮긴다.
 *
 * 앞선 판은 글 내용이 스크립트에 박혀 있었다. 글마다 스크립트를 새로 만들 수는 없으니
 * DB 에서 슬러그로 읽어 온다.
 *
 * 화면 구조 (읽어서 확인한 것):
 *   iframe PostWriteForm.naver
 *     제목  .se-documentTitle
 *     본문  .se-component.se-text
 *     사진  툴바 버튼 → 파일 선택창 (누르기 전엔 input[type=file] 이 없다)
 *     발행  오른쪽 위 → 설정 패널(태그·검색허용) → 다시 발행
 *
 * 그림은 SVG 를 PNG 로 구워서 올린다. 네이버 에디터는 SVG 를 안 받는다.
 *   node svg-to-png.mjs ../academy/public/blog/<슬러그> --scale 1
 *
 *   node naver-blog-post.mjs <슬러그>                  새로 발행
 *   node naver-blog-post.mjs <슬러그> --dry            발행 직전까지
 *   node naver-blog-post.mjs <슬러그> --update <logNo> 이미 올린 글을 고쳐 쓰기
 *
 * 글을 고쳤으면 새로 올리지 말고 --update 를 쓴다.
 * 같은 내용이 두 벌 올라가면 네이버 검색에서 서로 갉아먹는다.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { Pool } from "pg";

const BLOG_ID = process.env.NAVER_BLOG_ID || "force11";
const DRY = process.argv.includes("--dry");

/**
 * --update 다음 값은 logNo 다. 슬러그로 오해하면 안 된다.
 *
 * 여기서 두 번 틀렸다.
 *  1) 잘린 배열의 인덱스를 원본 배열 인덱스와 비교해서, 인자 순서를 바꾸면
 *     logNo 를 슬러그로 읽었다.
 *  2) 그걸 고치면서 ui+1 을 무조건 걸렀는데, --update 가 없으면 ui 가 -1 이라
 *     ui+1 이 0 이 된다. 0 번은 슬러그 자리다. 그래서 슬러그를 못 찾았다.
 * -1 일 때를 따로 두는 게 맞다.
 */
const ARGS = process.argv.slice(2);
const ui = ARGS.indexOf("--update");
const LOG_NO = ui >= 0 ? ARGS[ui + 1] : null;
const skip = ui >= 0 ? ui + 1 : -1;
const slug = ARGS.find((a, i) => !a.startsWith("--") && i !== skip);

if (!slug) {
  console.log("슬러그를 주세요. 예: node naver-blog-post.mjs ai-ro-jjatneunde-wae-ne-beon");
  process.exit(1);
}

for (const l of fs.readFileSync(new URL("../academy/.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// ── 글 읽기
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});
const { rows } = await pool.query(
  `select slug, title, body, tags from academy.posts where slug = $1`, [slug],
);
await pool.end();
if (!rows.length) { console.log(`${slug} 글이 없습니다.`); process.exit(1); }
const post = rows[0];

/** 지역 태그는 늘 붙인다. 네이버에서 들어오는 사람은 대개 동네부터 찾는다. */
const LOCAL = ["송파코딩학원", "석촌동코딩학원", "잠실코딩학원", "코딩학원추천"];
const TAGS = [...new Set([...post.tags, ...LOCAL])].slice(0, 30);

const IMGDIR = path.resolve("../academy/public/blog", slug);

/**
 * 마크다운을 네이버 에디터에 넣을 블록으로 바꾼다.
 *
 * 에디터는 마크다운을 모른다. 굵게·기울임 표시가 그대로 글자로 남으므로 떼어낸다.
 * 소제목은 ■ 를 붙여 눈에 띄게 한다 — 네이버에서 제목 서식을 주려면
 * 툴바를 눌러야 하는데, 글마다 그렇게 하면 자동화가 무너진다.
 */
function toBlocks(md) {
  const out = [];
  for (const raw of md.split("\n\n")) {
    const s = raw.trim();
    if (!s) continue;

    const img = /^!\[[^\]]*\]\(([^)]+)\)$/.exec(s);
    if (img) {
      const file = path.basename(img[1]).replace(/\.svg$/, ".png");
      const p = path.join(IMGDIR, file);
      if (fs.existsSync(p)) out.push({ img: p });
      else console.log(`  (그림 없음, 건너뜀: ${file})`);
      continue;
    }

    const text = s
      .replace(/^#{2,3}\s*/, "■ ")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 $2");
    out.push({ t: text });
  }
  return out;
}

const BLOCKS = [
  ...toBlocks(post.body),
  { t: "― 로봇&코딩학원 (서울 송파구 석촌동 274-8 2층)" },
  { t: "상담 02-422-0525 · 카카오톡 http://pf.kakao.com/_Bxhxbxjxb/chat" },
  { t: `글 전문 https://robotncoding.com/blog/${slug}` },
];

console.log(`${post.title}`);
console.log(`  문단 ${BLOCKS.filter((b) => b.t).length} · 사진 ${BLOCKS.filter((b) => b.img).length} · 태그 ${TAGS.length}`);

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("dialog", async (d) => { console.log("  · " + d.message().slice(0, 70)); await d.accept().catch(() => {}); });

await page.goto(
  LOG_NO
    ? `https://blog.naver.com/PostWriteForm.naver?blogId=${BLOG_ID}&logNo=${LOG_NO}&Redirect=Update`
    : `https://blog.naver.com/${BLOG_ID}?Redirect=Write`,
  { waitUntil: "domcontentloaded" },
);
await page.waitForTimeout(12000);

if (/nid\.naver\.com/.test(page.url())) {
  console.log("네이버 로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).");
  const t0 = Date.now();
  while (Date.now() - t0 < 480000 && /nid\.naver\.com/.test(page.url())) await page.waitForTimeout(2500);
  await page.waitForTimeout(9000);
}

const F = page.frames().find((f) => /PostWriteForm/i.test(f.url()));
if (!F) { console.log("에디터 프레임을 못 찾았습니다."); await ctx.close(); process.exit(1); }

// 임시저장 복구 팝업 — '취소'를 정확히 맞춘다. /취소/ 로 두면 툴바의 '취소선'이 걸린다.
const restore = F.getByRole("button", { name: "취소", exact: true }).first();
if (await restore.isVisible().catch(() => false)) {
  await restore.click().catch(() => {});
  console.log("이전 임시저장 팝업을 닫았습니다");
  await page.waitForTimeout(1500);
}

/**
 * 고쳐 쓰기면 있던 내용을 먼저 비운다.
 *
 * 한 번 여기서 틀렸다. .se-component 의 첫 번째를 눌렀는데 그게 제목 칸이라
 * Ctrl+A 가 제목만 잡았고, 본문은 그대로 남아 옛 글 뒤에 새 글이 붙었다.
 * 본문 컴포넌트를 눌러야 하고, 스마트에디터는 Ctrl+A 를 한 번 누르면 문단만,
 * 두 번 누르면 문서 전체를 잡는다.
 */
if (LOG_NO) {
  await F.locator(".se-component.se-text").last().click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Control+A");
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+A");
  await page.waitForTimeout(400);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(2000);

  // 비웠는지 확인한다. 안 비워졌으면 붙여 쓰지 말고 멈춘다.
  const left = (await F.locator(".se-main-container, .se-container").first()
    .innerText().catch(() => "")).replace(/\s/g, "");
  if (left.length > 80) {
    console.log(`✗ 본문이 안 비워졌습니다 (${left.length}자 남음). 붙여 쓰면 중복됩니다.`);
    console.log("  창에서 직접 본문을 지우고 다시 돌리거나, 글을 지우고 새로 올리세요.");
    await page.waitForTimeout(30000);
    await ctx.close();
    process.exit(1);
  }
  console.log("기존 내용을 비웠습니다");
}

await F.locator(".se-documentTitle").first().click();
await page.waitForTimeout(700);
await page.keyboard.type(post.title, { delay: 12 });
await page.waitForTimeout(900);

await F.locator(".se-component.se-text").first().click();
await page.waitForTimeout(900);

async function insertImage(file) {
  const chooser = page.waitForEvent("filechooser", { timeout: 20000 });
  await F.getByRole("button", { name: /사진/ }).first().click();
  (await chooser).setFiles(file);
  await page.waitForTimeout(9000);
  await page.keyboard.press("Control+End");   // 커서를 끝으로. 안 하면 그림 앞에 글이 들어간다
  await page.waitForTimeout(700);
}

for (const b of BLOCKS) {
  if (b.img) { await insertImage(b.img); console.log(`  [사진] ${path.basename(b.img)}`); continue; }
  await page.keyboard.type(b.t, { delay: 5 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
}
console.log("본문 입력 완료");

// ── 발행 설정
await F.getByRole("button", { name: /^발행/ }).first().click({ timeout: 10000 });
await page.waitForTimeout(3500);

// 검색 허용이 꺼져 있으면 태그를 아무리 넣어도 검색에 안 잡힌다
for (const [id, name] of [["publish-option-search", "검색 허용"], ["publish-option-outside", "외부 공유"]]) {
  const c = F.locator(`#${id}`);
  if (!(await c.count())) continue;
  if ((await c.isChecked().catch(() => null)) === false) {
    await c.check({ force: true }).catch(() => {});
    console.log(`  ${name} 켰습니다`);
  }
}

const box = F.locator("#tag-input").first();
if (await box.isVisible().catch(() => false)) {
  for (const t of TAGS) {
    await box.click();
    await page.keyboard.type(t, { delay: 15 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(420);
  }
  console.log(`  태그 ${TAGS.length}개`);
} else {
  console.log("  태그 칸을 못 찾았습니다");
}

if (DRY) {
  console.log("\n--dry 입니다. 발행하지 않았습니다. 창에서 확인하세요 (90초).");
  await page.waitForTimeout(90000);
  await ctx.close();
  process.exit(0);
}

await F.getByRole("button", { name: /^발행$/ }).last().click({ timeout: 10000 });
await page.waitForTimeout(13000);

console.log("\n주소:", page.url().slice(0, 110));
console.log(!/PostWriteForm/.test(page.url()) ? "✓ 발행된 것으로 보입니다" : "화면이 그대로입니다 — 확인 필요");

await page.waitForTimeout(20000);
await ctx.close();
