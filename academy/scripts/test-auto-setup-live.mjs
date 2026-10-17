/**
 * 끝에서 끝 — 두 칸 등록 · 자동 세팅(Step 55h).
 *
 *   node academy/scripts/test-auto-setup-live.mjs --live [--out <폴더>]
 *
 * 로컬 next dev(운영 DB) + 새 헤드리스 chromium(빈 프로필) + /admin/enter?key= 로 관리자 쿠키만. 원장 로그인 브라우저는 안 연다.
 * 시험 고객 셋(status 'test')을 두 칸 폼으로 넣고 판이 다섯 단계를 돌게 둔 뒤, 지우기()로 지우고 남은 행 0 을 센다.
 *   A 「시험치과 송파점」 + cited.kr(우리 사이트 — 남의 사이트를 두드리지 않는다)
 *   B 「시험꽃집 가온점」 + 홈페이지 빈칸
 *   C 「시험블로그상점」 + https://blog.naver.com/naver_diary(네이버 공식 블로그 — 고객 블로그를 두드리지 않는다)
 * 이름은 지어낸 상호다. 네이버 자동완성 원응답(상태 코드)을 그대로 찍는다 — BUILD-LOG 실측 기록용.
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
import { 지우기, 체크리스트, 일감계획, 금지말찾기, 파일럿상태 } from "../../web/lib/client-core.mjs";
import { 다음단계, 사이트상태 } from "../../web/lib/auto-setup-core.mjs";
import { 착수순서 } from "../../web/lib/onboard-core.mjs";

if (!process.argv.includes("--live")) {
  console.log("사용: node academy/scripts/test-auto-setup-live.mjs --live [--out <폴더>]   (로컬 next dev + 운영 DB 에 시험 고객 셋을 넣었다 지운다)");
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
const PORT = 3079, BASE = `http://localhost:${PORT}`;
const A = { name: "시험치과 송파점", homepage: "cited.kr", slug: "cited-2" };
const B = { name: "시험꽃집 가온점", homepage: "", slug: "siheomkkotjip-gaonjeom" };
const C = { name: "시험블로그상점", homepage: "https://blog.naver.com/naver_diary", slug: "naver-diary" };

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) { 통과++; console.log(`  ✓ ${이름}`); } else { 실패++; console.log(`  ✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 비었나 = (port) => new Promise((r) => { const s = net.createServer().once("error", () => r(false)).once("listening", () => s.close(() => r(true))).listen(port); });
const 행 = async (slug) => (await q(`select to_jsonb(c) as r from geo.clients c where slug = $1`, [slug]))[0]?.r ?? null;

/** client_id·pilot_id 칸이 있는 표 전부에서 그 고객들·파일럿들 행 수 */
const 남은행 = async (ids, 파일럿) => {
  const 칸들 = await q(`select c.table_schema || '.' || c.table_name as t, c.column_name as col
      from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema in ('geo', 'academy') and t.table_type = 'BASE TABLE' and c.column_name in ('client_id', 'pilot_id')`);
  let n = 0;
  for (const { t, col } of 칸들) {
    if (col === "pilot_id" && !파일럿.length) continue;
    const [r] = col === "client_id"
      ? await q(`select count(*)::int as n from ${t} where client_id::text = any($1::text[])`, [ids.map(String)])
      : await q(`select count(*)::int as n from ${t} where pilot_id::text = any($1::text[])`, [파일럿]);
    if (r.n) console.log(`     남음 ${t}.${col} ${r.n}`);
    n += r.n;
  }
  return { n, 표: 칸들.length, 칸들 };
};

const 사진들 = [];
const 사진 = async (page, url, 이름, 기다림) => {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(url);
    await page.locator(기다림).first().waitFor();
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    봄(`${이름} ${w} — 가로 넘침 없음`, sw <= iw, `scrollWidth ${sw} > innerWidth ${iw}`);
    const 파일 = path.join(출력, `step55-${이름}-${w}.png`);
    await page.screenshot({ path: 파일, fullPage: true });
    사진들.push(파일);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
};

