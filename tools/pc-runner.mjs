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
 *   ai-web-measure.mjs   하루 한 번, 10:00 넘어 PC 가 켜져 있을 때 — ChatGPT·Gemini·퍼플렉시티 화면 측정
 *                        (21:30 으로 걸려 있었는데 그 시각엔 PC 가 꺼져 있기 쉽다. 측정은 몇 시든 하루 한 번이면 된다)
 * 시각을 놓치면(PC 가 꺼져 있었으면) 켜진 뒤 그날 안에 한 번 따라잡는다. 한 번에 하나씩만 돌린다.
 *
 *   node pc-runner.mjs              일꾼으로 뜬다 (이미 떠 있으면 조용히 끝난다)
 *   node pc-runner.mjs --install    시작프로그램에 등록하고 옛 작업 스케줄러 셋을 끈다. 지금 바로 띄운다
 *   node pc-runner.mjs --status     마지막 실행 기록
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(HERE, ".pc-runner.lock");
const STATE = path.join(HERE, ".pc-runner-state.json");
const LOG = path.join(HERE, "pc-runner.log");
const NODE = process.execPath;

const JOBS = [
  { id: "heartbeat", script: "heartbeat.mjs", everyMin: 60, limitMin: 5 },
  { id: "local-agent", script: "local-agent.mjs", at: ["12:40", "19:10"], limitMin: 60 },
  { id: "ai-web-measure", script: "ai-web-measure.mjs", at: ["10:00"], limitMin: 180 },
];
const OLD_TASKS = ["Cited Heartbeat", "Cited Local Agent", "Cited AI Measure"];

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
function 차례(job, last, now = Date.now()) {
  if (job.everyMin) return !last || now - last >= job.everyMin * 60000;
  // 오늘 지난 시각 가운데 가장 늦은 것. 그 뒤에 한 번도 안 돌았으면 차례 (놓친 시각은 한 번만 따라잡는다)
  const passed = job.at.map((hm) => 오늘시각(hm, now)).filter((t) => t <= now);
  if (!passed.length) return false;
  return !last || last < Math.max(...passed);
}

function 돌리기(job) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    기록(`시작 ${job.id}`);
    const c = spawn(NODE, [path.join(HERE, job.script)], { cwd: HERE, windowsHide: true, stdio: "ignore" });
    const kill = setTimeout(() => { 기록(`${job.id} ${job.limitMin}분 넘어 멈춤`); c.kill(); }, job.limitMin * 60000);
    c.on("exit", (code) => {
      clearTimeout(kill);
      기록(`끝 ${job.id} · 종료코드 ${code} · ${Math.round((Date.now() - t0) / 1000)}초`);
      resolve(code);
    });
    c.on("error", (e) => { clearTimeout(kill); 기록(`${job.id} 못 띄움 — ${e.message}`); resolve(-1); });
  });
}

/** 이미 떠 있는 일꾼이 있으면 true */
function 떠있음() {
  try {
    const pid = Number(fs.readFileSync(LOCK, "utf8"));
    if (pid && pid !== process.pid) { process.kill(pid, 0); return true; }
  } catch {}
  return false;
}

async function 일꾼() {
  if (떠있음()) return;
  fs.writeFileSync(LOCK, String(process.pid));
  const 정리 = () => { try { if (Number(fs.readFileSync(LOCK, "utf8")) === process.pid) fs.unlinkSync(LOCK); } catch {} };
  process.on("exit", 정리);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
  기록(`일꾼 시작 (pid ${process.pid})`);

  let busy = false;
  const tick = async () => {
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
  await tick();
  setInterval(tick, 60_000);
}

function 설치() {
  const startup = path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
    "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  const vbs = path.join(startup, "Cited PC Runner.vbs");
  // 창 없이 띄운다 (0 = 숨김, False = 기다리지 않음)
  fs.writeFileSync(vbs,
    `CreateObject("WScript.Shell").Run """${NODE}"" ""${path.join(HERE, "pc-runner.mjs")}""", 0, False\r\n`);
  console.log(`시작프로그램 등록: ${vbs}`);
  for (const t of OLD_TASKS) {
    try {
      execFileSync("powershell.exe", ["-NoProfile", "-Command", `Disable-ScheduledTask -TaskName '${t}' | Out-Null`], { stdio: "ignore" });
      console.log(`옛 작업 끔: ${t}`);
    } catch { console.log(`옛 작업 못 끔(없거나 권한): ${t}`); }
  }
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
    console.log(`  ${j.id.padEnd(15)} 마지막 시작 ${f(s?.last)} · 끝 ${f(s?.end)} · 종료코드 ${s?.code ?? "—"}`);
  }
}

if (process.argv.includes("--install")) 설치();
else if (process.argv.includes("--status")) 상태();
else await 일꾼();
