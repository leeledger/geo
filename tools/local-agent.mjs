/**
 * 로컬 에이전트 — 로그인한 브라우저가 필요한 일을 원장 PC 에서 집어 간다.
 *
 * GitHub 러너에는 네이버·구글 로그인이 없다. 그래서 회사 루프(company.mjs)는 이런 일을
 * 「로컬 대기」로 올리고, 이 스크립트가 윈도 작업 스케줄러로 하루 두 번 돌며 처리한다.
 *
 *   naver-transfer  발행했는데 네이버에 없는 글을 옮긴다 (naver-blog-post.mjs)
 *   gsc-submit      구글 서치콘솔 색인 요청 (submit-gsc.mjs --all, 하루 한도 안에서)
 *   brave-index-check  개선 루프가 넘긴 글이 Brave 색인에 있나 (brave-index-check.mjs). 없으면 제출 명령을 사람에게
 *   고객 블로그     원장이 현황판에서 확인한 바깥 글 블로그 초안을 그 고객 블로그에 (naver-blog-post.mjs --marketing, Step 35 D55)
 *   지식iN 질문     고객 프로필로 실제 최근 질문을 찾고(kin-find.mjs) 하나에 답 초안(marketing-draft.mjs --kin-question). 등록은 원장 (Step 41)
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
import { indexClients, loadClients } from "../academy/clients.mjs";
import { 빙미등록 } from "./bing-site.mjs";
import { CODE_SLUGS, 탐침읽기, 탐침저장 } from "../web/lib/client-core.mjs";
import { 답차례 } from "../web/lib/kin-core.mjs";

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
// 종료코드 3 = 건너뜀(다른 실행이 돌고 있음). 0 이면 pc-runner 로그에 성공처럼 찍혀 옛 작업 스케줄러와 겹친 걸 못 봤다(2026-10-06 12:40)
try { fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" }); }
catch {
  기록("이미 돌고 있습니다 — 건너뜀");
  process.exit(3);
}

/**
 * 현황판 「로그인 창 열기」 창(login-poll → open-session)이 떠 있으면 닫힐 때까지 기다린다 — 같은 프로필을 두 번 못 연다.
 * 자기 잠금을 먼저 쓰고 창 잠금을 본다(login-poll 은 반대 순서). 13분 넘은 창 잠금은 죽은 창의 흔적. 건너뛰지 않고 기다린다
 */