/** 고객 화면을 열어 둔 채(판이 단계를 부른다) 멈출 때까지 — 최대 ms */
const 판끝 = async (page, slug, ms = 180000) => {
  const 끝 = Date.now() + ms;
  let r = await 행(slug);
  while (Date.now() < 끝) {
    r = await 행(slug);
    const a = r?.config?.auto;
    const 도는 = Object.values(a?.단계 ?? {}).some((s) => s.상태 === "도는중");
    if (a && !도는 && !다음단계(a, new Date(), { 실패도: false })) break;
    await 쉼(2000);
  }
  console.log(`  ${slug} 자동 세팅: ${Object.entries(r?.config?.auto?.단계 ?? {}).map(([k, s]) => `${k} ${s.상태}${s.시도 ? `(${s.시도})` : ""}`).join(" · ")}`);
  for (const [k, s] of Object.entries(r?.config?.auto?.단계 ?? {})) if (s.말) console.log(`     ${k}: ${s.말}${s.오류 ? ` [원문 ${s.오류.slice(0, 160)}]` : ""}`);
  return r;
};

/** 고객 글(체크리스트 보낼글 · setup-send 일감 글 · 착수순서 보낼글) 전부 */
const 고객글 = async (row) => {
  const 줄 = 체크리스트(row, row.derived ?? {}, { pilot: await 파일럿상태(q, row.id) });
  const r = 착수순서({ row, derived: row.derived ?? {}, 세팅줄: 줄, pilot: null, tasks: [], questions: [], content: [], ai: [], checks: [], audits: [], 로그인일감: [], 크롤: null });
  const 일감 = await q(`select dedupe_key, detail from geo.agent_tasks where client_id = $1 and dedupe_key = 'setup-send'`, [row.id]);
  return { 줄, 글: [...줄.map((x) => x.보낼글), ...r.단계.flatMap((s) => s.줄.map((x) => x.보낼글)), ...일감.map((t) => t.detail)].filter(Boolean) };
};

