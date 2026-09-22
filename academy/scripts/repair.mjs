/**
 * 수리공 — 감사관이 「code」로 분류한 조사를 사람 없이 고쳐 합치고, 틀렸으면 스스로 되돌린다 (Step 10).
 *
 * 9/22 에 찾은 고장은 전부 사람 세션이 고쳤다. 감사관(audit.mjs)이 원인을 좁혀도 고치는 손이 없으면 일감만 쌓인다.
 * 다만 claude 가 쓴 코드를 그대로 main 에 넣으면 숫자를 파는 회사가 숫자를 망칠 수 있다. 그래서
 *   - 가드는 전부 이 스크립트가 claude 밖에서 검사한다 (브랜치 보호가 없다 — 무료 비공개 플랜, API 403)
 *   - 고친 것은 두 번째 claude(검토자)가 체크리스트로 본다. fail 이면 가지만 남기고 사람에게
 *   - 합친 뒤 해당 자동 작업을 바로 돌려 보고, 실패하거나 신호가 다시 뜨면 되돌린다. 7일에 두 번 되돌리면 멈춘다
 *   - claude 는 푸시·커밋을 못 한다. 셸도 없다. 토큰은 자식 환경에 없다 — 푸시는 claude 가 끝난 뒤 이 스크립트가 한다
 *
 *   node scripts/repair.mjs               확인(지난 수리) → 수리 1건 (REPAIR_ENABLED=1 일 때만 합친다)
 *   node scripts/repair.mjs --dry         가지·diff·검토까지만. main 은 안 건드린다 (가지는 푸시해 둔다)
 *   node scripts/repair.mjs --task 319    그 조사만
 *   node scripts/repair.mjs --revert-test 되돌리기를 시험 가지에서 실제로 해 본다 (main 무관)
 *   Actions 에서는 REPAIR_MODE(run|dry|revert-test)·REPAIR_TASK 로 받는다 — 입력을 셸에 끼워 넣지 않으려고
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { 클로드코드, 클로드코드있음, 클로드기록연결 } from "./claude-code.mjs";

const envFile = new URL("../.env.local", import.meta.url);
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const 인자 = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const MODE = process.argv.includes("--dry") ? "dry" : process.argv.includes("--revert-test") ? "revert-test" : (process.env.REPAIR_MODE || "run");
const TASK = (() => { const v = 인자("--task") ?? process.env.REPAIR_TASK; return v && /^\d+$/.test(v) ? Number(v) : null; })();
const 정수 = (v, d) => { const n = Number(v ?? d); return Number.isInteger(n) && n >= 0 ? n : d; };
const MAX_PER_DAY = 정수(process.env.REPAIR_MAX_PER_DAY, 1);
const ENABLED = process.env.REPAIR_ENABLED === "1";
const REPO = process.env.GITHUB_REPOSITORY || "leeledger/geo";
const TOKEN = process.env.GH_TOKEN;
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const HOUSE = 1;

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
클로드기록연결(q);

const KST = (d = new Date()) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
const 끝 = (s, n = 400) => String(s ?? "").replace(/\s+/g, " ").trim().slice(-n);
// 푸시 오류 문구에 토큰 든 주소가 섞여 로그·DB 로 가면 안 된다
const 가림 = (s) => (TOKEN ? String(s ?? "").split(TOKEN).join("***") : String(s ?? ""));
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────── git (이 스크립트만 만진다)
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024 }).trim();
const git시도 = (...args) => {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: 가림(`${r.stdout ?? ""}${r.stderr ?? ""}`).trim() };
};
// checkout 은 persist-credentials: false 라 .git/config 에 토큰이 없다. 푸시할 때만 주소에 싣는다
const 원격 = () => `https://x-access-token:${TOKEN}@github.com/${REPO}.git`;
const 푸시 = (refspec) => git시도("push", 원격(), refspec);
const 가져오기 = () => git시도("fetch", 원격(), "+refs/heads/main:refs/remotes/origin/main");
const 커밋 = (message) => git시도("-c", "user.name=repair-bot", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-q", "-m", message);

const gh = async (p, init = {}) => {
  const r = await fetch(`https://api.github.com/repos/${REPO}${p}`, {
    ...init, headers: { authorization: `Bearer ${TOKEN}`, accept: "application/vnd.github+json", ...(init.headers ?? {}) },
  }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
  if (r.status === 204) return {};
  return r.ok ? r.json() : { __error: `${r.status} ${끝(await r.text(), 200)}` };
};

// ─────────────────────────────────────────── 표
const ensure = async () => {
  await q(`create table if not exists geo.repairs (id bigserial primary key, task_id bigint, branch text, base_sha text, head_sha text,
    merge_sha text, files text[], lines int, review jsonb, checks jsonb, status text not null, verify_run_url text, reverted_sha text,
    note text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await q(`create table if not exists geo.settings (key text primary key, value text not null, updated_at timestamptz not null default now())`);
};
const 수리기록 = async (row) => {
  const [r] = await q(`insert into geo.repairs (task_id, branch, base_sha, head_sha, files, lines, review, checks, status, note)
    values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10) returning id`,
    [row.task_id, row.branch, row.base_sha, row.head_sha ?? null, row.files ?? [], row.lines ?? 0, JSON.stringify(row.review ?? null),
      JSON.stringify(row.checks ?? {}), row.status, 끝(row.note, 1000)]);
  return r.id;
};
const 수리갱신 = (id, patch) => q(`update geo.repairs set status=coalesce($2,status), merge_sha=coalesce($3,merge_sha), verify_run_url=coalesce($4,verify_run_url),
    reverted_sha=coalesce($5,reverted_sha), note=case when $6::text = '' then note else left(note || E'\n' || $6, 2000) end, updated_at=now() where id=$1`,
  [id, patch.status ?? null, patch.merge_sha ?? null, patch.verify ?? null, patch.reverted ?? null, 끝(patch.note, 600)]);
const 일감 = (id, status, patch = {}) => q(`update geo.agent_tasks set status=$2, updated_at=now(),
    evidence = case when $3::text = '' then evidence else left(evidence || E'\n' || $3, 4000) end,
    detail = case when $4::text = '' then detail else $4 end,
    payload = payload || $5::jsonb,
    done_at = case when $2 in ('완료','닫힘') then now() else done_at end where id=$1`,
  [id, status, patch.evidence ?? "", patch.detail ?? "", JSON.stringify(patch.payload ?? {})]);
const 활동 = (ok, summary, taskId = null) => q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id) values ($1,'repair','수리',$2,$3,$4)`,
  [HOUSE, ok, 끝(summary, 1000), taskId]).catch(() => {});

// ─────────────────────────────────────────── 가드 (claude 밖, 이 스크립트가 본다)
const 허용 = /^academy\/scripts\/[^/]+\.mjs$/;
// 숫자를 파는 스크립트·자기 자신·글 데이터는 사람이 고친다 (Arch 설계 Step 10)
const 금지 = [/^academy\/scripts\/(claude-code|audit|repair|verdict|case-report|pilot-report|report|insert-diagrams)\.mjs$/, /^academy\/scripts\/seed-post-/];
const 토큰모양 = /(sk-ant-[\w-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|xox[abpr]-[\w-]{10,}|AKIA[0-9A-Z]{16}|AIza[\w-]{30,}|postgres(?:ql)?:\/\/[^\s'"`]+@|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[\w-]{20,}\.[\w-]{20,})/;
const 비밀값들 = () => ["DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "LLM_PROXY_TOKEN", "LLM_PROXY_URL", "GEMINI_API_KEY", "GROQ_API_KEY"]
  .map((k) => process.env[k]).filter((v) => v && v.length >= 12);
const 한도 = { 파일: 3, 줄: 80 };

/** 바뀐 파일 목록 — 시작 전에 이미 있던 변경(로컬 작업 트리)은 뺀다 */
const 바뀜 = (before = new Set()) => git("status", "--porcelain", "-uall").split("\n").filter(Boolean)
  .map((l) => ({ code: l.slice(0, 2), file: l.slice(3).replace(/^"|"$/g, "") })).filter((x) => !before.has(x.file));

