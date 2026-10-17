/**
 * 끝에서 끝 — 고객사 화면(/admin/clients)을 실제로 눌러 두 칸 등록 → 자동 세팅(사이트 점검) → 체크리스트 → 사람 일감 → 중복 거부 → 파일럿 시작 → 지우기 (Step 38 → 55).
 *
 *   node scripts/test-client-screen.mjs --live     로컬 next dev(운영 DB)를 띄우고 새 헤드리스 브라우저로 누른다
 *
 * 원장 로그인 브라우저는 안 연다 — Playwright 새 chromium(빈 프로필) + /admin/enter?key= 로 관리자 쿠키만.
 * 시험 도메인은 우리 사이트(cited.kr). 남의 사이트를 시험으로 두드리지 않는다.
 * 시험 고객은 status 'test' — 매시 회사 루프(세팅재점검·측정)가 안 읽는다. 끝에서 화면 「지우기」로 지우고 남은 행 0 을 센다
 */
import fs from "node:fs";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "../../tools/node_modules/playwright/index.mjs";
import { loadClients } from "../clients.mjs";
import { 고객사말 } from "../masks.mjs";
import { 체크리스트, 사람일감맞추기, 파일럿상태, 지우기, 보낼글말, 금지말찾기 } from "../../web/lib/client-core.mjs";
import { 다음단계 } from "../../web/lib/auto-setup-core.mjs";

if (!process.argv.includes("--live")) {
  console.log("사용: node scripts/test-client-screen.mjs --live   (로컬 next dev + 운영 DB 에 시험 고객을 화면으로 넣었다 지운다)");
  process.exit(1);
}
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
const PORT = 3077, BASE = `http://localhost:${PORT}`;
// 두 칸 등록(Step 55) — 관리명은 홈페이지 첫 마디로 자동(cited 가 쓰여 cited-2). 옛 시험 주소 geo-rose-nine.vercel.app 은
// 이제 cited.kr 로 308 넘어가(2026-10-17 실측) 점검이 「다른 주소로 넘어가」에서 멈춘다 — 우리 사이트 cited.kr 를 직접 쓴다(시험 고객은 시험끼리만 중복을 본다)
const SLUG = "cited-2", NAME = "화면시험고객", DOMAIN = "cited.kr";

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

