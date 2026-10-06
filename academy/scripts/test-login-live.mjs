/**
 * 끝에서 끝 — 현황판 「로그인 창 열기」 버튼 → open-login 한 행 → login-poll(가짜 open-session) → 일감 완료·실패 (Step 39b).
 *
 *   node scripts/test-login-live.mjs --live    로컬 next dev(운영 DB) + 새 헤드리스 브라우저로 누른다
 *
 * 원장 로그인 브라우저는 안 연다 — open-session 은 fixtures/fake-open-session.mjs 로 바꿔 끼운다(OPEN_SESSION).
 * 시험 고객(status test)의 login-naver-blog 일감 하나로 돈다. 끝에서 시험 고객을 지우고 남은 행 0 을 센다.
 * login-poll 은 가장 오래된 open-login 을 집는다 — 다른 open-login 이 대기 중이면 손대지 않고 멈춘다
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "../../tools/node_modules/playwright/index.mjs";
import { 지우기 } from "../../web/lib/client-core.mjs";
import { 창요청, 오래된창요청닫기 } from "../../web/lib/login-core.mjs";

if (!process.argv.includes("--live")) {
  console.log("사용: node scripts/test-login-live.mjs --live   (로컬 next dev + 운영 DB 에 시험 고객을 넣었다 지운다)");
  process.exit(1);
}
const 환경 = (파일) => Object.fromEntries(fs.readFileSync(new URL(파일, import.meta.url), "utf8").split(/\r?\n/)
  .map((l) => /^([A-Z_0-9]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "").trim()]));
for (const [k, v] of Object.entries(환경("../.env.local"))) if (!process.env[k]) process.env[k] = v;
const 웹환경 = 환경("../../web/.env.local");
const KEY = 웹환경.ADMIN_TOKEN;
if (!KEY) { console.log("web/.env.local 에 ADMIN_TOKEN 이 없어 관리자 쿠키를 못 받습니다"); process.exit(1); }

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 3 });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
const 한연결 = async (fn) => { const c = await pool.connect(); try { return await fn((s, p = []) => c.query(s, p).then((r) => r.rows)); } finally { c.release(); } };

const WEB = fileURLToPath(new URL("../../web/", import.meta.url));
const TOOLS = fileURLToPath(new URL("../../tools/", import.meta.url));
const FAKE = fileURLToPath(new URL("./fixtures/fake-open-session.mjs", import.meta.url));
const ARGS = path.join(TOOLS, ".fake-open-args.json");
const LA_LOCK = path.join(TOOLS, ".local-agent.lock");
const PORT = 3078, BASE = `http://localhost:${PORT}`;
const SLUG = "e2e-login";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) { 통과++; console.log(`  ✓ ${이름}`); } else { 실패++; console.log(`  ✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 비었나 = (port) => new Promise((r) => { const s = net.createServer().once("error", () => r(false)).once("listening", () => s.close(() => r(true))).listen(port); });
const 폴 = (ok = "") => {
  fs.rmSync(ARGS, { force: true });
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(TOOLS, "login-poll.mjs")], { cwd: TOOLS, encoding: "utf8", timeout: 120000,
    env: { ...process.env, OPEN_SESSION: FAKE, FAKE_OPEN_OK: ok, FAKE_OPEN_ARGS: ARGS } });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, ms: Date.now() - t0, args: fs.existsSync(ARGS) ? JSON.parse(fs.readFileSync(ARGS, "utf8")) : null };
};
const 창행 = (id) => q(`select id, status, payload, last_error, evidence from geo.agent_tasks where client_id = $1 and kind = 'open-login' order by id`, [id]);
const 일감 = (tid) => q(`select status, evidence from geo.agent_tasks where id = $1`, [tid]).then((r) => r[0]);

let dev = null, browser = null, id = null;
try {
  const [남의] = await q(`select count(*)::int n from geo.agent_tasks where kind = 'open-login' and status in ('로컬 대기', '실행 중')`);
  if (남의.n) throw new Error(`다른 open-login 이 ${남의.n}건 대기 중입니다 — login-poll 이 그걸 집을 수 있어 멈춥니다`);
  if (fs.existsSync(LA_LOCK)) throw new Error("로컬 에이전트가 돌고 있습니다(.local-agent.lock) — 끝난 뒤 다시");
  const [옛] = await q(`select id, status from geo.clients where slug = $1`, [SLUG]);
  if (옛) {
    if (옛.status !== "test") throw new Error(`${SLUG} 가 시험 고객이 아닙니다 — 손대지 않고 멈춥니다`);
    console.log(`지난 실행이 남긴 ${SLUG} 지움: ${JSON.stringify(await 한연결((dq) => 지우기(dq, SLUG)))}`);
  }
  [{ id }] = await q(`insert into geo.clients (slug, name, domain, status, measure_active, config, answer_pattern)
      values ($1, '로그인시험', 'geo-rose-nine.vercel.app', 'test', false, '{"v":1}'::jsonb, '로그인시험') returning id`, [SLUG]);
  const [로그인] = await q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
      values ($1, 'deliver', 'human', $2, '로그인시험 블로그 로그인 필요', '시험', '사람 대기', 5, '{"sticky":true}'::jsonb) returning id`, [id, `login-naver-blog-${SLUG}`]);
  const [딴일] = await q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
      values ($1, 'deliver', 'human', $2, '빙 웹마스터에 로그인시험 추가', '시험', '사람 대기', 5, '{"sticky":true}'::jsonb) returning id`, [id, `bing-site-${SLUG}`]);
  console.log(`시험 고객 id ${id} · login 일감 #${로그인.id} · 다른 일감 #${딴일.id}`);

  // 1. 화면 — 버튼 두 번 → 한 행
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
  browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${BASE}/admin/enter?key=${encodeURIComponent(KEY)}&to=${encodeURIComponent(`/admin/ops?c=${SLUG}`)}`);
  await page.waitForURL(`**/admin/ops?c=${SLUG}`);
  const 줄 = page.locator(".td-list li", { hasText: "로그인시험 블로그 로그인 필요" });
  봄("현황판에 login 일감 줄 · 「로그인 창 열기」 버튼", (await 줄.locator("button", { hasText: "로그인 창 열기" }).count()) === 1);
  봄("다른 사람 일에는 버튼 없음", (await page.locator(".td-list li", { hasText: "빙 웹마스터에 로그인시험 추가" }).locator("button", { hasText: "로그인 창 열기" }).count()) === 0);
  봄("왜 문구", (await 줄.innerText()).includes("버튼을 누르면 원장 PC 에 로그인 창이 뜹니다"));
  for (let n = 0; n < 2; n++) {
    await page.locator(".td-list li", { hasText: "로그인시험 블로그 로그인 필요" }).locator("button", { hasText: "로그인 창 열기" }).click();
    await 쉼(4000);
    await page.reload();
  }
  let 창 = await 창행(id);
  봄("두 번 눌러도 open-login 한 행 · 로컬 대기", 창.length === 1 && 창[0].status === "로컬 대기", JSON.stringify(창.map((x) => x.status)));
  봄("payload — 고객 블로그 프로필 · from", 창[0]?.payload?.profile === `.browser-profile-${SLUG}` && 창[0]?.payload?.sites?.join() === "blog" && 창[0]?.payload?.from === Number(로그인.id));
  봄("눌린 줄 「조치 중 · … 로그인 창 요청함」", /조치 중 · \d+\/\d+ 로그인 창 요청함\(\d\d:\d\d KST\)/.test(await page.locator(".td-list li", { hasText: "로그인시험 블로그 로그인 필요" }).innerText()));
  const r0 = await 창요청(q, 딴일.id);
  봄("login-* 아닌 일감은 거부", !r0.ok && r0.err === "not-login" && (await 창행(id)).length === 1);

  // 2. 로컬 에이전트가 도는 중 → 기다림 note, 그대로
  fs.writeFileSync(LA_LOCK, "시험");
  let p = 폴("네이버 블로그");
  fs.rmSync(LA_LOCK, { force: true });
  창 = await 창행(id);
  봄("로컬 에이전트 잠금 → 안 엶 · 로컬 대기 · note", p.args === null && 창[0].status === "로컬 대기" && 창[0].last_error === "로컬 에이전트가 브라우저를 쓰는 중 — 끝나면 엽니다", `${창[0].status} ${창[0].last_error} ${p.out.slice(-200)}`);

  // 3. 확인 없음 → open-login 실패 · login 일감은 사람 대기 그대로
  p = 폴("");
  창 = await 창행(id);
  let t = await 일감(로그인.id);
  봄("가짜 창 인자 — --blog 고객 프로필", JSON.stringify(p.args) === JSON.stringify(["--blog", `.browser-profile-${SLUG}`]), JSON.stringify(p.args));
  봄("확인 없음 → open-login 실패 「아직 확인 안 된 곳: 네이버 블로그」", 창[0].status === "실패" && 창[0].last_error === "아직 확인 안 된 곳: 네이버 블로그", `${창[0].status} ${창[0].last_error}`);
  봄("login 일감은 사람 대기 그대로 + 근거", t.status === "사람 대기" && /로그인 창 닫힘 — 아직 확인 안 된 곳/.test(t.evidence));

  // 4. 다시 눌러 → 전부 ✓ → 둘 다 완료
  const r1 = await 창요청(q, 로그인.id);
  봄("실패 뒤 다시 누르면 같은 행이 로컬 대기로", r1.ok && !r1.이미 && (await 창행(id)).length === 1 && (await 창행(id))[0].status === "로컬 대기");
  p = 폴("네이버 블로그");
  창 = await 창행(id);
  t = await 일감(로그인.id);
  봄("전부 ✓ → open-login 완료", 창[0].status === "완료" && /창에서 로그인 확인: 네이버 블로그/.test(창[0].evidence), `${창[0].status} ${p.out.slice(-300)}`);
  봄("login 일감 완료 「창에서 로그인 확인」", t.status === "완료" && /창에서 로그인 확인/.test(t.evidence), t.status);
  const 활동 = await q(`select ok, summary from geo.agent_activity where client_id = $1 and action = '로그인 창' order by at`, [id]);
  봄("활동 줄 「로그인 창」 실패·성공", 활동.length === 2 && 활동[0].ok === false && 활동[1].ok === true, JSON.stringify(활동));

  // 5. PC 꺼짐 — 30분 넘은 로컬 대기 → 실패
  await q(`update geo.agent_tasks set status = '사람 대기' where id = $1`, [로그인.id]);
  await 창요청(q, 로그인.id);
  await q(`update geo.agent_tasks set updated_at = now() - interval '31 minutes' where client_id = $1 and kind = 'open-login'`, [id]);
  const 닫힘 = await 오래된창요청닫기(q);
  창 = await 창행(id);
  t = await 일감(로그인.id);
  봄("30분 지난 open-login → 실패 「PC 가 꺼져 있어 창을 못 열었습니다」", 닫힘.some((x) => x.client_id === id) && 창[0].status === "실패" && 창[0].last_error === "PC 가 꺼져 있어 창을 못 열었습니다");
  봄("login 일감 근거에 「로그인 창 못 엶」", /로그인 창 못 엶 — PC 가 꺼져 있어/.test(t.evidence));

  // 6. 할 일 없음 → 바로 끝
  p = 폴("");
  봄("open-login 없음 → 창 안 엶 · 종료코드 0", p.code === 0 && p.args === null, `code ${p.code} ${p.ms}ms`);
  console.log(`  (일 없을 때 login-poll ${p.ms}ms)`);
} catch (e) {
  실패++;
  console.log(`  ✗ 실행 오류 — ${e.message}`);
} finally {
  fs.rmSync(ARGS, { force: true });
  await browser?.close().catch(() => {});
  if (dev) { spawnSync("taskkill", ["/pid", String(dev.pid), "/T", "/F"], { stdio: "ignore" }); }
  if (id !== null) {
    const r = await 한연결((dq) => 지우기(dq, SLUG)).catch((e) => ({ ok: false, err: e.message }));
    const [x] = await q(`select count(*)::int n from geo.clients where slug = $1`, [SLUG]);
    봄(`시험 고객 지움 · 남은 행 0 (${JSON.stringify(r)})`, r.ok && x.n === 0);
  }
  await pool.end().catch(() => {});
}
console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