let dev = null, browser = null;
const ids = [], 파일럿들 = [];
try {
  for (const x of [A, B, C]) {
    const [옛] = await q(`select id, status from geo.clients where slug = $1`, [x.slug]);
    if (옛) {
      if (옛.status !== "test") throw new Error(`${x.slug} 가 시험 고객이 아닙니다 — 손대지 않고 멈춥니다`);
      console.log(`지난 실행이 남긴 ${x.slug}(id ${옛.id}) 를 지움: ${JSON.stringify(await 한연결((dq) => 지우기(dq, x.slug)))}`);
    }
  }

  // 0. 로컬 next dev
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
  const 폼 = page.locator('[data-testid="new-client"]');
  const 두칸 = async (x, { 겹침 = false } = {}) => {
    await page.goto(`${BASE}/admin/clients`);
    await 폼.locator('[name="name"]').fill(x.name);
    await 폼.locator('[name="homepage"]').fill(x.homepage);
    await 폼.locator("details > summary").click();
    await 폼.locator('[name="test"]').check();
    if (겹침) await 폼.locator('[name="allow_dup"]').check();
    const 시작 = Date.now();
    await 폼.locator('button[type="submit"]').click();
    return 시작;
  };
  봄("새 등록 — 두 칸(+ 접힌 시험용)", (await 폼.locator("input:not([type=checkbox]):not([type=hidden])").count()) === 2);

  // ── A
  const 시작A = await 두칸(A);
  await page.waitForURL(`**/admin/clients/${A.slug}`, { timeout: 90000 });
  console.log(`  A 등록 → 고객 화면 ${((Date.now() - 시작A) / 1000).toFixed(1)}초`);
  let a = await 행(A.slug);
  ids.push(a.id);
  봄("A slug cited-2(cited 가 쓰임)", a.slug === "cited-2");
  봄("A crawl_key 36자 hex · alias 「고객 X」 · test", /^[0-9a-f]{36}$/.test(a.crawl_key ?? "") && /^고객 [A-Z]+$/.test(a.alias ?? "") && a.status === "test");
  const 판별A = a.config.answerTerms ?? [];
  console.log(`  A 판별 말: ${JSON.stringify(판별A)} · 흔함 ${a.config.auto.흔함} · 출처 ${a.config.auto.출처.판별말}`);
  봄("A 판별 말 — 이름(흔함이면 빠짐)·cited.kr · 맨 영어 낱말 없음", 판별A.includes("cited.kr") && (a.config.auto.흔함 ? !판별A.includes(A.name) : 판별A.includes(A.name))
    && !판별A.some((t) => /^[A-Za-z]+$/.test(t)));
  a = await 판끝(page, A.slug);
  const d = a.derived ?? {};
  봄("A 사이트 상태 none|setup 이 세팅점검 결과와 맞음", ["none", "setup"].includes(a.config.auto.사이트상태) && a.config.auto.사이트상태 === 사이트상태(d), `${a.config.auto.사이트상태} vs ${사이트상태(d)}`);
  봄("A 업종 치과 · 출처 이름", a.config.auto.사실?.업종?.값 === "치과" && /^이름/.test(a.config.auto.사실?.업종?.출처 ?? ""), JSON.stringify(a.config.auto.사실?.업종));
  console.log(`  A 지역: ${JSON.stringify(a.config.auto.사실?.지역)}`);
  if (a.config.auto.단계.업종지역.상태 === "원장") {
    봄("A 지역 모름 → 원장 · 판에 두 칸", a.config.auto.사실.지역.값 === null && (await page.locator('[data-testid="facts-form"]').count()) === 1);
    await page.locator('[data-testid="facts-form"] [name="category"]').fill("치과");
    await page.locator('[data-testid="facts-form"] [name="district"]').fill("송파구");
    await page.locator('[data-testid="facts-form"] button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
    a = await 판끝(page, A.slug);
    봄("A 원장 두 칸 → 업종지역 됨 · 출처 원장 입력", a.config.auto.단계.업종지역.상태 === "됨" && /^원장 입력 \d{4}-\d{2}-\d{2}$/.test(a.config.auto.사실.지역.출처));
  } else 봄("A 지역 읽음 — 출처 JSON-LD·본문", /JSON-LD|본문/.test(a.config.auto.사실?.지역?.출처 ?? ""), JSON.stringify(a.config.auto.사실?.지역));
  const 원 = a.config.auto.자동완성;
  console.log(`  ── 네이버 자동완성 원응답(로컬 PC) fetched_at ${원?.fetched_at}`);
  for (const s of 원?.씨앗 ?? []) console.log(`     ${s.차}차 「${s.q}」 상태 ${s.status ?? "없음"}${s.오류 ? ` (${s.오류})` : ""} · ${s.items.length}개 ${JSON.stringify(s.items)}`);
  봄("A 자동완성 원응답 저장(씨앗·상태·말)", Array.isArray(원?.씨앗) && 원.씨앗.length >= 1 && 원.씨앗.every((s) => "status" in s && Array.isArray(s.items)));
  const 원문들 = new Set((원?.씨앗 ?? []).flatMap((s) => s.items));
  const compete = a.config.queries?.compete ?? [];
  console.log(`  A 경쟁 검색어 ${compete.length}개: ${JSON.stringify(compete)} · 출처 ${a.config.auto.출처.경쟁 ?? "-"}`);
  봄("A compete — 3~8 원문 또는 비움(3개 미만)", (compete.length >= 3 && compete.length <= 8 && compete.every((x) => 원문들.has(x))) || compete.length === 0);
  const [pa] = await q(`select id::text as id, status, paid_on, payment_ref, needs_build, price from geo.pilots where client_id = $1`, [a.id]);
  if (pa) 파일럿들.push(pa.id);
  봄("A 파일럿 리허설 · paid_on null · payment_ref null · needs_build = 사이트 상태", pa?.status === "리허설" && pa.paid_on === null && pa.payment_ref === null && pa.needs_build === a.config.auto.사이트상태, JSON.stringify(pa));
  const qa = pa ? await q(`select position, stage, text, approved from geo.pilot_questions where pilot_id = $1 order by position`, [pa.id]) : [];
  const 후보 = a.config.auto.후보?.length ?? 0;
  console.log(`  A 질문 후보 ${후보}개 · 넣은 질문 ${qa.length}개 · 검색어 단계 ${a.config.auto.단계.검색어.상태}`);
  if (후보 >= 17) {
    봄("A 질문 20 — keyword 17 원문 · brand 3 · approved false", qa.length === 20 && qa.filter((x) => x.stage === "keyword").every((x) => 원문들.has(x.text))
      && qa.filter((x) => x.stage === "keyword").length === 17 && qa.filter((x) => x.stage === "brand").length === 3 && qa.every((x) => !x.approved));
    봄("A measure_active", a.measure_active === true);
  } else 봄("A keyword<17 → 검색어 원장 · 질문 0", a.config.auto.단계.검색어.상태 === "원장" && qa.length === 0);
  const ga = await 고객글(a);
  봄("A 고객 글 금지어 0", ga.글.every((g) => !금지말찾기(g).length), ga.글.find((g) => 금지말찾기(g).length));
  봄("A send 보낼글 금지어 0", !금지말찾기(ga.줄.find((x) => x.id === "send")?.보낼글 ?? "").length);
  await 사진(page, `${BASE}/admin/clients/${A.slug}`, "client-A", '[data-testid="auto-setup"]');

  // onboard — 요약 · 사이트 줄
  await page.goto(`${BASE}/admin/clients/${A.slug}/onboard`);
  const 요약 = await page.locator('[data-testid="auto-summary"]').innerText();
  console.log(`  A onboard 요약: ${요약}`);
  봄("A onboard 자동 세팅 요약 한 줄", /^자동 세팅 \d\/5/.test(요약));
  봄("A onboard 사이트 줄 — 체크리스트와 같은 상태", (await page.locator('[data-stage="site"] [data-row="site"]').getAttribute("data-state")) === "됨");
  await 사진(page, `${BASE}/admin/clients/${A.slug}/onboard`, "onboard-A", '[data-stage="contract"]');

  // ── B 홈페이지 빈칸
  await 두칸(B);
  await page.waitForURL(`**/admin/clients/${B.slug}`, { timeout: 90000 });
  let b = await 판끝(page, B.slug, 60000);
  ids.push(b.id);
  봄("B 갈래 없음 · domain null · build", b.config.auto.갈래 === "없음" && b.domain === null && b.config.auto.사이트상태 === "build");
  const gb = await 고객글(b);
  봄("B 사이트 줄 해당없음 · 보낼글 금지어 0", gb.줄.find((x) => x.id === "site").상태 === "해당없음" && gb.글.every((g) => !금지말찾기(g).length));
  봄("B 업종 꽃집(이름)", b.config.auto.사실?.업종?.값 === "꽃집", JSON.stringify(b.config.auto.사실));
  const [pb] = await q(`select id::text as id from geo.pilots where client_id = $1`, [b.id]);
  if (pb) 파일럿들.push(pb.id);

  // ── C 네이버 공식 블로그
  await 두칸(C);
  await page.waitForURL(`**/admin/clients/${C.slug}`, { timeout: 90000 });
  let c = await 판끝(page, C.slug, 90000);
  ids.push(c.id);
  봄("C 갈래 플랫폼 · 채널 blog · domain null", c.config.auto.갈래 === "플랫폼" && c.config.onboard?.channels?.blog === C.homepage && c.domain === null);
  const pl = c.derived?.platform;
  console.log(`  C derived.platform: ${JSON.stringify({ platform: pl?.platform, page: pl?.page, hosts: pl?.hosts })}`);
  봄("C derived.platform 실측(확인 시각·페이지 상태)", !!pl?.checkedAt && pl?.page && "status" in pl.page);
  const gc = await 고객글(c);
  봄("C site·send·gsc 해당없음", ["site", "send", "gsc"].every((id) => gc.줄.find((x) => x.id === id).상태 === "해당없음"));
  봄("C 기술 말 고객 글 0", gc.글.every((g) => !금지말찾기(g).length) && !gc.글.some((g) => /robots|sitemap|llms|indexnow/i.test(g)));
  const [pc] = await q(`select id::text as id from geo.pilots where client_id = $1`, [c.id]);
  if (pc) 파일럿들.push(pc.id);

  // ── 같은 홈페이지 · 같은 이름
  await 두칸({ name: "시험치과 둘째", homepage: "https://www.cited.kr/" });
  await page.locator(".cl-err").first().waitFor();
  봄("같은 홈페이지 다시 → 거부", (await page.locator(".cl-err").first().innerText()).includes("같은 도메인"));
  await 두칸({ name: A.name, homepage: "" });
  await page.locator(".cl-err").first().waitFor();
  const 이름말 = await page.locator(".cl-err").first().innerText();
  봄("같은 이름 → name-dup 확인 문구", 이름말.includes(`같은 이름의 고객이 있습니다(${A.slug})`) && 이름말.includes("그래도 등록"), 이름말);
  봄("거부는 행을 안 만듦", (await q(`select count(*)::int n from geo.clients where name in ('시험치과 둘째') or (name = $1 and slug <> $2)`, [A.name, A.slug]))[0].n === 0);
} catch (e) {
  실패++;
  console.log(`  ✗ 실행 오류 — ${e.stack ?? e.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (dev) { try { execFileSync("taskkill", ["/pid", String(dev.pid), "/T", "/F"], { stdio: "ignore" }); } catch { dev.kill(); } }
  // 지우기 — A·B·C 와 이번에 생겼을지 모를 행(slug 로)
  for (const x of [A, B, C]) {
    const r = await 행(x.slug).catch(() => null);
    if (r && !ids.includes(r.id)) ids.push(r.id);
    for (const p of await q(`select id::text as id from geo.pilots p join geo.clients c on c.id = p.client_id where c.slug = $1`, [x.slug]).catch(() => [])) if (!파일럿들.includes(p.id)) 파일럿들.push(p.id);
    if (r) console.log(`  지우기 ${x.slug}: ${JSON.stringify(await 한연결((dq) => 지우기(dq, x.slug)).catch((e) => e.message))}`);
  }
  if (ids.length) {
    const 남 = await 남은행(ids, 파일럿들);
    const [{ n: slug남 }] = await q(`select count(*)::int as n from geo.clients where slug = any($1::text[]) or id = any($2::int[])`, [[A.slug, B.slug, C.slug], ids]);
    const 일감 = await q(`select (select count(*) from geo.agent_tasks where client_id = any($1::int[]))::int as t, (select count(*) from geo.agent_activity where client_id = any($1::int[]))::int as a`, [ids]);
    봄(`A·B·C 지움 — client_id·pilot_id 표 ${남.표}칸 전부 0 · agent_tasks ${일감[0].t} · agent_activity ${일감[0].a} · slug ${slug남} (id ${ids.join(",")})`,
      남.n === 0 && slug남 === 0 && 일감[0].t === 0 && 일감[0].a === 0, `남음 ${남.n}`);
  }
  await pool.end().catch(() => {});
}
for (const p of 사진들) console.log(`  사진 ${p}`);
console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
