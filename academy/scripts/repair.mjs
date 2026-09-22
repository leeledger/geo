/**
 * 수리공 — 감사관이 「code」로 분류한 조사를 가지에서 고치고, 검토받고, 합치고, 틀렸으면 되돌린다 (Step 10).
 *
 * 9/22 에 찾은 고장은 전부 사람 세션이 고쳤다. 감사관(audit.mjs)이 원인을 좁혀도 고치는 손이 없으면 일감만 쌓인다.
 * 다만 claude 가 쓴 코드를 그대로 main 에 넣으면 숫자를 파는 회사가 숫자를 망칠 수 있다. 그래서
 *   - 가드는 전부 이 스크립트가 claude 밖에서 검사한다 (브랜치 보호가 없다 — 무료 비공개 플랜, API 403)
 *   - 고친 것은 두 번째 claude(검토자)가 원래 신호 규칙의 조건까지 대조해 본다. fail 이면 가지만 남기고 사람에게
 *   - 견습: 처음 5건은 스스로 합치지 않는다. 가지·검토까지 하고 원장 승인(mode=merge)을 기다린다 (9/22 Arch 결정)
 *   - 합친 뒤 읽기 위주 자동 작업을 바로 돌려 보고, 실패하거나 신호가 재발하면 수리 파일만 되돌린다
 *   - 되돌리기가 한 번이라도 실패하거나 7일에 두 번 되돌리면 멈춘다
 *   - claude 는 푸시·커밋·셸을 못 한다. 토큰은 자식 환경에 없다 — 푸시는 claude 가 끝난 뒤 이 스크립트가 한다
 *
 *   node scripts/repair.mjs                확인(지난 수리) → 수리 1건 → 승인 대기 (견습이 끝났으면 합친다)
 *   node scripts/repair.mjs --dry          가지·diff·검토까지만. 승인 일감도 안 만든다
 *   node scripts/repair.mjs --merge --task 319  원장 승인 — 승인 대기 수리안을 다시 검사하고 합친다
 *   node scripts/repair.mjs --revert-test  되돌리기를 시험 가지에서 해 본다 (main 무관)
 *   node scripts/repair.mjs --guard-test   가드가 막아야 할 줄을 막는지 본다 (DB·claude 없음)
 *   Actions 에서는 REPAIR_MODE·REPAIR_TASK·REPAIR_EVENT 로 받는다 — 입력을 셸에 끼워 넣지 않으려고
 *
 * REPAIR_ENABLED=1 이 아니면: 정해진 시각 실행은 지난 수리 확인(되돌리기)만 한다. 사람이 띄운 run 은 승인 대기까지만 간다. merge 는 안 된다
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

const MODES = ["run", "dry", "merge", "revert-test", "guard-test"];
const MODE = MODES.find((m) => process.argv.includes(`--${m}`)) ?? (process.env.REPAIR_MODE || "run");
const 인자 = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const TASK = (() => { const v = 인자("--task") ?? process.env.REPAIR_TASK; return v && /^\d+$/.test(v) ? Number(v) : null; })();
// 빈 문자열도 기본값으로 — Actions 는 설정 안 한 변수를 "" 로 넘긴다. Number("") 는 0 이라 상한 0 이 됐다(9/22 첫 dry)
const 정수 = (v, d) => { if (v === undefined || v === null || String(v).trim() === "") return d; const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : d; };
const MAX_PER_DAY = 정수(process.env.REPAIR_MAX_PER_DAY, 1);
const ENABLED = process.env.REPAIR_ENABLED === "1";
// 사람이 띄운 실행인가 — dispatch 이면서 띄운 이가 봇이 아닐 때만. 회사 루프가 실패한 작업을 다시 띄우면 dispatch 로 보인다(Richard 9/22).
// 봇이 띄운 실행은 확인만 한다(수리 claude·승인 일감 없음, merge 거절). 정해진 시각 실행은 킬 스위치가 꺼져 있으면 확인만
const 띄운이 = String(process.env.REPAIR_ACTOR ?? "").trim();
const 손으로 = process.env.GITHUB_ACTIONS ? process.env.REPAIR_EVENT === "workflow_dispatch" && 띄운이 !== "" && !/\[bot\]$/.test(띄운이) : true;
const 정해진 = process.env.GITHUB_ACTIONS ? process.env.REPAIR_EVENT === "schedule" : false;
const REPO = process.env.GITHUB_REPOSITORY || "leeledger/geo";
const TOKEN = process.env.GH_TOKEN;
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const 로그파일 = path.join(ROOT, "handoff", "BUILD-LOG.md");
const HOUSE = 1;
const 시작시각 = Date.now();
const 잡분 = 정수(process.env.REPAIR_JOB_MINUTES, 75); // repair.yml timeout-minutes 와 맞춘다
const 견습건수 = 5;
// 합친 뒤 돌려 볼 수 있는 자동 작업 — 읽기 위주만. write(초안 작성)·optimize(측정·행동)는 돌리지 않는다 (9/22 Arch 결정)
const 확인가능 = new Set(["company.yml", "scout.yml", "audit.yml", "watch.yml"]);

const pool = MODE === "guard-test" ? null : (() => {
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  return new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
})();
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
if (pool) 클로드기록연결(q);

const KST = (d = new Date()) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
const 끝 = (s, n = 400) => String(s ?? "").replace(/\s+/g, " ").trim().slice(-n);
/** LLM 이 쓴 글을 기록에 넣을 때 — 한 줄로 접고 앞에서 자른다. BUILD-LOG 는 감사관·Arch 가 읽는 문맥이라 줄바꿈 주입을 남기지 않는다 */
const 한줄 = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").replace(/^#+/, "").trim().slice(0, n);
// 푸시 오류 문구에 토큰 든 주소가 섞여 로그·DB 로 가면 안 된다
const 가림 = (s) => (TOKEN ? String(s ?? "").split(TOKEN).join("***") : String(s ?? ""));
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 지난분 = () => (Date.now() - 시작시각) / 60000;

// ─────────────────────────────────────────── git (이 스크립트만 만진다)
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024 }).trim();
const git시도 = (...args) => {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: 가림(`${r.stdout ?? ""}${r.stderr ?? ""}`).trim() };
};
// checkout 은 persist-credentials: false 라 .git/config 에 토큰이 없다. 푸시할 때만 주소에 싣는다
const 원격 = () => `https://x-access-token:${TOKEN}@github.com/${REPO}.git`;
const 푸시 = (refspec) => git시도("push", 원격(), refspec);
const 가져오기 = (branch = "main") => {
  const f = git시도("fetch", 원격(), `+refs/heads/${branch}:refs/remotes/origin/${branch}`);
  if (!f.ok) throw new Error(`fetch 실패 (${branch}) ${끝(f.out, 200)}`);
  return git("rev-parse", `origin/${branch}`);
};
const 커밋 = (message) => git시도("-c", "user.name=repair-bot", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-q", "-m", message);
/** base 이후 main 에서 이 파일들이 바뀌었나 */
const 파일바뀜 = (from, to, files) => git("log", "--format=%h", `${from}..${to}`, "--", ...files);

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
  await q(`alter table geo.repairs add column if not exists approved boolean not null default false`);
  await q(`alter table geo.repairs add column if not exists merged_at timestamptz`);
  await q(`create table if not exists geo.settings (key text primary key, value text not null, updated_at timestamptz not null default now())`);
};
const 수리기록 = async (row) => {
  const [r] = await q(`insert into geo.repairs (task_id, branch, base_sha, head_sha, files, lines, review, checks, status, note)
    values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10) returning id`,
    [row.task_id, row.branch, row.base_sha, row.head_sha ?? null, row.files ?? [], row.lines ?? 0, JSON.stringify(row.review ?? null),
      JSON.stringify(row.checks ?? {}), row.status, 한줄(row.note, 1000)]);
  return r.id;
};
const 수리갱신 = (id, patch) => q(`update geo.repairs set status=coalesce($2,status), merge_sha=coalesce($3,merge_sha), verify_run_url=coalesce($4,verify_run_url),
    reverted_sha=coalesce($5,reverted_sha), note=case when $6::text = '' then note else left(note || E'\n' || $6, 2000) end,
    checks = checks || $7::jsonb, base_sha=coalesce($8,base_sha), approved = approved or $9,
    merged_at = case when $2 = '합침' then now() else merged_at end, updated_at=now() where id=$1`,
  [id, patch.status ?? null, patch.merge_sha ?? null, patch.verify ?? null, patch.reverted ?? null, 한줄(patch.note, 600),
    JSON.stringify(patch.checks ?? {}), patch.base ?? null, Boolean(patch.approved)]);
