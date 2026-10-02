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
 *   node naver-blog-post.mjs --marketing <id> --profile .browser-profile-docttak
 *        고객 바깥 글(geo.marketing_posts 블로그 초안, Step 35 D55)을 그 고객 블로그에 올린다.
 *        원장이 현황판에서 「읽었어요」를 누른 초안만(note 「게시 승인」). 블로그 아이디는 NAVER_BLOG_ID 로 준다.
 *        학원 꼬리(주소·QR·지도·상담 전화)는 안 붙인다 — 다른 고객 글이다
 *
 * 글을 고쳤으면 새로 올리지 말고 --update 를 쓴다.
 * 같은 내용이 두 벌 올라가면 네이버 검색에서 서로 갉아먹는다.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
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
// 값을 받는 옵션들 — 그 값을 슬러그로 읽지 않는다
const 값자리 = new Set(["--update", "--marketing", "--profile"].map((k) => ARGS.indexOf(k)).filter((i) => i >= 0).map((i) => i + 1));
const 값 = (k) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] ?? null : null; };
const MK_ID = 값("--marketing");
// 프로필은 저장소 루트 기준(.browser-profile). 고객 블로그는 따로 둔 프로필로 — 학원 블로그 세션과 섞이면 남의 블로그에 올라간다
const PROFILE = 값("--profile") ?? ".browser-profile";
const slug = MK_ID ? `marketing-${MK_ID}` : ARGS.find((a, i) => !a.startsWith("--") && !값자리.has(i));
if (MK_ID && (!/^\d+$/.test(MK_ID) || LOG_NO)) { console.log("--marketing 다음에는 초안 번호를 주고, --update 와 같이 쓰지 않습니다."); process.exit(1); }
if (MK_ID && !process.env.NAVER_BLOG_ID) { console.log("--marketing 은 NAVER_BLOG_ID(그 고객 블로그 아이디)가 있어야 합니다 — 학원 블로그에 올리지 않게."); process.exit(1); }

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
// 바깥 글은 원장이 확인한 블로그 초안만 읽는다(note 「게시 승인」). 태그는 검색어 하나와 고객 이름
const { rows } = MK_ID
  ? await pool.query(
    `select 'marketing-' || m.id as slug, m.title, m.body, array[replace(m.target_query, ' ', ''), c.name] as tags
       from geo.marketing_posts m join geo.clients c on c.id = m.client_id
      where m.id = $1 and m.channel = 'blog' and m.status = '초안' and m.note like '게시 승인%'`, [Number(MK_ID)])
  : await pool.query(`select slug, title, body, tags from academy.posts where slug = $1`, [slug]);
// 에이전트가 그린 도해는 public/blog 가 아니라 DB 에 있다(/blog/img/<슬러그>/<이름>.svg, Step 12)
const dbImgs = !MK_ID && rows[0]?.body.includes(`/blog/img/${slug}/`)
  ? (await pool.query(`select name, svg from academy.post_images where slug = $1`, [slug])).rows : [];
await pool.end();
if (!rows.length) { console.log(MK_ID ? `바깥 글 ${MK_ID}: 원장이 확인한 블로그 초안이 아닙니다(이미 올렸거나 확인 전) — 안 올립니다.` : `${slug} 글이 없습니다.`); process.exit(1); }
const post = rows[0];

/** 지역 태그는 늘 붙인다. 네이버에서 들어오는 사람은 대개 동네부터 찾는다. */
const LOCAL = ["송파코딩학원", "석촌동코딩학원", "잠실코딩학원", "코딩학원추천"];
const TAGS = [...new Set([...post.tags, ...(MK_ID ? [] : LOCAL)])].slice(0, 30);

// path.resolve 는 실행 위치(cwd) 기준이다. 이 도구는 .browser-profile 이 저장소 루트에 있어서
// 루트에서 돌리는데, 그러면 C:/dev/academy/... 를 뒤져 그림을 못 찾는다.
// 게다가 조용히 「그림 없음」으로 넘어가서 사진 0장짜리 글이 그대로 올라간다.
// 60행처럼 파일 위치 기준으로 잡으면 어디서 돌리든 맞는다.
const IMGDIR = fileURLToPath(new URL(`../academy/public/blog/${slug}/`, import.meta.url));

/**
 * DB 도해는 임시 폴더에 SVG 로 풀어 svg-to-png.mjs 로 굽는다. 파싱 오류면 그 도구가 멈추고 PNG 를 안 만든다 —
 * 빨간 오류 화면이 올라가지 않는다. 구운 PNG 가 없는 그림은 아래 toBlocks 가 「그림 없음」으로 알린다
 */
