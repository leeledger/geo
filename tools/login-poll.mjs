/**
 * 로그인 창 집기(Step 39b) — 현황판 「로그인 창 열기」가 올린 open-login 일감(로컬 대기)을 원장 PC 에서 연다.
 * pc-runner 가 LOGIN_POLL_HOURS 안에서 매분 띄운다. 일이 없으면 쿼리 한 번으로 끝난다.
 *
 *   있음 → 로컬 에이전트가 브라우저를 쓰는 중이면(.local-agent.lock 2시간 안) 기다림 note, 그대로 둔다
 *        → 다른 창이 떠 있으면(.open-session.lock) 그대로 둔다
 *        → 실행 중 · .open-session.lock · open-session.mjs (최대 12분) · 「✓ <이름> 로그인 확인」 줄로 판정
 *          요청한 곳 전부 ✓ → open-login 완료 + login 일감 완료 / 아니면 open-login 실패, login 일감은 사람 대기 그대로
 *
 * 로컬 에이전트는 실행 한 번에 학원 프로필(.browser-profile)과 고객 블로그 프로필을 다 열 수 있다.
 * 지금 어느 걸 열고 있는지는 기록이 없어 「같은 프로필을 쓰는 중」으로 본다 — 같은 프로필을 두 번 열면 크로미움이 깨진다.
 *
 *   node login-poll.mjs
 *   OPEN_SESSION=<스크립트>   시험용 가짜 open-session (실제 브라우저 안 엶)
 *   LOGIN_POLL_ENV=<파일>     .env.local 대신 읽을 파일(시험)
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { 창요청검사, 확인된곳, 창이름, kst분, 근거붙임 } from "../web/lib/login-core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LA_LOCK = path.join(HERE, ".local-agent.lock");
const OS_LOCK = path.join(HERE, ".open-session.lock");
const LOG = path.join(HERE, "login-poll.log");
const OPEN_SESSION = process.env.OPEN_SESSION || path.join(HERE, "open-session.mjs");

const 기록 = (s) => {
  const line = `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} ${s}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + "\n"); } catch {}
};

for (const l of fs.readFileSync(process.env.LOGIN_POLL_ENV || path.join(HERE, "../academy/.env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
// local-agent 와 같은 줄 — 창이 12분 떠 있는 동안 연결을 붙잡지 않게 쿼리마다 열고 닫는다
const q = async (s, p = []) => {
  const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  await c.connect();
  try { return (await c.query(s, p)).rows; } finally { await c.end().catch(() => {}); }
};
const 활동 = (ok, summary, taskId, clientId) =>
  q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id, run_url) values ($1,'deliver','로그인 창',$2,$3,$4,'login-poll')`,
    [clientId, ok, String(summary).slice(0, 1000), taskId]).catch(() => {});
const 신선 = (f, ms) => { try { return Date.now() - fs.statSync(f).mtimeMs < ms; } catch { return false; } };
const 기다림말 = "로컬 에이전트가 브라우저를 쓰는 중 — 끝나면 엽니다";

const [t] = await q(`select id, client_id, payload, last_error from geo.agent_tasks
   where kind = 'open-login' and status = '로컬 대기' order by updated_at, id limit 1`);
if (!t) process.exit(0);

const 요청 = 창요청검사(t.payload);
if (!요청) {
  await q(`update geo.agent_tasks set status='실패', updated_at=now(), last_error='요청 모양이 이상해 창을 안 열었습니다' where id=$1`, [t.id]);
  await 활동(false, `open-login #${t.id} payload 이상 — 안 엶`, t.id, t.client_id);
  process.exit(0);
}

// 다른 창이 떠 있으면 그대로 둔다(같은 프로필을 두 번 못 연다). 13분 넘은 잠금은 죽은 창의 흔적
if (fs.existsSync(OS_LOCK) && !신선(OS_LOCK, 13 * 60000)) fs.rmSync(OS_LOCK, { force: true });
try { fs.writeFileSync(OS_LOCK, String(process.pid), { flag: "wx" }); }
catch { process.exit(0); }

let 정리됨 = false;
const 잠금풀기 = () => { if (!정리됨) { 정리됨 = true; try { if (fs.readFileSync(OS_LOCK, "utf8") === String(process.pid)) fs.rmSync(OS_LOCK, { force: true }); } catch {} } };
process.on("exit", 잠금풀기);

try {
  // 창 잠금을 먼저 쓰고 로컬 에이전트 잠금을 본다 — 로컬 에이전트는 자기 잠금을 쓰고 창 잠금을 본다. 둘 중 하나는 꼭 상대를 본다
  if (신선(LA_LOCK, 2 * 3600 * 1000)) {
    // updated_at 도 매번 — PC 가 켜져 있다는 표시. 안 그러면 local-agent 가 30분 넘게 돌 때 회사 루프가 「PC 꺼짐」으로 닫는다
    await q(`update geo.agent_tasks set last_error=$2, updated_at=now() where id=$1 and status='로컬 대기'`, [t.id, 기다림말]);
    process.exit(0);
  }
  const [잡음] = await q(`update geo.agent_tasks set status='실행 중', last_error='', updated_at=now() where id=$1 and status='로컬 대기' returning id`, [t.id]);
  if (!잡음) process.exit(0);

  const 이름들 = 요청.sites.map((s) => 창이름[s]).join(", ");
  기록(`창 엶 #${t.id}: ${이름들} (${요청.profile})`);
  const args = 요청.sites.includes("blog") ? ["--blog", 요청.profile] : ["--only", 요청.sites.join(",")];
  const r = spawnSync(process.execPath, [OPEN_SESSION, ...args], { cwd: HERE, encoding: "utf8", timeout: 13 * 60000, windowsHide: false, maxBuffer: 5 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? `\n${r.error.message}` : ""}`;
  const { 됨, 안됨 } = 확인된곳(out, 요청.sites);
  const 지금 = kst분();

  if (!안됨.length) {
    await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = right(coalesce(evidence,'') || E'\n' || $2, 4000) where id=$1`,
      [t.id, `${지금} 창에서 로그인 확인: ${이름들}`]);
    if (요청.from) {
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = right(coalesce(evidence,'') || E'\n' || $2, 4000)
                where id=$1 and status='사람 대기'`, [요청.from, `${지금} 창에서 로그인 확인`]);
    }
    기록(`끝 #${t.id}: 전부 확인`);
    await 활동(true, `${이름들} 로그인 확인`, t.id, t.client_id);
  } else {
    const 말 = `아직 확인 안 된 곳: ${안됨.map((s) => 창이름[s]).join(", ")}`;
    await q(`update geo.agent_tasks set status='실패', updated_at=now(), last_error=$2, evidence = right(coalesce(evidence,'') || E'\n' || $3, 4000) where id=$1`,
      [t.id, 말, `${지금} 창 닫힘 — ${말}${됨.length ? ` · 확인 ${됨.map((s) => 창이름[s]).join(", ")}` : ""} · 종료코드 ${r.status ?? r.signal ?? "?"}`]);
    if (요청.from) await 근거붙임(q, 요청.from, `${지금} 로그인 창 닫힘 — ${말}`);
    기록(`끝 #${t.id}: ${말}`);
    await 활동(false, 말, t.id, t.client_id);
  }
} finally {
  잠금풀기();
}