const 일감 = (id, status, patch = {}) => q(`update geo.agent_tasks set status=$2, updated_at=now(),
    evidence = case when $3::text = '' then evidence else left(evidence || E'\n' || $3, 4000) end,
    detail = case when $4::text = '' then detail else $4 end,
    payload = payload || $5::jsonb,
    done_at = case when $2 in ('완료','닫힘') then now() else done_at end where id=$1`,
  [id, status, patch.evidence ?? "", patch.detail ?? "", JSON.stringify(patch.payload ?? {})]);
const 활동 = (ok, summary, taskId = null) => q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id) values ($1,'repair','수리',$2,$3,$4)`,
  [HOUSE, ok, 한줄(summary, 1000), taskId]).catch(() => {});
const 멈추기 = async (이유) => {
  await q(`insert into geo.settings (key, value) values ('repair_paused', 'true') on conflict (key) do update set value='true', updated_at=now()`);
  await 활동(false, `수리공 멈춤 — ${이유} (geo.settings repair_paused=true, 사람이 풀 때까지)`);
  console.log(`  ⛔ 수리공 멈춤 — ${이유}`);
};

// ─────────────────────────────────────────── 가드 (claude 밖, 이 스크립트가 본다)
const 허용 = /^academy\/scripts\/[^/]+\.mjs$/;
// 숫자를 파는 스크립트·자기 자신·글 데이터는 사람이 고친다 (Arch 설계 Step 10)
const 금지 = [/^academy\/scripts\/(claude-code|audit|repair|verdict|case-report|pilot-report|report|insert-diagrams)\.mjs$/, /^academy\/scripts\/seed-post-/];
const 토큰모양 = /(sk-ant-[\w-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|xox[abpr]-[\w-]{10,}|AKIA[0-9A-Z]{16}|AIza[\w-]{30,}|postgres(?:ql)?:\/\/[^\s'"`]+@|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[\w-]{20,}\.[\w-]{20,})/;
const 비밀값들 = () => ["DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "LLM_PROXY_TOKEN", "LLM_PROXY_URL", "GEMINI_API_KEY", "GROQ_API_KEY"]
  .map((k) => process.env[k]).filter((v) => v && v.length >= 12);
const 한도 = { 파일: 3, 줄: 80 };
const 위험모듈 = /^(?:node:)?(child_process|http|https|net|tls|dns|dgram|vm|worker_threads)$/;

/**
 * 추가된 줄에서 비밀이 밖으로 나가는 길을 찾는다. 허용 스크립트는 워크플로에서 DB·GitHub·구독 토큰을 들고 돈다.
 * 수리공과 검토자는 같은 진단(LLM 출력)을 읽으니 같은 주입에 함께 넘어갈 수 있다 — 여기서 결정적으로 막는다(Richard 9/22)
 * 원래 = 그 파일의 base 내용. 원래 있던 것은 새로 쓴 게 아니다
 */
const 줄검사 = (file, 추가, 원래) => {
  const 문제 = [];
  const 비밀 = 비밀값들();
  const 있던 = (s) => 원래.includes(s);
  for (const l of 추가) {
    if (토큰모양.test(l) || 비밀.some((s) => l.includes(s))) 문제.push(`토큰 모양 문자열 (${file})`);
    for (const m of l.matchAll(/process\.env\.([A-Za-z_]\w*)|process\.env\[\s*["'`]([A-Za-z_]\w*)["'`]\s*\]/g)) {
      const 이름 = m[1] ?? m[2];
      if (!new RegExp(`process\\.env(\\.${이름}\\b|\\[\\s*["'\`]${이름}["'\`])`).test(원래)) 문제.push(`새 환경변수 process.env.${이름} (${file})`);
    }
    if (/process\.env\[\s*[^"'`\s]/.test(l)) 문제.push(`환경변수 이름을 값으로 고름 (${file})`);
    // process["env"]·Reflect.get(process, …)·const { env } = process 는 위 검사를 비껴간다
    if (/\bprocess\s*\[/.test(l) || /Reflect\s*\.\s*\w+\s*\(\s*process\b/.test(l) || /\{[^}]*\benv\b[^}]*\}\s*=\s*process\b/.test(l)) 문제.push(`process 를 우회해 읽음 (${file})`);
    if (/\bprocess\.env\b(?!\s*[.[])/.test(l)) 문제.push(`process.env 를 통째로 씀 (${file})`);
    for (const m of l.matchAll(/https?:\/\/([^/\s'"`)]+)/g)) {
      const 호스트 = m[1];
      if (/[$+{]/.test(호스트)) 문제.push(`주소 호스트를 값으로 만듦 (${file})`);
      else if (!있던(`//${호스트}`)) 문제.push(`새 호스트 ${호스트} (${file})`);
    }
    for (const m of l.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g)) {
      const spec = m[1];
      const 원래있음 = 있던(`"${spec}"`) || 있던(`'${spec}'`);
      if (위험모듈.test(spec)) { if (!원래있음) 문제.push(`새 네트워크·프로세스 모듈 ${spec} (${file})`); }
      else if (!spec.startsWith(".") && !spec.startsWith("node:") && !원래있음) 문제.push(`새 패키지 ${spec} (${file})`);
    }
    if (/\beval\s*\(/.test(l) || /\bnew\s+Function\b/.test(l) || /(^|[^\w.])Function\s*\(/.test(l)) 문제.push(`eval·new Function (${file})`);
    if (/\bimport\s*\(\s*[^"'\s)]/.test(l) || /\brequire\s*\(\s*[^"'\s)]/.test(l)) 문제.push(`문자열 아닌 동적 import (${file})`);
    if (/process\.env/.test(l) && /\bfetch\s*\(|https?:\/\//.test(l)) 문제.push(`환경변수와 네트워크가 한 줄에 (${file})`);
  }
  return [...new Set(문제)];
};
/**
 * 문자열 검사로는 다 못 막는다 — fetch(row.url + k)·"https:" + "//…" 처럼 주소를 조립하면 호스트 검사를 비껴간다(Richard 9/22).
 * 네트워크·환경에 닿는 줄이 하나라도 있으면 견습이 끝나도 스스로 합치지 않는다. 승인으로는 합칠 수 있다
 */
const 사람봐야 = (추가) => 추가.some((l) => /\bfetch\s*\(|\brequest\s*\(|\.post\s*\(|\bprocess\b/.test(l));

/** 바뀐 파일 목록 — 시작 전에 이미 있던 변경(로컬 작업 트리)은 뺀다 */
// git() 은 출력을 trim 한다 — 첫 줄 앞의 공백(" M")이 날아가 파일 이름이 한 글자 잘린다. 여기선 날것을 쓴다
const 바뀜 = (before = new Set()) => execFileSync("git", ["-c", "core.quotepath=false", "status", "--porcelain", "-uall"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(Boolean)
  .map((l) => ({ code: l.slice(0, 2), file: l.slice(3).replace(/^"|"$/g, "") })).filter((x) => !before.has(x.file));

const 가드 = (base, files) => {
  const 문제 = [];
  const 결과 = { files: files.map((x) => x.file), 줄: 0, needs_owner: false };
  if (!files.length) 문제.push("바뀐 것이 없다");
  for (const { code, file } of files) {
    if (!허용.test(file)) 문제.push(`허용 경로 밖: ${file}`);
    if (금지.some((r) => r.test(file))) 문제.push(`금지 파일: ${file}`);
    if (code.includes("D")) 문제.push(`지움: ${file}`);
    if (code.includes("?")) 문제.push(`새 파일: ${file}`);
  }
  if (files.length > 한도.파일) 문제.push(`파일 ${files.length}개 > ${한도.파일}`);
  for (const { file, code } of files) {
    if (!허용.test(file) || code.includes("D") || code.includes("?")) continue;
    const diff = git("diff", "-U0", base, "--", file);
    const 추가 = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
    const 삭제 = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    결과.줄 += 추가.length + 삭제;
    문제.push(...줄검사(file, 추가, git시도("show", `${base}:${file}`).out));
    if (사람봐야(추가)) 결과.needs_owner = true;
    const 검사 = spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
    if (검사.status !== 0) 문제.push(`node --check 실패: ${file} ${끝(검사.stderr, 200)}`);
  }
  if (결과.줄 > 한도.줄) 문제.push(`바뀐 줄 ${결과.줄} > ${한도.줄}`);
  return { ...결과, 문제 };
};

// ─────────────────────────────────────────── claude 두 자리
// 감사관과 같은 칸막이(저장소 안만 읽기, /proc·~/.claude·.env·.git 거절). 수리공만 academy/scripts/*.mjs 를 고칠 수 있다.
// 셸(Bash)은 주지 않는다. `node --check /proc/self/environ` 은 문법 오류 메시지에 환경변수를 찍는다 — 검사는 이 스크립트가 한다.
// .git 도 막는다 — fetch 가 수리 claude 보다 먼저 돌고, 저장소 안(./**)이 다 열려 있어도 .git 을 읽을 이유는 없다
const 거절 = ["//proc/**", "~/.claude/**", "**/.env*", "./.git/**"].flatMap((p) => [`Read(${p})`, `Grep(${p})`, `Glob(${p})`])
  .concat("Edit(**/.env*)", "Edit(./.github/**)", "Edit(./web/**)", "Edit(./academy/app/**)", "Edit(./.git/**)");
const 비밀빼기 = ["DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN", "LLM_PROXY_TOKEN", "LLM_PROXY_URL", "GEMINI_API_KEY", "GROQ_API_KEY"];
const 금지편집 = ["claude-code", "audit", "repair", "verdict", "case-report", "pilot-report", "report", "insert-diagrams"].map((n) => `Edit(./academy/scripts/${n}.mjs)`)
  .concat("Edit(./academy/scripts/seed-post-*)");
// capRequired — 호출 수를 못 세면 부르지 않는다. 수리는 하루 상한 밖에서 돌면 안 된다
const 수리칸 = {
  cwd: ROOT, tools: ["Read", "Grep", "Glob", "Edit"],
  allow: ["Read(./**)", "Grep(./**)", "Glob(./**)", "Edit(./academy/scripts/*.mjs)"],
  deny: [...거절, ...금지편집], envDrop: 비밀빼기, capRequired: true,
  model: "sonnet", maxTurns: 30, timeoutMs: 15 * 60 * 1000, purpose: "repair",
  system: "너는 사이티드 수리공이다. 가장 작은 수정으로 원인을 고친다. 규칙과 출력 형식은 사용자 메시지 앞머리에 있다.",
};
const 검토칸 = {
  cwd: ROOT, tools: ["Read", "Grep", "Glob"], allow: ["Read(./**)", "Grep(./**)", "Glob(./**)"], deny: 거절, envDrop: 비밀빼기, capRequired: true,
  model: "sonnet", maxTurns: 15, timeoutMs: 10 * 60 * 1000, purpose: "repair-review",
  system: "너는 사이티드 코드 검토자다. 고치지 않는다. 체크리스트로 판정한다. 규칙과 출력 형식은 사용자 메시지 앞머리에 있다.",
};

const JSON읽기 = (text) => {
  const m = /\{[\s\S]*\}/.exec(String(text).replace(/^```(json)?|```$/gm, ""));
  try { return JSON.parse(m?.[0] ?? ""); } catch { return null; }
};

/** 원래 신호 규칙의 코드 원문 (audit.mjs 의 R1~R6 함수). 검토자가 임계값·제외 조건을 하나씩 대조한다 */
const 규칙원문 = (rule) => {
  if (!/^R[1-6]$/.test(String(rule))) return "(규칙 없음)";
  const src = fs.readFileSync(path.join(ROOT, "academy", "scripts", "audit.mjs"), "utf8");
  const i = src.indexOf(`const ${rule} = async`);
  if (i < 0) return "(규칙 원문을 못 찾음)";
  const j = src.indexOf("\n};\n", i);
  return src.slice(i, j < 0 ? i + 4000 : j + 3);
};

const 수리지침 = (t) => [
  "아래 조사 결과가 가리키는 원인을 고친다. 고칠 수 있는 가장 작은 수정만 한다.",
  "",
  "규칙",
  "- academy/scripts/*.mjs 만 고친다. 다음은 손대지 않는다: claude-code.mjs · audit.mjs · repair.mjs · verdict.mjs · case-report.mjs · pilot-report.mjs · report.mjs · seed-post-* · insert-diagrams.mjs",
  "- 파일 3개 이하, 더하고 뺀 줄 합계 80줄 이하. 새 파일을 만들지 않는다",
  "- 새 환경변수(process.env.X)·새 주소 호스트·새 패키지·child_process/http/https/net 같은 모듈·eval 을 쓰지 않는다. 스크립트가 가드에서 떨어뜨린다",
  "- 새 알림·일감을 만든다면 아래 「원래 신호 규칙」의 임계값·제외 조건을 빠짐없이 똑같이 쓴다",
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
  `원래 신호 규칙 (audit.mjs ${t.payload?.rule ?? ""}):`,
  규칙원문(t.payload?.rule),
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
  "7. 새 비밀·환경변수·네트워크 호출을 쓰나",
  "8. 이 파일을 부르는 다른 곳이 깨지나 (Grep 으로 호출부를 본다)",
  "9. diff 가 새 알림·일감·신호를 만들면, 아래 「원래 신호 규칙」의 임계값·제외 조건을 하나씩 대조해 checks.9 에 조건마다 「있음/없음」으로 적는다. 하나라도 없으면 fail",
  "",
  '출력은 JSON 하나만: {"verdict":"pass|fail","must":["fail 이면 고칠 것"],"notes":"한두 문장","checks":{"1":"ok|문제: …","2":"…","3":"…","4":"…","5":"…","6":"…","7":"…","8":"…","9":"조건별 있음/없음 또는 해당 없음"}}',
  "",
  `조사 ${t.id}: ${t.title}`,
  "진단:",
  JSON.stringify(t.payload?.diagnosis ?? {}, null, 1),
  `원래 신호 규칙 (audit.mjs ${t.payload?.rule ?? ""}):`,
  규칙원문(t.payload?.rule),
  `수리공 요약: ${한줄(요약, 400)}`,
  "diff:",
  diff.slice(0, 30000),
].join("\n");

const 검토받기 = async (t, diff, 요약) => {
  const rv = await 클로드코드(검토지침(t, diff, 요약), { ...검토칸, taskId: t.id });
  if (rv.한도) return { 한도: true, error: rv.error };
  let 검토 = (rv.ok ? JSON읽기(rv.text) : null) ?? { verdict: "fail", must: [`검토 실패: ${한줄(rv.error ?? rv.text, 200)}`] };
  if (!["pass", "fail"].includes(검토.verdict)) 검토 = { ...검토, verdict: "fail", must: [...(검토.must ?? []), "verdict 가 pass|fail 이 아님"] };
  return 검토;
};

// ─────────────────────────────────────────── 되돌리기
/**
 * 수리 파일만 합치기 전(merge_sha^) 모양으로 되돌린다. git revert 는 BUILD-LOG 끝 항목에서 거의 늘 충돌한다 —
 * BUILD-LOG 는 매일 누군가 끝에 덧붙인다(Richard 9/22). 그래서 BUILD-LOG 는 되돌리지 않고 「되돌림」 줄을 새로 붙인다.
 * 합친 뒤 같은 파일을 누가 또 고쳤으면 손대지 않는다(사람이 본다). main 이 움직여 푸시가 거절되면 한 번 더 한다
 */
const 되돌리기 = (rep, 이유, branch = "main") => {
  for (let 시도 = 0; 시도 < 2; 시도++) {
    const f = git시도("fetch", 원격(), `+refs/heads/${branch}:refs/remotes/origin/${branch}`);
    if (!f.ok) return { ok: false, error: `fetch 실패 ${끝(f.out, 200)}` };
    const tip = `origin/${branch}`;
    if (!git시도("merge-base", "--is-ancestor", rep.merge_sha, tip).ok) return { ok: false, 안합쳐짐: true, error: `합친 커밋 ${rep.merge_sha.slice(0, 7)} 이 ${branch} 에 없다` };
    const 이후 = 파일바뀜(rep.merge_sha, tip, rep.files);
    if (이후) return { ok: false, error: `합친 뒤 같은 파일이 또 바뀜 (${이후.split("\n").join(", ")}) — 사람이 되돌린다` };
    git("checkout", "-q", "-f", "-B", `revert-${rep.merge_sha.slice(0, 7)}`, tip);
    git("checkout", `${rep.merge_sha}^`, "--", ...rep.files);
    fs.appendFileSync(로그파일, `\n### 자동 수리 되돌림 — 수리 ${rep.id} · ${KST()} KST\n- ${한줄(이유, 300)} · 되돌린 파일: ${rep.files.join(", ")} (합친 커밋 ${rep.merge_sha.slice(0, 7)})\n`);
    git("add", "--", ...rep.files, "handoff/BUILD-LOG.md");
    const c = 커밋(`자동 수리 되돌림: 수리 ${rep.id} (${rep.merge_sha.slice(0, 7)})\n\n${한줄(이유, 200)}`);
    if (!c.ok) return { ok: false, error: `커밋 실패 ${끝(c.out, 200)}` };
    const p = 푸시(`HEAD:refs/heads/${branch}`);
    if (p.ok) return { ok: true, sha: git("rev-parse", "HEAD") };
    console.log(`  (되돌리기 푸시 거절 — main 이 움직였다. 한 번 더) ${끝(p.out, 120)}`);
  }
  return { ok: false, error: "되돌리기 푸시가 두 번 거절됨" };
};

const 되돌리고기록 = async (rep, task, 이유) => {
  const r = 되돌리기(rep, 이유);
  if (!r.ok && r.안합쳐짐) {
    // 푸시 전에 멈춘 「합치는 중」 — main 에 안 들어갔다. 되돌릴 것도 없다
    await 수리갱신(rep.id, { status: "포기", note: `${KST()} ${r.error}` });
    if (task) await 일감(task.id, "사람 대기", { evidence: `${KST()} 합치다 멈춤 — main 에 안 들어감 (수리 ${rep.id})`, detail: `자동 수리(${rep.branch})가 합치다 멈췄습니다. main 은 그대로입니다. 가지를 보고 다시 승인하거나 닫습니다.` });
    return false;
  }
  if (!r.ok) {
    await 수리갱신(rep.id, { status: "되돌림 실패", note: `${KST()} ${이유} · ${r.error}` });
    if (task) await 일감(task.id, "사람 대기", { evidence: `${KST()} 자동 되돌리기 실패 — ${r.error}`,
      detail: `수리 ${rep.merge_sha.slice(0, 7)} 를 되돌려야 하는데 자동으로 못 했습니다(${한줄(이유, 120)}). ${rep.files.join(", ")} 를 ${rep.merge_sha.slice(0, 7)}^ 모양으로 직접 되돌립니다.` });
    // 되돌려야 할 코드가 main 에 남았다. 그 위에 다음 수리를 얹지 않는다(Richard 9/22)
    await 멈추기(`되돌리기 실패 (수리 ${rep.id})`);
    return false;
  }
  await 수리갱신(rep.id, { status: "되돌림", reverted: r.sha, note: `${KST()} ${이유}` });
  if (task) await 일감(task.id, "사람 대기", { evidence: `${KST()} 수리 되돌림 ${r.sha.slice(0, 7)} — ${한줄(이유, 200)}`,
    detail: `자동 수리(${rep.branch})를 되돌렸습니다: ${한줄(이유, 200)}. 조사 진단과 가지 diff 를 보고 Claude 세션에서 고칩니다.` });
  await 활동(true, `되돌림 ${rep.merge_sha.slice(0, 7)} → ${r.sha.slice(0, 7)} · ${이유}`, task?.id);
  console.log(`  ↩ 되돌림 ${rep.merge_sha.slice(0, 7)} → ${r.sha.slice(0, 7)} · ${이유}`);
  const [{ n }] = await q(`select count(*)::int n from geo.repairs where status='되돌림' and updated_at > now() - interval '7 days'`);
  if (n >= 2) await 멈추기(`7일에 되돌림 ${n}번`);
  return true;
};

// ─────────────────────────────────────────── 확인 실행
/** 바뀐 스크립트를 실제로 쓰는 읽기 위주 자동 작업. 워크플로가 직접 부르거나, 그 스크립트를 부르는 스크립트를 워크플로가 부른다 */
const 확인작업 = (files) => {
  const wfDir = path.join(ROOT, ".github", "workflows");
  const wfs = fs.readdirSync(wfDir).filter((f) => 확인가능.has(f)).map((f) => ({ f, text: fs.readFileSync(path.join(wfDir, f), "utf8") }));
  const scripts = fs.readdirSync(path.join(ROOT, "academy", "scripts")).filter((f) => f.endsWith(".mjs"));
  const 모음 = new Set();
  for (const file of files) {
    const base = path.basename(file);
    const 이름 = base.replace(".", "\\.");
    const 부르는곳 = [base, ...scripts.filter((s) => s !== base && new RegExp(`scripts/${이름}|\\./${이름}`)
      .test(fs.readFileSync(path.join(ROOT, "academy", "scripts", s), "utf8")))];
    for (const w of wfs) if (부르는곳.some((s) => w.text.includes(`scripts/${s}`))) 모음.add(w.f);
  }
  return [...모음];
};

const 돌려보기 = async (작업) => {
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
  return 결과;
};

// ─────────────────────────────────────────── 0. 지난 수리 확인
/** 원장이 승인 일감을 닫았거나 완료 표시함 = 거절. 행은 「거절」, 조사는 사람 대기 — 같은 조사를 다시 자동 수리하지 않는다 */
const 거절처리 = async (rep, task, 상태) => {
  await 수리갱신(rep.id, { status: "거절", note: `${KST()} 승인 일감이 「${상태}」 — 원장 거절로 본다` });
  if (task) await 일감(task.id, "사람 대기", { evidence: `${KST()} 원장이 자동 수리안을 거절함 (수리 ${rep.id}) — 다시 자동 수리하지 않음`,
    detail: `자동 수리안(${rep.branch})을 거절했습니다. 이 조사는 더 자동으로 고치지 않습니다. Claude 세션에서 봅니다.` });
  await 활동(true, `수리안 거절 (수리 ${rep.id}, 승인 일감 ${상태})`, task?.id);
  console.log(`  ✗ 수리 ${rep.id} 거절 — 승인 일감 ${상태}`);
};

const 지난수리확인 = async () => {
  const 대기 = await q(`select r.*, a.status 승인상태 from geo.repairs r join geo.agent_tasks t on t.id = r.task_id
      left join geo.agent_tasks a on a.client_id = t.client_id and a.dedupe_key = 'repair-approve-' || r.task_id
    where r.status = '승인 대기'`);
  for (const rep of 대기) {
    if (rep.승인상태 === "사람 대기") continue;
    const [task] = await q(`select * from geo.agent_tasks where id=$1`, [rep.task_id]);
    await 거절처리(rep, task, rep.승인상태 ?? "승인 일감 없음");
  }
  const reps = await q(`select r.*, to_char(coalesce(r.merged_at, r.updated_at) at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') made,
      extract(epoch from now() - coalesce(r.merged_at, r.updated_at)) / 3600 as 시간 from geo.repairs r where status in ('합치는 중','합침') order by id`);
  for (const rep of reps) {
    const [task] = await q(`select * from geo.agent_tasks where id=$1`, [rep.task_id]);
    const p = task?.payload ?? {};
    // 잡이 합치다·확인하다 죽으면 확인 안 된 코드가 main 에 남는다. 1시간 넘게 이 상태면 확인 실패로 본다(Richard 9/22)
    if (rep.status === "합치는 중" && rep.시간 > 1) { await 되돌리고기록(rep, task, "합치는 중에 멈춤 — 1시간 넘게 확인 없음"); continue; }
    if (rep.status === "합침" && (rep.checks?.확인작업 ?? []).length && !rep.verify_run_url && rep.시간 > 1) {
      await 되돌리고기록(rep, task, "합친 뒤 확인 결과가 없다 — 1시간 넘음"); continue;
    }
    if (rep.status !== "합침" || !task) continue;
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
    if (rep.시간 > 24 * 7 && p.seen_at && p.seen_at > 합친때 && !(p.absent_at > 합친때)) {
      // 7일 내내 신호가 그대로면 이 수리는 원인을 못 짚었다. 코드는 멀쩡할 수 있으니 되돌리지 않고 사람에게
      await 수리갱신(rep.id, { status: "효과 없음", note: `${KST()} 7일 동안 신호가 그대로` });
      await 일감(task.id, "사람 대기", { evidence: `${KST()} 수리 뒤 7일 동안 신호가 그대로 — 효과 없음`,
        detail: `자동 수리(${rep.branch}, ${rep.merge_sha?.slice(0, 7)})가 신호를 못 없앴습니다. 되돌릴지·다른 원인인지 Claude 세션에서 봅니다.` });
    }
  }
};

// ─────────────────────────────────────────── 견습
/** 원장이 승인해 합친 수리 중 7일 동안 안 되돌려진 것이 5건 쌓이고, 되돌림·멈춤이 한 번도 없으면 스스로 합친다 (9/22 Arch 결정) */
const 무인허용 = async () => {
  const [{ n }] = await q(`select count(*)::int n from geo.repairs where approved and merge_sha is not null
    and status in ('합침','확인됨','효과 없음') and merged_at < now() - interval '7 days'`);
  const [{ r }] = await q(`select count(*)::int r from geo.repairs where status in ('되돌림','되돌림 실패')`);
  const [멈춤] = await q(`select value from geo.settings where key='repair_paused'`);
  const ok = n >= 견습건수 && r === 0 && 멈춤?.value !== "true";
  if (ok) {
    const [새로] = await q(`insert into geo.settings (key, value) values ('repair_auto', $1) on conflict (key) do nothing returning key`, [`unlocked ${KST()}`]);
    if (새로) await 활동(true, `견습 끝 — 승인해 합친 수리 ${n}건이 7일 동안 되돌림 없이 버팀. 이제 검토 pass 수리는 스스로 합친다`);
  }
  return { ok, n, r };
};

// ─────────────────────────────────────────── 1. 수리안 만들기 (가지·가드·검토)
const 오늘수리수 = async () => (await q(`select count(*)::int n from geo.repairs where status not in ('dry','dry 폐기','revert-test')
  and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date`))[0].n;

const 만들기 = async (t, base) => {
  const 가지 = `auto/fix-${t.id}`;
  git("checkout", "-q", "-f", "-B", 가지, base);
  const r = await 클로드코드(수리지침(t), { ...수리칸, taskId: t.id });
  if (r.한도) { console.log(`  한도 — 오늘은 건너뜀 (실패로 세지 않음): ${끝(r.error, 160)}`); return null; }
  if (r.거절.length) console.log(`  (수리공 권한 거절 ${r.거절.length}건: ${r.거절.map((d) => `${d.tool_name} ${d.tool_input?.file_path ?? d.tool_input?.path ?? ""}`).join(" · ")})`);
  if (!r.ok) {
    // 실패도 행을 남긴다 — 안 남기면 하루 1건에 안 잡혀 같은 날 몇 번이고 다시 부른다. 같은 조사에서 두 번이면 사람에게
    await 수리기록({ task_id: t.id, branch: 가지, base_sha: base, status: "실패", note: r.error });
    const [{ n }] = await q(`select count(*)::int n from geo.repairs where task_id=$1 and status='실패'`, [t.id]);
    if (n >= 2) await 일감(t.id, "사람 대기", { evidence: `${KST()} 수리 claude 가 ${n}번 실패 — ${한줄(r.error, 200)}`, detail: `자동 수리가 ${n}번 실패했습니다(${한줄(r.error, 120)}). Claude 세션에서 고칩니다.` });
    console.log(`  ✗ 수리 claude 실패 (${n}번째): ${끝(r.error, 200)}`);
    return null;
  }
  const j = JSON읽기(r.text) ?? {};
  const 요약 = 한줄(j.요약, 300);
  if (j.못고침) {
    await 일감(t.id, "사람 대기", { evidence: `${KST()} 수리공이 못 고침 — ${한줄(j.못고침, 300)}`, detail: `자동 수리가 못 고친 이유: ${한줄(j.못고침, 300)}` });
    await 수리기록({ task_id: t.id, branch: 가지, base_sha: base, status: "못 고침", note: j.못고침 });
    console.log(`  → 못 고침: ${한줄(j.못고침, 200)}`);
    return null;
  }
  const files = 바뀜();
  const g = 가드(base, files);
  const diff = files.length ? git("diff", base, "--", ...files.map((x) => x.file)) : "";
  console.log(`  가드: 파일 ${g.files.length} · 줄 ${g.줄}${g.문제.length ? ` · 문제 ${g.문제.join(" / ")}` : " · 통과"}`);
  console.log(diff.split("\n").map((l) => `    ${l}`).join("\n"));
  if (g.문제.length) {
    await 수리기록({ task_id: t.id, branch: 가지, base_sha: base, files: g.files, lines: g.줄, checks: { ...g, 요약 }, status: "가드 걸림", note: g.문제.join(" / ") });
    await 일감(t.id, "사람 대기", { evidence: `${KST()} 자동 수리안이 가드에 걸림 — ${g.문제.join(" / ")}`, detail: `자동 수리안이 가드에 걸렸습니다: ${g.문제.join(" / ")}. Claude 세션에서 고칩니다.` });
    return null;
  }
  const 검토 = await 검토받기(t, diff, 요약);
  if (검토.한도) { console.log(`  한도 — 검토 못 함, 오늘은 건너뜀: ${끝(검토.error, 160)}`); return null; }
  console.log(`  검토: ${검토.verdict}${검토.must?.length ? ` · must ${검토.must.join(" / ")}` : ""} · ${한줄(검토.notes, 200)}`);
  if (검토.checks?.["9"]) console.log(`  검토 9번: ${한줄(검토.checks["9"], 300)}`);
  // 가지에 커밋해 두고 푸시한다. 합치든 말든 무엇을 만들었는지 남긴다
  git("add", "--", ...g.files);
  const c = 커밋(`자동 수리안: ${한줄(요약, 72) || `조사 ${t.id}`} (조사 ${t.id})\n\n검토 ${검토.verdict} — repair.mjs 가 만든 가지. main 에는 합친 커밋이 따로 간다`);
  if (!c.ok) throw new Error(`커밋 실패 ${c.out}`);
  const head = git("rev-parse", "HEAD");
  const pb = 푸시(`+HEAD:refs/heads/${가지}`);
  console.log(`  가지 ${가지} ${head.slice(0, 7)} 푸시 ${pb.ok ? "됨" : `실패 ${끝(pb.out, 160)}`}`);
  if (!pb.ok) throw new Error(`가지 푸시 실패 ${끝(pb.out, 160)}`);
  return { 가지, base, head, files: g.files, 줄: g.줄, 요약, 검토, diff, needs_owner: g.needs_owner };
};

// ─────────────────────────────────────────── 2. 합치기
/**
 * base 위에 「수리 파일 + BUILD-LOG 항목」 한 커밋을 만들어 main 에 fast-forward 한다.
 * 푸시 전에 수리 행을 「합치는 중」과 merge_sha 로 먼저 쓴다 — 잡이 죽어도 다음 실행이 찾아 되돌린다.
 * main 이 움직였으면: 수리 파일이 그사이 안 바뀌었을 때만 새 main 위에 같은 파일로 다시 만든다(검토받은 diff 그대로). 바뀌었으면 포기
 */
const 합치기 = async (t, 안, repId, { approved }) => {
  const 작업 = 확인작업(안.files);
  // 합치고 확인을 끝낼 시간이 없으면 합치지 않는다 — 확인 없는 합침이 제일 나쁘다
  if (지난분() + (작업.length ? 30 : 5) > 잡분 - 5) {
    await 수리갱신(repId, { note: `${KST()} 남은 시간이 모자라 합치지 않음 (지난 ${지난분().toFixed(0)}분)` });
    console.log(`  시간이 모자라 합치지 않음 — 승인 대기로 둔다`);
    return false;
  }
  let base = 안.base;
  let merge = null;
  for (let 시도 = 0; 시도 < 2; 시도++) {
    git("checkout", "-q", "-f", "-B", `${안.가지}-merge`, base);
    git("checkout", 안.head, "--", ...안.files);
    fs.appendFileSync(로그파일, [
      "", `### 자동 수리 — 조사 ${t.id} · ${KST()} KST`,
      `- 무엇: ${한줄(안.요약, 200) || "(요약 없음)"}`,
      `- 왜: ${한줄(t.payload?.diagnosis?.결론 ?? t.title, 200)}`,
      `- 파일: ${안.files.join(", ")} (바뀐 줄 ${안.줄}) · 검토 ${안.검토.verdict} · ${approved ? "원장 승인" : "무인(견습 끝)"}`,
      `- 가지: ${안.가지} (${안.head.slice(0, 7)}) · 확인 실행: ${작업.join(", ") || "없음 — node --check 와 다음 정기 실행·감사에 맡김"}`, "",
    ].join("\n"));
    git("add", "--", ...안.files, "handoff/BUILD-LOG.md");
    const mc = 커밋(`자동 수리: ${한줄(안.요약, 72) || `조사 ${t.id}`}\n\n조사 ${t.id} (${t.payload?.rule ?? ""} ${t.payload?.subject ?? ""}) · 분류 code · 검토 ${안.검토.verdict}\n가지 ${안.가지} ${안.head.slice(0, 7)} · repair.mjs${approved ? " · 원장 승인" : ""}`);
    if (!mc.ok) throw new Error(`합칠 커밋 실패 ${mc.out}`);
    merge = git("rev-parse", "HEAD");
    await 수리갱신(repId, { status: "합치는 중", merge_sha: merge, base, approved, checks: { 확인작업: 작업 } });
    const p = 푸시("HEAD:refs/heads/main");
    if (p.ok) break;
    const 새main = 가져오기();
    if (파일바뀜(base, 새main, 안.files)) {
      await 수리갱신(repId, { status: "포기", note: `${KST()} 합치는 사이 main 이 같은 파일을 바꿈 — 검토받지 않은 병합을 올리지 않는다` });
      await 일감(t.id, "사람 대기", { evidence: `${KST()} main 이 같은 파일을 바꿔 합치기 포기 (수리 ${repId})`, detail: `가지 ${안.가지} 를 사람이 합칩니다.` });
      return false;
    }
    console.log(`  (main 푸시 거절 — main 이 움직였지만 수리 파일은 그대로. 새 main 위에 같은 파일로 다시 만든다)`);
    base = 새main;
    merge = null;
  }
  if (!merge) {
    await 수리갱신(repId, { status: "포기", note: `${KST()} main 푸시가 두 번 거절됨` });
    await 일감(t.id, "사람 대기", { evidence: `${KST()} main 푸시 두 번 거절 — 합치기 포기 (수리 ${repId})`, detail: `가지 ${안.가지} 를 사람이 합칩니다.` });
    return false;
  }
  await 수리갱신(repId, { status: "합침", note: `main ${merge.slice(0, 7)}`, verify: 작업.length ? null : "정기 실행에 맡김" });
  await 일감(t.id, "수리 확인", { evidence: `${KST()} 자동 수리 합침 ${merge.slice(0, 7)} (수리 ${repId})${approved ? " · 원장 승인" : ""}`,
    payload: { merged_at: KST(), repair_id: Number(repId) } });
  await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n' || $2, 4000)
    where client_id=$1 and dedupe_key=$3 and status='사람 대기'`, [t.client_id, `${KST()} 합침 ${merge.slice(0, 7)}`, `repair-approve-${t.id}`]);
  await 활동(true, `합침 ${merge.slice(0, 7)} · 조사 ${t.id} · ${한줄(안.요약, 120)}`, t.id);
  console.log(`  ✓ main ${merge.slice(0, 7)} — 확인 실행: ${작업.join(", ") || "없음(읽기 위주 작업이 이 파일을 안 씀 — 정기 실행·감사에 맡김)"}`);
  if (!작업.length) return true;

  // 합친 순간이 배포다(Actions 가 매번 checkout). 읽기 위주 자동 작업을 바로 돌려 본다 — GITHUB_TOKEN 푸시는 다른 워크플로를 안 깨우지만 dispatch 는 된다
  const 결과 = await 돌려보기(작업);
  const 실패 = 결과.filter((x) => !x.ok);
  await 수리갱신(repId, { verify: 결과.map((x) => x.url ?? `${x.wf}:없음`).join(" "), note: 결과.map((x) => `${x.wf} ${x.ok ? "성공" : `실패(${x.why})`}`).join(" · ") });
  for (const x of 결과) console.log(`    ${x.ok ? "✓" : "✗"} ${x.wf} ${x.why} ${x.url ?? ""}`);
  if (실패.length) {
    const [rep] = await q(`select * from geo.repairs where id=$1`, [repId]);
    await 되돌리고기록(rep, t, `확인 실행 실패: ${실패.map((x) => `${x.wf} ${x.why}`).join(", ")}`);
  }
  return true;
};

// ─────────────────────────────────────────── 3. 흐름
const 승인일감 = async (t, 안, repId) => {
  const 명령 = `gh workflow run repair.yml -f mode=merge -f task=${t.id}`;
  const 줄수 = git("diff", "--stat", 안.base, 안.head);
  await q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload, link)
      values ($1,'repair','repair-approval',$2,$3,$4,'사람 대기',3,$5::jsonb,$6)
    on conflict (client_id, dedupe_key) do update set title=excluded.title, detail=excluded.detail, status='사람 대기', done_at=null,
      payload=excluded.payload, link=excluded.link, updated_at=now()`,
    [t.client_id, `repair-approve-${t.id}`, `자동 수리 승인 대기: ${한줄(안.요약, 80) || `조사 ${t.id}`}`,
      [`검토 ${안.검토.verdict} — ${한줄(안.검토.notes, 300)}`,
        `바뀐 곳: ${안.files.join(", ")} (줄 ${안.줄})`, 줄수,
        `가지: https://github.com/${REPO}/compare/main...${안.가지}`,
        `승인(합치기): ${명령}`,
        "거절: /admin/ops 「원장님이 하실 일」에서 이 일감을 「완료」로 표시하면 거절로 봅니다(합치지 않음). 다음 수리공 실행이 거절로 적고 이 조사는 더 자동 수리하지 않습니다. 가지는 남고 main 은 그대로입니다.",
        `화면을 못 쓰면: update geo.agent_tasks set status='닫힘' where dedupe_key='repair-approve-${t.id}';`].join("\n"),
      JSON.stringify({ sticky: true, task_id: t.id, repair_id: Number(repId), 명령 }), `https://github.com/${REPO}/compare/main...${안.가지}`]);
  await 일감(t.id, "수리 승인 대기", { evidence: `${KST()} 수리안 가지 ${안.가지} ${안.head.slice(0, 7)} · 검토 ${안.검토.verdict} — 원장 승인 대기 (수리 ${repId})` });
  console.log(`  → 승인 대기: ${명령}`);
};

const 수리 = async () => {
  const [멈춤] = await q(`select value from geo.settings where key='repair_paused'`);
  if (멈춤?.value === "true") { console.log("  수리공 멈춤 (geo.settings repair_paused=true) — 사람이 풀어야 한다"); return; }
  if (!손으로 && !정해진) { console.log(`  사람이 띄운 실행이 아니다 (${process.env.REPAIR_EVENT ?? ""} · ${띄운이 || "띄운 이 없음"}) — 지난 수리 확인만 한다`); return; }
  if (!ENABLED && !손으로) { console.log("  REPAIR_ENABLED 꺼짐 — 정해진 시각 실행은 지난 수리 확인만 한다"); return; }
  if (MODE === "run" && (await 오늘수리수()) >= MAX_PER_DAY) { console.log(`  오늘 수리 ${MAX_PER_DAY}건을 했다 — 내일`); return; }
  if (!클로드코드있음()) { console.log("  Claude Code 없음 — 건너뜀"); return; }
  const [t] = await q(`select * from geo.agent_tasks where kind='investigate' and status='수리 대기' and payload->'diagnosis'->>'분류' = 'code'
    ${TASK ? "and id=$1" : ""} order by priority, id limit 1`, TASK ? [TASK] : []);
  if (!t) { console.log(`  수리 대기 조사 없음${TASK ? ` (조사 ${TASK})` : ""}`); return; }
  console.log(`  ▶ 조사 ${t.id} ${t.title}`);

  // 이미 합쳤던(확인됨·효과 없음·되돌림) 조사가 다시 열렸으면 같은 수리를 되풀이하지 않는다 — 사람에게(Richard 9/22)
  const [전력] = await q(`select id, status from geo.repairs where task_id=$1 and status in ('확인됨','효과 없음','되돌림','되돌림 실패','거절') order by id desc limit 1`, [t.id]);
  if (전력) {
    await 일감(t.id, "사람 대기", { evidence: `${KST()} 자동 수리했던 조사가 다시 열림 (수리 ${전력.id} ${전력.status}) — 다시 고치지 않음`,
      detail: `이 신호는 자동 수리(수리 ${전력.id}, ${전력.status}) 뒤에 다시 떴습니다. 같은 수리를 되풀이하지 않습니다. Claude 세션에서 원인을 다시 봅니다.` });
    console.log(`  → 사람 대기: 전에 수리 ${전력.id} (${전력.status})`);
    return;
  }
  // 조사관이 고칠 파일로 짚은 것이 전부 금지 경로면 claude 를 부를 필요도 없다
  const 짚은 = (t.payload?.diagnosis?.다음?.파일 ?? []).map((f) => String(f).replace(/^\.?\//, "").replace(/:\d+.*$/, ""));
  const 밖 = 짚은.filter((f) => !허용.test(f) || 금지.some((r) => r.test(f)));
  if (짚은.length && 밖.length === 짚은.length) {
    await 일감(t.id, "사람 대기", { evidence: `${KST()} 수리공이 고칠 수 없는 파일: ${밖.join(", ")}`,
      detail: `고칠 곳이 자동 수리 금지 경로입니다(${밖.join(", ")}). 워크플로·web·academy/app·숫자 스크립트는 Claude 세션에서 고칩니다.` });
    console.log(`  → 사람 대기: 금지 경로 ${밖.join(", ")}`);
    return;
  }

  const 전 = 바뀜();
  if (전.length) throw new Error(`작업 트리가 깨끗하지 않다 (${전.slice(0, 5).map((x) => x.file).join(", ")}) — 가지를 만들지 않는다`);
  const base = 가져오기();
  const 안 = await 만들기(t, base);
  if (!안) return;
  const 행 = { task_id: t.id, branch: 안.가지, base_sha: base, head_sha: 안.head, files: 안.files, lines: 안.줄, review: 안.검토, checks: { 문제: [], 요약: 안.요약, needs_owner: 안.needs_owner } };
  if (MODE === "dry") {
    const id = await 수리기록({ ...행, status: "dry", note: "--dry: 가지만 푸시, main 무관, 합칠 수 없음" });
    console.log(`  --dry 끝 (수리 ${id}). main 은 그대로`);
    return;
  }
  if (안.검토.verdict !== "pass") {
    const id = await 수리기록({ ...행, status: "검토 불합격", note: (안.검토.must ?? []).join(" / ") });
    await 일감(t.id, "사람 대기", { evidence: `${KST()} 자동 수리안 검토 불합격 — ${한줄((안.검토.must ?? []).join(" / "), 300)}`,
      detail: `자동 수리안(가지 ${안.가지})이 검토에서 떨어졌습니다: ${한줄((안.검토.must ?? []).join(" / "), 300)}. 가지 diff 를 보고 Claude 세션에서 고칩니다.` });
    await 활동(false, `수리안 검토 불합격 (수리 ${id})`, t.id);
    return;
  }
  const 무인 = ENABLED ? await 무인허용() : { ok: false, n: 0 };
  if (!무인.ok || 안.needs_owner) {
    const id = await 수리기록({ ...행, status: "승인 대기", note: 안.needs_owner ? "네트워크·환경에 닿는 줄이 있어 늘 원장 승인" : `견습 — 승인해 합친 수리 ${무인.n}/${견습건수}` });
    await 승인일감(t, 안, id);
    return;
  }
  const id = await 수리기록({ ...행, status: "승인 대기", note: "견습 끝 — 무인 합치기" });
  await 합치기(t, 안, id, { approved: false });
};

/** 원장 승인 — 승인 대기 수리안을 다시 검사하고 합친다. base 가 움직였으면 검토를 다시 받는다(Richard 9/22) */
const 승인합치기 = async () => {
  if (!손으로) { console.log(`  merge 는 사람만 띄운다 (${띄운이 || "띄운 이 없음"}) — 합치지 않는다`); return; }
  if (!ENABLED) { console.log("  REPAIR_ENABLED 꺼짐 — 합치지 않는다 (원장이 저장소 변수를 켜야 한다)"); return; }
  if (!TASK) throw new Error("merge 는 task 가 있어야 한다 (-f task=<조사 id>)");
  const [멈춤] = await q(`select value from geo.settings where key='repair_paused'`);
  if (멈춤?.value === "true") { console.log("  수리공 멈춤 — 합치지 않는다"); return; }
  const [rep] = await q(`select * from geo.repairs where task_id=$1 and status='승인 대기' order by id desc limit 1`, [TASK]);
  if (!rep) { console.log(`  조사 ${TASK} 에 승인 대기 수리안이 없다`); return; }
  const [t] = await q(`select * from geo.agent_tasks where id=$1`, [TASK]);
  // 승인 일감이 아직 사람 대기일 때만 합친다. 닫았거나 완료 표시했으면 거절이다 — 나중에 누가 merge 를 돌려도 거절한 안이 들어가면 안 된다
  const [승인] = await q(`select status from geo.agent_tasks where client_id=$1 and dedupe_key=$2`, [t.client_id, `repair-approve-${TASK}`]);
  if (승인?.status !== "사람 대기") { await 거절처리(rep, t, 승인?.status ?? "승인 일감 없음"); return; }
  const base = 가져오기();
  const 머리 = 가져오기(rep.branch);
  if (머리 !== rep.head_sha) throw new Error(`가지 ${rep.branch} 머리가 바뀜 (${머리.slice(0, 7)} ≠ ${rep.head_sha.slice(0, 7)}) — 검토받은 diff 가 아니다`);
  if (base !== rep.base_sha && 파일바뀜(rep.base_sha, base, rep.files)) {
    await 수리갱신(rep.id, { status: "포기", note: `${KST()} 승인 사이 main 이 같은 파일을 바꿈` });
    await 일감(t.id, "수리 대기", { evidence: `${KST()} 승인 사이 main 이 같은 파일을 바꿔 수리안 폐기 — 다음 수리에서 새로 만든다` });
    console.log("  main 이 같은 파일을 바꿈 — 수리안 폐기, 다음 실행에서 새로 만든다");
    return;
  }
  // 새 base 위에 같은 파일을 올리고 가드를 다시 건다
  const 전 = 바뀜();
  if (전.length) throw new Error("작업 트리가 깨끗하지 않다");
  git("checkout", "-q", "-f", "-B", `${rep.branch}-check`, base);
  git("checkout", rep.head_sha, "--", ...rep.files);
  git("reset", "-q");
  const g = 가드(base, 바뀜());
  if (g.문제.length) {
    await 수리갱신(rep.id, { status: "가드 걸림", note: g.문제.join(" / ") });
    await 일감(t.id, "사람 대기", { evidence: `${KST()} 승인 뒤 다시 건 가드에 걸림 — ${g.문제.join(" / ")}` });
    return;
  }
  let 검토 = rep.review;
  if (base !== rep.base_sha) {
    const diff = git("diff", base, "--", ...rep.files);
    검토 = await 검토받기(t, diff, rep.checks?.요약 ?? "");
    if (검토.한도) { console.log(`  한도 — 다시 검토 못 함: ${끝(검토.error, 160)}`); return; }
    console.log(`  main 이 움직여 다시 검토: ${검토.verdict} · ${한줄(검토.notes, 200)}`);
    if (검토.verdict !== "pass") {
      await 수리갱신(rep.id, { status: "검토 불합격", note: `다시 검토 fail — ${한줄((검토.must ?? []).join(" / "), 300)}` });
      await 일감(t.id, "사람 대기", { evidence: `${KST()} 승인 뒤 다시 검토에서 fail` });
      return;
    }
  }
  await 합치기(t, { 가지: rep.branch, base, head: rep.head_sha, files: rep.files, 줄: rep.lines, 요약: rep.checks?.요약 ?? "", 검토 }, rep.id, { approved: true });
};

// ─────────────────────────────────────────── 시험
/**
 * 되돌리기 시험 — 시험 가지에서 운영과 같은 되돌리기()를 쓴다.
 * 1) 가짜 수리(scout.mjs 끝 주석 + BUILD-LOG 항목) → 2) 다른 사람이 BUILD-LOG 에 덧붙임 → 3) 되돌리기:
 *    scout.mjs 는 base 와 같아야 하고, BUILD-LOG 에는 세 항목(가짜 수리·다른 사람·되돌림)이 다 남아야 한다
 * 4) 되돌린 뒤 scout.mjs 를 또 고치고 다시 되돌리기 → 「또 바뀜」으로 거절돼야 한다
 */
const 되돌리기시험 = async () => {
  const base = 가져오기();
  const 가지 = `auto/revert-test-${Date.now()}`;
  const 파일 = "academy/scripts/scout.mjs";
  const 판정 = [];
  try {
    git("checkout", "-q", "-f", "-B", 가지, base);
    fs.appendFileSync(path.join(ROOT, 파일), "\n// 되돌리기 시험 — 가짜 수리\n");
    fs.appendFileSync(로그파일, `\n### 자동 수리 — 되돌리기 시험 가짜 항목 ${가지}\n`);
    git("add", 파일, "handoff/BUILD-LOG.md");
    if (!커밋("되돌리기 시험: 가짜 수리").ok) throw new Error("커밋 실패");
    const merge = git("rev-parse", "HEAD");
    fs.appendFileSync(로그파일, `\n### 그사이 다른 사람 항목 ${가지}\n`);
    git("add", "handoff/BUILD-LOG.md");
    if (!커밋("되돌리기 시험: 그사이 BUILD-LOG 에 덧붙임").ok) throw new Error("커밋 실패");
    const p = 푸시(`HEAD:refs/heads/${가지}`);
    if (!p.ok) throw new Error(`시험 가지 푸시 실패 ${p.out}`);
    console.log(`  가짜 수리 ${merge.slice(0, 7)} + BUILD-LOG 덧붙임 → ${가지}`);
    const rep = { id: 0, files: [파일], merge_sha: merge };
    const r = 되돌리기(rep, "되돌리기 시험", 가지);
    if (!r.ok) throw new Error(`되돌리기 실패 ${r.error}`);
    const 같음 = git시도("diff", "--quiet", base, r.sha, "--", 파일).ok;
    const 로그 = git("show", `${r.sha}:handoff/BUILD-LOG.md`);
    const 셋 = [`되돌리기 시험 가짜 항목 ${가지}`, `그사이 다른 사람 항목 ${가지}`, "자동 수리 되돌림 — 수리 0"].every((s) => 로그.includes(s));
    판정.push(["수리 파일이 base 와 같다", 같음], ["BUILD-LOG 에 가짜 수리·다른 사람·되돌림 세 항목", 셋]);
    console.log(`  ↩ 되돌림 ${r.sha.slice(0, 7)}`);
    // 되돌린 뒤 같은 파일을 누가 또 고침 → 두 번째 되돌리기는 거절돼야 한다
    git("checkout", "-q", "-f", "-B", 가지, r.sha);
    fs.appendFileSync(path.join(ROOT, 파일), "\n// 되돌리기 시험 — 그 뒤 다른 수정\n");
    git("add", 파일);
    커밋("되돌리기 시험: 합친 뒤 같은 파일 수정");
    푸시(`HEAD:refs/heads/${가지}`);
    const r2 = 되돌리기(rep, "되돌리기 시험 2", 가지);
    판정.push(["합친 뒤 같은 파일이 바뀌면 거절", !r2.ok && /또 바뀜/.test(r2.error ?? "")]);
    for (const [말, ok] of 판정) console.log(`  ${ok ? "✓" : "✗"} ${말}`);
    await 수리기록({ task_id: null, branch: 가지, base_sha: base, head_sha: r.sha, status: "revert-test", note: 판정.map(([말, ok]) => `${ok ? "✓" : "✗"} ${말}`).join(" · ") });
    if (판정.some(([, ok]) => !ok)) process.exitCode = 1;
  } finally {
    const d = 푸시(`:refs/heads/${가지}`);
    console.log(`  시험 가지 지움 ${d.ok ? "됨" : `실패 ${끝(d.out, 120)}`}`);
  }
};

/** 가드 시험 — 막아야 할 줄과 통과해야 할 줄. DB·claude·git 을 안 쓴다 */
const 가드시험 = () => {
  const 원래 = [
    'import fs from "node:fs";',
    "const u = new URL(process.env.DATABASE_URL);",
    'await fetch("https://api.github.com/repos/x");',
  ].join("\n");
  const 경우 = [
    ["새 환경변수", ["const k = process.env.EVIL_KEY;"], true],
    ["환경변수 이름을 값으로", ["const v = process.env[name];"], true],
    ["process.env 통째로", ["console.log(JSON.stringify(process.env));"], true],
    ["새 호스트", ['await fetch("https://evil.example.com/p");'], true],
    ["호스트를 값으로 조립", ["await fetch(`https://${host}/x`);"], true],
    ["환경변수+네트워크 한 줄", ['await fetch("https://api.github.com/x?k=" + process.env.DATABASE_URL);'], true],
    ["child_process import", ['import { exec } from "node:child_process";'], true],
    ["https require", ['const https = require("https");'], true],
    ["eval", ["eval(code);"], true],
    ["new Function", ["const f = new Function(\"a\", body);"], true],
    ["동적 import 변수", ["const m = await import(name);"], true],
    ["새 패키지", ['import x from "left-pad";'], true],
    ['process["env"]', ['const v = process["env"].DATABASE_URL;'], true],
    ["const { env } = process", ["const { env } = process;"], true],
    ["Reflect.get(process", ['const e = Reflect.get(process, "env");'], true],
    ["주소를 변수로 fetch — 막지는 않되 사람", ["await fetch(row.url + \"?\" + k);"], "사람"],
    ["조립한 주소 + fetch — 사람", ['const u = "https:" + "//evil";', "await fetch(u);"], "사람"],
    ["request( — 사람", ["const r = await request(opts);"], "사람"],
    [".post( — 사람", ["await client.post(body);"], "사람"],
    ["원래 있던 환경변수 읽기 — 사람", ["const u2 = process.env.DATABASE_URL;"], "사람"],
    ["깨끗한 수정", ["const n = rows.filter((r) => r.pct < 20 && r.t >= 10).length;", "const 이름 = `${c.name} — ${r.vendor}`;"], false],
  ];
  let 틀림 = 0;
  console.log("가드 시험");
  for (const [이름, 줄, 기대] of 경우) {
    const 문제 = 줄검사("시험.mjs", 줄, 원래);
    const 사람 = 사람봐야(줄);
    const 막아야 = 기대 === true;
    const ok = 기대 === "사람" ? 문제.length === 0 && 사람 : 막아야 ? 문제.length > 0 : 문제.length === 0 && !사람;
    if (!ok) 틀림++;
    console.log(`  ${ok ? "✓" : "✗"} ${이름} — ${기대 === "사람" ? "통과하되 원장 승인" : 막아야 ? "막아야 함" : "통과해야 함"} · ${문제.length ? 문제.join(" / ") : "문제 없음"}${사람 ? " · needs_owner" : ""}`);
  }
  console.log(틀림 ? `  ✗ ${틀림}건 틀림` : "  ✓ 전부 맞음");
  if (틀림) process.exitCode = 1;
};

try {
  console.log(`수리공 · ${KST()} KST · ${MODE}${TASK ? ` · 조사 ${TASK}` : ""} · REPAIR_ENABLED=${ENABLED ? 1 : 0}${손으로 ? " · 사람이 띄움" : ""}`);
  if (!MODES.includes(MODE)) throw new Error(`모르는 모드 ${MODE}`);
  if (MODE === "guard-test") 가드시험();
  else {
    if (!TOKEN) throw new Error("GH_TOKEN 없음 — 푸시·확인 실행을 못 한다");
    // 이 스크립트는 checkout -f 로 가지를 오간다. 로컬에서 고치던 파일이 있으면 날아간다 — 깨끗할 때만 돈다
    const 더러움 = 바뀜();
    if (더러움.length) throw new Error(`작업 트리가 깨끗하지 않다 (${더러움.slice(0, 5).map((x) => x.file).join(", ")}) — 커밋하거나 stash 한 뒤 돌린다`);
    await ensure();
    const 원래가지 = git("rev-parse", "--abbrev-ref", "HEAD");
    const 원래커밋 = git("rev-parse", "HEAD");
    try {
      if (MODE === "revert-test") await 되돌리기시험();
      else {
        await 지난수리확인();
        if (MODE === "merge") await 승인합치기();
        else await 수리();
      }
    } finally {
      git시도("checkout", "-q", "-f", 원래가지 === "HEAD" ? 원래커밋 : 원래가지);
    }
  }
} catch (e) {
  console.error("수리 실패", 가림(e.message));
  if (pool) await 활동(false, `수리 실패 (${MODE}): ${가림(e.message)}`);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
