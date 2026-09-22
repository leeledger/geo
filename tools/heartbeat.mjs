/**
 * 심장박동 — 회사 루프가 오래 안 돌았으면 GitHub 에 직접 돌려 달라고 한다.
 *
 * company.yml 은 「매시 23분」 예약인데, 2026-09-22 에 예약으로 실제 돈 건 세 번뿐이었다(08:23·14:10·19:06 KST).
 * GitHub 은 한가한 저장소의 예약 실행을 몇 시간씩 미루거나 건너뛴다. 새 현황판의 상태등이 이걸 「지연」으로 잡았다.
 * 원장 PC 작업 스케줄러가 한 시간마다 이 스크립트를 부르고, 70분 넘게 안 돌았으면 workflow_dispatch 한다.
 * GitHub 예약과 이 심장박동이 서로 메운다 — PC 가 꺼져 있으면 예약만, GitHub 이 게으르면 이쪽이.
 *
 *   node heartbeat.mjs              확인하고 필요하면 돌린다
 *   node heartbeat.mjs --install    작업 스케줄러에 매시 등록 (Cited Heartbeat)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = "leeledger/geo";
const 한계분 = 70;
const LOG = path.join(HERE, "heartbeat.log");
const 기록 = (s) => {
  const line = `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} ${s}`;
  console.log(line);
  fs.appendFileSync(LOG, line + "\n");
};

if (process.argv.includes("--install")) {
  // local-agent.mjs 와 같은 방식 — 경로의 & 가 cmd 에서 명령 구분자로 먹혀 schtasks /tr 을 안 쓴다
  const node = process.execPath.replace(/'/g, "''");
  const script = fileURLToPath(import.meta.url).replace(/'/g, "''");
  const ps = [
    `$a = New-ScheduledTaskAction -Execute '${node}' -Argument ('"' + '${script}' + '"') -WorkingDirectory '${HERE.replace(/'/g, "''")}'`,
    `$t = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(47) -RepetitionInterval (New-TimeSpan -Hours 1)`,
    `$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries`,
    `Register-ScheduledTask -TaskName 'Cited Heartbeat' -Action $a -Trigger $t -Settings $s -Description '사이티드 심장박동: 회사 루프가 70분 넘게 안 돌면 GitHub 에 실행 요청' -Force | Out-Null`,
    `Get-ScheduledTask -TaskName 'Cited Heartbeat' | Select-Object TaskName, State | Format-List`,
  ].join("; ");
  execFileSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    ["-NoProfile", "-Command", ps], { stdio: "inherit" });
  process.exit(0);
}

// gh 활성 계정이 codeis8520-ctrl 로 되돌아가는 일이 있다(CLAUDE.md 함정). 그 계정은 이 저장소 권한이 없다 —
// 전환하지 않고 leeledger 토큰을 이 호출에만 쥐여 준다
let 토큰 = "";
try { 토큰 = execFileSync("gh", ["auth", "token", "--user", "leeledger"], { encoding: "utf8", timeout: 20000, windowsHide: true }).trim(); } catch {}
const gh = (args) => execFileSync("gh", args, {
  encoding: "utf8", timeout: 60000, windowsHide: true,
  env: 토큰 ? { ...process.env, GH_TOKEN: 토큰 } : process.env,
});

try {
  // 진행 중인 실행이 있으면 건드리지 않는다(concurrency 로 줄 서지만 굳이 쌓지 않는다)
  const runs = JSON.parse(gh(["run", "list", "-R", REPO, "-w", "company.yml", "-L", "5", "--json", "status,createdAt"]));
  if (runs.some((r) => r.status !== "completed")) { 기록("회사 루프 도는 중 — 그대로 둠"); process.exit(0); }
  const 마지막 = runs.map((r) => Date.parse(r.createdAt)).sort((a, b) => b - a)[0];
  const 분 = 마지막 ? Math.round((Date.now() - 마지막) / 60000) : Infinity;
  if (분 < 한계분) { 기록(`회사 루프 ${분}분 전에 돎 — 괜찮음`); process.exit(0); }
  gh(["workflow", "run", "company.yml", "-R", REPO]);
  기록(`회사 루프 ${분 === Infinity ? "기록 없음" : `${분}분`} 동안 안 돎 → 실행 요청`);
} catch (e) {
  // gh 로그인이 풀렸거나 네트워크가 없으면 남기고 끝낸다. 감사관이 지연을 따로 잡는다
  기록(`실패 ${String(e.message).split("\n")[0].slice(0, 160)}`);
  process.exitCode = 1;
}