let dev = null, browser = null, id = null, 파일럿들 = [];
try {
  // 지난 실행이 중간에 죽었으면 남은 시험 고객부터(같은 지우기 함수 — 시험 고객만 지운다)
  const [옛] = await q(`select id, status from geo.clients where slug = $1`, [SLUG]);
  if (옛) {
    if (옛.status !== "test") throw new Error(`${SLUG} 가 시험 고객이 아닙니다 — 손대지 않고 멈춥니다`);
    console.log(`지난 실행이 남긴 ${SLUG}(id ${옛.id}) 를 지움: ${JSON.stringify(await 한연결((dq) => 지우기(dq, SLUG)))}`);
  }
  const [{ n: 고객수전 }] = await q(`select count(*)::int as n from geo.clients`);

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
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(90000);
  await page.goto(`${BASE}/admin/enter?key=${encodeURIComponent(KEY)}&to=/admin/clients`);
  봄("관리자 쿠키 → /admin/clients", new URL(page.url()).pathname === "/admin/clients", page.url());

  // 2. 등록 — 두 칸 폼(Step 55e D221). 시험 고객 체크는 접힌 「시험용」 안
  const 새폼 = page.locator('[data-testid="new-client"]');
  봄("새 등록 폼은 두 칸(+ 접힌 시험용)", (await 새폼.locator("input:not([type=checkbox]):not([type=hidden])").count()) === 2
    && (await 새폼.locator('[name="name"]').count()) === 1 && (await 새폼.locator('[name="homepage"]').count()) === 1 && !(await 새폼.locator('[name="slug"]').count()));
  const 두칸 = async (이름, 홈) => {
    await page.goto(`${BASE}/admin/clients`);
    await 새폼.locator('[name="name"]').fill(이름);
    await 새폼.locator('[name="homepage"]').fill(홈);
    await 새폼.locator("details > summary").click();
    await 새폼.locator('[name="test"]').check();
    await 새폼.locator('button[type="submit"]').click();
  };
  const 시작 = Date.now();
  await 두칸(NAME, `https://${DOMAIN}/`);
  await page.waitForURL(`**/admin/clients/${SLUG}**`, { timeout: 90000 });
  console.log(`  등록 → 상세 ${((Date.now() - 시작) / 1000).toFixed(1)}초 (${page.url().replace(BASE, "")})`);
  let [row] = (await q(`select to_jsonb(c) as r from geo.clients c where slug = $1`, [SLUG])).map((x) => x.r);
  id = row?.id ?? null;
  봄("행 생김 — status test · 외부 · alias 「고객 …」", row?.status === "test" && row?.relation === "외부" && /^고객 [A-Z]+$/.test(row?.alias ?? ""), JSON.stringify({ status: row?.status, relation: row?.relation, alias: row?.alias }));
  const key = row?.config?.indexnow?.key ?? "";
  봄("IndexNow 키 32자 · mode 우리 · crawl_key 36자", /^[0-9a-f]{32}$/.test(key) && row?.config?.indexnow?.mode === "우리" && /^[0-9a-f]{36}$/.test(row?.crawl_key ?? ""));
  봄("answer_pattern 만들어짐(이름·도메인)", typeof row?.answer_pattern === "string" && new RegExp(row.answer_pattern, "i").test(`답: ${NAME} 입니다`) && new RegExp(row.answer_pattern, "i").test(DOMAIN));

  // 3. 자동 세팅 판이 멈출 때까지(최대 3분) — 사이트 단계가 derived 를 채운다
  for (let i = 0; i < 90; i++) {
    [row] = (await q(`select to_jsonb(c) as r from geo.clients c where id = $1`, [id])).map((x) => x.r);
    if (row.config.auto?.단계?.사이트?.상태 === "됨" && !다음단계(row.config.auto, new Date(), { 실패도: false })) break;
    await 쉼(2000);
  }
  console.log(`  자동 세팅: ${Object.entries(row.config.auto?.단계 ?? {}).map(([k, s]) => `${k} ${s.상태}`).join(" · ")}`);
  봄("자동 세팅 — 사이트 단계 됨", row.config.auto?.단계?.사이트?.상태 === "됨", JSON.stringify(row.config.auto?.단계?.사이트));

  // 4. derived — 실제 값
  const d = row?.derived ?? {};
  console.log(`  derived: checkedAt ${d.checkedAt} · home ${d.home?.status} · robots ${d.robots?.status} 막힘 [${d.robots?.blocked?.join(",") ?? "-"}] · sitemap ${d.sitemap?.status} ${d.sitemap?.url} 주소 ${d.sitemap?.pages} · llms ${d.llmsTxt?.status} ok ${d.llmsTxt?.ok} · homeLdTypes [${d.homeLdTypes?.join(",") ?? "-"}] · 키 파일 ${d.indexnowFile?.status} ok ${d.indexnowFile?.ok} · 오류 ${JSON.stringify(d.errors ?? [])}`);
  봄("derived.checkedAt 방금", Math.abs(Date.now() - Date.parse(d.checkedAt ?? "")) < 5 * 60000);
  봄("derived.robots.status 실제 코드", Number.isInteger(d.robots?.status));
  봄("derived.sitemap.pages 실제 수", Number.isInteger(d.sitemap?.pages));
  봄("derived.homeLdTypes 배열", Array.isArray(d.homeLdTypes));
  봄("본문 앞부분 300자 이하", [d.home?.head, d.robots?.head, d.llmsTxt?.head].every((h) => h === undefined || h.length <= 300));
  봄("키 파일 없음(우리 랜딩에 이 키 파일은 없다)", d.indexnowFile?.ok === false, `status ${d.indexnowFile?.status}`);

  // 5. 체크리스트 — 화면
  await page.goto(`${BASE}/admin/clients/${SLUG}`);
  // 체크리스트는 「할 일 순서」 아래 「자세히」에 접혀 있다(Step 57 D256)
  봄("할 일 순서가 맨 위 — 체크리스트는 접힘", (await page.locator('[data-testid="todo-order"]').count()) === 1 && (await page.locator("#checks").getAttribute("open")) === null);
  await page.locator("#checks > summary").click();
  const 칸상태 = async (cid) => page.locator(`[data-check="${cid}"]`).getAttribute("data-state");
  봄("체크리스트 뜸(12줄)", (await page.locator('[data-testid="checklist"] li').count()) === 12);
  봄("사이트 열림 = 됨", (await 칸상태("site")) === "됨");
  봄("「고객 담당에게 보낼 것」 = 사람", (await 칸상태("send")) === "사람");
  const 보낼글 = await page.locator('[data-check="send"] textarea').inputValue();
  봄("보낼 글 = 관리자 아이디 한 문장 · 금지어 0", 보낼글 === 보낼글말.사이트(NAME) && !금지말찾기(보낼글).length, 보낼글.slice(0, 200));
  const 고칠 = (await page.locator('[data-check="send"] details.fix pre').textContent()) ?? ""; // 접힌 details 안이라 innerText 는 빈 글자
  봄("고칠 것(원장·세션만)에 키 파일 이름·내용 · 복사 단추 없음", 고칠.includes(`https://${DOMAIN}/${key}.txt`) && 고칠.includes(`내용은 이 한 줄입니다: ${key}`)
    && (await page.locator('[data-check="send"] details.fix button').count()) === 0, 고칠.slice(0, 200));
  봄("GSC = 사람 · 계약 전 측정 = 기다림(원장 일감 아님, D254)", (await 칸상태("gsc")) === "사람" && (await 칸상태("measure")) === "기다림");
  봄("바깥 글 = 해당없음 · 이름 판별 말 = 됨", (await 칸상태("offsite")) === "해당없음" && (await 칸상태("name")) === "됨");
  봄("할 일 순서 → 자동 세팅 판 → 체크리스트", (await page.locator('[data-testid="auto-setup"]').count()) === 1
    && (await page.locator('[data-testid="todo-order"]').boundingBox()).y < (await page.locator('[data-testid="auto-setup"]').boundingBox()).y
    && (await page.locator('[data-testid="auto-setup"]').boundingBox()).y < (await page.locator('[data-testid="checklist"]').boundingBox()).y);

  // 6. 동기화 — 회사 루프와 같은 함수를 이 id 로
  const 줄 = 체크리스트(row, d, { pilot: await 파일럿상태(q, id) });
  const s1 = await 사람일감맞추기(q, row, 줄, { admin: BASE });
  const s2 = await 사람일감맞추기(q, row, 줄, { admin: BASE });
  const 일감 = await q(`select dedupe_key, status, title, agent, kind, link, detail from geo.agent_tasks where client_id = $1 order by dedupe_key`, [id]);
  console.log(`  동기화 1차 엶 [${s1.열림.join(",")}] · 2차 엶 [${s2.열림.join(",")}]`);
  for (const t of 일감) console.log(`     ${t.dedupe_key} · ${t.status} · ${t.title}`);
  const 사람키 = 줄.filter((x) => x.상태 === "사람").map((x) => `setup-${x.id}`).sort();
  봄("사람 대기 일감 = 체크리스트 사람 칸(send·gsc 포함 · 계약 전 measure 없음)", ["setup-gsc", "setup-send"].every((k) => 사람키.includes(k)) && !사람키.includes("setup-measure")
    && JSON.stringify(일감.filter((t) => t.status === "사람 대기").map((t) => t.dedupe_key).sort()) === JSON.stringify(사람키) && 일감.every((t) => t.kind === "setup"), 사람키.join(","));
  봄("두 번 돌려도 중복 없음", s2.열림.length === 0);
  봄("제목 사람 말 · 링크 고객 화면 · setup-send 글 금지어 0", 일감.some((t) => t.title === `${NAME}: 고객 담당에게 보낼 것이 있습니다`) && 일감.every((t) => t.link === `${BASE}/admin/clients/${SLUG}`)
    && !금지말찾기(일감.find((t) => t.dedupe_key === "setup-send")?.detail).length);

  // 7. 중복 거부 — 같은 홈페이지(시험끼리) · 같은 이름(「그래도 등록」 확인)
  await 두칸("화면시험고객둘", `https://www.${DOMAIN}/`);
  await page.locator(".cl-err").first().waitFor();
  const 중복말 = await page.locator(".cl-err").first().innerText();
  봄("같은 홈페이지 거부 — 사람 말", 중복말.includes("같은 도메인"), 중복말);
  봄("거부 뒤 친 값이 남음", (await 새폼.locator('[name="name"]').inputValue()) === "화면시험고객둘");
  await 두칸(NAME, "");
  await page.locator(".cl-err").first().waitFor();
  const 이름말 = await page.locator(".cl-err").first().innerText();
  봄("같은 이름 → 「그래도 등록」 확인 문구 · 체크 칸이 나옴", 이름말.includes(`같은 이름의 고객이 있습니다(${SLUG})`) && (await 새폼.locator('[name="allow_dup"]').count()) === 1, 이름말);
  봄("거부는 행을 안 만듦", (await q(`select count(*)::int as n from geo.clients where name in ('화면시험고객둘') or (name = $1 and id <> $2)`, [NAME, id]))[0].n === 0);

  // 8. 가림 — 새 이름이 고객사말에
  const 말 = 고객사말(await loadClients(q, { includeTest: true }));
  봄("고객사말에 새 이름·도메인", 말.includes(NAME) && 말.includes(DOMAIN));

  // 9. GSC 권한 받음 버튼 → 체크리스트 됨 → 동기화가 닫음
  await page.goto(`${BASE}/admin/clients/${SLUG}`);
  await page.locator("#checks > summary").click();
  await page.locator('[data-check="gsc"] button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  await page.locator('[data-check="gsc"][data-state="됨"]').waitFor();
  봄("권한 받음 → GSC 됨", (await 칸상태("gsc")) === "됨");
  const [row2] = (await q(`select to_jsonb(c) as r from geo.clients c where id = $1`, [id])).map((x) => x.r);
  const s3 = await 사람일감맞추기(q, row2, 체크리스트(row2, row2.derived, { pilot: null }), { admin: BASE });
  const [gt] = await q(`select status from geo.agent_tasks where client_id = $1 and dedupe_key = 'setup-gsc'`, [id]);
  봄("됨이면 일감 완료로 닫힘", s3.닫힘.includes("setup-gsc") && gt?.status === "완료");

  // 9. 파일럿 시작 — 상세 폼. geo.clients 행 수는 그대로
  const [{ n: 고객수중 }] = await q(`select count(*)::int as n from geo.clients`);
  // 같은 폼을 두 탭에 열어 둔다 — 하나로 만들고, 낡은 다른 탭으로 한 번 더 누르면 거부돼야 한다(덮어쓰기 없음)
  const 둘째 = await page.context().newPage();
  둘째.setDefaultTimeout(90000);
  const 폼열기 = async (pg) => { await pg.goto(`${BASE}/admin/clients/${SLUG}#pilot`); await pg.locator("#pilot > summary").click(); return pg.locator("#pilot form"); };
  const pf = await 폼열기(page);
  const pf2 = await 폼열기(둘째);
  const 계약 = { district: "송파구", neighborhood: "석촌동", category: "치과", audience: "직장인", contact_name: "시험", contact_email: "e2e@example.invalid",
    contact_phone: "010-0000-0000", receipt_type: "없음", payment_ref: "E2E", terms_evidence: "https://example.invalid/terms", biz_type: "개인" };
  const 오늘 = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  for (const 폼 of [pf, pf2]) {
    for (const [k, v] of Object.entries(계약)) await 폼.locator(`[name="${k}"]`).fill(v);
    await 폼.locator('[name="refund_terms_sent_on"]').fill(오늘);
  }
  await pf.locator('button[type="submit"]').click();
  await page.waitForURL("**/admin/pilots/**", { timeout: 90000 });
  await pf2.locator('[name="contact_name"]').fill("덮어쓰기 시도");
  await pf2.locator('button[type="submit"]').click();
  await 둘째.waitForURL("**err=pilot-exists**", { timeout: 90000 });
  봄("두 번째 파일럿 시작 거부 — 사람 말", (await 둘째.locator(".cl-err").innerText()).includes("이미 파일럿이 있습니다"));
  const [담당] = await q(`select count(*)::int as n, max(contact_name) as who from geo.pilots where client_id = $1`, [id]);
  봄("파일럿 하나 그대로 · 담당자 안 덮임", 담당.n === 1 && 담당.who === "시험", JSON.stringify(담당));
  await 둘째.close();
  파일럿들 = (await q(`select id::text as id from geo.pilots where client_id = $1`, [id])).map((r) => r.id);
  const [pn] = 파일럿들.length ? await q(`select (select count(*) from geo.pilot_questions where pilot_id = $1)::int as qs, (select count(*) from geo.pilot_tasks where pilot_id = $1)::int as ts`, [파일럿들[0]]) : [{ qs: 0, ts: 0 }];
  const [{ n: 고객수후 }] = await q(`select count(*)::int as n from geo.clients`);
  console.log(`  파일럿 ${파일럿들[0]} · 질문 ${pn.qs} · 과업 ${pn.ts} · 고객 행 ${고객수중} → ${고객수후}`);
  봄("파일럿 하나·질문 20·과업 생김", 파일럿들.length === 1 && pn.qs === 20 && pn.ts > 0);
  봄("createPilot 이 geo.clients 를 안 만듦", 고객수후 === 고객수중 && 고객수중 === 고객수전 + 1);
  await page.goto(`${BASE}/admin/clients/${SLUG}`);
  봄("파일럿 뒤 AI 측정 = 기다림(질문 승인 전)", (await 칸상태("measure")) === "기다림");

  // 10. /admin/pilots 목록 그대로 열림 · 만들기 폼 자리에 링크
  await page.goto(`${BASE}/admin/pilots`);
  봄("/admin/pilots 열림 · 고객사 화면 링크", (await page.locator('a[href="/admin/clients"]').count()) >= 1 && (await page.locator("text=30일 업무 생성").count()) === 0);

  // 11. 지우기 — 화면 버튼
  await page.goto(`${BASE}/admin/clients/${SLUG}`);
  await page.locator(".cl-danger button[type=submit]").click();
  await page.waitForURL("**/admin/clients?deleted=1", { timeout: 90000 });
  봄("지우기 → 목록(지웠습니다)", (await page.locator(".cl-note").innerText()).includes("지웠습니다"));
} catch (e) {
  실패++;
  console.log(`  ✗ 실행 오류 — ${e.stack ?? e.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (dev) { try { execFileSync("taskkill", ["/pid", String(dev.pid), "/T", "/F"], { stdio: "ignore" }); } catch { dev.kill(); } }
  if (id !== null) {
    const 남 = await 남은행(id, 파일럿들);
    const [{ n: slug남 }] = await q(`select count(*)::int as n from geo.clients where slug = $1 or id = $2`, [SLUG, id]);
    봄(`client_id·pilot_id 표 ${남.표}칸 전부 0 · slug 0 (id ${id})`, 남.n === 0 && slug남 === 0, `남음 ${남.n} · slug ${slug남}`);
    if (slug남) console.log(`  정리: ${JSON.stringify(await 한연결((dq) => 지우기(dq, SLUG)).catch((e) => e.message))}`);
  }
  await pool.end().catch(() => {});
}
console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
