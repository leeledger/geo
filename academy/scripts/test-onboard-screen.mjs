/**
 * 끝에서 끝 — 계약 뒤 순서 화면(/admin/clients/<slug>/onboard, Step 54).
 *
 *   node academy/scripts/test-onboard-screen.mjs --live [--out <폴더>]
 *
 * 로컬 next dev(운영 DB) + 새 헤드리스 chromium(빈 프로필) + /admin/enter?key= 로 관리자 쿠키만. 원장 로그인 브라우저는 안 연다.
 * 시험 고객(status 'test', 도메인은 우리 랜딩 — 남의 사이트를 두드리지 않는다)을 화면으로 등록 → 파일럿 시작(사이트 구축) →
 * 상황 저장(도메인 담당 우리 · 블로그 받음) → 줄 상태 단언 → 1440·390 스크린샷 → cited(자사·리허설) 두 폭 → 시험 고객 지우기 · 남은 행 0.
 * 스크린샷은 --out 폴더(없으면 OS 임시 폴더). 저장소에 남기지 않는다
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "../../tools/node_modules/playwright/index.mjs";
import { 지우기 } from "../../web/lib/client-core.mjs";

if (!process.argv.includes("--live")) {
  console.log("사용: node academy/scripts/test-onboard-screen.mjs --live [--out <폴더>]   (로컬 next dev + 운영 DB 에 시험 고객을 넣었다 지운다)");
  process.exit(1);
}
const 출력 = (() => { const i = process.argv.indexOf("--out"); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : os.tmpdir(); })();
fs.mkdirSync(출력, { recursive: true });

const 환경 = (파일) => {
  for (const l of fs.readFileSync(new URL(파일, import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_0-9]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
};
환경("../.env.local");
const 웹환경 = Object.fromEntries(fs.readFileSync(new URL("../../web/.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .map((l) => /^([A-Z_0-9]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "").trim()]));
const KEY = 웹환경.ADMIN_TOKEN;
if (!KEY) { console.log("web/.env.local 에 ADMIN_TOKEN 이 없어 관리자 쿠키를 못 받습니다"); process.exit(1); }

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 3 });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
const 한연결 = async (fn) => { const c = await pool.connect(); try { return await fn((s, p = []) => c.query(s, p).then((r) => r.rows)); } finally { c.release(); } };

const WEB = fileURLToPath(new URL("../../web/", import.meta.url));
const PORT = 3078, BASE = `http://localhost:${PORT}`;
const SLUG = "e2e-onboard", NAME = "착수시험고객", DOMAIN = "geo-rose-nine.vercel.app";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) { 통과++; console.log(`  ✓ ${이름}`); } else { 실패++; console.log(`  ✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 비었나 = (port) => new Promise((r) => { const s = net.createServer().once("error", () => r(false)).once("listening", () => s.close(() => r(true))).listen(port); });

/** client_id·pilot_id 칸이 있는 표 전부에서 그 고객·파일럿 행 수 */
const 남은행 = async (id, 파일럿) => {
  const 칸들 = await q(`select c.table_schema || '.' || c.table_name as t, c.column_name as col
      from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema in ('geo', 'academy') and t.table_type = 'BASE TABLE' and c.column_name in ('client_id', 'pilot_id')`);
  let n = 0;
  for (const { t, col } of 칸들) {
    if (col === "pilot_id" && !파일럿.length) continue;
    const [r] = col === "client_id"
      ? await q(`select count(*)::int as n from ${t} where client_id::text = $1`, [String(id)])
      : await q(`select count(*)::int as n from ${t} where pilot_id::text = any($1::text[])`, [파일럿]);
    if (r.n) console.log(`     남음 ${t}.${col} ${r.n}`);
    n += r.n;
  }
  return { n, 표: 칸들.length };
};

const 사진들 = [];
/** 두 폭에서 가로 넘침 없음 + 전체 화면 사진 */
const 두폭 = async (page, url, 이름) => {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(url);
    await page.locator('[data-stage="contract"]').waitFor();
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    봄(`${이름} ${w} — 가로 넘침 없음`, sw <= iw, `scrollWidth ${sw} > innerWidth ${iw}`);
    const 파일 = path.join(출력, `onboard-${이름}-${w}.png`);
    await page.screenshot({ path: 파일, fullPage: true });
    사진들.push(파일);
  }
};