const DBIMGDIR = path.join(os.tmpdir(), `naver-img-${slug}`);
if (dbImgs.length) {
  fs.rmSync(DBIMGDIR, { recursive: true, force: true });
  fs.mkdirSync(DBIMGDIR, { recursive: true });
  for (const im of dbImgs) fs.writeFileSync(path.join(DBIMGDIR, `${im.name}.svg`), im.svg);
  const bake = spawnSync(process.execPath, [fileURLToPath(new URL("./svg-to-png.mjs", import.meta.url)), DBIMGDIR, "--scale", "1"], { encoding: "utf8" });
  console.log(`DB 도해 ${dbImgs.length}장 굽기\n${(bake.stdout ?? "").trimEnd()}${bake.status ? `\n  ⚠ 굽기 실패 ${(bake.stderr ?? "").trim().slice(-300)}` : ""}`);
}

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
      const p = path.join(img[1].startsWith("/blog/img/") ? DBIMGDIR : IMGDIR, file);
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

/**
 * 하단 상담 블록. 옛 네이버 글에는 카카오채널 카드·지도가 늘 붙어 있었는데
 * 사이트에서 옮긴 글에는 글자 안내만 남아 지도와 QR 이 빠졌다(2026-09-21 원장 지적).
 *   카카오 주소  → 에디터가 링크 카드로 바꾼다
 *   QR 카드      → 홈페이지 kakao-qr.svg 와 같은 코드 (assets/naver-footer/contact-qr.svg 를 구운 것)
 *   지도         → 에디터 「장소」에서 송파대로37길 52 를 골라 넣는다
 */
const QR_CARD = fileURLToPath(new URL("./assets/naver-footer/contact-qr.png", import.meta.url));
const PLACE = { query: "로봇앤코딩학원", address: "송파대로37길 52" };

const BLOCKS = MK_ID ? toBlocks(post.body) : [
  ...toBlocks(post.body),
  { hr: true },
  { t: "― 로봇&코딩학원 (서울 송파구 석촌동 274-8 2층)" },
  // QR·지도를 카카오 주소보다 먼저 둔다. 주소 줄이 링크 카드로 바뀌면 커서가 카드 뒤에서 길을 잃고
  // 「사진」 버튼이 파일 창을 안 연다(2026-09-21, 20초 대기 끝에 죽음 — 발행 전이라 중복은 없었다).
  ...(fs.existsSync(QR_CARD) ? [{ img: QR_CARD }] : []),
  { place: true },
  { t: "상담 02-422-0525 · 카카오톡 http://pf.kakao.com/_Bxhxbxjxb/chat" },
  { t: `글 전문 https://robotncoding.com/blog/${slug}` },
];

console.log(post.title);
console.log(`  문단 ${BLOCKS.filter((b) => b.t).length} · 소제목 ${BLOCKS.filter((b) => b.h).length}` +
            ` · 사진 ${BLOCKS.filter((b) => b.img).length} · 태그 ${TAGS.length}`);

const ctx = await chromium.launchPersistentContext(path.resolve(process.cwd(), PROFILE), {
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
  const 열기 = async () => {
    const chooser = page.waitForEvent("filechooser", { timeout: 15000 });
    await F.locator("button.se-image-toolbar-button").first().click();
    return chooser;
  };
  let chooser;
  try { chooser = await 열기(); }
  catch {
    // 커서가 링크 카드·지도 같은 덩어리에 걸려 있으면 파일 창이 안 뜬다. 끝으로 옮기고 한 번 더
    await page.keyboard.press("Escape");
    await F.locator(".se-component").last().click().catch(() => {});
    await page.keyboard.press("Control+End");
    await page.waitForTimeout(800);
    chooser = await 열기();
  }
  await chooser.setFiles(file);
  await page.waitForTimeout(9000);
  await page.keyboard.press("Control+End");   // 커서를 끝으로. 안 하면 그림 앞에 글이 들어간다
  await page.waitForTimeout(700);
}

/**
 * 지도 넣기. 「장소」 → 검색 → 우리 주소 줄의 「추가」 → 「확인」 (naver-place-probe.mjs 로 확인한 순서).
 * 이름으로 고르면 안 된다 — 「로봇앤코딩학원」 이 강남·광진에도 있다. 주소로 고른다.
 */
async function insertPlace() {
  try {
    await F.getByRole("button", { name: /^장소/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(2500);
    await F.locator("input[placeholder*='장소']").first().click();
    await page.keyboard.type(PLACE.query, { delay: 25 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3500);
    const item = F.locator(".se-place-map-search-result-item", { hasText: PLACE.address }).first();
    await item.hover();
    await item.locator(".se-place-add-button").click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    await F.locator(".se-popup-button-confirm").first().click();
    await page.waitForTimeout(3000);
    await page.keyboard.press("Control+End");
    await page.waitForTimeout(600);
    return (await F.locator(".se-component.se-placesMap").count()) > 0;
  } catch {
    await F.locator(".se-popup-close-button").first().click().catch(() => {});
    return false;
  }
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

  if (b.place) {
    console.log((await insertPlace()) ? "  [지도] 로봇앤코딩학원" : "  ⚠ 지도를 못 넣었습니다 — 발행 뒤 손으로 넣어 주세요");
    continue;
  }

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
  // 하단부(QR·지도·링크 카드)를 사람이 안 봐도 확인할 수 있게 찍어 둔다
  await page.keyboard.press("Escape");
  // 본문 도해가 PNG 로 들어갔는지 — 첫 본문 사진(하단 QR 카드 앞)을 따로 찍는다
  if (BLOCKS.some((b) => b.img)) {
    await F.locator(".se-component.se-image").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(process.cwd(), "naver-dry-image.png") });
    console.log("  본문 첫 사진: naver-dry-image.png");
  }
  await F.locator(".se-component").last().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(process.cwd(), "naver-dry-bottom.png") });
  console.log("\n--dry 입니다. 발행하지 않았습니다. 하단: naver-dry-bottom.png · 창에서 확인하세요 (90초).");
  await page.waitForTimeout(90000);
  await ctx.close();
  process.exit(0);
}