const 가드 = (base, files) => {
  const 문제 = [];
  const 결과 = { files: files.map((x) => x.file), 줄: 0 };
  if (!files.length) 문제.push("바뀐 것이 없다");
  for (const { code, file } of files) {
    if (!허용.test(file)) 문제.push(`허용 경로 밖: ${file}`);
    if (금지.some((r) => r.test(file))) 문제.push(`금지 파일: ${file}`);
    if (code.includes("D")) 문제.push(`지움: ${file}`);
  }
  if (files.length > 한도.파일) 문제.push(`파일 ${files.length}개 > ${한도.파일}`);
  const 비밀 = 비밀값들();
  for (const { file, code } of files) {
    if (!허용.test(file) || code.includes("D")) continue;
    const 새것 = code.includes("?");
    const diff = 새것 ? fs.readFileSync(path.join(ROOT, file), "utf8").split("\n").map((l) => `+${l}`).join("\n") : git("diff", "-U0", base, "--", file);
    const 추가 = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
    const 삭제 = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    결과.줄 += 추가.length + 삭제;
    if (추가.some((l) => 토큰모양.test(l)) || 추가.some((l) => 비밀.some((s) => l.includes(s)))) 문제.push(`토큰 모양 문자열: ${file}`);
    // 새 패키지 import 금지 — 상대 경로·node: 가 아닌 이름은 원래 그 파일에 있던 것만
    const 원래 = 새것 ? "" : git시도("show", `${base}:${file}`).out;
    for (const l of 추가) {
      for (const m of l.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g)) {
        const spec = m[1];
        if (spec.startsWith(".") || spec.startsWith("node:") || 원래.includes(`"${spec}"`) || 원래.includes(`'${spec}'`)) continue;
        문제.push(`새 패키지 import: ${spec} (${file})`);
      }
    }
    const 검사 = spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
    if (검사.status !== 0) 문제.push(`node --check 실패: ${file} ${끝(검사.stderr, 200)}`);
  }
  if (결과.줄 > 한도.줄) 문제.push(`바뀐 줄 ${결과.줄} > ${한도.줄}`);
  return { ...결과, 문제 };
};

/** 조사관이 준 재현 명령. --dry 를 실제로 지원하는 스크립트만 돌린다 — --dry 를 모르는 스크립트는 진짜로 일해 버린다 */
const 재현 = (cmd) => {
  const m = /^node (?:academy\/)?scripts\/([\w-]+)\.mjs((?: --?[\w-]+(?:[= ][\w.\/-]+)?)*)$/.exec(String(cmd ?? "").trim());
  if (!m || !/--dry\b/.test(m[2])) return null;
  const 파일 = path.join(ROOT, "academy", "scripts", `${m[1]}.mjs`);
  if (!fs.existsSync(파일) || !fs.readFileSync(파일, "utf8").includes('"--dry"')) return null;
  const r = spawnSync(process.execPath, [파일, ...m[2].trim().split(/\s+/)], { cwd: path.join(ROOT, "academy"), encoding: "utf8", timeout: 5 * 60 * 1000 });
  return { cmd: m[0], ok: r.status === 0, out: 끝(`${r.stdout}${r.stderr}`, 300) };
};