let dev = null, browser = null, id = null, 파일럿들 = [];
try {
  const [옛] = await q(`select id, status from geo.clients where slug = $1`, [SLUG]);
  if (옛) {
    if (옛.status !== "test") throw new Error(`${SLUG} 가 시험 고객이 아닙니다 — 손대지 않고 멈춥니다`);
    console.log(`지난 실행이 남긴 ${SLUG}(id ${옛.id}) 를 지움: ${JSON.stringify(await 한연결((dq) => 지우기(dq, SLUG)))}`);
  }

  // 1. 로컬 next dev
  if (!(await 비었나(PORT))) throw new Error(`포트 ${PORT} 를 누가 쓰고 있습니다`);
  dev = spawn(process.execPath, ["./node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], { cwd: WEB, env: { ...process.env, ...웹환경, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
  let 로그 = "";
  dev.stdout.on("data", (b) => { 로그 += b; });
  dev.stderr.on("data", (b) => { 로그 += b; });
  for (let i = 0; i < 120; i++) {
    await 쉼(1000);
    try { const r = await fetch(`${BASE}/admin/login`); if (r.status < 500) break; } catch { /* 아직 */ }
    if (i === 119) throw new Error(`next dev 가 120초 안에 안 떴습니다\n${로그.slice(-800)}`);
  }
  console.log(`next dev ${BASE} 뜸`);

  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(90000);
  await page.goto(`${BASE}/admin/enter?key=${encodeURIComponent(KEY)}&to=/admin/clients`);
  봄("관리자 쿠키 → /admin/clients", new URL(page.url()).pathname === "/admin/clients", page.url());
  봄("목록에 「계약 뒤 순서」 링크(코드 고객 빼고)", (await page.locator('a.cl-ob[href="/admin/clients/cited/onboard"]').count()) === 1
    && (await page.locator('a.cl-ob[href="/admin/clients/robotncoding/onboard"]').count()) === 0);
  봄("등록 폼 도메인 설명 한 줄", (await page.locator("form.cl-form").first().innerText()).includes("홈페이지가 없으면 열 도메인(구축 계약 때 정함)"));

  // 2. 등록 — 화면 폼, 시험 고객
  const f = page.locator("form.cl-form").first();
  for (const [k, v] of Object.entries({ name: NAME, slug: SLUG, domain: `https://${DOMAIN}/`, answer_terms: `${NAME}, e2e-onboard`, compete: "시험 검색어 하나\n시험 검색어 둘\n시험 검색어 셋" })) {
    await f.locator(`[name="${k}"]`).fill(v);
  }
  await f.locator('[name="test"]').check();
  await f.locator('button[type="submit"]').click();
  await page.waitForURL(`**/admin/clients/${SLUG}**`, { timeout: 90000 });
  const [row] = (await q(`select to_jsonb(c) as r from geo.clients c where slug = $1`, [SLUG])).map((x) => x.r);
  id = row?.id ?? null;
  봄("시험 고객 생김 — status test · 외부", row?.status === "test" && row?.relation === "외부");
  봄("고객 화면에 「계약 뒤 순서」 링크", (await page.locator(`a[href="/admin/clients/${SLUG}/onboard"]`).count()) === 1);

  // 3. 파일럿 시작 전 — 진단 통과 순서 · 파일럿 원장님 몫
  await page.goto(`${BASE}/admin/clients/${SLUG}/onboard`);
  const 단계순서 = async () => (await page.locator("[data-stage]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-stage")))).join(",");
  const 줄상태 = async (stage, rid) => page.locator(`[data-stage="${stage}"] [data-row="${rid}"]`).getAttribute("data-state");
  봄("파일럿 없음 — 진단 통과 순서", (await 단계순서()) === "contract,receive,site,kickoff,baseline,run30,day30", await 단계순서());
  봄("파일럿 없음 — contract.pilot 원장님 몫", (await 줄상태("contract", "pilot")) === "원장님 몫");

  // 4. 파일럿 시작 — 사이트 구축
  await page.goto(`${BASE}/admin/clients/${SLUG}#pilot`);
  await page.locator("#pilot > summary").click();
  const pf = page.locator("#pilot form");
  const 계약 = { district: "송파구", neighborhood: "석촌동", category: "치과", audience: "직장인", contact_name: "시험", contact_email: "e2e@example.invalid",
    contact_phone: "010-0000-0000", receipt_type: "없음", payment_ref: "E2E", terms_evidence: "https://example.invalid/terms", biz_type: "개인" };
  const 오늘 = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  for (const [k, v] of Object.entries(계약)) await pf.locator(`[name="${k}"]`).fill(v);
  await pf.locator('[name="refund_terms_sent_on"]').fill(오늘);
  await pf.locator('[name="needs_build"]').selectOption("build");
  await pf.locator('button[type="submit"]').click();
  await page.waitForURL("**/admin/pilots/**", { timeout: 90000 });
  파일럿들 = (await q(`select id::text as id, needs_build from geo.pilots where client_id = $1`, [id])).map((r) => r.id);
  봄("파일럿 하나 · 사이트 구축", 파일럿들.length === 1 && (await q(`select needs_build from geo.pilots where client_id = $1`, [id]))[0]?.needs_build === "build");

  // 5. 상황 바꾸기 — 잘못된 값은 저장 안 됨
  const 옛config = (await q(`select config from geo.clients where id = $1`, [id]))[0].config;
  await page.goto(`${BASE}/admin/clients/${SLUG}/onboard`);
  await page.locator("#situation > summary").click();
  await page.locator('#situation select[name="dns"]').evaluate((s) => { const o = document.createElement("option"); o.value = "누구"; s.appendChild(o); s.value = "누구"; });
  await page.locator('#situation button[type="submit"]').click();
  await page.waitForURL("**err=onboard**", { timeout: 90000 });
  봄("모르는 값 → 저장 안 됨 · 오류 한 줄", (await page.locator(".cl-err").innerText()).includes("저장 안 됨")
    && JSON.stringify((await q(`select config from geo.clients where id = $1`, [id]))[0].config) === JSON.stringify(옛config));

  // 6. 상황 저장 — 도메인 담당 우리 · 블로그 받음
  await page.goto(`${BASE}/admin/clients/${SLUG}/onboard`);
  await page.locator("#situation > summary").click();
  await page.locator('#situation select[name="dns"]').selectOption("우리");
  await page.locator('#situation select[name="blog"]').selectOption("받음");
  await page.locator('#situation button[type="submit"]').click();
  await page.waitForURL("**saved=1**", { timeout: 90000 });
  const 새config = (await q(`select config from geo.clients where id = $1`, [id]))[0].config;
  봄("config.onboard 저장 — dns 우리 · blog 받음", 새config.onboard?.dns === "우리" && 새config.onboard?.blog === "받음", JSON.stringify(새config.onboard));
  const { onboard: _o, ...나머지 } = 새config;
  봄("다른 config 키는 그대로(indexnow 키·gsc·queries)", JSON.stringify(나머지) === JSON.stringify(옛config));

  // 7. 줄 상태
  봄("구축 순서 — 기준선이 사이트보다 먼저", (await 단계순서()) === "contract,receive,kickoff,baseline,site,run30,day30", await 단계순서());
  const 세팅들 = ["site", "robots", "sitemap", "llms", "jsonld", "keyfile", "send"];
  const 세팅상태 = await Promise.all(세팅들.map((x) => 줄상태("site", x)));
  봄("site 단계 세팅줄 전부 해당없음(연 날 전)", 세팅상태.every((s) => s === "해당없음"), 세팅상태.join(","));
  봄("blog 원장님 몫", (await 줄상태("receive", "blog")) === "원장님 몫");
  const blog말 = await page.locator('[data-row="blog"]').innerText();
  봄("blog 줄 — save-login 명령 또는 로그인 일감", blog말.includes(`save-login.mjs naver-${SLUG}`) || blog말.includes("로그인 일감"), blog말);
  봄("launch 원장님 몫", (await 줄상태("site", "launch")) === "원장님 몫");
  봄("dns 됨 · 누가 Claude 세션", (await 줄상태("receive", "dns")) === "됨" && (await page.locator('[data-row="dns"]').getAttribute("data-who")) === "Claude 세션");
  봄("띠 — 착수 전 환불 문장", (await page.locator('[data-testid="band"]').innerText()).includes("착수 전 취소 — 390,000원 모두 돌려드림"));
  const 본문 = await page.locator("main").innerText();
  봄("화면에 % 없음", !/\d+\s*%/.test(본문), 본문.match(/.{20}\d+\s*%.{10}/)?.[0]);
  봄("화면에 영문 상태값 없음", !/\b(none|setup|build|pending|undefined|null|NaN)\b/.test(본문), 본문.match(/\b(none|setup|build|pending|undefined|null|NaN)\b/)?.[0]);

  // 8. 사진 — 시험 고객 · cited(자사·리허설 실데이터)
  await 두폭(page, `${BASE}/admin/clients/${SLUG}/onboard`, "test");
  await 두폭(page, `${BASE}/admin/clients/cited/onboard`, "cited");
  const cited띠 = await page.locator('[data-testid="band"]').innerText().catch(() => "");
  봄("cited — 계약 줄 해당없음", (await page.locator('[data-stage="contract"] [data-row]').evaluateAll((xs) => xs.every((x) => x.getAttribute("data-state") === "해당없음"))));
  console.log(`  cited 띠: ${cited띠.replace(/\n/g, " | ")}`);

  // 9. 코드 고객 — 안내 한 줄, 폼 없음
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/admin/clients/robotncoding/onboard`);
  봄("코드 고객 — 안내 한 줄 · 폼 없음", (await page.locator("main").innerText()).includes("코드로 설정한 고객입니다. 계약 순서가 없습니다") && (await page.locator("#situation").count()) === 0);
} catch (e) {
  실패++;
  console.log(`  ✗ 실행 오류 — ${e.stack ?? e.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (dev) { try { execFileSync("taskkill", ["/pid", String(dev.pid), "/T", "/F"], { stdio: "ignore" }); } catch { dev.kill(); } }
  if (id !== null) {
    console.log(`  지우기: ${JSON.stringify(await 한연결((dq) => 지우기(dq, SLUG)).catch((e) => e.message))}`);
    const 남 = await 남은행(id, 파일럿들);
    const [{ n: slug남 }] = await q(`select count(*)::int as n from geo.clients where slug = $1 or id = $2`, [SLUG, id]);
    봄(`client_id·pilot_id 표 ${남.표}칸 전부 0 · slug 0 (id ${id})`, 남.n === 0 && slug남 === 0, `남음 ${남.n} · slug ${slug남}`);
  }
  await pool.end().catch(() => {});
}
for (const p of 사진들) console.log(`  사진 ${p}`);
console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