// 로컬 에이전트가 이 줄로 「발행을 눌렀을 수 있다」를 안다. 이 뒤에 죽으면 중복 게시를 막으려고 사람 확인으로 돌린다
console.log("발행 버튼을 누릅니다");
await F.getByRole("button", { name: /^발행$/ }).last().click({ timeout: 10000 });
await page.waitForTimeout(13000);

const 끝주소 = page.url();
console.log("\n주소:", 끝주소.slice(0, 110));
const 발행됨 = !/PostWriteForm/.test(끝주소);
console.log(발행됨 ? "✓ 발행된 것으로 보입니다" : "화면이 그대로입니다 — 확인 필요");

// 여기서 DB 에 적어야 한다. 안 적으면 이 글이 계속 「안 된 것」으로 잡혀서
// 다음 이관 때 또 올라가고, 같은 내용 두 벌이 네이버 검색에서 서로 갉아먹는다.
// 여태 이 로직이 없어서 사람이 손으로 적고 있었다 — 한 번 빠뜨리면 중복이다.
if (발행됨) {
  const logNo = /\/(\d{6,})(?:[?#]|$)/.exec(끝주소)?.[1] ?? /logNo=(\d{6,})/.exec(끝주소)?.[1];
  if (!logNo) {
    console.log("  ⚠ 주소에서 글 번호를 못 뽑았습니다. 손으로 적어야 합니다:");
    console.log(MK_ID
      ? `     update geo.marketing_posts set status='올림', posted_url='https://blog.naver.com/${BLOG_ID}/<번호>', posted_at=now() where id=${MK_ID};`
      : `     update academy.posts set naver_log_no='<번호>', naver_at=now() where slug='${slug}';`);
  } else {
    // 위쪽 풀은 글을 읽자마자 닫는다. 브라우저 작업이 몇 분이라 연결을 붙잡고 있으면
    // Neon 이 유휴로 끊는다. 그래서 적을 때만 잠깐 새로 연다.
    const du = new URL(process.env.DATABASE_URL);
    du.searchParams.delete("sslmode");
    const 기록풀 = new Pool({
      connectionString: du.toString(),
      ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
    });
    const r = await (MK_ID
      ? 기록풀.query(
        `update geo.marketing_posts set status = '올림', posted_url = $1, posted_at = now() where id = $2 and status = '초안'`,
        [`https://blog.naver.com/${BLOG_ID}/${logNo}`, Number(MK_ID)])
      : 기록풀.query(
        `update academy.posts set naver_log_no = $1, naver_at = now()
          where slug = $2 and naver_log_no is null`,
        [logNo, slug])).catch((e) => { console.log("  ⚠ 기록 실패:", e.message.slice(0, 80)); return null; });
    await 기록풀.end().catch(() => {});
    if (r?.rowCount) console.log(MK_ID ? `  기록했습니다: marketing_posts ${MK_ID} 올림 logNo=${logNo}` : `  기록했습니다: naver_log_no=${logNo}`);
    else if (r) console.log(`  이미 기록돼 있습니다 (덮어쓰지 않았습니다). 고쳐 쓰려면 --update 를 쓰세요`);
  }
}

await page.waitForTimeout(20000);
await ctx.close();
