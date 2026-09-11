/**
 * 오늘 한 일 — 마감 시각으로 자른 하루를 기록한다.
 *
 * 대시보드(/admin/ops)의 「오늘 한 일」은 DB 에 남는 일을 화면을 열 때마다 센다.
 * DB 밖의 일 — 커밋, 정찰 이슈, 자동 작업 실행 — 은 여기서 모아 geo.daily_briefs 에 적는다.
 * 마감 시각이 지나면 그날 치를 closed 로 굳힌다. 굳힌 뒤에는 고치지 않는다.
 *
 * 세는 로직은 web/lib/brief-core.mjs 하나다. 화면과 기록이 갈라지지 않게.
 *
 *   node scripts/daily-brief.mjs                     지금 창을 글로 보기
 *   node scripts/daily-brief.mjs --snapshot          지금 창을 open 으로 저장 (커밋·이슈·실행 포함)
 *   node scripts/daily-brief.mjs --close-if-due      마감이 지난 창이 아직 안 굳었으면 closed 로 저장
 *   node scripts/daily-brief.mjs --cutoff 20:00      마감 시각을 바꿔 저장
 *
 * GitHub 쪽은 GH_TOKEN(Actions 의 github.token) 이나 로컬 gh 로그인으로 읽는다. 없으면 건너뛴다.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { windows, gatherDb, clientLine, validCutoff, kstDay, kstTime, DEFAULT_CUTOFF } from "../../web/lib/brief-core.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO = process.env.GITHUB_REPOSITORY || "leeledger/geo";
const argv = process.argv.slice(2);

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});
const q = (sql, params = []) => pool.query(sql, params).then((r) => r.rows);

await q(`create table if not exists geo.settings (
  key text primary key, value text not null, updated_at timestamptz not null default now())`);
await q(`create table if not exists geo.daily_briefs (
  day          date primary key,
  status       text not null default 'open',
  window_start timestamptz not null,
  window_end   timestamptz not null,
  data         jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now())`);

// ── 마감 시각
const ci = argv.indexOf("--cutoff");
if (ci >= 0) {
  const v = argv[ci + 1];
  if (!validCutoff(v)) throw new Error(`HH:MM 으로 주세요: ${v}`);
  await q(`insert into geo.settings (key, value) values ('brief_cutoff', $1)
           on conflict (key) do update set value = excluded.value, updated_at = now()`, [v]);
  console.log(`마감 시각 ${v} 로 저장`);
}
const [setting] = await q(`select value from geo.settings where key = 'brief_cutoff'`);
const cutoff = validCutoff(setting?.value) ? setting.value : DEFAULT_CUTOFF;
const w = windows(cutoff);

// ── DB 밖의 일
function commits(start, end) {
  try {
    const out = execFileSync("git", ["log", "--no-merges", `--since=${start.toISOString()}`, `--until=${end.toISOString()}`,
      "--format=%h%x09%an%x09%aI%x09%s"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.trim().split("\n").filter(Boolean).map((l) => {
      const [hash, author, at, ...s] = l.split("\t");
      return { hash, author, at: new Date(at).toISOString(), subject: s.join("\t") };
    });
  } catch {
    return null;
  }
}

function token() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

async function gh(pathname) {
  const t = token();
  if (!t) return null;
  const r = await fetch(`https://api.github.com${pathname}`, {
    headers: { authorization: `Bearer ${t}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
  }).catch(() => null);
  return r && r.ok ? r.json() : null;
}

async function extras(start, end) {
  const inWin = (t) => t && new Date(t) >= start && new Date(t) < end;
  const issuesRaw = await gh(`/repos/${REPO}/issues?state=all&labels=scout&per_page=100&since=${start.toISOString()}`);
  const runsRaw = await gh(`/repos/${REPO}/actions/runs?per_page=100&created=%3E%3D${start.toISOString().slice(0, 19)}Z`);

  const issues = Array.isArray(issuesRaw) ? {
    opened: issuesRaw.filter((i) => !i.pull_request && inWin(i.created_at)).map((i) => ({ number: i.number, title: i.title })),
    closed: issuesRaw.filter((i) => !i.pull_request && inWin(i.closed_at)).map((i) => ({ number: i.number, title: i.title })),
  } : null;

  let runs = null;
  if (runsRaw?.workflow_runs) {
    const by = new Map();
    for (const r of runsRaw.workflow_runs.filter((x) => inWin(x.created_at) && x.status === "completed")) {
      const e = by.get(r.name) ?? { name: r.name, ok: 0, fail: 0 };
      if (r.conclusion === "success") e.ok++; else e.fail++;
      by.set(r.name, e);
    }
    runs = [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  return { commits: commits(start, end), issues, runs };
}

async function build(win) {
  const facts = await gatherDb(q, win.start, win.end);
  return { facts, extras: await extras(win.start, win.end) };
}

async function save(win, status, data) {
  await q(
    `insert into geo.daily_briefs (day, status, window_start, window_end, data)
     values ($1, $2, $3, $4, $5)
     on conflict (day) do update set status = excluded.status, data = excluded.data, updated_at = now()
     where geo.daily_briefs.status <> 'closed'`,
    [win.day, status, win.start, win.end, JSON.stringify(data)],
  );
}

function print(win, data, label) {
  const { facts, extras: x } = data;
  console.log(`\n══ 오늘 한 일 · ${win.day} 마감분 (${label}) ══`);
  console.log(`   ${kstDay(win.start)} ${kstTime(win.start)} ~ ${kstDay(win.end)} ${kstTime(win.end)} (한국 시각)`);
  for (const c of facts.clients) {
    console.log(`\n  [${c.name}] ${clientLine(c)}`);
    for (const wk of c.work) console.log(`    · ${wk.at ? kstTime(wk.at) : ""} ${wk.what}`);
    for (const p of c.published) console.log(`    · 발행 ${p.title}`);
  }
  console.log(`\n  바깥  리드 ${facts.leads.length} · 상담 기록 ${facts.inquiries} · 랜딩 진단 ${facts.publicScans}`);
  if (x.commits) {
    console.log(`  커밋  ${x.commits.length}건`);
    for (const c of x.commits.slice(0, 10)) console.log(`    · ${kstTime(c.at)} ${c.subject}`);
  }
  if (x.runs) console.log(`  자동  ${x.runs.map((r) => `${r.name} ${r.ok}${r.fail ? `/실패 ${r.fail}` : ""}`).join(" · ") || "실행 없음"}`);
  if (x.issues) console.log(`  정찰  새 이슈 ${x.issues.opened.length} · 닫힘 ${x.issues.closed.length}`);
}

if (argv.includes("--close-if-due")) {
  const [row] = await q(`select status from geo.daily_briefs where day = $1`, [w.closed.day]);
  if (row?.status === "closed") {
    console.log(`${w.closed.day} 마감분은 이미 굳었습니다.`);
  } else {
    const data = await build(w.closed);
    await save(w.closed, "closed", data);
    print(w.closed, data, "마감 · 저장");
  }
}

const data = await build(w.open);
if (argv.includes("--snapshot")) await save(w.open, "open", data);
print(w.open, data, argv.includes("--snapshot") ? "진행 중 · 저장" : "진행 중");

await pool.end();