const OS_LOCK = path.join(HERE, ".open-session.lock");
const 창떠있음 = () => { try { return Date.now() - fs.statSync(OS_LOCK).mtimeMs < 13 * 60000; } catch { return false; } };
if (창떠있음()) {
  기록("로그인 창이 떠 있습니다 — 닫힐 때까지 기다림");
  const t0 = Date.now();
  // 처음 볼 때만 신선도로 거른다. 기다리는 동안은 파일이 있는 한 기다린다 — 그래야 13분 넘게 안 닫힌 창을 「안 닫힘」으로 안다
  while (fs.existsSync(OS_LOCK) && Date.now() - t0 < 13 * 60000) await new Promise((r) => setTimeout(r, 30_000));
  if (fs.existsSync(OS_LOCK)) {
    기록("로그인 창이 안 닫힘 — 건너뜀");
    fs.rmSync(LOCK, { force: true });
    process.exit(3);
  }
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

const 돌리기 = (file, args, timeoutMin, env = {}) => {
  try {
    return { ok: true, out: execFileSync(process.execPath, [file, ...args], { cwd: HERE, encoding: "utf8", timeout: timeoutMin * 60000, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, ...env } }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}\n${e.message}` };
  }
};
const 끝 = (s, n = 300) => String(s).replace(/\s+/g, " ").trim().slice(-n);
const KST = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
const 활동 = (agent, action, ok, summary, taskId = null, clientId = 1) =>
  q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id, run_url) values ($6,$1,$2,$3,$4,$5,'local-agent')`,
    [agent, action, ok, String(summary).slice(0, 1000), taskId, clientId]).catch(() => {});
const 사람로그인 = (kind, what) =>
  q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
     values (1, 'deliver', 'human', $1, $2, $3, '사람 대기', 5, '{"sticky":true}'::jsonb)
     on conflict (client_id, dedupe_key) do update set status='사람 대기', updated_at=now()`,
    [`login-${kind}`, `${what} 로그인이 풀렸습니다`, `로컬 에이전트가 ${what} 일을 못 했습니다. 현황판 「로그인 창 열기」를 누르거나 PC 에서 node tools/open-session.mjs 로 로그인하면 다음 실행(12:40·19:10)부터 다시 돕니다.`]);
const 로그인됨 = (kind) =>
  q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now() where client_id=1 and dedupe_key=$1 and status='사람 대기'`, [`login-${kind}`]);

try {
  기록("시작");
  // 코드 3곳 + DB 고객(Step 37). DB 를 못 읽으면 코드 3곳(stderr 한 줄)
  const 고객들 = await loadClients(q);
  await 활동("deliver", "로컬 에이전트 출근", true, "네이버 이관·구글 색인 요청 확인");

  // 세션이 손으로 옮긴 글은 naver_log_no 가 있어 아래 목록에서 빠진다. 그 글의 로컬 대기 이관 일감은 닫을 곳이 없어 여기서 닫는다(Step 40)
  const 이미있음 = await q(
    `update geo.agent_tasks t set status='완료', done_at=now(), updated_at=now(),
            evidence=left(t.evidence || E'\n' || $1 || ' 이미 네이버에 있음 logNo=' || p.naver_log_no, 4000)
       from academy.posts p
      where t.kind='naver-transfer' and t.status='로컬 대기' and p.client_id = t.client_id
        and p.slug = t.payload->>'slug' and p.naver_log_no is not null
      returning t.id`, [KST()]);
  if (이미있음.length) 기록(`네이버에 이미 있는 글의 이관 일감 ${이미있음.length}건 완료`);

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
      // 근거(logNo)를 같이 남긴다 — 빈 완료는 감사 R3 가 「근거 없는 완료」로 잡는다
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(coalesce(evidence, '') || E'\n' || $2, 4000) where id=$1`,
        [attempt.id, `${KST()} logNo=${after.naver_log_no}`]);
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

  /**
   * ── 고객 바깥 글 블로그(Step 35 D55). 원장이 현황판에서 「읽었어요」를 누른 블로그 초안만(note 「게시 승인」) — 발행 전 사실 확인은 사람 몫이다.
   * 지식iN·카페는 자동으로 올리지 않는다(스팸·계정 정지 위험). 학원 블로그 세션과 섞이지 않게 고객마다 따로 둔 프로필로.
   * 프로필이나 블로그 아이디가 없으면 로그인 일감 한 건(고객별 dedupe)만 올리고 건너뛴다. 중복 게시 막기는 학원 이관과 같은 시도 기록으로
   */
  // 코드 고객은 blogProfile 이 있으면, DB 고객은 바깥 글을 켜고(enabled) 블로그 아이디가 있을 때만
  for (const c of 고객들.filter((x) => x.출처 !== "코드" && x.marketing?.enabled && !x.marketing.blogId)) 기록(`${c.slug}: marketing.blogId 없음 — 블로그 건너뜀`);
  for (const c of 고객들.filter((x) => x.marketing?.blogProfile && (x.출처 === "코드" || (x.marketing.enabled && x.marketing.blogId)))) {
    const 대기 = await q(`select m.id, m.title from geo.marketing_posts m
        where m.client_id = $1 and m.channel = 'blog' and m.status = '초안' and m.note like '게시 승인%'
          and not exists (select 1 from geo.agent_tasks a where a.client_id = $1 and a.dedupe_key = 'marketing-attempt-' || m.id
                           and a.status not in ('완료', '닫힘'))
        order by m.id limit 1`, [c.id]).catch(() => []);
    if (!대기.length) continue;
    const 프로필 = path.join(HERE, c.marketing.blogProfile);
    const 아이디 = c.marketing.blogId ?? process.env[`NAVER_BLOG_ID_${c.slug.toUpperCase()}`];
    const 로그인일감 = (why) => q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
        values ($1, 'deliver', 'human', $2, $3, $4, '사람 대기', 5, '{"sticky":true}'::jsonb)
        on conflict (client_id, dedupe_key) do update set status='사람 대기', updated_at=now()`,
      [c.id, `login-naver-blog-${c.slug}`, `${c.name} 블로그 로그인 필요`,
        `${why} 현황판 「로그인 창 열기」를 누르거나 PC 에서 node tools/open-session.mjs --blog ${c.marketing.blogProfile} 로 ${c.name} 블로그 네이버 계정에 로그인하고, academy/.env.local 에 NAVER_BLOG_ID_${c.slug.toUpperCase()}=<블로그 아이디> 를 적어 주세요. 다음 실행(12:40·19:10)부터 확인한 블로그 초안을 올립니다.`]);
    if (!fs.existsSync(프로필) || !아이디) {
      await 로그인일감(!fs.existsSync(프로필) ? "블로그용 프로필이 아직 없습니다." : "블로그 아이디가 아직 없습니다.");
      await 활동("deliver", `${c.name} 블로그 멈춤`, false, "로그인 필요 — 프로필 또는 블로그 아이디 없음", null, c.id);
      continue;
    }
    const m = 대기[0];
    기록(`${c.name} 블로그: ${m.id} ${m.title}`);
    const [attempt] = await q(
      `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
       values ($1, 'deliver', 'marketing-attempt', $2, $3, '로컬 에이전트가 블로그 게시를 시작했습니다.', '실행 중', 30, $4::jsonb)
       on conflict (client_id, dedupe_key) do update set status='실행 중', updated_at=now()
       returning id`,
      [c.id, `marketing-attempt-${m.id}`, `${c.name} 블로그 게시 시도: ${m.title}`, JSON.stringify({ sticky: true, marketing_id: m.id })]);
    const r = 돌리기("naver-blog-post.mjs", ["--marketing", String(m.id), "--profile", 프로필], 15, { NAVER_BLOG_ID: 아이디 });
    const [after] = await q(`select status, posted_url from geo.marketing_posts where id = $1`, [m.id]);
    const 발행했을수도 = /발행 버튼을 누릅니다|ETIMEDOUT|timed out|SIGTERM/i.test(r.out);
    if (after?.status === "올림") {
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now() where id=$1`, [attempt.id]);
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now() where client_id=$1 and dedupe_key=$2 and status='사람 대기'`,
        [c.id, `login-naver-blog-${c.slug}`]);
      await 활동("deliver", `${c.name} 블로그 게시: ${m.title}`, true, after.posted_url, attempt.id, c.id);
    } else if (/로그인이 필요/.test(r.out)) {
      await q(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence='발행 전 멈춤: 로그인 필요' where id=$1`, [attempt.id]);
      await 로그인일감("네이버 로그인이 풀렸습니다.");
      await 활동("deliver", `${c.name} 블로그 멈춤`, false, "로그인 필요", attempt.id, c.id);
    } else if (발행했을수도) {
      await q(`update geo.agent_tasks set status='사람 대기', updated_at=now(), last_error=$2 where id=$1`,
        [attempt.id, `${c.name} 블로그에 이 글이 올라갔는지 확인해 주세요. 올라갔으면 update geo.marketing_posts set status='올림', posted_url='<주소>', posted_at=now() where id=${m.id}; 안 올라갔으면 이 일감을 닫으면 다시 시도합니다. 출력: ${끝(r.out, 200)}`]);
      await 활동("deliver", `${c.name} 블로그 게시 확인 필요`, false, 끝(r.out), attempt.id, c.id);
    } else {
      await q(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence=$2 where id=$1`, [attempt.id, `발행 전에 멈춤: ${끝(r.out, 200)}`]);
      await 활동("deliver", `${c.name} 블로그 게시 실패`, false, 끝(r.out), attempt.id, c.id);
    }
  }

  /**
   * ── 지식iN 실제 질문(Step 41 D70): marketing.kin 고객. 그날 첫 차례에만 kin-find(고객 프로필로 kin.naver.com 읽기),
   * 그다음 7일 안 후보 하나에 답 초안(하루 1건 — kin-core 답차례). 등록은 원장이 현황판 「이 질문에 답하기」 창에서 누른다.
   * 블로그 게시와 같은 프로필을 쓰니 그 뒤에 차례로 돈다(같은 프로필을 두 번 못 연다)
   */
  for (const c of 고객들.filter((x) => x.marketing?.kin && x.marketing.blogProfile)) {
    const 오늘 = KST().slice(0, 10);
    const [찾음] = await q(`select 1 from geo.agent_activity where client_id = $1 and run_url = 'kin-find'
        and (at at time zone 'Asia/Seoul')::date = $2::date limit 1`, [c.id, 오늘]);
    if (!찾음) {
      const r = 돌리기("kin-find.mjs", ["--client", c.slug], 15);
      기록(`${c.name} 지식iN 질문 찾기: ${끝(r.out, 160)}`);
      if (/로그인이 필요|캡차/.test(r.out)) continue;   // 일감·활동은 kin-find 가 남겼다
    }
    const 오늘글 = await q(`select kin_question_id from geo.marketing_posts where client_id = $1 and channel = 'jisikin' and created_on = $2::date`, [c.id, 오늘]).catch(() => []);
    const 후보들 = await q(`select id, asked_at::text, status from geo.kin_questions where client_id = $1 and status = '후보'`, [c.id]).catch(() => []);
    const 차례 = 답차례(오늘글, 후보들, 오늘);
    if (!차례.id) { 기록(`${c.name} 지식iN 답: ${차례.why}`); continue; }
    const r = 돌리기(path.join(HERE, "../academy/scripts/marketing-draft.mjs"), ["--client", c.slug, "--kin-question", String(차례.id)], 12);
    const [글] = await q(`select status from geo.marketing_posts where kin_question_id = $1 order by id desc limit 1`, [차례.id]).catch(() => []);
    await 활동("deliver", `${c.name} 지식iN 답 초안`, r.ok, `질문 #${차례.id} · ${글 ? `초안 ${글.status === "초안" ? "통과" : "관문 탈락"}` : "안 씀"} · ${끝(r.out, 200)}`, null, c.id);
  }

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

  // ── Brave 색인 확인: 개선 루프 자기 점검이 만든 일감(payload {slugs}). Brave 는 curl 을 막아 러너에서 못 본다.
  // 없는 글은 제출 명령을 남기고 사람에게 넘긴다 — 제출 버튼에 캡차가 있다. 우회하지 않는다
  // evidence 는 새 줄이 뒤에 붙는다. 넘치면 오래된 앞쪽을 버린다(right)
  const 날 = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  // 사람 대기(제출 요청)로 7일 넘은 일감은 다시 본다. 원장이 제출했는지 결과(색인에 들었나)로 알아챈다
  await q(`update geo.agent_tasks set status='로컬 대기', updated_at=now(),
            evidence = right(evidence || E'\n' || $1, 4000)
            where kind='brave-index-check' and status='사람 대기' and updated_at <= now() - interval '7 days'`,
    [`${날()} 사람 대기 7일 — 다시 확인`]);
  for (const t of await q(`select id, payload, attempts from geo.agent_tasks where kind='brave-index-check' and status='로컬 대기' order by priority, id`)) {
    const slugs = (t.payload?.slugs ?? []).filter((s) => /^[a-z0-9-]+$/.test(s));
    if (!slugs.length) continue;
    기록(`Brave 색인 확인: ${slugs.length}편`);
    const r = 돌리기("brave-index-check.mjs", slugs, 10);
    // 출력 한 줄이 「있음|없음|확인 불가  https://robotncoding.com/blog/<slug>」
    const 줄 = [...r.out.matchAll(/^(있음|없음|확인 불가)\s+(\S+)/gm)].map((m) => ({ 결과: m[1], url: m[2] }));
    if (줄.length !== slugs.length) {
      // 브라우저가 죽는 등 출력이 모자라면 다시 한다. 세 번째면 사람에게 — 실행마다 브라우저를 여는 걸 끝없이 되풀이하지 않는다
      const 사람 = t.attempts + 1 >= 3;
      await q(`update geo.agent_tasks set attempts = attempts + 1, updated_at=now(), last_error=$2,
                status = case when $3 then '사람 대기' else status end, detail = case when $3 then $4 else detail end where id=$1`,
        [t.id, `Brave 확인 출력이 모자랍니다 (${줄.length}/${slugs.length}): ${끝(r.out, 200)}`, 사람,
          `Brave 확인이 3번 실패했습니다. 원장 PC 에서 node tools/brave-index-check.mjs ${slugs.join(" ")} 로 직접 확인해 주세요.`]);
      await 활동("deliver", "Brave 색인 확인 실패", false, 끝(r.out, 200), t.id);
      continue;
    }
    // 캡차·빈 화면은 없음이 아니다. 사람에게 제출을 시키지 않고 로컬 대기로 둔다 — 다음 실행이 다시 본다
    if (줄.some((x) => x.결과 === "확인 불가")) {
      await q(`update geo.agent_tasks set updated_at=now(), evidence = right(evidence || E'\n' || $2, 4000) where id=$1`,
        [t.id, `${날()} Brave 확인 불가 (캡차 또는 빈 화면) ${줄.filter((x) => x.결과 === "확인 불가").length}/${줄.length}편`]);
      await 활동("deliver", "Brave 색인 확인 불가", false, "캡차 또는 빈 화면 — 다음 실행에 다시", t.id);
      continue;
    }
    const 없음 = 줄.filter((x) => x.결과 === "없음").map((x) => x.url);
    const 요약 = `${날()} Brave 색인 ${줄.length - 없음.length}/${줄.length}편 있음`;
    if (없음.length) {
      await q(`update geo.agent_tasks set status='사람 대기', updated_at=now(), last_error='',
                detail=$2, evidence = right(evidence || E'\n' || $3, 4000) where id=$1`,
        [t.id, `Brave 색인에 없는 글 ${없음.length}편을 제출해 주세요. PC 에서 node tools/brave-submit.mjs ${없음.join(" ")} — 캡차는 창에서 직접 풉니다.`,
          `${요약} · 없음: ${없음.map((u) => u.replace(/^.*\/blog\//, "")).join(", ")}`]);
    } else {
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), last_error='',
                evidence = right(evidence || E'\n' || $2, 4000) where id=$1`,
        [t.id, `${요약} · Brave 에 다 있음 — 원인이 색인이 아니다`]);
    }
    await 활동("deliver", "Brave 색인 확인", true, `${요약}${없음.length ? ` · 제출 필요 ${없음.length}편` : ""}`, t.id);
  }

  // ── 구글 색인 요청: 하루 한도가 있어 --all 이 남은 주소만 조금씩 넣는다. gsc:true 고객을 학원 먼저 차례로(Step 36)
  // 고객당 20분 — 두 고객이 30분씩이면 pc-runner 한도(90분)를 블로그·Brave 와 나눠 쓰지 못한다
  // 회사 루프(company.mjs announce)는 글을 내는 고객 누구에게나 gsc-submit 을 만든다. gsc 없는 고객 것은 여기서 아무도 안 도니
  // 「로컬 대기」로 영영 남지 않게 해당 없음으로 닫는다
  const 해당없음 = await q(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(),
      evidence = left(evidence || E'\n해당 없음 — 이 고객은 PC 구글 색인 요청을 안 돈다(clients.mjs gsc 없음)', 4000)
      where kind='gsc-submit' and status='로컬 대기' and not (client_id = any($1::int[])) returning id, client_id`, [indexClients(고객들).map((c) => c.id)]);
  for (const t of 해당없음) await 활동("deliver", "구글 색인 요청 해당 없음", true, `gsc-submit 일감 #${t.id} 닫음 — gsc 없는 고객`, t.id, t.client_id);
  let 구글막힘 = false;
  for (const c of indexClients(고객들)) {
    const gscTasks = await q(`select id from geo.agent_tasks where client_id=$1 and kind='gsc-submit' and status='로컬 대기'`, [c.id]);
    const r = 돌리기("submit-gsc.mjs", ["--all", "--client", c.slug], 20);
    if (/로그인이 안 돼 있습니다/.test(r.out)) {
      // 구글 로그인은 고객이 같이 쓴다. 다음 고객도 같은 데서 막히니 여기서 멈춘다
      구글막힘 = true;
      await 사람로그인("google", "구글 서치콘솔");
      await 활동("deliver", "구글 색인 요청 멈춤", false, "로그인 필요", null, c.id);
      break;
    }
    const done = new Set(JSON.parse(fs.readFileSync(path.join(HERE, "gsc-done.json"), "utf8")));
    const waiting = await q(`select id, payload->>'url' url from geo.agent_tasks where client_id=$1 and kind='gsc-submit' and status='로컬 대기'`, [c.id]);
    let closed = 0;
    for (const t of waiting) {
      if (!done.has(t.url)) continue;
      await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n로컬 에이전트 색인 요청 완료', 4000) where id=$1`, [t.id]);
      closed++;
    }
    if (r.ok) await 로그인됨("google");
    await 활동("deliver", "구글 색인 요청", r.ok, `${c.name} · ${끝(r.out, 200)} · 로컬 일감 ${closed}/${gscTasks.length} 완료`, null, c.id);
  }
  /**
   * ── 서치콘솔 권한 탐침(Step 39c): 구글 색인을 원하는데(wantGsc) 아직 권한 표시가 없는(gsc 아님) DB 고객을 하루 한 번.
   * derived.gscAccess 에 화면 원문 앞부분을 남긴다. 「있음」일 때만 config.gsc = true. 판정 기준(원문 fixture)이 없으면 늘 「모름」
   * gsc 가 이미 true 인 고객(원장 「권한 받음」)은 안 본다 — 확인할 기준이 아직 없다
   */
  if (!구글막힘) {
    const 탐침대상 = await q(`select id, slug, name from geo.clients
        where status not in ('ended', 'test') and not (slug = any($1::text[]))
          and coalesce(config->'wantGsc', 'true'::jsonb) <> 'false'::jsonb and not coalesce(config->'gsc' = 'true'::jsonb, false)
          and coalesce(left(derived->'gscAccess'->>'at', 10), '') <> $2
        order by id`, [CODE_SLUGS, 날()]).catch((e) => { 기록(`권한 탐침 대상 못 읽음 ${e.message}`); return []; });
    for (const c of 탐침대상) {
      const r = 돌리기("gsc-access.mjs", ["--client", c.slug], 3);
      if (/로그인이 풀렸습니다/.test(r.out)) {
        await 사람로그인("google", "구글 서치콘솔");
        await 활동("deliver", "서치콘솔 권한 탐침 멈춤", false, "로그인 필요", null, c.id);
        break;
      }
      const 결과 = 탐침읽기(r.out);
      if (!결과) { await 활동("deliver", "서치콘솔 권한 탐침 실패", false, `${c.name} · ${끝(r.out, 200)}`, null, c.id); continue; }
      const 지금 = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
      await 탐침저장(q, c.id, 결과, 지금);
      await 활동("deliver", "서치콘솔 권한 탐침", true, `${c.name} · ${결과.state}${결과.state === "있음" ? " — config.gsc 켬" : ""}`, null, c.id);
    }
  }

  // ── 빙 주소 제출: 하루 100개 한도. 사이트맵에서 아직 안 낸 주소만 낸다(bing-done.json).
  // 사이트맵은 「Success」인데 Bingbot 이 47쪽 중 5쪽만 읽었다(2026-09-22) — 빙이 ChatGPT 검색·Copilot 의 색인이다
  for (const c of indexClients(고객들)) {
    const 빙 = 돌리기("bing-submit-urls.mjs", ["--client", c.slug], 10);
    if (/로그인이 풀렸습니다/.test(빙.out)) {
      await 사람로그인("microsoft", "빙 웹마스터");
      await 활동("deliver", "빙 주소 제출 멈춤", false, "로그인 필요", null, c.id);
      break;
    }
    const dedupe = `bing-site-${c.slug}`;
    if (빙.out.includes(빙미등록)) {
      // 사이트를 빙에 더하는 건 원장 동의 한 번이다(서치콘솔 가져오기). 같은 일감을 매번 새로 만들지 않는다
      await q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
               values ($1, 'deliver', 'human', $2, $3, $4, '사람 대기', 5, '{"sticky":true}'::jsonb)
               on conflict (client_id, dedupe_key) do update set status='사람 대기', updated_at=now()`,
        [c.id, dedupe, `빙 웹마스터에 ${c.name} 추가`, "구글 서치콘솔 가져오기 동의 한 번(node tools/bing-import.mjs 가 창을 엽니다)"]);
      await 활동("deliver", "빙 주소 제출 멈춤", false, `${c.name} 빙 웹마스터에 등록 안 됨 — 원장 일감`, null, c.id);
      continue;
    }
    // 제출이 실제로 된 날만 「등록돼 있다」로 본다. 버튼 못 찾음(exit 1) 같은 다른 실패에 일감을 닫으면 헛닫힘이다
    if (빙.ok) await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now() where client_id=$1 and dedupe_key=$2 and status='사람 대기'`, [c.id, dedupe]);
    await 활동("deliver", "빙 주소 제출", 빙.ok, `${c.name} · ${끝(빙.out, 200)}`, null, c.id);
  }
  기록(`끝 (네이버 ${네이버막힘 ? "로그인 필요" : "정상"})`);
} catch (e) {
  기록(`실패 ${e.message}`);
  await 활동("deliver", "로컬 에이전트 실패", false, e.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(LOCK, { force: true });
}
