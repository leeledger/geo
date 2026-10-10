/**
 * 지식iN 답 창(Step 41) — 현황판 「이 질문에 답하기」 → open-kin(로컬 대기) → login-poll 이 이걸 띄운다.
 * 고객 네이버 프로필로 질문 페이지를 열고, 답 입력칸을 열어 초안을 채우고, 같은 글을 클립보드에도 넣는다.
 *
 * 「등록」은 원장이 누른다. 이 파일에는 그 버튼을 찾거나 누르는 코드가 없다(약관 — 원장 결정 2026-10-10).
 * test-kin.mjs 가 이 파일 글자를 읽어 그런 코드가 생기지 않았는지 본다.
 *
 * 누르는 것은 질문 아래 「답변」(입력칸 열기) 하나와 입력칸뿐이다. 캡차가 뜨면 건드리지 않고 창만 띄워 둔다.
 * 창은 원장이 닫거나 12분이 지나면 닫힌다(로그인 창과 같은 시간). 정상 종료해야 쿠키가 남는다.
 *
 *   node tools/kin-open.mjs <marketing_posts.id>
 *
 * 출력(login-poll 이 kin-core 창결과 로 읽는다):
 *   ✓ 답 채움            입력칸에 넣고 클립보드에도 넣음
 *   ✓ 클립보드           입력칸을 못 찾아 클립보드에만
 *   ✗ <까닭>             창을 못 띄움
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pg from "pg";
import { loadClients } from "../academy/clients.mjs";
import { 네이버쿠키 } from "./login-rules.mjs";
import { 질문주소, 붙일글, 막힘, 채움말 } from "../web/lib/kin-core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const 상한 = 12 * 60 * 1000;
const id = Number(process.argv[2]);
const 끝 = (s) => { console.log(`✗ ${s}`); process.exit(1); };
if (!Number.isInteger(id) || id <= 0) 끝("사용법: node tools/kin-open.mjs <marketing_posts.id>");

for (const l of fs.readFileSync(process.env.LOGIN_POLL_ENV || path.join(HERE, "../academy/.env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const q = async (s, p = []) => {
  const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  await c.connect();
  try { return (await c.query(s, p)).rows; } finally { await c.end().catch(() => {}); }
};

const [m] = await q(`select m.id, m.body, k.url, c.slug from geo.marketing_posts m
    join geo.kin_questions k on k.id = m.kin_question_id join geo.clients c on c.id = m.client_id
   where m.id = $1 and m.channel = 'jisikin' and m.status = '초안'`, [id]);
if (!m) 끝("질문이 붙은 지식iN 초안이 아닙니다(이미 올렸거나 버렸을 수 있습니다)");
const 주소 = 질문주소(m.url);
if (!주소) 끝(`지식iN 질문 주소가 아닙니다: ${m.url}`);
const [c] = await loadClients(q, { slug: m.slug, includeTest: true });
const 프로필 = c?.marketing?.blogProfile ? path.join(HERE, c.marketing.blogProfile) : null;
if (!프로필 || !fs.existsSync(프로필)) 끝("네이버 프로필이 없습니다 — 현황판 「로그인 창 열기」로 먼저 로그인해 주세요");
const 글 = 붙일글(m.body);

// 클립보드 — 입력칸을 못 찾아도 붙여 넣을 수 있게 먼저 넣는다. 한글이 깨지지 않게 파일로 넘긴다
const 임시 = path.join(os.tmpdir(), `kin-open-${id}.txt`);
let 클립보드 = false;
try {
  fs.writeFileSync(임시, 글, "utf8");
  execFileSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    ["-NoProfile", "-Command", `Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 -LiteralPath '${임시.replace(/'/g, "''")}')`], { timeout: 20000 });
  클립보드 = true;
} catch (e) {
  console.log(`  클립보드에 못 넣음: ${String(e.message).slice(0, 120)}`);
} finally {
  fs.rmSync(임시, { force: true });
}

const ctx = await chromium.launchPersistentContext(프로필, {
  headless: false, viewport: { width: 1280, height: 940 }, locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? await ctx.newPage();
let 결과 = "";
try {
  await page.goto(주소, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const 화면 = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
  if (네이버쿠키(await ctx.cookies("https://nid.naver.com").catch(() => [])) === "없음") {
    결과 = "네이버 로그인이 풀려 입력칸을 못 열었습니다";
  } else if (막힘(화면, page.url())) {
    결과 = "캡차·차단 화면이라 손대지 않았습니다";
  } else {
    // 「답변」 — 입력칸을 여는 버튼(질문 아래). 글을 올리는 버튼이 아니다
    await page.locator("button._answerWriteButton").first().click({ timeout: 10000 });
    const 칸 = page.locator("#smartEditorArea .se-text-paragraph").first();
    await 칸.waitFor({ state: "visible", timeout: 15000 });
    await 칸.click();
    const 줄들 = 글.split("\n");
    for (const [i, 줄] of 줄들.entries()) {
      if (줄) await page.keyboard.type(줄, { delay: 4 });
      if (i < 줄들.length - 1) await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(800);
    const 들어감 = await page.locator("#smartEditorArea .se-content").first().innerText().catch(() => "");
    const 납작 = (s) => s.replace(/\s+/g, "");
    if (!납작(들어감).includes(납작(글.slice(0, 40)))) 결과 = "입력칸에 글이 안 들어갔습니다";
  }
} catch (e) {
  결과 = `입력칸을 못 찾았습니다(${String(e.message).split("\n")[0].slice(0, 100)})`;
}

if (!결과) console.log(`✓ 답 채움 — ${채움말.됨}`);
else if (클립보드) console.log(`✓ 클립보드 — ${채움말.클립보드만} · ${결과}`);
else console.log(`✗ ${결과} · 클립보드에도 못 넣었습니다`);

// 원장이 읽고 올리는 동안 창을 둔다. 원장이 창을 닫으면 바로 끝난다
const 시작 = Date.now();
while (Date.now() - 시작 < 상한 && ctx.pages().some((p) => !p.isClosed())) await new Promise((r) => setTimeout(r, 3000));
await ctx.close().catch(() => {});
console.log("창을 닫았습니다.");