// ─────────────────────────────────────────── claude 두 자리
// 감사관과 같은 칸막이(저장소 안만 읽기, /proc·~/.claude·.env 거절). 수리공만 academy/scripts/*.mjs 를 고칠 수 있다.
// 셸(Bash)은 주지 않는다. `node --check /proc/self/environ` 은 문법 오류 메시지에 환경변수를 찍는다 — 검사는 이 스크립트가 한다
const 거절 = ["Read(//proc/**)", "Grep(//proc/**)", "Glob(//proc/**)", "Read(~/.claude/**)", "Grep(~/.claude/**)", "Glob(~/.claude/**)",
  "Read(**/.env*)", "Grep(**/.env*)", "Glob(**/.env*)", "Edit(**/.env*)", "Edit(./.github/**)", "Edit(./web/**)", "Edit(./academy/app/**)"];
const 비밀빼기 = ["DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN", "LLM_PROXY_TOKEN", "LLM_PROXY_URL", "GEMINI_API_KEY", "GROQ_API_KEY"];
const 수리칸 = {
  cwd: ROOT, tools: ["Read", "Grep", "Glob", "Edit"],
  allow: ["Read(./**)", "Grep(./**)", "Glob(./**)", "Edit(./academy/scripts/*.mjs)"],
  deny: [...거절, ...금지파일규칙()], envDrop: 비밀빼기,
  model: "sonnet", maxTurns: 30, timeoutMs: 15 * 60 * 1000, purpose: "repair",
  system: "너는 사이티드 수리공이다. 가장 작은 수정으로 원인을 고친다. 규칙과 출력 형식은 사용자 메시지 앞머리에 있다.",
};
const 검토칸 = {
  cwd: ROOT, tools: ["Read", "Grep", "Glob"], allow: ["Read(./**)", "Grep(./**)", "Glob(./**)"], deny: 거절, envDrop: 비밀빼기,
  model: "sonnet", maxTurns: 15, timeoutMs: 10 * 60 * 1000, purpose: "repair-review",
  system: "너는 사이티드 코드 검토자다. 고치지 않는다. 체크리스트로 판정한다. 규칙과 출력 형식은 사용자 메시지 앞머리에 있다.",
};
function 금지파일규칙() {
  return ["claude-code", "audit", "repair", "verdict", "case-report", "pilot-report", "report", "insert-diagrams"].map((n) => `Edit(./academy/scripts/${n}.mjs)`)
    .concat("Edit(./academy/scripts/seed-post-*)");
}

const JSON읽기 = (text) => {
  const m = /\{[\s\S]*\}/.exec(String(text).replace(/^```(json)?|```$/gm, ""));
  try { return JSON.parse(m?.[0] ?? ""); } catch { return null; }
};

const 수리지침 = (t) => [
  "아래 조사 결과가 가리키는 원인을 고친다. 고칠 수 있는 가장 작은 수정만 한다.",
  "",
  "규칙",
  "- academy/scripts/*.mjs 만 고친다. 다음은 손대지 않는다: claude-code.mjs · audit.mjs · repair.mjs · verdict.mjs · case-report.mjs · pilot-report.mjs · report.mjs · seed-post-* · insert-diagrams.mjs",
  "- 파일 3개 이하, 더하고 뺀 줄 합계 80줄 이하. 새 패키지를 import 하지 않는다. 새 파일을 만들지 않는다",
  "- 판정 기준(mentioned/cited 계산, 엔진끼리 섞지 않는 비교 규칙)을 바꾸지 않는다",
  "- 에러를 삼켜 성공처럼 보이게 하지 않는다. 근거 없이 「완료」를 찍지 않는다",
  "- 날짜·시각은 Asia/Seoul. 고객사 이름·지점·전화번호를 코드에 새로 쓰지 않는다. 비밀 값이나 토큰 모양 문자열을 쓰지 않는다",
  "- 저장소 말투를 따른다: 한국어 식별자·주석, 주석은 「왜」를 사건과 날짜로 적는다",
  "- 셸은 없다. 문법 검사·커밋·푸시는 스크립트가 한다. 고칠 수 없거나 금지 파일을 고쳐야 풀리면 아무것도 고치지 말고 이유를 적는다",
  "- 턴은 30번이 끝이다. Grep 으로 줄을 찾고 필요한 부분만 읽는다",
  "",
  '끝나면 JSON 하나만: {"요약":"무엇을 왜 — 한두 문장","파일":["academy/scripts/…"],"못고침":"고치지 못했으면 이유, 고쳤으면 빈 문자열"}',
  "",
  `조사 ${t.id}: ${t.title}`,
  "진단:",
  JSON.stringify(t.payload?.diagnosis ?? {}, null, 1),
  "facts:",
  JSON.stringify(t.payload?.facts ?? {}, null, 1),
].join("\n");

