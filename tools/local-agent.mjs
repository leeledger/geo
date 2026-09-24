/**
 * 로컬 에이전트 — 로그인한 브라우저가 필요한 일을 원장 PC 에서 집어 간다.
 *
 * GitHub 러너에는 네이버·구글 로그인이 없다. 그래서 회사 루프(company.mjs)는 이런 일을
 * 「로컬 대기」로 올리고, 이 스크립트가 윈도 작업 스케줄러로 하루 두 번 돌며 처리한다.
 *
 *   naver-transfer  발행했는데 네이버에 없는 글을 옮긴다 (naver-blog-post.mjs)
 *   gsc-submit      구글 서치콘솔 색인 요청 (submit-gsc.mjs --all, 하루 한도 안에서)
 *
 * 로그인이 풀려 있으면 억지로 하지 않고 「사람 대기 · 로그인 필요」로 올린다.
 * 대시보드에 뜨고, 원장이 node tools/open-session.mjs 로 로그인하면 다음 실행부터 다시 돈다.
 *
 *   node tools/local-agent.mjs
 *   node tools/local-agent.mjs --install     작업 스케줄러에 등록 (매일 12:40 · 19:10)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(HERE, ".local-agent.lock");
const LOG = path.join(HERE, "local-agent.log");

const 기록 = (s) => {
  const line = `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} ${s}`;
  console.log(line);
  fs.appendFileSync(LOG, line + "\n");
};

if (process.argv.includes("--install")) {
  // PowerShell 로 등록한다. 경로의 & 가 cmd 에서 명령 구분자로 먹히므로 schtasks /tr 을 안 쓴다
  const node = process.execPath.replace(/'/g, "''");
  const script = fileURLToPath(import.meta.url).replace(/'/g, "''");
  const ps = [
    `$a = New-ScheduledTaskAction -Execute '${node}' -Argument ('"' + '${script}' + '"') -WorkingDirectory '${HERE.replace(/'/g, "''")}'`,
    `$t = @((New-ScheduledTaskTrigger -Daily -At 12:40), (New-ScheduledTaskTrigger -Daily -At 19:10))`,
    `$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries`,
    `Register-ScheduledTask -TaskName 'Cited Local Agent' -Action $a -Trigger $t -Settings $s -Description '사이티드 로컬 에이전트: 네이버 이관·구글 색인 요청' -Force | Out-Null`,
    `Get-ScheduledTask -TaskName 'Cited Local Agent' | Select-Object TaskName, State | Format-List`,
  ].join("; ");
  execFileSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-Command", ps], { stdio: "inherit" });
  process.exit(0);
}

// 두 번 겹쳐 돌면 같은 글을 네이버에 두 번 올린다
// wx 로 만들어야 둘이 동시에 「없음」을 보고 둘 다 들어가는 틈이 없다. 2시간 넘은 잠금은 죽은 실행의 흔적이다
if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs >= 2 * 3600 * 1000) fs.rmSync(LOCK, { force: true });
try { fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" }); }
catch {
  기록("이미 돌고 있습니다 — 건너뜀");
  process.exit(0);
}

for (const l of fs.readFileSync(path.join(HERE, "../academy/.env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
// 브라우저 작업이 몇 분씩 걸려 연결을 붙잡으면 Neon 이 끊는다. 쿼리마다 새로 연다
const q = async (s, p = []) => {
  const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  await c.connect();
  try { return (await c.query(s, p)).rows; } finally { await c.end().catch(() => {}); }
};

const 돌리기 = (file, args, timeoutMin) => {
  try {
    return { ok: true, out: execFileSync(process.execPath, [file, ...args], { cwd: HERE, encoding: "utf8", timeout: timeoutMin * 60000, maxBuffer: 20 * 1024 * 1024 }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}\n${e.message}` };
  }
};
const 끝 = (s, n = 300) => String(s).replace(/\s+/g, " ").trim().slice(-n);
const 활동 = (agent, action, ok, summary, taskId = null) =>
  q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id, run_url) values (1,$1,$2,$3,$4,$5,'local-agent')`,
    [agent, action, ok, String(summary).slice(0, 1000), taskId]).catch(() => {});
const 사람로그인 = (kind, what) =>
  q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
     values (1, 'deliver', 'human', $1, $2, $3, '사람 대기', 5, '{"sticky":true}'::jsonb)
     on conflict (client_id, dedupe_key) do update set status='사람 대기', updated_at=now()`,
    [`login-${kind}`, `${what} 로그인이 풀렸습니다`, `로컬 에이전트가 ${what} 일을 못 했습니다. PC 에서 node tools/open-session.mjs 를 실행해 로그인하면 다음 실행(12:40·19:10)부터 다시 돕니다.`]);
const 로그인됨 = (kind) =>
  q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now() where client_id=1 and dedupe_key=$1 and status='사람 대기'`, [`login-${kind}`]);

try {
  기록("시작");
  await 활동("deliver", "로컬 에이전트 출근", true, "네이버 이관·구글 색인 요청 확인");

  // ── 네이버 이관: 최근 2주 발행했는데 네이버에 없는 글 (정찰 신호와 같은 기준) + 발행 알림이 넘긴 글
  // 한 번이라도 발행 버튼까지 갔을 수 있는 글(시도 기록이 열려 있는 글)은 자동으로 다시 올리지 않는다 — 네이버에 두 벌이 된다
  const posts = await q(
    `select slug, title from academy.posts
      where client_id = 1 and published and naver_log_no is null
        and (published_at > now() - interval '14 days'
             or slug in (select payload->>'slug' from geo.agent_tasks where kind='naver-transfer' and status='로컬 대기'))
        and not exists (select 1 from geo.agent_tasks a where a.client_id = 1 and a.dedupe_key = 'naver-attempt-' || slug
                         and a.status not in ('완료', '닫힘'))
      order by published_at limit 3`);
  let 네이버막힘 = false;
  for (const p of posts) {
    기록(`네이버 이관: ${p.slug}`);
    // 시작 전에 시도를 남긴다. 발행 뒤에 프로세스가 죽어도 다음 실행이 같은 글을 또 올리지 않게
    const [attempt] = await q(
      `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
       values (1, 'deliver', 'naver-attempt', $1, $2, '로컬 에이전트가 네이버 이관을 시작했습니다.', '실행 중', 30, $3::jsonb)
       on conflict (client_id, dedupe_key) do update set status='실행 중', updated_at=now()
       returning id`,
      [`naver-attempt-${p.slug}`, `네이버 이관 시도: ${p.title}`, JSON.stringify({ sticky: true, slug: p.slug })]);
    const r = 돌리기("naver-blog-post.mjs", [p.slug], 15);
    const [after] = await q(`select naver_log_no from academy.posts where slug=$1`, [p.slug]);
    // 발행 버튼을 누르기 직전에 찍는 줄이 있으면 올라갔을 수 있다. 시간 초과도 어디서 죽었는지 모르니 같은 취급
    const 발행했을수도 = /발행 버튼을 누릅니다|ETIMEDOUT|timed out|SIGTERM/i.test(r.out);
    if (after?.naver_log_no) {
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now() where id=$1`, [attempt.id]);
    } else if (발행했을수도) {
      await q(`update geo.agent_tasks set status='사람 대기', updated_at=now(), last_error=$2 where id=$1`,
        [attempt.id, `네이버 블로그에 이 글이 올라갔는지 확인해 주세요. 올라갔으면 update academy.posts set naver_log_no='<번호>', naver_at=now() where slug='${p.slug}'; 안 올라갔으면 이 일감을 닫으면 다시 시도합니다. 출력: ${끝(r.out, 200)}`]);
    } else {
      // 발행 버튼 전에 멈춘 것(로그인·에디터 못 찾음 등)은 다시 해도 중복이 안 된다
      await q(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence=$2 where id=$1`, [attempt.id, `발행 전에 멈춤: ${끝(r.out, 200)}`]);
    }
    if (after?.naver_log_no) {
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n' || $2, 4000)
                where client_id=1 and kind='naver-transfer' and payload->>'slug' = $1 and status in ('로컬 대기','대기','실패')`,
        [p.slug, `로컬 에이전트 이관 완료 logNo=${after.naver_log_no}`]);
      await 활동("deliver", `네이버 이관: ${p.title}`, true, `logNo ${after.naver_log_no}`);
      await 로그인됨("naver");
    } else if (/로그인이 필요/.test(r.out)) {
      네이버막힘 = true;
      await 사람로그인("naver", "네이버 블로그");
      await 활동("deliver", "네이버 이관 멈춤", false, "로그인 필요");
      break;
    } else {
      await 활동("deliver", `네이버 이관 실패: ${p.title}`, false, 끝(r.out));
    }
  }
  if (!posts.length) 기록("네이버로 옮길 글 없음");

  // ── 플레이스 대표키워드: 원장(2026-09-24) 「플레이스에 올리는 것도 에이전트가」. 일감 payload {add, remove}
  for (const t of await q(`select id, title, payload from geo.agent_tasks where kind='place-keyword' and status='로컬 대기' order by priority, id`)) {
    const p = t.payload ?? {};
    const args = [...(p.add ? ["--add", p.add] : []), ...(p.remove ? ["--remove", p.remove] : [])];
    if (!args.length) continue;
    const r = 돌리기("smartplace-keyword.mjs", args, 5);
    if (/로그인이 안 돼 있습니다/.test(r.out)) { await 사람로그인("naver", "네이버"); await 활동("deliver", "플레이스 키워드 멈춤", false, "로그인 필요", t.id); break; }
    const 결과 = /KEYWORDS=(.*)/.exec(r.out)?.[1] ?? "";
    await q(`update geo.agent_tasks set status=$2, done_at=case when $2='완료' then now() else done_at end, updated_at=now(),
              attempts = attempts + case when $2='완료' then 0 else 1 end,
              evidence = left(evidence || E'\n' || $3, 4000) where id=$1`,
      [t.id, r.ok ? "완료" : "로컬 대기", r.ok ? `로컬 에이전트 저장 확인 · 지금 키워드 ${결과}` : `실패 ${끝(r.out, 160)}`]);
    await 활동("deliver", "플레이스 키워드", r.ok, r.ok ? `${p.add ?? ""}${p.remove ? ` (뺌 ${p.remove})` : ""} · ${결과}` : 끝(r.out, 200), t.id);
  }

  // ── 구글 색인 요청: 하루 한도가 있어 --all 이 남은 주소만 조금씩 넣는다
  const gscTasks = await q(`select id from geo.agent_tasks where kind='gsc-submit' and status='로컬 대기'`);
  const r = 돌리기("submit-gsc.mjs", ["--all"], 30);
  if (/로그인이 안 돼 있습니다/.test(r.out)) {
    await 사람로그인("google", "구글 서치콘솔");
    await 활동("deliver", "구글 색인 요청 멈춤", false, "로그인 필요");
  } else {
    const done = new Set(JSON.parse(fs.readFileSync(path.join(HERE, "gsc-done.json"), "utf8")));
    const waiting = await q(`select id, payload->>'url' url from geo.agent_tasks where kind='gsc-submit' and status='로컬 대기'`);
    let closed = 0;
    for (const t of waiting) {
      if (!done.has(t.url)) continue;
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n로컬 에이전트 색인 요청 완료', 4000) where id=$1`, [t.id]);
      closed++;
    }
    if (r.ok) await 로그인됨("google");
    await 활동("deliver", "구글 색인 요청", r.ok,`${끝(r.out, 200)} · 로컬 일감 ${closed}/${gscTasks.length} 완료`);
  }
  // ── 빙 주소 제출: 하루 100개 한도. 사이트맵에서 아직 안 낸 주소만 낸다(bing-done.json).
  // 사이트맵은 「Success」인데 Bingbot 이 47쪽 중 5쪽만 읽었다(2026-09-22) — 빙이 ChatGPT 검색·Copilot 의 색인이다
  const 빙 = 돌리기("bing-submit-urls.mjs", [], 10);
  if (/로그인이 풀렸습니다/.test(빙.out)) {
    await 사람로그인("microsoft", "빙 웹마스터");
    await 활동("deliver", "빙 주소 제출 멈춤", false, "로그인 필요");
  } else {
    await 활동("deliver", "빙 주소 제출", 빙.ok, 끝(빙.out, 200));
  }
  기록(`끝 (네이버 ${네이버막힘 ? "로그인 필요" : "정상"})`);
} catch (e) {
  기록(`실패 ${e.message}`);
  await 활동("deliver", "로컬 에이전트 실패", false, e.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(LOCK, { force: true });
}
