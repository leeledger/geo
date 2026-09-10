/**
 * 사이트 글을 네이버 블로그로 옮긴다.
 *
 * 원본은 사이트(robotncoding.com)고 여기는 사본이다.
 * 네이버는 robots.txt 로 AI 크롤러를 막기 때문에 여기 올린 글은 AI 에게는 없는 글이다.
 * 그래도 네이버 검색으로 들어오는 학부모가 있으니 옮긴다.
 *
 * 화면 구조 (읽어서 확인한 것):
 *   iframe PostWriteForm.naver
 *     제목  .se-documentTitle
 *     본문  .se-component.se-text
 *     사진  툴바 버튼 → 파일 선택창 (누르기 전엔 input[type=file] 이 없다)
 *     발행  오른쪽 위 → 설정 패널(태그·검색허용) → 다시 발행
 *
 * 서식은 시험해 보고 되는 것만 쓴다 (naver-fmt-probe.mjs 로 확인):
 *   Ctrl+B        굵게 토글          ← 문단을 토막내 치면서 켜고 끈다
 *   구분선 추가     한 번 누르면 끝
 *   글자 크기       11·13·15·16·19·24·28·30·34·38 (기본 19)
 * 드롭다운 안을 뒤지는 방식은 부서지기 쉬워서 최소로만 쓴다.
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

const PARA_BREAK = /\n\s*\n/;

/**
 * 마크다운을 네이버 에디터에 넣을 블록으로 바꾼다.
 *
 * 앞선 판은 전부 같은 크기 본문으로 밀어 넣어서 읽기가 나빴다.
 * 이제 종류를 나눈다 — 소제목은 크게·굵게, 목록은 줄마다, 굵게는 굵게.
 * 에디터는 마크다운을 모르므로 표시 문자는 떼고 서식으로 옮긴다.
 */
