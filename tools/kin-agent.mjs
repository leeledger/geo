/**
 * 지식iN 차례(Step 41 KG-41-6) — pc-runner 가 하루 세 번(09·13·19시) 띄운다. 맞는 질문이 몇 시간 안에 채택돼, 하루 한 번은 늦었다.
 *   marketing.kin 고객마다: kin-find(분야 새 질문 목록 → 검색 보조) → 7일 안 후보 하나에 답 초안(하루 1건 — kin-core 답차례)
 * 등록은 원장이 현황판 「이 질문에 답하기」 창에서 누른다. 여기에는 등록이 없다.
 *
 * 로컬 에이전트와 같은 고객 프로필을 쓰니 그 잠금(.local-agent.lock)을 같이 쓴다. 잡혀 있으면 건너뜀(종료코드 3).
 * login-poll 은 이 잠금을 보고 창을 미룬다.
 *
 *   node tools/kin-agent.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadClients } from "../academy/clients.mjs";
import { 답차례, kst날 } from "../web/lib/kin-core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(HERE, ".local-agent.lock");
const LOG = path.join(HERE, "local-agent.log");
const 기록 = (s) => {
  const line = `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} [지식iN] ${s}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + "\n"); } catch {}
};

if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs >= 2 * 3600 * 1000) fs.rmSync(LOCK, { force: true });
try { fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" }); }
catch { 기록("로컬 에이전트가 돌고 있습니다 — 건너뜀"); process.exit(3); }

for (const l of fs.readFileSync(path.join(HERE, "../academy/.env.local"), "utf8").split(/\r?\n/)) {
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
const 돌리기 = (file, args, timeoutMin) => {
  try { return { ok: true, out: execFileSync(process.execPath, [file, ...args], { cwd: HERE, encoding: "utf8", timeout: timeoutMin * 60000, maxBuffer: 20 * 1024 * 1024 }) }; }
  catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}\n${e.message}` }; }
};
const 끝 = (s, n = 200) => String(s).replace(/\s+/g, " ").trim().slice(-n);

try {
  const 오늘 = kst날();
  for (const c of (await loadClients(q)).filter((x) => x.marketing?.kin && x.marketing.blogProfile)) {
    const r = 돌리기("kin-find.mjs", ["--client", c.slug], 15);
    기록(`${c.name} 질문 찾기: ${끝(r.out, 200)}`);
    if (/로그인이 필요|캡차/.test(r.out)) continue;   // 일감·활동은 kin-find 가 남겼다
    const 오늘글 = await q(`select kin_question_id from geo.marketing_posts where client_id = $1 and channel = 'jisikin' and created_on = $2::date`, [c.id, 오늘]).catch(() => []);
    const 후보들 = await q(`select id, asked_at::text, status from geo.kin_questions where client_id = $1 and status = '후보'`, [c.id]).catch(() => []);
    const 차례 = 답차례(오늘글, 후보들, 오늘);
    if (!차례.id) { 기록(`${c.name} 답: ${차례.why}`); continue; }
    const w = 돌리기(path.join(HERE, "../academy/scripts/marketing-draft.mjs"), ["--client", c.slug, "--kin-question", String(차례.id)], 12);
    const [글] = await q(`select status from geo.marketing_posts where kin_question_id = $1 order by id desc limit 1`, [차례.id]).catch(() => []);
    await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url) values ($1,'deliver',$2,$3,$4,'kin-agent')`,
      [c.id, `${c.name} 지식iN 답 초안`, w.ok, `질문 #${차례.id} · ${글 ? `초안 ${글.status === "초안" ? "통과" : "관문 탈락"}` : "안 씀"} · ${끝(w.out)}`.slice(0, 1000)]).catch(() => {});
  }
} catch (e) {
  기록(`실패 ${e.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(LOCK, { force: true });
}
