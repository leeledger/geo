/**
 * PC 일꾼 — 윈도 작업 스케줄러 대신, 로그인하면 떠서 정해진 시각에 원장 PC 작업을 돌린다.
 *
 * 왜: 2026-09-24 부터 이 PC 의 작업 스케줄러가 「Cited」 작업 셋을 전부 0x800710E0(요청 거부)로 막았다.
 *   마지막 성공은 심장박동 9/23 21:47, 로컬 에이전트 9/23 19:10. 손으로 눌러도, cmd 한 줄짜리 시험 작업도 거부된다.
 *   로그인 없이 도는 작업(S4U)으로 바꾸려면 관리자 권한이 필요하다. 그래서 ChatGPT·Gemini·퍼플렉시티 화면 측정이
 *   9/24 뒤로 한 번도 안 돌았고, 현황판 「AI 질문 기록」에 Claude 만 남았다(2026-09-29 원장 질문으로 드러남).
 *   시작프로그램 폴더는 관리자 권한 없이 로그인 때마다 뜬다.
 *
 * 돌리는 것 (작업 스케줄러에 걸려 있던 것 그대로)
 *   heartbeat.mjs        매시 — 회사 루프가 오래 안 돌았으면 GitHub 에 돌려 달라고 한다
 *   local-agent.mjs      12:40 · 19:10 — 네이버 이관 · 구글 색인 요청
 *   ai-web-measure.mjs   10:00 · 16:00, PC 가 켜져 있을 때 — ChatGPT·Gemini·퍼플렉시티 화면 측정
 *                        16:00 은 그날 못 잰 문항만 잰다(Step 39b). 옛 21:30 작업이 우연히 메워 주던 자리 — 10-06 Gemini 「답 없음」 멈춤
 * 시각을 놓치면(PC 가 켜져 있었으면) 켜진 뒤 그날 안에 한 번 따라잡는다. 한 번에 하나씩만 돌린다.
 * 종료코드 3 = 건너뜀(다른 실행이 돌고 있음) — 성공으로 적지 않는다.
 *
 * 따로 도는 것: login-poll.mjs 매분(LOGIN_POLL_HOURS 안에서만, 빈 값 = 끔) — 현황판 「로그인 창 열기」를 집는다.
 *   위 줄(busy)과 따로 돈다. 측정 180분 사이에 끼우면 2분 안에 창을 못 띄운다
 *
 *   node pc-runner.mjs                일꾼으로 뜬다 (이미 떠 있으면 조용히 끝난다)
 *   node pc-runner.mjs --install      시작프로그램에 등록하고 옛 작업 스케줄러 셋을 끈다. 지금 바로 띄운다
 *   node pc-runner.mjs --disable-old  옛 작업 스케줄러 셋만 끈다 — 끈 뒤 상태를 다시 읽어 적는다. 못 끄면 관리자 PowerShell 한 줄
 *   node pc-runner.mjs --status       마지막 실행 기록
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(HERE, ".pc-runner.lock");
const STATE = path.join(HERE, ".pc-runner-state.json");
const LOG = path.join(HERE, "pc-runner.log");
const ENV = path.join(HERE, "../academy/.env.local");
const NODE = process.execPath;

const JOBS = [
  { id: "heartbeat", script: "heartbeat.mjs", everyMin: 60, limitMin: 5 },
  // 90분(Step 36): 평소 1~9분(pc-runner.log 9/29~10/2). 색인 고객이 둘이 되며 구글 20분·빙 10분 상한이 고객마다 붙어
  // 구글·빙만 상한 60분이다. 60분 한도면 둘 다 막힌 날 블로그·Brave 몫이 안 남는다
  { id: "local-agent", script: "local-agent.mjs", at: ["12:40", "19:10"], limitMin: 90 },
  { id: "ai-web-measure", script: "ai-web-measure.mjs", at: ["10:00", "16:00"], limitMin: 180 },
];
// 끄기는 경로까지(루트 \) — 2026-10-06 실측: --install 의 Disable-ScheduledTask 뒤에도 셋 다 「준비」였다(출력을 버려 까닭을 못 남겼다)
const OLD_TASKS = ["\\Cited Heartbeat", "\\Cited Local Agent", "\\Cited AI Measure"];

const kst = (t = Date.now()) => new Date(t + 9 * 3600 * 1000);
const 오늘 = (t = Date.now()) => kst(t).toISOString().slice(0, 10);
/** 오늘 KST HH:MM 의 절대 시각(ms) */
const 오늘시각 = (hm, t = Date.now()) => Date.parse(`${오늘(t)}T${hm}:00+09:00`);