const 검토지침 = (t, diff, 요약) => [
  "아래 diff 는 자동 수리공이 만든 것이다. 조사 결과와 체크리스트로 판정한다. 저장소를 Read·Grep 으로 확인해도 된다.",
  "",
  "체크리스트 — 하나라도 문제면 fail",
  "1. 원인과 diff 가 맞나. 조사 결론이 말한 원인을 이 diff 가 실제로 고치나",
  "2. 판정 기준(mentioned/cited 계산, 엔진 비교 규칙)이 바뀌었나",
  "3. 에러를 삼켜 성공으로 보이게 했나",
  "4. 근거 없이 완료를 찍나",
  "5. 날짜·시각을 KST(Asia/Seoul)로 다루나",
  "6. 고객사 이름·지점·업종·전화가 새로 드러나나",
  "7. 새 비밀·환경변수를 쓰나",
  "8. 이 파일을 부르는 다른 곳이 깨지나 (Grep 으로 호출부를 본다)",
  "",
  '출력은 JSON 하나만: {"verdict":"pass|fail","must":["fail 이면 고칠 것"],"notes":"한두 문장","checks":{"1":"ok|문제: …","2":"…","3":"…","4":"…","5":"…","6":"…","7":"…","8":"…"}}',
  "",
  `조사 ${t.id}: ${t.title}`,
  "진단:",
  JSON.stringify(t.payload?.diagnosis ?? {}, null, 1),
  `수리공 요약: ${요약}`,
  "diff:",
  diff.slice(0, 30000),
].join("\n");

// ─────────────────────────────────────────── 되돌리기
/** 합친 커밋을 되돌려 그 가지에 푸시한다. 충돌이면 손대지 않고 실패로 돌려준다 */
const 되돌리기 = (sha, branch = "main") => {
  const f = git시도("fetch", 원격(), `+refs/heads/${branch}:refs/remotes/origin/${branch}`);
  if (!f.ok) return { ok: false, error: `fetch 실패 ${끝(f.out, 200)}` };
  git("checkout", "-q", "-B", `revert-${sha.slice(0, 7)}`, `origin/${branch}`);
  const r = git시도("-c", "user.name=repair-bot", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "revert", "--no-edit", sha);
  if (!r.ok) { git시도("revert", "--abort"); return { ok: false, error: `revert 충돌 ${끝(r.out, 200)}` }; }
  const p = 푸시(`HEAD:refs/heads/${branch}`);
  if (!p.ok) return { ok: false, error: `푸시 실패 ${끝(p.out, 200)}` };
  return { ok: true, sha: git("rev-parse", "HEAD") };
};

const 멈춤확인 = async () => {
  const [{ n }] = await q(`select count(*)::int n from geo.repairs where status='되돌림' and updated_at > now() - interval '7 days'`);
  if (n >= 2) {
    await q(`insert into geo.settings (key, value) values ('repair_paused', 'true') on conflict (key) do update set value='true', updated_at=now()`);
    await 활동(false, `7일에 되돌림 ${n}번 — 수리공 멈춤 (geo.settings repair_paused=true, 사람이 풀 때까지)`);
    console.log(`  ⛔ 7일에 되돌림 ${n}번 — 수리공을 멈춘다`);
  }
};

const 되돌리고기록 = async (rep, task, 이유) => {
  const r = 되돌리기(rep.merge_sha);
  if (!r.ok) {
    await 수리갱신(rep.id, { status: "되돌림 실패", note: `${KST()} ${이유} · ${r.error}` });
    await 일감(task.id, "사람 대기", { evidence: `${KST()} 자동 되돌리기 실패 — ${r.error}`, detail: `수리 ${rep.merge_sha.slice(0, 7)} 를 되돌려야 하는데 자동으로 못 했습니다(${이유}). git revert ${rep.merge_sha} 를 직접 합니다.` });
    await 활동(false, `되돌리기 실패 ${rep.merge_sha.slice(0, 7)} — ${r.error}`, task.id);
    return false;
  }
  await 수리갱신(rep.id, { status: "되돌림", reverted: r.sha, note: `${KST()} ${이유}` });
  await 일감(task.id, "사람 대기", { evidence: `${KST()} 수리 되돌림 ${r.sha.slice(0, 7)} — ${이유}`,
    detail: `자동 수리(${rep.branch})를 되돌렸습니다: ${이유}. 조사 진단과 가지 diff 를 보고 Claude 세션에서 고칩니다.` });
  await 활동(true, `되돌림 ${rep.merge_sha.slice(0, 7)} → ${r.sha.slice(0, 7)} · ${이유}`, task.id);
  console.log(`  ↩ 되돌림 ${rep.merge_sha.slice(0, 7)} → ${r.sha.slice(0, 7)} · ${이유}`);
  await 멈춤확인();
  return true;
};

// ─────────────────────────────────────────── 확인 실행
/** 바뀐 스크립트를 실제로 쓰는 자동 작업. 워크플로가 직접 부르거나, 그 스크립트를 부르는 스크립트를 워크플로가 부른다 */
const 확인작업 = (files) => {
  const wfDir = path.join(ROOT, ".github", "workflows");
  const wfs = fs.readdirSync(wfDir).filter((f) => f.endsWith(".yml") && f !== "repair.yml").map((f) => ({ f, text: fs.readFileSync(path.join(wfDir, f), "utf8") }));
  const scripts = fs.readdirSync(path.join(ROOT, "academy", "scripts")).filter((f) => f.endsWith(".mjs"));
  const 모음 = new Set();
  for (const file of files) {
    const base = path.basename(file);
    const 부르는곳 = [base, ...scripts.filter((s) => s !== base && new RegExp(`scripts/${base.replace(".", "\\.")}|\\./${base.replace(".", "\\.")}`)
      .test(fs.readFileSync(path.join(ROOT, "academy", "scripts", s), "utf8")))];
    for (const w of wfs) if (부르는곳.some((s) => w.text.includes(`scripts/${s}`))) 모음.add(w.f);
  }
  return [...모음];
};