function toBlocks(md) {
  const out = [];
  for (const raw of md.split(PARA_BREAK)) {
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

    if (/^#{2,3}\s/.test(s)) {
      out.push({ h: s.replace(/^#+\s*/, "") });
      continue;
    }

    // 목록은 줄마다 한 문단으로. 한 덩어리로 치면 줄바꿈이 뭉개진다.
    if (/^[-*]\s/.test(s)) {
      for (const line of s.split("\n")) {
        const t = line.replace(/^[-*]\s*/, "").trim();
        if (t) out.push({ t: "· " + t });
      }
      continue;
    }

    out.push({ t: s });
  }
  return out;
}

const BLOCKS = [
  ...toBlocks(post.body),
  { hr: true },
  { t: "― 로봇&코딩학원 (서울 송파구 석촌동 274-8 2층)" },
  { t: "상담 02-422-0525 · 카카오톡 http://pf.kakao.com/_Bxhxbxjxb/chat" },
  { t: `글 전문 https://robotncoding.com/blog/${slug}` },
];

console.log(post.title);
console.log(`  문단 ${BLOCKS.filter((b) => b.t).length} · 소제목 ${BLOCKS.filter((b) => b.h).length}` +
            ` · 사진 ${BLOCKS.filter((b) => b.img).length} · 태그 ${TAGS.length}`);

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
  /**
   * 남은 글자를 셀 때 제목과 안내문을 빼야 한다.
   *
   * 처음엔 .se-main-container 의 innerText 를 통째로 셌는데, 거기엔
   * 제목 컴포넌트와 빈 문단의 안내문("글감과 함께 나의 일상을 기록해보세요!")이
   * 같이 들어간다. 본문이 멀쩡히 비워졌는데도 103자가 남았다고 나와서
   * 두 번 헛돌았다. 비운 걸 안 비웠다고 읽으면 고칠 수가 없다.
   */
  const rest = async () =>
    F.evaluate(() => {
      const c = document.querySelector(".se-main-container") || document.querySelector(".se-container");
      if (!c) return 0;
      let n = 0;
      for (const el of c.querySelectorAll(".se-component")) {
        if (el.classList.contains("se-documentTitle")) continue;
        const t = (el.innerText || "").replace(/\s/g, "").length;
        const ph = el.querySelector(".se-placeholder");
        const p = ph ? (ph.innerText || "").replace(/\s/g, "").length : 0;
        n += Math.max(0, t - p);
      }
      return n;
    });

  let left = await rest();
  for (let i = 0; i < 4 && left > 20; i++) {
    await F.locator(".se-component.se-text").last().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.keyboard.press("Control+A");
    await page.waitForTimeout(350);
    await page.keyboard.press("Control+A");
    await page.waitForTimeout(350);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(1600);
    left = await rest();
  }

  if (left > 20) {
    console.log(`✗ 본문이 안 비워졌습니다 (${left}자 남음). 붙여 쓰면 중복됩니다.`);
    await page.waitForTimeout(30000);
    await ctx.close();
    process.exit(1);
  }
  console.log(`기존 내용을 비웠습니다 (본문 남은 글자 ${left})`);
}

// 제목도 비우고 쓴다. 안 비우면 옛 제목 뒤에 새 제목이 붙는다.
await F.locator(".se-documentTitle").first().click();
await page.waitForTimeout(600);
await page.keyboard.press("Control+A");
await page.waitForTimeout(300);
await page.keyboard.press("Delete");
await page.waitForTimeout(700);

await F.locator(".se-documentTitle").first().click();
await page.waitForTimeout(700);
await page.keyboard.type(post.title, { delay: 12 });
await page.waitForTimeout(900);

await F.locator(".se-component.se-text").first().click();
await page.waitForTimeout(900);

// ── 서식 도구 ────────────────────────────────────────────

/** 글자 크기 바꾸기. 안 되면 false 를 주고 호출부는 그냥 넘어간다. */
async function setSize(px) {
  try {
    await F.getByRole("button", { name: /글자 크기/ }).first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const ok = await F.evaluate((want) => {
      const box = document.querySelector(
        ".se-toolbar-option-font-size-code, [class*='font-size'] ul, [class*='fontsize'] ul",
      );
      if (!box) return false;
      for (const el of box.querySelectorAll("li,button")) {
        if ((el.textContent || "").trim().startsWith(want)) { el.click(); return true; }
      }
      return false;
    }, px);
    await page.waitForTimeout(700);
    if (!ok) await page.keyboard.press("Escape");
    return ok;
  } catch {
    return false;
  }
}

async function addHr() {
  try {
    await F.getByRole("button", { name: "구분선 추가", exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1400);
    await page.keyboard.press("Control+End");
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

/**
 * **굵게** 표시를 서식으로 옮겨 친다.
 * split 의 홀수 자리가 별표 안쪽이다. 그 구간만 Ctrl+B 로 감싼다.
 */
async function typeRich(text) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 $2")   // 링크는 글자 + 주소로
      .replace(/(?<!\*)\*(?!\*)/g, "");                // 남은 홑별표 제거
    if (!seg) continue;
    const bold = i % 2 === 1;
    if (bold) await page.keyboard.press("Control+b");
    await page.keyboard.type(seg, { delay: 4 });
    if (bold) await page.keyboard.press("Control+b");
  }
}

async function insertImage(file) {
  const chooser = page.waitForEvent("filechooser", { timeout: 20000 });
  await F.getByRole("button", { name: /사진/ }).first().click();
  (await chooser).setFiles(file);
  await page.waitForTimeout(9000);
  await page.keyboard.press("Control+End");   // 커서를 끝으로. 안 하면 그림 앞에 글이 들어간다
  await page.waitForTimeout(700);
}

// ── 본문 입력 ────────────────────────────────────────────

const BODY_PX = "16";
const HEAD_PX = "24";
let sizeWorks = true;
let heads = 0;

// 본문 기본 크기를 한 번 정해 둔다. 기본 19 는 문단이 길면 답답하다.
if (!(await setSize(BODY_PX))) {
  sizeWorks = false;
  console.log("  (글자 크기를 못 바꿨습니다. 굵게와 구분선만 씁니다)");
}

for (const b of BLOCKS) {
  if (b.img) {
    await insertImage(b.img);
    console.log(`  [사진] ${path.basename(b.img)}`);
    continue;
  }

  if (b.hr) { await addHr(); continue; }

  if (b.h) {
    // 소제목 앞에 구분선을 둬서 마디가 보이게 한다
    if (heads > 0) await addHr();
    heads++;
    if (sizeWorks) await setSize(HEAD_PX);
    await page.keyboard.press("Control+b");
    await page.keyboard.type(b.h, { delay: 6 });
    await page.keyboard.press("Control+b");
    await page.keyboard.press("Enter");
    if (sizeWorks) await setSize(BODY_PX);
    await page.waitForTimeout(300);
    continue;
  }

  await typeRich(b.t);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
}
console.log(`본문 입력 완료 (소제목 ${heads}개)`);

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