const 기록 = (s) => {
  const line = `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} ${s}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + "\n"); } catch {}
};

const 읽기 = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } };
const 쓰기 = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));

/** 지금 돌 차례인가 — 마지막으로 시작한 시각(last)과 비교 */
export function 차례(job, last, now = Date.now()) {
  if (job.everyMin) return !last || now - last >= job.everyMin * 60000;
  // 오늘 지난 시각 가운데 가장 늦은 것. 그 뒤에 한 번도 안 돌았으면 차례 (놓친 시각은 한 번만 따라잡는다)
  const passed = job.at.map((hm) => 오늘시각(hm, now)).filter((t) => t <= now);
  if (!passed.length) return false;
  return !last || last < Math.max(...passed);
}

/** 끝난 줄 — 종료코드 3 은 건너뜀(다른 실행이 돌고 있음). 성공처럼 「끝」으로 적지 않는다 */
export const 끝줄 = (id, code, 초) =>
  code === 3 ? `건너뜀 ${id} · 다른 실행이 돌고 있음 · 종료코드 3 · ${초}초` : `끝 ${id} · 종료코드 ${code} · ${초}초`;

/**
 * LOGIN_POLL_HOURS — 「8-24」면 KST 8시부터 24시 전까지. 빈 값·모양이 틀리면 끔.
 * 매분 DB 를 깨우니(Neon 자동 잠듦 5분보다 짧다) 요금제를 확인하기 전엔 빈 값으로 둔다(Step 39b escalate)
 */
export function 시간창안(spec, now = Date.now()) {
  const m = /^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/.exec(String(spec ?? ""));
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  if (!(a >= 0 && b <= 24 && a < b)) return false;
  const h = kst(now).getUTCHours();
  return h >= a && h < b;
}

/** academy/.env.local 의 한 값 — 매분 다시 읽는다(값을 바꾸면 일꾼을 다시 안 띄워도 먹는다) */
const 환경값 = (key) => {
  try {
    for (const l of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z_]+)=(.*)$/.exec(l);
      if (m && m[1] === key) return m[2].trim();
    }
  } catch {}
  return "";
};

function 돌리기(job, args = []) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    if (!job.quiet) 기록(`시작 ${job.id}`);
    const c = spawn(NODE, [path.join(HERE, job.script), ...args], { cwd: HERE, windowsHide: true, stdio: "ignore" });
    const kill = setTimeout(() => { 기록(`${job.id} ${job.limitMin}분 넘어 멈춤`); c.kill(); }, job.limitMin * 60000);
    c.on("exit", (code) => {
      clearTimeout(kill);
      // 조용한 일(login-poll 매분)은 정상 끝을 안 적는다 — 무슨 일을 했으면 자기 로그(login-poll.log)에 적는다
      if (!job.quiet || code !== 0) 기록(끝줄(job.id, code, Math.round((Date.now() - t0) / 1000)));
      resolve(code);
    });
    c.on("error", (e) => { clearTimeout(kill); 기록(`${job.id} 못 띄움 — ${e.message}`); resolve(-1); });
  });
}

/**
 * 이미 떠 있는 일꾼이 있으면 true.
 * 일꾼은 매분 잠금 파일을 새로 쓴다. 5분 넘게 안 바뀐 잠금은 죽은 일꾼의 것으로 본다 —
 * 윈도는 pid 를 다시 쓰므로 pid 가 살아 있다는 것만으로는 일꾼이라는 뜻이 아니다.
 * 2026-09-30 13:34 에 일꾼이 꺼진 뒤 33시간 아무것도 안 돌았다(10/1 화면 측정 0건)
 */
function 떠있음() {
  try {
    const pid = Number(fs.readFileSync(LOCK, "utf8"));
    const 신선 = Date.now() - fs.statSync(LOCK).mtimeMs < 5 * 60000;
    if (pid && pid !== process.pid && 신선) { process.kill(pid, 0); return true; }
  } catch {}
  return false;
}

const LOGIN_JOB = { id: "login-poll", script: "login-poll.mjs", limitMin: 15, quiet: true };

async function 일꾼() {
  if (떠있음()) return;
  fs.writeFileSync(LOCK, String(process.pid));
  const 정리 = () => { try { if (Number(fs.readFileSync(LOCK, "utf8")) === process.pid) fs.unlinkSync(LOCK); } catch {} };
  process.on("exit", 정리);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
  const 창 = 환경값("LOGIN_POLL_HOURS");
  기록(`일꾼 시작 (pid ${process.pid}) · 로그인 창 집기 ${창 ? `LOGIN_POLL_HOURS=${창}` : "꺼짐(LOGIN_POLL_HOURS 빈 값)"}`);

  let busy = false;
  const tick = async () => {
    // 살아 있다는 표시 — 일이 돌고 있어도(busy) 매분 갱신한다
    try { fs.writeFileSync(LOCK, String(process.pid)); } catch {}
    if (busy) return;
    busy = true;
    try {
      for (const job of JOBS) {
        const st = 읽기();
        if (!차례(job, st[job.id]?.last)) continue;
        st[job.id] = { ...(st[job.id] ?? {}), last: Date.now() };
        쓰기(st);
        const code = await 돌리기(job);
        const s2 = 읽기();
        s2[job.id] = { ...(s2[job.id] ?? {}), code, end: Date.now() };
        쓰기(s2);
      }
    } finally { busy = false; }
  };

  // 로그인 창 집기 — busy 와 따로. 한 번에 하나(창이 12분까지 떠 있다)
  let loginBusy = false;
  const loginTick = async () => {
    if (loginBusy || !시간창안(환경값("LOGIN_POLL_HOURS"))) return;
    loginBusy = true;
    try { await 돌리기(LOGIN_JOB); } finally { loginBusy = false; }
  };

  await tick();
  setInterval(tick, 60_000);
  setInterval(loginTick, 60_000);
}

/** schtasks /query /fo csv /nh 한 줄 → 「끔」|「켜짐」|「모름」. 셋째 칸이 상태(사용 안 함·준비·실행 중 / Disabled·Ready·Running) */
export function 옛작업상태(csv) {
  const 첫줄 = String(csv ?? "").split(/\r?\n/).find((l) => l.trim()) ?? "";
  const 상태 = [...첫줄.matchAll(/"([^"]*)"/g)].map((m) => m[1])[2] ?? "";
  if (/사용\s*안\s*함|Disabled/i.test(상태)) return "끔";
  return 상태.trim() ? "켜짐" : "모름";
}

/** 일반 권한으로 못 끄면 원장이 관리자 PowerShell 에 붙일 한 줄 */
export const 관리자한줄 = (tasks) =>
  `Get-ScheduledTask -TaskPath '\\' -TaskName ${tasks.map((t) => `'${t.replace(/^\\/, "")}'`).join(",")} | Disable-ScheduledTask`;

const 한글 = (b) => (b && b.length ? new TextDecoder("euc-kr").decode(b) : "");

/** 옛 작업 셋 끄기 — 출력 원문과 끈 뒤 상태를 pc-runner.log 에 남긴다. 남은 작업 이름 목록을 돌려준다 */
function 옛작업끄기() {
  const 남음 = [];
  for (const t of OLD_TASKS) {
    const r = spawnSync("schtasks.exe", ["/change", "/tn", t, "/disable"], { windowsHide: true });
    const 원문 = `${한글(r.stdout)}${한글(r.stderr)}${r.error ? r.error.message : ""}`.replace(/\s+/g, " ").trim();
    const s = spawnSync("schtasks.exe", ["/query", "/tn", t, "/fo", "csv", "/nh"], { windowsHide: true });
    const 지금 = s.status === 0 ? 옛작업상태(한글(s.stdout)) : "없음";
    기록(`옛 작업 ${t}: 끄기 종료코드 ${r.status ?? "?"} · ${원문.slice(0, 200)} · 지금 ${지금}`);
    if (지금 === "켜짐" || 지금 === "모름") 남음.push(t);
  }
  if (남음.length) {
    console.log(`\n못 끈 작업 ${남음.length}개 — 관리자 PowerShell 에 이 한 줄을 붙여 주세요:\n${관리자한줄(남음)}`);
  }
  return 남음;
}

function 설치() {
  const startup = path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
    "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  const vbs = path.join(startup, "Cited PC Runner.vbs");
  // 창 없이 띄우고(0 = 숨김), 끝날 때까지 기다렸다가(True) 1분 뒤 다시 띄운다.
  // 일꾼이 꺼져도 로그인 전까지 아무도 안 띄워 33시간 멈췄다(2026-09-30~10-01). 이미 떠 있으면 새 일꾼은 바로 끝나고 1분 뒤 또 본다
  fs.writeFileSync(vbs,
    `Set sh = CreateObject("WScript.Shell")\r\nDo\r\n  sh.Run """${NODE}"" ""${path.join(HERE, "pc-runner.mjs")}""", 0, True\r\n  WScript.Sleep 60000\r\nLoop\r\n`);
  console.log(`시작프로그램 등록: ${vbs}`);
  옛작업끄기();
  if (떠있음()) { console.log("일꾼이 이미 떠 있습니다"); return; }
  spawn("wscript.exe", [vbs], { detached: true, stdio: "ignore" }).unref();
  console.log("일꾼을 띄웠습니다");
}

function 상태() {
  const st = 읽기();
  console.log(떠있음() ? "일꾼: 떠 있음" : "일꾼: 안 떠 있음");
  for (const j of JOBS) {
    const s = st[j.id];
    const f = (t) => (t ? new Date(t).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }) : "—");
    console.log(`  ${j.id.padEnd(15)} 마지막 시작 ${f(s?.last)} · 끝 ${f(s?.end)} · 종료코드 ${s?.code ?? "—"}${s?.code === 3 ? "(건너뜀)" : ""}`);
  }
  const 창 = 환경값("LOGIN_POLL_HOURS");
  console.log(`  로그인 창 집기  ${창 ? `LOGIN_POLL_HOURS=${창} · 지금 ${시간창안(창) ? "켜짐" : "시간 밖"}` : "꺼짐(LOGIN_POLL_HOURS 빈 값)"}`);
}

// 가져다 쓸 때(시험)는 돌지 않는다. 윈도 경로는 대소문자를 안 가린다(c: 와 C:) — 틀리면 일꾼이 조용히 아무것도 안 한다
if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()) {
  if (process.argv.includes("--install")) 설치();
  else if (process.argv.includes("--disable-old")) { if (옛작업끄기().length) process.exitCode = 1; }
  else if (process.argv.includes("--status")) 상태();
  else await 일꾼();
}