const 돌려보기 = async (files) => {
  const 작업 = 확인작업(files);
  const 시각 = Date.now();
  const 띄움 = [];
  const 결과 = [];
  for (const wf of 작업) {
    const d = await gh(`/actions/workflows/${wf}/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main" }) });
    if (d.__error) 결과.push({ wf, ok: false, url: null, why: `dispatch 실패 ${d.__error}` });
    else 띄움.push(wf);
  }
  // 한꺼번에 띄우고 같이 기다린다. 25분 안에 안 끝나면 실패로 본다 — 모르는 것을 성공으로 치지 않는다
  const 끝난 = new Map();
  for (let i = 0; i < 75 && 끝난.size < 띄움.length; i++) {
    await 쉼(20000);
    for (const wf of 띄움) {
      if (끝난.has(wf)) continue;
      const l = await gh(`/actions/workflows/${wf}/runs?event=workflow_dispatch&per_page=5`);
      const run = (l.workflow_runs ?? []).find((r) => new Date(r.created_at).getTime() >= 시각 - 5000);
      if (run?.status === "completed") 끝난.set(wf, run);
    }
  }
  for (const wf of 띄움) {
    const run = 끝난.get(wf);
    결과.push({ wf, ok: run?.conclusion === "success", url: run?.html_url ?? null, why: run ? `completed ${run.conclusion}` : "25분 안에 안 끝남" });
  }
  return { 작업, 결과 };
};

// ─────────────────────────────────────────── 0. 지난 수리 확인 (재발이면 되돌린다)
const 지난수리확인 = async () => {
  const reps = await q(`select r.*, to_char(r.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') made from geo.repairs r where status='합침' order by id`);
  for (const rep of reps) {
    const [task] = await q(`select * from geo.agent_tasks where id=$1`, [rep.task_id]);
    if (!task) continue;
    const p = task.payload ?? {};
    const 합친때 = p.merged_at ?? rep.made;
    // 재발 = 수리 뒤 신호가 한 번 사라졌다가(absent_at) 다시 보임(seen_at). 계속 보이는 것은 재발이 아니다 — 크롤러·인용처럼 느린 지표는 하루에 안 움직인다
    if (p.absent_at && p.absent_at > 합친때 && p.seen_at && p.seen_at > p.absent_at) {
      await 되돌리고기록(rep, task, `같은 신호 재발 (사라짐 ${p.absent_at} → 다시 ${p.seen_at})`);
      continue;
    }
    if (task.status === "닫힘") {
      await 수리갱신(rep.id, { status: "확인됨", note: `${KST()} 감사관이 풀림을 확인해 조사를 닫음` });
      console.log(`  ✓ 수리 ${rep.id} 확인됨 — 조사 ${task.id} 닫힘`);
      continue;
    }
    const 지난날 = (Date.now() - new Date(rep.created_at)) / 86400000;
    if (지난날 > 7 && p.seen_at && p.seen_at > 합친때 && !(p.absent_at > 합친때)) {
      // 7일 내내 신호가 그대로면 이 수리는 원인을 못 짚었다. 코드는 멀쩡할 수 있으니 되돌리지 않고 사람에게
      await 수리갱신(rep.id, { status: "효과 없음", note: `${KST()} 7일 동안 신호가 그대로` });
      await 일감(task.id, "사람 대기", { evidence: `${KST()} 수리 뒤 7일 동안 신호가 그대로 — 효과 없음`,
        detail: `자동 수리(${rep.branch}, ${rep.merge_sha?.slice(0, 7)})가 신호를 못 없앴습니다. 되돌릴지·다른 원인인지 Claude 세션에서 봅니다.` });
    }
  }
};

// ─────────────────────────────────────────── 1. 수리 1건
const 오늘수리수 = async () => (await q(`select count(*)::int n from geo.repairs where status not in ('dry','revert-test')
  and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date`))[0].n;

const 수리 = async () => {
  const [{ value: 멈춤 } = {}] = await q(`select value from geo.settings where key='repair_paused'`);
  if (멈춤 === "true") { console.log("  수리공 멈춤 (geo.settings repair_paused=true) — 사람이 풀어야 한다"); return; }
  if (MODE === "run" && !ENABLED) { console.log("  REPAIR_ENABLED 가 1 이 아니다 — 합치지 않는다 (--dry 는 된다)"); return; }
  if (MODE === "run" && (await 오늘수리수()) >= MAX_PER_DAY) { console.log(`  오늘 수리 ${MAX_PER_DAY}건을 했다 — 내일`); return; }
  if (!클로드코드있음()) { console.log("  Claude Code 없음 — 건너뜀"); return; }
  const [t] = await q(`select * from geo.agent_tasks where kind='investigate' and status='수리 대기' and payload->'diagnosis'->>'분류' = 'code'
    ${TASK ? "and id=$1" : ""} order by priority, id limit 1`, TASK ? [TASK] : []);
  if (!t) { console.log(`  수리 대기 조사 없음${TASK ? ` (조사 ${TASK})` : ""}`); return; }
  console.log(`  ▶ 조사 ${t.id} ${t.title}`);

  // 조사관이 고칠 파일로 짚은 것이 금지 경로면 claude 를 부를 필요도 없다 — 워크플로·web·숫자 스크립트는 사람이 고친다
  const 짚은 = (t.payload?.diagnosis?.다음?.파일 ?? []).map((f) => String(f).replace(/^\.?\//, "").replace(/:\d+.*$/, ""));
  const 밖 = 짚은.filter((f) => !허용.test(f) || 금지.some((r) => r.test(f)));
  if (짚은.length && 밖.length === 짚은.length) {
    await 일감(t.id, "사람 대기", { evidence: `${KST()} 수리공이 고칠 수 없는 파일: ${밖.join(", ")}`,
      detail: `고칠 곳이 자동 수리 금지 경로입니다(${밖.join(", ")}). 워크플로·web·academy/app·숫자 스크립트는 Claude 세션에서 고칩니다.` });
    console.log(`  → 사람 대기: 금지 경로 ${밖.join(", ")}`);
    return;
  }

  const 전 = new Set(바뀜().map((x) => x.file));
  const 가지 = `auto/fix-${t.id}`;
  const 원래가지 = git("rev-parse", "--abbrev-ref", "HEAD");
  const f = 가져오기();
  if (!f.ok) throw new Error(`fetch 실패 ${f.out}`);
  const base = git("rev-parse", "origin/main");
  if (전.size) throw new Error(`작업 트리가 깨끗하지 않다 (${[...전].slice(0, 5).join(", ")}) — 가지를 만들지 않는다`);
  git("checkout", "-q", "-B", 가지, base);

  try {
    // 지난 --dry 가 같은 조사로 만든 가지가 검토를 통과했고 원격 머리가 그대로면 다시 부르지 않는다 (구독 한도를 아낀다)
    const [전번] = await q(`select * from geo.repairs where task_id=$1 and status='dry' and review->>'verdict'='pass'
      and created_at > now() - interval '3 days' order by id desc limit 1`, [t.id]);
    let 요약 = "", 검토 = null, head = null, 재사용 = false;
    if (MODE === "run" && 전번) {
      const g = git시도("fetch", 원격(), `+refs/heads/${전번.branch}:refs/remotes/origin/${전번.branch}`);
      if (g.ok && git("rev-parse", `origin/${전번.branch}`) === 전번.head_sha) {
        git("checkout", "-q", "-B", 가지, 전번.head_sha);
        const rb = git시도("-c", "user.name=repair-bot", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "rebase", base);
        if (!rb.ok) { git시도("rebase", "--abort"); throw new Error(`지난 가지를 main 위로 못 옮김 ${끝(rb.out, 200)}`); }
        git("reset", "-q", "--soft", base);
        git("reset", "-q");
        요약 = 전번.checks?.요약 ?? "";
        검토 = 전번.review;
        재사용 = true;
        console.log(`  지난 --dry 수리 ${전번.id} (${전번.head_sha.slice(0, 7)}, 검토 pass) 를 다시 씀`);
      }
    }
    if (!재사용) {
      const r = await 클로드코드(수리지침(t), { ...수리칸, taskId: t.id });
      if (r.한도) { console.log(`  한도 — 오늘은 건너뜀 (실패로 세지 않음): ${끝(r.error, 160)}`); return; }
      if (!r.ok) throw new Error(`수리 claude 실패: ${끝(r.error, 200)}`);
      if (r.거절.length) console.log(`  (수리공 권한 거절 ${r.거절.length}건: ${r.거절.map((d) => `${d.tool_name} ${d.tool_input?.file_path ?? d.tool_input?.path ?? ""}`).join(" · ")})`);
      const j = JSON읽기(r.text) ?? {};
      요약 = String(j.요약 ?? "").trim();
      if (j.못고침) {
        await 일감(t.id, "사람 대기", { evidence: `${KST()} 수리공이 못 고침 — ${끝(j.못고침, 300)}`, detail: `자동 수리가 못 고친 이유: ${j.못고침}` });
        await 수리기록({ task_id: t.id, branch: 가지, base_sha: base, status: "못 고침", note: j.못고침 });
        console.log(`  → 못 고침: ${끝(j.못고침, 200)}`);
        return;
      }
    }

    const files = 바뀜(전);
    const g = 가드(base, files);
    const 재현결과 = 재현(t.payload?.diagnosis?.재현);
    if (재현결과 && !재현결과.ok) g.문제.push(`재현 명령 실패: ${재현결과.cmd} ${재현결과.out}`);
    const diff = files.length ? git("diff", base, "--", ...files.map((x) => x.file)) : "";
    console.log(`  가드: 파일 ${g.files.length} · 줄 ${g.줄}${g.문제.length ? ` · 문제 ${g.문제.join(" / ")}` : " · 통과"}${재현결과 ? ` · 재현 ${재현결과.ok ? "0" : "실패"}` : ""}`);
    console.log(diff.split("\n").map((l) => `    ${l}`).join("\n"));
    if (g.문제.length) {
      await 수리기록({ task_id: t.id, branch: 가지, base_sha: base, files: g.files, lines: g.줄, checks: { ...g, 요약, 재현: 재현결과 }, status: "가드 걸림", note: g.문제.join(" / ") });
      await 일감(t.id, "사람 대기", { evidence: `${KST()} 자동 수리안이 가드에 걸림 — ${g.문제.join(" / ")}`, detail: `자동 수리안이 가드에 걸렸습니다: ${g.문제.join(" / ")}. Claude 세션에서 고칩니다.` });
      return;
    }

    if (!검토) {
      const rv = await 클로드코드(검토지침(t, diff, 요약), { ...검토칸, taskId: t.id });
      if (rv.한도) { console.log(`  한도 — 검토 못 함, 오늘은 건너뜀: ${끝(rv.error, 160)}`); return; }
      검토 = (rv.ok ? JSON읽기(rv.text) : null) ?? { verdict: "fail", must: [`검토 실패: ${끝(rv.error ?? rv.text, 200)}`] };
      if (!["pass", "fail"].includes(검토.verdict)) 검토 = { ...검토, verdict: "fail", must: [...(검토.must ?? []), "verdict 가 pass|fail 이 아님"] };
    }
    console.log(`  검토: ${검토.verdict}${검토.must?.length ? ` · must ${검토.must.join(" / ")}` : ""} · ${끝(검토.notes, 200)}`);

    // 가지에 커밋해 두고 푸시한다. 합치든 말든 무엇을 만들었는지 남긴다
    git("add", "--", ...g.files);
    const c = 커밋(`자동 수리안: ${끝(요약, 80) || `조사 ${t.id}`} (조사 ${t.id})\n\n검토 ${검토.verdict} — repair.mjs 가 만든 가지. main 에는 합친 커밋이 따로 간다`);
    if (!c.ok) throw new Error(`커밋 실패 ${c.out}`);
    head = git("rev-parse", "HEAD");
    const pb = 푸시(`+HEAD:refs/heads/${가지}`);
    console.log(`  가지 ${가지} ${head.slice(0, 7)} 푸시 ${pb.ok ? "됨" : `실패 ${끝(pb.out, 160)}`}`);
    const 행 = { task_id: t.id, branch: 가지, base_sha: base, head_sha: head, files: g.files, lines: g.줄, review: 검토, checks: { 문제: [], 요약, 재현: 재현결과, 재사용 } };

    if (MODE === "dry") {
      const id = await 수리기록({ ...행, status: "dry", note: `--dry: 가지만 푸시, main 무관` });
      console.log(`  --dry 끝 (수리 ${id}). main 은 그대로`);
      return;
    }
    if (검토.verdict !== "pass") {
      const id = await 수리기록({ ...행, status: "검토 불합격", note: (검토.must ?? []).join(" / ") });
      await 일감(t.id, "사람 대기", { evidence: `${KST()} 자동 수리안 검토 불합격 — ${(검토.must ?? []).join(" / ")}`,
        detail: `자동 수리안(가지 ${가지})이 검토에서 떨어졌습니다: ${(검토.must ?? []).join(" / ")}. 가지 diff 를 보고 Claude 세션에서 고칩니다.` });
      await 활동(false, `수리안 검토 불합격 (수리 ${id}) — ${(검토.must ?? []).join(" / ")}`, t.id);
      return;
    }
    const 작업 = 확인작업(g.files);
    if (!작업.length) {
      const id = await 수리기록({ ...행, status: "확인 불가", note: "이 파일을 쓰는 자동 작업이 없어 합친 뒤 확인할 수 없다" });
      await 일감(t.id, "사람 대기", { evidence: `${KST()} 수리안 검토 pass 지만 확인할 자동 작업이 없어 합치지 않음 (수리 ${id})`, detail: `가지 ${가지} 를 보고 사람이 합칩니다.` });
      return;
    }

    // main 에 합친다 — 한 커밋에 수리 + BUILD-LOG 「자동 수리」 항목. fast-forward 만, main 이 움직였으면 한 번만 다시 올린다
    const 합칠가지 = `${가지}-merge`;
    git("checkout", "-q", "-B", 합칠가지, base);
    git("checkout", head, "--", ...g.files);
    const 로그 = path.join(ROOT, "handoff", "BUILD-LOG.md");
    fs.appendFileSync(로그, [
      "", `### 자동 수리 — 조사 ${t.id} · ${KST()} KST`,
      `- 무엇: ${요약 || "(요약 없음)"}`,
      `- 왜: ${t.payload?.diagnosis?.결론 ?? t.title}`,
      `- 파일: ${g.files.join(", ")} (바뀐 줄 ${g.줄})`,
      `- 검토: ${검토.verdict} — ${끝(검토.notes, 300)}`,
      `- 가지: ${가지} (${head.slice(0, 7)}) · 확인 실행: ${작업.join(", ")} · 실패하거나 신호가 재발하면 repair.mjs 가 되돌린다`, "",
    ].join("\n"));
    git("add", "--", ...g.files, "handoff/BUILD-LOG.md");
    const mc = 커밋(`자동 수리: ${끝(요약, 72) || `조사 ${t.id}`}\n\n조사 ${t.id} (${t.payload?.rule ?? ""} ${t.payload?.subject ?? ""}) · 분류 code\n검토 pass — ${끝(검토.notes, 200)}\n가지 ${가지} ${head.slice(0, 7)} · repair.mjs`);
    if (!mc.ok) throw new Error(`합칠 커밋 실패 ${mc.out}`);
    let p = 푸시("HEAD:refs/heads/main");
    if (!p.ok) {
      가져오기();
      const rb = git시도("-c", "user.name=repair-bot", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "rebase", "origin/main");
      if (!rb.ok) {
        git시도("rebase", "--abort");
        const id = await 수리기록({ ...행, status: "포기", note: `main 이 움직였고 다시 올리다 충돌 ${끝(rb.out, 200)}` });
        await 일감(t.id, "사람 대기", { evidence: `${KST()} main 과 충돌해 합치기 포기 (수리 ${id})`, detail: `가지 ${가지} 를 사람이 합칩니다.` });
        return;
      }
      p = 푸시("HEAD:refs/heads/main");
    }
    if (!p.ok) throw new Error(`main 푸시 실패 ${끝(p.out, 200)}`);
    const merge = git("rev-parse", "HEAD");
    const id = await 수리기록({ ...행, status: "합침", note: `main ${merge.slice(0, 7)}` });
    await q(`update geo.repairs set merge_sha=$2 where id=$1`, [id, merge]);
    await 일감(t.id, "수리 확인", { evidence: `${KST()} 자동 수리 합침 ${merge.slice(0, 7)} (수리 ${id}) — 확인 실행 ${작업.join(", ")}`,
      payload: { merged_at: KST(), repair_id: Number(id) } });
    await 활동(true, `합침 ${merge.slice(0, 7)} · 조사 ${t.id} · ${끝(요약, 120)}`, t.id);
    console.log(`  ✓ main ${merge.slice(0, 7)} — 확인 실행: ${작업.join(", ")}`);

    // 합친 순간이 배포다(Actions 가 매번 checkout). 해당 자동 작업을 바로 돌려 본다 — GITHUB_TOKEN 푸시는 다른 워크플로를 안 깨우지만 dispatch 는 된다
    const v = await 돌려보기(g.files);
    const 실패 = v.결과.filter((x) => !x.ok);
    await 수리갱신(id, { verify: v.결과.map((x) => x.url).filter(Boolean).join(" "), note: v.결과.map((x) => `${x.wf} ${x.ok ? "성공" : `실패(${x.why})`}`).join(" · ") });
    for (const x of v.결과) console.log(`    ${x.ok ? "✓" : "✗"} ${x.wf} ${x.why} ${x.url ?? ""}`);
    if (실패.length) {
      const [rep] = await q(`select * from geo.repairs where id=$1`, [id]);
      await 되돌리고기록(rep, t, `확인 실행 실패: ${실패.map((x) => `${x.wf} ${x.why}`).join(", ")}`);
    }
  } finally {
    git시도("checkout", "-q", "-f", 원래가지 === "HEAD" ? base : 원래가지);
  }
};

// ─────────────────────────────────────────── 되돌리기 시험 (main 무관)
/** 시험 가지에 무해한 커밋을 올리고, 운영과 같은 되돌리기()로 되돌린 뒤 base 와 트리가 같은지 본다 */
const 되돌리기시험 = async () => {
  const f = 가져오기();
  if (!f.ok) throw new Error(`fetch 실패 ${f.out}`);
  const base = git("rev-parse", "origin/main");
  const 가지 = `auto/revert-test-${Date.now()}`;
  const 원래가지 = git("rev-parse", "--abbrev-ref", "HEAD");
  try {
    git("checkout", "-q", "-B", 가지, base);
    fs.appendFileSync(path.join(ROOT, "handoff", "BUILD-LOG.md"), `\n<!-- revert-test ${KST()} -->\n`);
    git("add", "handoff/BUILD-LOG.md");
    const c = 커밋(`되돌리기 시험 커밋 (${가지})`);
    if (!c.ok) throw new Error(c.out);
    const sha = git("rev-parse", "HEAD");
    const p = 푸시(`HEAD:refs/heads/${가지}`);
    if (!p.ok) throw new Error(`시험 가지 푸시 실패 ${p.out}`);
    console.log(`  시험 커밋 ${sha.slice(0, 7)} → ${가지}`);
    const r = 되돌리기(sha, 가지);
    if (!r.ok) throw new Error(`되돌리기 실패 ${r.error}`);
    const 차이 = git("diff", "--stat", base, r.sha);
    const 같음 = 차이 === "";
    console.log(`  ↩ 되돌림 ${r.sha.slice(0, 7)} · base 와 트리 ${같음 ? "같음 ✓" : `다름 ✗ ${차이}`}`);
    await 수리기록({ task_id: null, branch: 가지, base_sha: base, head_sha: r.sha, status: "revert-test", note: `시험 커밋 ${sha.slice(0, 7)} → 되돌림 ${r.sha.slice(0, 7)} · 트리 ${같음 ? "같음" : "다름"}` });
    const d = 푸시(`:refs/heads/${가지}`);
    console.log(`  시험 가지 지움 ${d.ok ? "됨" : `실패 ${끝(d.out, 120)}`}`);
    if (!같음) process.exitCode = 1;
  } finally {
    git시도("checkout", "-q", "-f", 원래가지 === "HEAD" ? base : 원래가지);
  }
};

try {
  console.log(`수리공 · ${KST()} KST · ${MODE}${TASK ? ` · 조사 ${TASK}` : ""}${MODE === "run" ? ` · REPAIR_ENABLED=${ENABLED ? 1 : 0}` : ""}`);
  if (!["run", "dry", "revert-test"].includes(MODE)) throw new Error(`모르는 모드 ${MODE}`);
  if (!TOKEN) throw new Error("GH_TOKEN 없음 — 푸시·확인 실행을 못 한다");
  await ensure();
  if (MODE === "revert-test") await 되돌리기시험();
  else {
    if (MODE === "run") await 지난수리확인();
    await 수리();
  }
} catch (e) {
  console.error("수리 실패", 가림(e.message));
  await 활동(false, `수리 실패: ${가림(e.message)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
