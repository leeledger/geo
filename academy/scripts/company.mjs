/**
 * 에이전트 회사 — 매시간 일감을 만들고, 집어 가고, 실행하고, 기록한다.
 *
 * 전에는 대시보드 카드가 DB 숫자를 보고 「다음 행동」 문장을 골라 띄우기만 했다.
 * 그 문장을 가져가 실행하는 곳이 없어서 정찰 이슈 6건이 일주일 동안 열려 있었고,
 * 주간 초안이 실패해도 아무도 몰랐다(2026-09-17 원장 지적).
 *
 * 한 번 돌 때
 *   1. 출근 기록   GitHub 자동 작업들의 최근 실행을 담당별 활동으로 옮긴다 (누가 실제로 일했나)
 *   2. 계획        신호(정찰·초안·문의·리드·작업 실패)마다 일감을 만든다. 신호가 사라지면 닫는다
 *   3. 실행        대기 중인 일감을 우선순위대로 집어 실제로 한다. 실패하면 간격을 늘려 다시 한다
 *
 * 담당
 *   ops      운영   작업 실패 재실행·원인 기록, 사이트 점검, 재진단
 *   measure  측정   노출 재측정, 브랜드 방어, 지는 검색어에서 누가 이기는지 분석
 *   content  콘텐츠 주간 초안, 질문 겨냥 초안, 초안 AI 티 검사·다듬기
 *   deliver  유통   색인 알림, 크롤러가 안 읽은 쪽 밀기 (로그인이 필요한 이관·구글 요청은 local-agent)
 *   sales    성과   상담 결과·리드 후속은 사람 일로 올린다
 *   improve  개선   daily-agent.mjs 가 따로 돈다 (optimize.yml)
 *
 * 사람만 할 수 있는 일(로그인·상담 결과)은 「사람 대기」로 올리고 할 곳의 주소를 단다.
 * 학원 주 1편은 주제·감수·발행까지 자동이다(Step 43) — 자동 감수를 다 통과한 글만 나가고, 원장은 나간 글을 「내리기」 한 번으로 내린다.
 * 로그인한 브라우저가 필요한 일은 「로컬 대기」— tools/local-agent.mjs 가 원장 PC 에서 집어 간다.
 *
 *   node scripts/company.mjs              계획 + 실행
 *   node scripts/company.mjs --plan       계획만
 *   node scripts/company.mjs --max 2      이번에 실행할 일감 수
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadClients, 세션글제목 } from "../clients.mjs";
import { 고객설정준비 } from "../measure-targets.mjs";
import { 같은질문일감, 세션글키, 세션일감묶기 } from "./session-task.mjs";
import { 색인결과 } from "../serp-judge.mjs";
import { 탐침측정DDL } from "./loop-grow.mjs";
import { MARKETING_DDL } from "../../web/lib/marketing-core.mjs";
import { GROWTH_DDL } from "../../web/lib/growth-core.mjs";
import { 세팅재점검 } from "../../web/lib/client-core.mjs";
import { 오래된창요청닫기 } from "../../web/lib/login-core.mjs";
import { 오래된kin요청닫기 } from "../../web/lib/kin-core.mjs";
import { 오픈라우터, 재시도, 모델들, 공급자들 } from "./writer-common.mjs";
import { 프로필 } from "./profile.mjs";
import { PM보고 } from "./pm-report.mjs";
import { PC무소식, PC무소식글 } from "./pc-silent.mjs";
import { 파일럿칸준비, 파일럿날짜맞추기, 구축대기한도 } from "../pilot-plan.mjs";
import { 이번주글SQL, 기록하기, KST날 } from "../../web/lib/post-auto-core.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PLAN_ONLY = process.argv.includes("--plan");
const MAX = Number(process.argv[process.argv.indexOf("--max") + 1]) || 3;
const BUDGET_MS = 40 * 60 * 1000;
const START = Date.now();
const ADMIN = process.env.ADMIN_BASE_URL || "https://geo-rose-nine.vercel.app";
const REPO = process.env.GITHUB_REPOSITORY || "leeledger/geo";
const RUN_URL = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
const HOUSE = 1; // 사이티드 자체 일(작업 실패 등)은 첫 고객사 칸에 둔다 — client_id 가 not null 이다

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
/** 내린 글(review_notes.비공개이유)은 미발행이어도 초안이 아니다 — 검토 화면(web/lib/drafts.ts)과 같은 조건 */
const 내린글아님 = `not (coalesce(review_notes, '{}'::jsonb) ? '비공개이유')`;
const ROOT = fileURLToPath(new URL("..", import.meta.url));

// code 를 같이 준다 — 78(건너뜀)과 진짜 실패를 가려야 하는 자리가 있다 (weekly-draft)
const 실행 = (args, timeout = 15 * 60 * 1000) => {
  try {
    return { ok: true, code: 0, out: execFileSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", timeout, env: process.env, maxBuffer: 20 * 1024 * 1024 }) };
  } catch (e) {
    return { ok: false, code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}\n${e.message}` };
  }
};
const 끝 = (s, n = 400) => String(s ?? "").replace(/\s+/g, " ").trim().slice(-n);

const 활동 = (clientId, agent, action, ok, summary, taskId = null, runUrl = RUN_URL) =>
  q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id, run_url) values ($1,$2,$3,$4,$5,$6,$7)`,
    [clientId, agent, action, ok, String(summary).slice(0, 1000), taskId, runUrl]).catch((e) => console.log("  ⚠ 활동 기록 실패", e.message));

// ─────────────────────────────────────────── LLM (막히면 다음 공급자로)
/**
 * OpenRouter 하나만 부르던 때는 크레딧이 0 이 되자 200 에 빈 답이 왔고,
 * 「JSON 아님」 을 12일 동안 같은 자리에서 되풀이했다(2026-09-21 원장 지적 「에이전트가 일을 안 한다」).
 * 이제 OpenRouter 모델들 → Anthropic(중계, 하루 상한 있음) → Gemini → Groq 순으로 넘어간다. 빈 답도 실패로 친다.
 */
const 분석모델 = { anthropic: process.env.COMPANY_ANTHROPIC_MODEL || "claude-sonnet-5" };
/**
 * 모양 — 받은 JSON 이 쓸 만한지 부르는 쪽이 판단한다. JSON 이긴 한데 필요한 칸이 없으면(예: items 없음)
 * 그것도 실패로 치고 다음 공급자로 넘어간다. 안 그러면 「만든 일감 없음」으로 일주일 미뤄진다.
 * 돌려주는 돈없음 은 모든 실패가 크레딧(402)일 때만 참이다 — 오류 글자에 402 가 섞였다고 참이 되면 안 된다.
 */
const 물어보기 = async (질문, maxTokens = 6000, 모양 = () => true) => {
  // 총괄의 정체성·일하는 법·기억을 앞에 붙인다(agents/pm, Step 19). 공급자가 여럿이라 시스템 칸 대신 본문 앞에 둔다
  const prompt = `${프로필("pm")}\n\n---\n\n${질문}`;
  const 막힘 = [];
  const 코드들 = [];
  const 읽기 = (text) => {
    const m = /\{[\s\S]*\}/.exec(String(text).replace(/^```(json)?|```$/gm, ""));
    try { const j = JSON.parse(m?.[0] ?? ""); return 모양(j) ? j : null; } catch { return null; }
  };
  const 부르기 = (url, opts) => 재시도(url, opts).catch((e) => ({ ok: false, status: 0, headers: new Headers(), text: async () => e.message }));
  let 상한 = false; // 중계 하루 상한 — OpenRouter·Anthropic 이 같은 칸을 쓰니 걸리면 중계는 더 안 부른다

  const or = 오픈라우터();
  if (or) {
    // 모델은 닫힌다. 막히면 다음 이름으로 (stealth/union-alpha 가 2026-09-18 에 닫혔다)
    let 크레딧없음 = false;
    for (const model of 모델들()) {
      // 크레딧이 0 이면 유료 모델은 다 402 다. 중계 상한만 깎으니 무료(:free)만 더 해 본다
      if (크레딧없음 && !model.endsWith(":free")) continue;
      const res = await 부르기(or.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${or.key}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }),
      });
      if (res.headers?.get?.("x-proxy-cap")) { 상한 = true; 막힘.push("중계 하루 상한"); 코드들.push(429); break; }
      if (!res.ok) {
        if (res.status === 402) 크레딧없음 = true;
        코드들.push(res.status);
        막힘.push(`openrouter/${model} ${res.status} ${끝(await res.text(), 120)}`);
        continue;
      }
      const text = (await res.json().catch(() => ({}))).choices?.[0]?.message?.content ?? "";
      const json = 읽기(text);
      if (json) return { json, 공급자: `openrouter/${model}` };
      코드들.push(0);
      막힘.push(`openrouter/${model} 쓸 수 없는 답(${text.length}자)`);
    }
  }

  for (const p of 공급자들({ groq: true }).filter((x) => x.이름 !== "openrouter")) {
    // 분석은 짧은 JSON 이라 글쓰기용 큰 모델까지 안 쓴다. 제미나이는 모델이 주소에 들어 있어 본문을 건드리지 않는다
    const 앤트로픽 = p.이름.startsWith("anthropic");
    if (앤트로픽 && 상한 && p.이름.includes("중계")) continue;
    const model = 앤트로픽 ? 분석모델.anthropic : p.이름 === "claude-code" ? "sonnet" : p.model;
    const 요청 = p.요청(`${prompt}\n\nJSON 객체 하나만 답하라. 다른 말은 붙이지 마라.`, maxTokens, { json: true });
    // Claude Code(구독)도 분석은 sonnet 으로 — 한도를 원장과 같이 쓰니 가볍게
    const body = 앤트로픽 ? { ...요청, model } : p.이름 === "claude-code" ? { ...요청, model, timeoutMs: 4 * 60 * 1000 } : 요청;
    const res = await 부르기(p.url, { method: "POST", headers: p.headers(p.key), body: JSON.stringify(body) });
    if (!res.ok) {
      const 본문 = await res.text();
      // Anthropic 은 잔액 부족을 402 가 아니라 400 으로 준다. 크레딧 문제로 세야 고장으로 안 쌓인다
      코드들.push(/credit balance is too low/i.test(본문) ? 402 : res.status);
      막힘.push(`${p.이름} ${res.status} ${끝(본문, 120)}`);
      continue;
    }
    const text = p.text(await res.json().catch(() => ({})));
    const json = 읽기(text);
    if (json) return { json, 공급자: `${p.이름}/${model}` };
    코드들.push(0);
    막힘.push(`${p.이름} 쓸 수 없는 답(${text.length}자)`);
  }
  for (const m of 막힘) console.log(`  ⚠ ${m}`);
  return {
    error: 막힘.length ? `모든 공급자 막힘: ${막힘.join(" · ")}` : "LLM 설정 없음",
    돈없음: 코드들.length > 0 && 코드들.every((c) => c === 402),
  };
};

// ─────────────────────────────────────────── 일감 표
const ensure = async () => {
  await q(`create table if not exists geo.agent_tasks (id bigserial primary key, client_id int not null references geo.clients(id),
    agent text not null, kind text not null, dedupe_key text not null, title text not null, detail text not null default '',
    payload jsonb not null default '{}'::jsonb, status text not null default '대기', priority int not null default 50,
    attempts int not null default 0, evidence text not null default '', last_error text not null default '', link text,
    next_try_at timestamptz not null default now(), created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(), done_at timestamptz, unique (client_id, dedupe_key))`);
  await q(`create table if not exists geo.agent_activity (id bigserial primary key, client_id int references geo.clients(id),
    agent text not null, action text not null, ok boolean not null, summary text not null default '', task_id bigint,
    run_url text, at timestamptz not null default now())`);
  await q(`alter table academy.posts add column if not exists review_notes jsonb not null default '{}'::jsonb`);
  // 초안 재료 (Step 15). setup-materials.mjs 와 같은 덩어리다 — 한쪽만 고치면 Actions 가 사람 손을 기다린다.
  // 날짜 기본값을 current_date 로 두면 UTC 러너에서 전날로 찍힌다
  await q(`create table if not exists academy.materials (
    id uuid primary key default gen_random_uuid(), client_id int not null default 1,
    day date not null default ((now() at time zone 'Asia/Seoul')::date),
    kind text not null check (kind in ('상담','수업','질문','사례','숫자')),
    said text not null, context text not null default '', used_in text[] not null default '{}',
    origin text not null default 'owner', inquiry_id uuid,
    created_at timestamptz not null default now())`);
  await q(`create index if not exists materials_unused_idx
    on academy.materials (client_id, day desc) where cardinality(used_in) = 0`);
  await q(`create table if not exists academy.draft_feedback (
    id bigserial primary key, client_id int not null default 1, slug text not null,
    title text not null default '', reasons text[] not null default '{}', note text not null default '',
    excerpt text not null default '', created_at timestamptz not null default now())`);
  // 관리 화면이 읽는 표는 첫 입력 전에 있어야 한다(Step 27 D16). web/lib/hours.ts HOURS_DDL 과 같은 줄 — 한쪽만 고치지 않는다.
  // 화면 편의용이라 실패해도 루프는 계속 돈다(Richard 27) — 줄마다 따로 잡는다
  for (const s of [
    `create table if not exists geo.client_hours (
      id bigserial primary key, client_id int not null references geo.clients(id),
      day date not null default ((now() at time zone 'Asia/Seoul')::date),
      minutes int not null check (minutes > 0 and minutes <= 1440),
      what text not null default '', created_at timestamptz not null default now())`,
    `alter table geo.client_hours enable row level security`,
  ]) await q(s).catch((e) => console.log("  ⚠ client_hours 표 준비 실패", 끝(e.message, 200)));
  // 탐침·확장 질문 측정 표(Step 31). 운영 DB 에 아직 없었다 — 첫 측정 전에 만든다. 실패해도 계속(읽는 쪽이 없으면 빈 결과로 돈다)
  await q(탐침측정DDL).catch((e) => console.log("  ⚠ ai_probe_measurements 표 준비 실패", 끝(e.message, 200)));
  // 바깥 글 표(Step 35 D52) — 현황판 카드가 첫 초안 전에도 읽는다. web/lib/marketing-core.mjs 와 같은 줄. 실패해도 계속
  for (const s of MARKETING_DDL) await q(s).catch((e) => console.log("  ⚠ marketing_posts 표 준비 실패", 끝(e.message, 200)));
  // 문서딱 성장 리포트 표(Step 36) — 현황판 카드가 첫 가져오기 전에도 읽는다. web/lib/growth-core.mjs 와 같은 줄. 실패해도 계속
  for (const s of GROWTH_DDL) await q(s).catch((e) => console.log("  ⚠ growth_reports 표 준비 실패", 끝(e.message, 200)));
  // 고객 설정 칸(Step 37). 실패해도 계속 — 고객 목록은 칸 없이도 읽힌다
  await 고객설정준비(q).catch((e) => console.log("  ⚠ 고객 설정 칸 준비 실패", 끝(e.message, 200)));
};

const 본키 = new Set(); // 이번 계획에서 신호가 살아 있는 일감
/**
 * 일감을 만든다. 이미 있으면 내용만 갱신하고 상태는 이렇게 다룬다
 *   닫힘            신호가 다시 떴으니 대기로
 *   완료            cooldownH 가 지났으면 대기로 (고쳤는데 신호가 남았다 = 다시 할 일)
 *   관찰            next_try_at 이 지났으면 대기로
 *   나머지          그대로 (실행 중·사람 대기·로컬 대기·실패는 실행기가 정한다)
 */
const 일감 = async (t) => {
  본키.add(`${t.client_id}:${t.key}`);
  const status = t.status ?? "대기";
  await q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority, status, link)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
     on conflict (client_id, dedupe_key) do update set
       title = excluded.title, detail = excluded.detail,
       -- 새로 열린 일은 「확인 필요로 올림」 표시도 지운다. 시도 횟수와 같이 0 부터 센다
       payload = case when geo.agent_tasks.status = '닫힘'
                        or (geo.agent_tasks.status = '완료' and geo.agent_tasks.done_at < now() - make_interval(hours => $11))
                      then (geo.agent_tasks.payload - 'escalated') || excluded.payload
                      else geo.agent_tasks.payload || excluded.payload end,
       priority = excluded.priority, link = coalesce(excluded.link, geo.agent_tasks.link), updated_at = now(),
       status = case
         when geo.agent_tasks.status = '닫힘' then $9
         when geo.agent_tasks.status = '완료' and geo.agent_tasks.done_at < now() - make_interval(hours => $11) then $9
         when geo.agent_tasks.status = '관찰' and geo.agent_tasks.next_try_at <= now() then $9
         else geo.agent_tasks.status end,
       -- 새로 열린 일은 시도 횟수를 0 부터. 관찰에서 돌아온 일은 그대로 센다(주기마다 한 번씩 쌓여 사람에게 넘길 때를 정한다)
       attempts = case when geo.agent_tasks.status = '닫힘'
                         or (geo.agent_tasks.status = '완료' and geo.agent_tasks.done_at < now() - make_interval(hours => $11)) then 0
                       else geo.agent_tasks.attempts end,
       next_try_at = case when geo.agent_tasks.status in ('닫힘') then now() else geo.agent_tasks.next_try_at end`,
    [t.client_id, t.agent, t.kind, t.key, t.title, t.detail ?? "", JSON.stringify(t.payload ?? {}), t.priority ?? 50, status, t.link ?? null, t.cooldownH ?? 24],
  );
};

const 상태 = (id, status, patch = {}) =>
  q(`update geo.agent_tasks set status=$2, updated_at=now(),
       evidence = case when $3::text = '' then evidence else left(evidence || E'\n' || $3, 4000) end,
       last_error = coalesce($4, last_error), next_try_at = coalesce($5::timestamptz, next_try_at),
       done_at = case when $2 in ('완료','닫힘') then now() else done_at end,
       link = coalesce($6, link), attempts = attempts + $7
     where id=$1`,
    [id, status, patch.evidence ?? "", patch.error ?? null, patch.nextTry ?? null, patch.link ?? null, patch.attempt ? 1 : 0]);

/** 크레딧·잔액 때문에 막힌 것인가. 고장과 갈라야 한다 */
const 뒤 = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
/** 다음 KST 자정 (하루 몫이 다시 차는 때) */
const 내일 = () => { const d = new Date(Date.now() + 9 * 3600 * 1000); d.setUTCHours(24, 1, 0, 0); return new Date(d.getTime() - 9 * 3600 * 1000).toISOString(); };
const 오늘 = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
/** 다음에 오는 월요일 hm(KST). 월요일 그 시각 전이면 오늘 — 월요일 새벽의 건너뜀이 한 주를 통째로 넘기지 않게(Richard 17) */
const 다음월요일 = (hm = "07:00") => {
  const [h, m] = hm.split(":").map(Number);
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  const 오늘시각 = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), h, m);
  const 남은날 = k.getUTCDay() === 1 && k.getTime() < 오늘시각 ? 0 : ((8 - k.getUTCDay()) % 7) || 7;
  return new Date(오늘시각 + 남은날 * 86400000 - 9 * 3600 * 1000).toISOString();
};
/** 실패하면 1·3·6·12시간 뒤, 그 뒤로는 하루에 한 번. 사람에게 넘기지 않고 계속 다시 해 본다(2026-09-24 원장) */
const 다시해봄 = (n) => 뒤([1, 3, 6, 12][n - 1] ?? 24);

// ─────────────────────────────────────────── 1. 출근 기록
const WORKFLOWS = { "watch.yml": "ops", "scout.yml": "ops", "serp.yml": "measure", "snapshot.yml": "deliver", "write.yml": "content", "optimize.yml": "improve", "audit.yml": "ops", "repair.yml": "ops", "sales.yml": "sales" };
const gh = async (path, init = {}) => {
  if (!process.env.GH_TOKEN) return null;
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init, headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json", ...(init.headers ?? {}) },
  }).catch(() => null);
  if (!r) return null;
  if (r.status === 201 || r.status === 204) return {};
  return r.ok ? r.json() : { __error: `${r.status} ${끝(await r.text(), 200)}` };
};

const 출근기록 = async () => {
  const latest = {};
  let ok = true;
  for (const [file, agent] of Object.entries(WORKFLOWS)) {
    const d = await gh(`/actions/workflows/${file}/runs?per_page=5`);
    if (!d || d.__error) { ok = false; console.log(`  ⚠ ${file} 실행 기록을 못 읽음 ${d?.__error ?? "(GH_TOKEN 없음)"}`); continue; }
    밀림후보[file] = (d.workflow_runs ?? []).map((r) => Date.parse(r.created_at)).filter(Number.isFinite);
    const runs = (d.workflow_runs ?? []).filter((r) => r.status === "completed");
    latest[file] = runs[0] ?? null;
    for (const r of runs.reverse()) {
      const [seen] = await q(`select 1 from geo.agent_activity where run_url=$1 limit 1`, [r.html_url]);
      if (seen) continue;
      const ok = r.conclusion === "success";
      // 깨우기(wake.mjs)도 같은 줄을 적는다. 몇 초 차로 겹치면 한 줄만 — 부분 고유 색인 agent_activity_mirror_run_url(2026-09-24)
      await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url, at) values ($1,$2,$3,$4,$5,$6,$7)
               on conflict (run_url) where run_url is not null and action ~ '^자동 작업 [a-z]+$' do nothing`,
        [HOUSE, agent, `자동 작업 ${file.replace(".yml", "")}`, ok, `${r.event} · ${r.conclusion}`, r.html_url, r.updated_at]);
    }
  }
  return { latest, ok };
};

/**
 * 밀린 예약 — GitHub 가 건너뛴 아침 일을 대신 띄운다.
 *
 * 2026-09-24 아침: 감사 06:35·정찰 06:37·측정 07:05 가 08:45 까지 한 건도 안 떴다. 현황판은 「지연」만 빨갛게 칠했고 아무도 다시 돌리지 않았다.
 * 정해진 시각에서 90분이 지났는데(현황판 「늦음」과 같은 선) 그 뒤로 시작된 실행이 없으면 workflow_dispatch 한다.
 * 수리공(repair)·영업(sales)은 빼둔다 — 봇이 띄우면 사람이 띄운 실행처럼 읽힌다(Richard 9/22, heartbeat.mjs 주석).
 * ★ 시각은 각 yml 의 cron 을 KST 로 옮긴 것. yml 을 바꾸면 여기도 (web/lib/agents.ts ROLES 와 같은 값)
 */
const 밀림후보 = {};
const 예약 = {
  "snapshot.yml": { at: ["03:23"] },
  "audit.yml": { at: ["06:35"] },
  "scout.yml": { at: ["06:37"] },
  "optimize.yml": { at: ["07:05"] },
  "serp.yml": { at: ["07:41"] },
  "write.yml": { at: ["06:07"], dow: 1 },
};
const 밀린예약 = async () => {
  const now = Date.now();
  const KST = 9 * 3600 * 1000;
  const 띄움 = [];
  for (const [file, s] of Object.entries(예약)) {
    const runs = 밀림후보[file];
    if (!runs) continue;   // 기록을 못 읽었으면 짐작으로 띄우지 않는다
    // 가장 최근에 지난 정해진 시각 (오늘 또는 그 전날들)
    let slot = null;
    for (let k = 0; k <= 7 && slot === null; k++) {
      const day = new Date(now + KST - k * 86400000).toISOString().slice(0, 10);
      if (s.dow !== undefined && new Date(`${day}T00:00:00Z`).getUTCDay() !== s.dow) continue;
      for (const hm of [...s.at].reverse()) {
        const t = Date.parse(`${day}T${hm}:00+09:00`);
        if (t <= now) { slot = t; break; }
      }
    }
    if (slot === null || now - slot < 90 * 60 * 1000) continue;   // 아직 GitHub 이 늦게라도 띄울 수 있는 때
    if (runs.some((t) => t >= slot)) continue;   // 그 뒤로 시작된 실행이 있다(대기·진행 포함). 예약은 일찍 뜨지 않으니 시각 앞의 실행은 안 친다
    const r = await gh(`/actions/workflows/${file}/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main" }) });
    const 이름 = file.replace(".yml", "");
    if (r && !r.__error) {
      띄움.push(이름);
      await 활동(HOUSE, "ops", "밀린 예약 실행", true, `${이름} — 예약 시각이 90분 지나도 안 떠서 대신 띄움`);
    } else {
      // 꺼진 작업(422)처럼 매시 되풀이될 실패는 하루 한 줄만 — 매시 적으면 운영 줄이 매시 「실패」로 칠해진다(Richard 16)
      const [적음] = await q(`select 1 from geo.agent_activity where action = '밀린 예약 실행' and not ok and summary like $1 and at > now() - interval '24 hours' limit 1`, [`${이름} —%`]);
      console.log(`  ⚠ ${이름} 대신 띄우기 실패 ${r?.__error ?? "GH_TOKEN 없음"}`);
      if (!적음) await 활동(HOUSE, "ops", "밀린 예약 실행", false, `${이름} — 띄우기 실패 ${끝(r?.__error ?? "GH_TOKEN 없음", 120)}`);
    }
  }
  if (띄움.length) console.log(`  밀린 예약 대신 띄움: ${띄움.join(", ")}`);
};

/**
 * 원장 PC 무실행 경보 (Step 23 D2). 판정은 pc-silent.mjs.
 * sticky 라 아래 「신호 사라짐」 닫기에 안 걸린다 — PC 가 돌아오면 여기서 직접 닫는다.
 * 흔적을 못 읽으면 열지도 닫지도 않는다
 */
const PC살핌 = async () => {
  const [흔적] = await q(`select
      (select updated_at from geo.settings where key = 'pc_heartbeat') as heartbeat,
      (select max(imported_at) from academy.ai_measurements where collection_method like '%-web-logged-out') as measure,
      (select max(at) from geo.agent_activity where agent = 'deliver' and action = '로컬 에이전트 출근') as local`).catch(() => [null]);
  const 판정 = 흔적 ? PC무소식(흔적) : null;
  if (!판정) { console.log("  ⚠ PC 흔적을 못 읽음 — PC 경보 판정 안 함"); return; }
  if (판정.조용함) {
    const 글 = PC무소식글(판정);
    await 일감({ client_id: HOUSE, agent: "deliver", kind: "pc-silent", key: "pc-silent", priority: 5, status: "사람 대기",
      title: 글.title, detail: 글.detail, payload: { sticky: true, hours: 판정.시간 } });
    return;
  }
  for (const t of await q(`select id from geo.agent_tasks where client_id=$1 and dedupe_key='pc-silent' and status not in ('완료','닫힘')`, [HOUSE])) {
    await 상태(t.id, "닫힘", { evidence: `${오늘()} PC 일꾼이 다시 돎 — ${판정.시간}시간 전 마지막 기록` });
    await 활동(HOUSE, "deliver", "일감 닫음", true, "원장 PC 일꾼이 다시 돕니다", t.id);
  }
};

/**
 * 30일 파일럿 (Step 26 D5·D10).
 * 착수일·기간·업무 기한을 맞추고(academy/pilot-plan.mjs), 기한이 지난 안 끝난 업무를 원장 「사람 대기」로 올린다.
 * 키는 pilot-<파일럿>-<업무> — 완료로 바꾸면 신호가 사라져 닫힌다. 진행 중(준비·진행) 파일럿만. 리허설·취소는 안 올린다.
 * 칸 준비·날짜 맞추기가 실패해도 기한 확인은 한다. 기한을 못 읽으면 「읽음」을 안 붙여 열린 일감을 닫지 않는다
 */
const 파일럿업무 = async (읽음) => {
  await 파일럿칸준비(q).catch((e) => console.log("  ⚠ 파일럿 칸 준비 실패", 끝(e.message, 200)));
  await 파일럿날짜맞추기(q)
    .then((바뀜) => { for (const x of 바뀜) console.log(`  파일럿 날짜: ${x}`); })
    .catch((e) => console.log("  ⚠ 파일럿 날짜를 못 맞춤", 끝(e.message, 200)));
  const late = await q(`select t.code, t.title, t.owner, t.due_on::text as due_on, p.id as pilot_id, p.client_id, c.name
      from geo.pilot_tasks t join geo.pilots p on p.id = t.pilot_id join geo.clients c on c.id = p.client_id
     where p.status in ('준비', '진행') and p.cancelled_on is null and t.status <> '완료'
       and t.due_on < (now() at time zone 'Asia/Seoul')::date
     order by t.due_on, t.id`).catch((e) => { console.log("  ⚠ 파일럿 업무를 못 읽음", 끝(e.message, 200)); return null; });
  /**
   * 입금 확인일 뒤 7일이 지나도 착수(질문 승인 뒤 첫 측정)가 없으면 원장 할 일로 올린다(Richard 26 2차, Arch).
   * 30일은 입금 확인일부터라 승인이 17일 이상 늦으면 기준선 7일과 마지막 7일이 겹쳐 판정할 수 없다.
   * 착수되면 신호가 사라져 닫힌다. 준비·진행만(리허설·취소 제외)
   */
  const 늦은승인 = await q(`select p.id, p.client_id, p.needs_build, c.name,
        ((now() at time zone 'Asia/Seoul')::date - p.paid_on)::int as n
      from geo.pilots p join geo.clients c on c.id = p.client_id
     where p.status in ('준비', '진행') and p.cancelled_on is null and p.kickoff_on is null and p.paid_on is not null
       and (now() at time zone 'Asia/Seoul')::date - p.paid_on >= 7`)
    .catch((e) => { console.log("  ⚠ 파일럿 착수 대기를 못 읽음", 끝(e.message, 200)); return null; });
  /**
   * 구축·세팅 고객이 착수 뒤 60일이 되도록 사이트 연 날이 없으면 측정에서 빠진다(measure-targets.mjs). 원장이 넣어야 30일이 시작된다(Step 28 D22).
   * 연 날을 넣으면 신호가 사라져 닫힌다
   */
  const 연날없음 = await q(`select p.id, p.client_id, c.name, p.kickoff_on::text as kickoff_on
      from geo.pilots p join geo.clients c on c.id = p.client_id
     where p.status in ('준비', '진행') and p.cancelled_on is null and p.needs_build in ('setup', 'build')
       and p.kickoff_on is not null and p.site_launch_on is null
       and (now() at time zone 'Asia/Seoul')::date >= p.kickoff_on + $1::int`, [구축대기한도])
    .catch((e) => { console.log("  ⚠ 파일럿 사이트 연 날 대기를 못 읽음", 끝(e.message, 200)); return null; });
  // 셋 다 읽었을 때만 「읽음」 — 하나라도 못 읽으면 열린 pilot-* 일감을 신호 사라짐으로 닫지 않는다
  if (late && 늦은승인 && 연날없음) 읽음.add("pilot");
  for (const p of 연날없음 ?? []) {
    await 일감({ client_id: p.client_id, agent: "deliver", kind: "human", key: `pilot-launch-${p.id}`, priority: 12, status: "사람 대기",
      title: `${p.name} 사이트 연 날을 넣어 주세요`,
      detail: `착수(${p.kickoff_on}) 뒤 ${구축대기한도}일이 지나도록 사이트 연 날이 비어 있어 AI 측정에서 뺐습니다. 30일은 연 날부터 셉니다. 파일럿 화면에서 연 날을 넣으면 다음 측정부터 다시 잽니다.`,
      link: `${ADMIN}/admin/pilots/${p.id}` });
  }
  for (const p of 늦은승인 ?? []) {
    await 일감({ client_id: p.client_id, agent: "deliver", kind: "human", key: `pilot-kickoff-${p.id}`, priority: 12, status: "사람 대기",
      title: `${p.name} 파일럿 질문 승인이 입금 뒤 ${p.n}일째 안 됐습니다${p.needs_build === "none" ? " — 17일이 되면 판정할 수 없습니다" : ""}`,
      detail: p.needs_build === "none"
        ? "30일은 입금 확인일부터 셉니다(신청서). 승인이 늦을수록 시작 기준(첫 7일)과 마지막 7일이 가까워지고, 17일이 되면 겹쳐서 늘었는지 판정할 수 없습니다. 고객에게 질문 20개 승인을 다시 요청해 주세요."
        : "질문 20개를 승인받아야 기준선(첫 7일)을 잴 수 있습니다. 고객에게 승인을 다시 요청해 주세요.",
      link: `${ADMIN}/admin/pilots/${p.id}` });
  }
  for (const t of late ?? []) {
    await 일감({ client_id: t.client_id, agent: "deliver", kind: "human", key: `pilot-${t.pilot_id}-${t.code}`, priority: 15, status: "사람 대기",
      title: `파일럿 기한 지남: ${t.title}`,
      detail: `${t.name} · 기한 ${t.due_on} · 맡은 쪽 ${t.owner}. 끝냈으면 파일럿 화면에서 완료로 바꾸고 근거를 적어 주세요. 고객 몫이면 고객에게 다시 요청합니다.`,
      link: `${ADMIN}/admin/pilots/${t.pilot_id}` });
  }
};

// ─────────────────────────────────────────── 2. 계획
/**
 * 글 쓰는 길이 세션인 고객(clients.mjs loop.draft = "session", 아이로그)의 「겨냥 초안」 일감을 「세션 대기」로 올린다(Step 30 D37).
 * 9/24 부터 「관찰」로 한 달씩 미뤄 아무도 안 봤다. 원장 할 일(사람 대기)에는 안 넣는다 — 현황판 할 일은 원장 몫만(Arch).
 * 현황판은 할 일 상자 밖에 「세션에서 할 일 n건」 한 줄로 보인다. 글은 Claude 세션이 쓴다 — 여기서는 상태·제목만 고친다
 */
const 세션글열기 = async (clients) => {
  for (const c of clients.filter((x) => x.conf?.loop?.draft === "session")) {
    const 멈춤 = await q(`select id, payload->>'question' as question from geo.agent_tasks
                          where client_id=$1 and kind='question-draft' and status='관찰' and payload ? 'question'`, [c.id]);
    for (const t of 멈춤) {
      // 열린 세션 글은 고객당 1개(Step 40 D60) — 이미 열린 것이 있으면 질문만 묶고 이 일감은 닫는다
      const 묶음 = await 세션일감묶기(q, { c, 질문: t.question, 출처: `관찰 일감 #${t.id}`, 오늘: 오늘().slice(0, 10), DRY: false });
      if (묶음?.묶음) { await 상태(t.id, "닫힘", { evidence: `${오늘()} #${묶음.id} 에 묶음` }); continue; }
      if (묶음) continue; // 상한 — 관찰로 둔다
      await q(`update geo.agent_tasks set status='세션 대기', title=$2, last_error=$3, updated_at=now(),
                 evidence = left(evidence || $4, 4000) where id=$1 and status='관찰'`,
        [t.id, 세션글제목(c.name, t.question), 세션글할일(c), `\n${오늘()} 세션 글 일감으로 올림`]);
    }
    if (멈춤.length) console.log(`  세션 글 일감: ${c.name} ${멈춤.length}건 관찰 → 세션 대기`);
  }
};
const 세션글할일 = (c) => `Claude 세션에서 ${c.conf.loop.draftWhere} 에 씁니다`;

/**
 * 등재 일감(listing)의 검색어가 최근 7일 네이버(웹문서·통합)에서 이미 나오면 저절로 끝낸다(Step 40 D62).
 * 하루 걸렸다 빠지면 who-wins(주 1회)가 다시 연다. sticky 라 「신호 사라짐」으로는 안 닫힌다
 */
const 등재닫기 = async () => {
  const 나옴 = await q(`select t.id, to_char(max(s.day), 'FMMM/FMDD') d
      from geo.agent_tasks t
      join academy.serp_checks s on s.client_id = t.client_id and s.query = t.payload->>'query'
       and s.engine in ('naver', 'naver_all') and s.hit and s.day > (now() at time zone 'Asia/Seoul')::date - 7
     where t.kind = 'listing' and t.status not in ('완료', '닫힘')
     group by t.id`);
  for (const t of 나옴) await 상태(t.id, "완료", { evidence: `${오늘()} 네이버 검색에 이미 나옴(${t.d} 측정)` });
  if (나옴.length) console.log(`  등재 일감 ${나옴.length}건 — 네이버에 이미 나와 완료`);
};

const 계획 = async (clients, { latest: latestRuns, ok: ghOk }) => {
  const bySlug = Object.fromEntries(clients.map((c) => [c.slug, c]));
  // 신호원을 못 읽었는데 「신호가 사라졌다」고 닫으면 다음 시간에 대기로 다시 열려 쿨다운을 건너뛴다.
  // 그래서 읽기에 성공한 신호원의 일감만 닫는다
  const 읽음 = new Set(["drafts"]);
  if (ghOk) 읽음.add("gh");

  // 정찰 신호
  const sc = 실행(["scripts/scout.mjs", "--json"], 5 * 60 * 1000);
  let found = [];
  try { found = JSON.parse(sc.out.slice(sc.out.indexOf("["))); if (sc.ok && Array.isArray(found)) 읽음.add("scout"); }
  catch { found = []; console.log("  ⚠ 정찰 결과를 못 읽음 — 정찰 일감은 닫지 않음", 끝(sc.out, 200)); }
  for (const f of found) {
    const [prefix, ...rest] = f.key.split("-");
    const slug = prefix === "cov" ? rest.slice(0, -1).join("-") : rest.join("-");
    const c = bySlug[slug] ?? bySlug.robotncoding;
    const base = { client_id: c.id, title: f.what, detail: `${f.why}\n할 일: ${f.todo}` };
    const vendor = prefix === "cov" ? rest.at(-1) : null;
    const map = {
      cov: { agent: "deliver", kind: "crawl-push", key: f.key, priority: 40, payload: { vendor }, cooldownH: 24 * 7 },
      brand: { agent: "measure", kind: "brand-defense", key: f.key, priority: 10 },
      rival: { agent: "measure", kind: "who-wins", key: f.key, priority: 30, cooldownH: 24 * 7 },
      publish: { agent: "content", kind: "weekly-draft", key: f.key, priority: 20, cooldownH: 24 * 3 },
      naver: { agent: "deliver", kind: "naver-transfer", key: f.key, priority: 40, status: "로컬 대기" },
      crawl: { agent: "ops", kind: "site-check", key: f.key, priority: 5, cooldownH: 6 },
      baseline: { agent: "ops", kind: "rescan", key: `rescan-${slug}`, priority: 45, cooldownH: 24 * 3 },
      rescan: { agent: "ops", kind: "rescan", key: `rescan-${slug}`, priority: 45, cooldownH: 24 * 3 },
      nomeasure: { agent: "measure", kind: "check-index", key: f.key, priority: 15 },
      notracker: { agent: "ops", kind: "human", key: f.key, priority: 60, status: "사람 대기" },
      inquiry: { agent: "sales", kind: "human", key: f.key, priority: 20, status: "사람 대기", link: `${ADMIN}/admin/inquiry` },
      lead: { agent: "sales", kind: "human", key: f.key, priority: 50, status: "사람 대기", link: `${ADMIN}/admin` },
    }[prefix];
    if (!map) { console.log(`  ⚠ 모르는 정찰 신호 ${f.key} — 운영 담당 사람 대기로`); }
    await 일감({ ...base, ...(map ?? { agent: "ops", kind: "human", key: f.key, priority: 50, status: "사람 대기" }) });
  }

  // 초안 — 검토 화면에서 읽고 발행할 일
  // 내린 글(비공개이유)은 초안이 아니다. 검토 화면이 안 보여 주는데 할 일로 띄우면 「초안이 없다」가 된다(2026-09-29)
  for (const p of await q(`select slug, title, client_id from academy.posts where not published and ${내린글아님} order by created_at`)) {
    await 일감({ client_id: p.client_id, agent: "content", kind: "review", key: `review-${p.slug}`, priority: 15,
      title: `초안 검토: ${p.title}`, detail: "AI 티를 검사하고 다듬은 뒤, 사실 확인·발행을 원장에게 넘깁니다.",
      payload: { slug: p.slug }, link: `${ADMIN}/admin/drafts#${p.slug}` });
  }
  // 도해 없는 초안 — 도해는 무조건이다(원장 2026-09-22). 붙을 때까지 다시 그리고, 두 번 넘게 못 붙이면 사람에게도 알린다 (Step 12, illustrate.mjs)
  for (const p of await q(`select slug, title, client_id, coalesce((review_notes->'삽화'->>'시도')::int, 0) 시도,
                             review_notes->'삽화'->'버린것' 버린것 from academy.posts
                            where not published and ${내린글아님} and position('![' in body) = 0 and length(body) >= 600 order by created_at`)) {
    await 일감({ client_id: p.client_id, agent: "content", kind: "illustrate", key: `illustrate-${p.slug}`, priority: 16,
      title: `도해 그리기: ${p.title}`, detail: "초안에 도해 2~3장을 그려 붙입니다. 본문에 없는 숫자·다른 고객사 이름·값에 안 맞는 막대가 든 그림은 버립니다.",
      payload: { slug: p.slug }, link: `${ADMIN}/admin/drafts#${p.slug}` });
    if (p.시도 >= 2) {
      await 일감({ client_id: p.client_id, agent: "content", kind: "human", key: `illustrate-human-${p.slug}`, priority: 25, status: "사람 대기",
        title: `도해를 못 붙임: ${p.title}`,
        detail: `삽화 담당이 ${p.시도}번 그렸지만 검사에서 다 버려졌습니다. 삽화 담당은 계속 다시 그립니다. 급하면 Claude 세션에서 그려 넣어 주세요.\n마지막에 버린 이유: ${끝((p.버린것 ?? []).join(" / "), 400)}`,
        link: `${ADMIN}/admin/drafts#${p.slug}` });
    }
  }
  // 발행본은 도해 없이 나가면 안 된다 — 이미 나간 글은 사람이 본 것이라 에이전트가 손대지 않고 사람에게 올린다
  for (const p of await q(`select slug, title, client_id from academy.posts where published and position('![' in body) = 0 order by published_at`)) {
    await 일감({ client_id: p.client_id, agent: "content", kind: "human", key: `noimg-${p.slug}`, priority: 30, status: "사람 대기",
      title: `도해 없이 발행된 글: ${p.title}`, detail: "발행본은 에이전트가 고치지 않습니다. Claude 세션에서 도해를 그려 public/blog/<슬러그>/ 에 넣고 본문에 끼워 주세요.",
      link: `https://${clients.find((c) => c.id === p.client_id)?.domain ?? "robotncoding.com"}/blog/${p.slug}` });
  }

  // 상담 결과 미입력 · 새 리드
  const inq = await q(`select client_id, count(*)::int n from academy.inquiries where enrolled is null group by client_id`).catch(() => null);
  const [lead] = await q(`select count(*)::int n from geo.leads where coalesce(status,'new')='new'`).catch(() => [null]);
  if (inq && lead) 읽음.add("db");
  for (const r of inq ?? []) {
    await 일감({ client_id: r.client_id, agent: "sales", kind: "human", key: "inquiry-result", priority: 20, status: "사람 대기",
      title: `상담 결과 미입력 ${r.n}건`, detail: "등록했는지 안 했는지를 적어야 노출이 매출로 이어지는지 압니다. 30초면 됩니다.",
      link: `${ADMIN}/admin/inquiry?c=${r.client_id}` });
  }
  if (lead?.n > 0) {
    await 일감({ client_id: HOUSE, agent: "sales", kind: "human", key: "lead-new", priority: 10, status: "사람 대기",
      title: `연락 안 한 리드 ${lead.n}건`, detail: "진단을 받고 연락처를 남긴 사람입니다. 하루 안에 연락해야 식지 않습니다.", link: `${ADMIN}/admin` });
  }

  // 초안 재료 — 읽기만 한다. 모자라도 일감을 만들지 않는다(아래)
  const [mat] = await q(`select count(*) filter (where cardinality(used_in) = 0)::int unused,
                                max(day)::text last from academy.materials where client_id = 1`).catch(() => [null]);
  // 2026-09-24 원장: 「초안 작성이 필수는 아니고 없으면 패스」 — 글감이 모자라도 원장 할 일로 올리지 않는다.
  // 신호를 안 만들고 「읽음」만 표시해 두면 옛 material-need 일감은 아래에서 「신호 사라짐」으로 닫힌다
  if (mat) 읽음.add("material");

  // 자동 작업 실패
  for (const [file, run] of Object.entries(latestRuns)) {
    if (!run || run.conclusion === "success" || run.conclusion === "skipped" || run.conclusion === "cancelled") continue;
    await 일감({ client_id: HOUSE, agent: "ops", kind: "workflow-failed", key: `wf-${file}`, priority: 5, cooldownH: 1,
      title: `자동 작업 실패: ${file}`, detail: `마지막 실행이 ${run.conclusion} 입니다.`, payload: { file, run_id: run.id, url: run.html_url }, link: run.html_url });
  }

  await PC살핌();
  // 현황판 「로그인 창 열기」를 PC 가 30분 안에 안 집으면(꺼짐) 실패로 — 원장이 눌러 놓고 기다리지 않게(Step 39b)
  for (const r of await 오래된창요청닫기(q).catch((e) => { console.log("  ⚠ 로그인 창 요청 정리 실패", 끝(e.message, 200)); return []; })) {
    await 활동(r.client_id, "deliver", "로그인 창 못 엶", false, r.last_error, r.id);
  }
  // 「이 질문에 답하기」(Step 41)도 같은 규칙 — 30분 안에 PC 가 안 집으면 실패로
  for (const r of await 오래된kin요청닫기(q).catch((e) => { console.log("  ⚠ 지식iN 답 창 요청 정리 실패", 끝(e.message, 200)); return []; })) {
    await 활동(r.client_id, "deliver", "지식iN 답 창 못 엶", false, r.last_error, r.id);
  }
  await 파일럿업무(읽음);
  await 세션글열기(clients);
  await 등재닫기().catch((e) => console.log("  ⚠ 등재 일감 닫기 실패", 끝(e.message, 200)));

  // 신호가 사라진 일감은 닫는다. 발행 후 알리기처럼 신호 없이 만든 일감(sticky)은 손대지 않는다
  const open = await q(`select id, client_id, dedupe_key, title from geo.agent_tasks
    where status in ('대기','관찰','사람 대기','로컬 대기','실패') and not coalesce((payload->>'sticky')::boolean, false)
      and (case when dedupe_key like 'wf-%' then 'gh'
                when dedupe_key like 'review-%' or dedupe_key like 'illustrate-%' or dedupe_key like 'noimg-%' then 'drafts'
                when dedupe_key in ('inquiry-result', 'lead-new') then 'db'
                when dedupe_key = 'material-need' then 'material'
                when dedupe_key like 'login-%' then 'local'
                when dedupe_key like 'pilot-%' then 'pilot'
                -- 고객사 세팅 일감(Step 38)은 세팅재점검 이 체크리스트로 열고 닫는다 — 여기서 「신호 사라짐」으로 닫지 않는다
                when dedupe_key like 'setup-%' then 'setup'
                else 'scout' end) = any($1)`, [[...읽음]]);
  for (const t of open) {
    if (본키.has(`${t.client_id}:${t.dedupe_key}`)) continue;
    await 상태(t.id, "닫힘", { evidence: `${오늘()} 신호가 사라져 닫음` });
    await 활동(t.client_id, "ops", "일감 닫음", true, `신호 사라짐: ${t.title}`, t.id);
  }
};

// ─────────────────────────────────────────── 3. 실행기
const clientOf = (clients, id) => clients.find((c) => c.id === id);

const EXEC = {
  // ── 운영
  async "workflow-failed"(t) {
    const { run_id, file } = t.payload;
    // 수리공은 다시 띄우지 않는다 — 회사 루프가 띄우면 사람이 띄운 실행처럼 보이고, rerun 은 실패한 merge 를 승인 없이 되풀이한다(Richard 9/22).
    // 대신 매일 06:50 예약이 다시 돈다. 사람에게도 넘기지 않는다
    if (file === "repair.yml") return { status: "관찰", nextTry: 뒤(24), attempt: true, evidence: `${오늘()} 수리 실패 — 다음 06:50 예약이 다시 돈다` };
    // 영업도 다시 띄우지 않는다. 같은 주에 두 번 돌면 Claude 호출이 6일 제한에 걸려 숫자 없는 틀로 통화문·답장 초안을 덮어쓴다(Richard 17).
    // 다음 월요일 08:10 예약이 다시 돈다
    if (file === "sales.yml") return { status: "관찰", nextTry: 다음월요일("08:40"), attempt: true, evidence: `${오늘()} 영업 정리 실패 — 다음 월요일 08:10 예약이 다시 돈다` };
    // 이미 새로 띄운 실행이 돌고 있으면 또 띄우지 않는다
    const 최근 = await gh(`/actions/workflows/${file}/runs?per_page=1`);
    if (최근?.workflow_runs?.[0] && 최근.workflow_runs[0].status !== "completed") {
      return { status: "관찰", nextTry: 뒤(1), evidence: `${오늘()} 다시 띄운 실행이 도는 중` };
    }
    const 입력 = { ref: "main" };
    if (t.attempts >= 1) {
      // 원장(2026-09-24): 「실패해도 스스로 다시 시작」. 두 번째부터는 간격을 늘려 계속 새로 띄운다 — 사람 대기로 넘기지 않는다
      const jobs = await gh(`/actions/runs/${run_id}/jobs`);
      const steps = (jobs?.jobs ?? []).flatMap((j) => (j.steps ?? []).filter((s) => s.conclusion === "failure").map((s) => `${j.name} › ${s.name}`));
      const 새로 = await gh(`/actions/workflows/${file}/dispatches`, { method: "POST", body: JSON.stringify(입력) });
      const 간격 = 다시해봄(t.attempts);
      return {
        status: "관찰", nextTry: 간격, attempt: true,
        evidence: `${오늘()} ${t.attempts + 1}번째 다시 띄움${새로 && !새로.__error ? "" : ` 실패(${끝(새로?.__error ?? "GH_TOKEN 없음", 80)})`} · 실패한 단계: ${steps.join(", ") || "확인 못함"}`,
      };
    }
    {
      // 첫 실패 — 재실행(rerun)은 그 실행이 쓰던 옛 커밋의 설정으로 돈다. 고쳐 놓은 코드로 다시 해 보려면 새로 띄워야 한다 —
      // write.yml 이 제미나이 키로 재실행돼 같은 429 로 또 죽었다(2026-09-17)
      const 새로 = await gh(`/actions/workflows/${file}/dispatches`, { method: "POST", body: JSON.stringify(입력) });
      if (새로 && !새로.__error) return { status: "관찰", nextTry: 뒤(1), evidence: `${오늘()} 최신 코드로 새로 실행함`, attempt: true };
      const r = await gh(`/actions/runs/${run_id}/rerun-failed-jobs`, { method: "POST" });
      if (r && !r.__error) return { status: "관찰", nextTry: 뒤(2), evidence: `${오늘()} 새로 띄우지 못해(${끝(새로?.__error, 80)}) 실패한 잡만 다시 돌림`, attempt: true };
      return { status: "관찰", nextTry: 뒤(2), evidence: `${오늘()} 재실행 요청 실패 ${r?.__error ?? "GH_TOKEN 없음"}`, attempt: true };
    }
  },

  async "site-check"(t, c) {
    const home = await fetch(`https://${c.domain}/`).then((r) => r.status).catch((e) => `오류 ${e.message}`);
    const robots = await fetch(`https://${c.domain}/robots.txt`).then(async (r) => `${r.status} ${/Disallow:\s*\/\s*$/m.test(await r.text()) ? "전체 차단 줄 있음" : ""}`).catch((e) => `오류 ${e.message}`);
    const ok = home === 200 && String(robots).startsWith("200") && !String(robots).includes("차단");
    return ok
      ? { status: "관찰", nextTry: 뒤(6), evidence: `${오늘()} 홈 ${home} · robots ${robots} — 사이트는 정상. 크롤러 쪽 공백으로 봄` }
      : { status: "사람 대기", evidence: `${오늘()} 홈 ${home} · robots ${robots}`, error: "사이트 응답 이상 — 배포·도메인 확인 필요" };
  },

  async rescan(t, c) {
    const r = 실행(["scripts/rescan.mjs", "--client", c.slug]);
    return r.ok ? { status: "완료", evidence: `${오늘()} 재진단 ${끝(r.out, 160)}` } : { status: "실패", error: 끝(r.out), attempt: true };
  },

  // ── 측정
  async "check-index"() {
    const r = 실행(["scripts/check-index.mjs"]);
    return r.ok ? { status: "완료", evidence: `${오늘()} 노출 재측정 ${끝(r.out, 160)}` } : { status: "실패", error: 끝(r.out), attempt: true };
  },

  async "brand-defense"(t, c) {
    const idx = 실행(["scripts/indexnow.mjs", "--client", c.slug, "/"]);
    const 결과 = 색인결과(idx.out, idx.ok);
    // 키가 없는 고객은 저장소가 배포 때 색인 알림을 보낸다. 건너뜀을 실패로 세면 3회 뒤 사람 대기로 갔다(#1385)
    if (결과 === "키없음") {
      return { status: "관찰", nextTry: 뒤(24), evidence: `${오늘()} 색인 알림은 이 고객 저장소가 배포 때 보냄 — 여기서는 안 보냄` };
    }
    const sent = 결과 === "접수";
    if (t.attempts >= 3) {
      return { status: "사람 대기", attempt: true, evidence: `${오늘()} 색인 알림 ${sent ? "접수" : "실패"} · 3회 밀어도 이름 검색에 안 나옴`,
        error: "구글 서치콘솔 색인 요청과 네이버 플레이스·서치어드바이저 등록 상태를 확인해야 합니다 (로그인 필요)" };
    }
    return { status: "관찰", nextTry: 뒤(24), attempt: true, evidence: `${오늘()} 홈 색인 알림 ${sent ? "접수" : "실패"} — 내일 측정에서 다시 봄` };
  },

  async "who-wins"(t, c, clients) {
    const r = 실행(["scripts/who-wins.mjs", "--client", c.slug], 10 * 60 * 1000);
    if (!r.ok || r.out.length < 200) return { status: "실패", attempt: true, error: `이기는 지면을 못 가져옴 ${끝(r.out, 200)}` };
    const ans = await 물어보기([
      "너는 지역 학원의 검색 노출을 맡은 분석가다. 아래는 네이버 웹문서에서 우리가 안 나오는 검색어마다 무엇이 이기고 있는지다.",
      `우리: ${c.name} (${c.domain})`,
      "검색어마다 하나를 골라라:",
      '- "content": 블로그·칼럼·비교글이 이기는 자리. 우리 사이트에 그 검색어에 곧장 답하는 글을 쓰면 겨룰 수 있다',
      '- "listing": 학원 목록·지도·플랫폼(예: 학원 정보 모음, 지도, 카페)이 이기는 자리. 글이 아니라 그곳에 등재돼야 한다',
      "지어내지 마라. 출력에 없는 사이트를 적지 마라.",
      "종류에 「·우리있음」이 붙은 결과는 그 페이지 안에 이미 우리가 올라 있다는 뜻이다. 그곳은 targets 에 넣지 마라 — 등재할 곳이 아니다.",
      '형식: {"items":[{"query":"검색어","action":"content|listing","question":"학부모가 실제로 칠 질문형 문장","targets":["이기는 도메인"],"reason":"한 줄"}]}',
      "",
      r.out.slice(-12000),
    // 「등재 필요」인데 이기는 곳이 비어 있으면 짐작이다 — 어디에 등재하라는지 모르는 일감은 사람에게 쓸모가 없다(2026-09-21 원장 지적)
    ].join("\n"), 6000, (j) => Array.isArray(j?.items) && j.items.every((it) => it?.action !== "listing" || (it.targets ?? []).length > 0));
    // 돈이 없어 못 부른 것은 고장이 아니다. 세 번 실패로 세어 사람에게 넘기면 진짜 고장이 묻힌다
    if (ans.error && ans.돈없음) return { status: "대기", nextTry: 뒤(12), evidence: `${오늘()} 크레딧이 없어 분석을 미룸` };
    if (ans.error) return { status: "실패", attempt: true, error: `분석 실패: ${ans.error}` };
    const made = [];
    for (const it of ans.json.items ?? []) {
      if (!it?.query) continue;
      const h = crypto.createHash("sha1").update(it.query).digest("hex").slice(0, 10);
      if (it.action === "listing") {
        await 일감({ client_id: c.id, agent: "deliver", kind: "listing", key: `listing-${h}`, priority: 35, status: "사람 대기",
          title: `등재 필요: 「${it.query}」`, detail: `${it.reason ?? ""}\n이기는 곳: ${(it.targets ?? []).join(", ")}. 등록·수정은 업체 로그인이 필요합니다.`,
          payload: { sticky: true, query: it.query, targets: it.targets ?? [] } });
      } else {
        // 글 쓰는 길이 세션인 고객은 처음부터 세션 글 일감(세션 대기)으로 — 관찰로 묵히지 않는다(Step 30 D37)
        const 세션 = c.conf?.loop?.draft === "session";
        // 세션 고객은 같은 질문이면 한 일감 — 개선 루프(daily-agent)와 같은 규칙: 질문 글자로 있는 일감 키, 없으면 세션글키(질문)
        const 질문 = it.question || it.query;
        const 있음 = 세션 ? await 같은질문일감(q, c.id, 질문) : undefined;
        // 열린 세션 글은 고객당 1개(Step 40 D60). 이미 열린 일감에 있는 질문이면 그대로, 다른 일감이 열려 있으면 그 일감에 질문만 묶는다
        if (있음?.status === "세션 대기") { made.push(`${it.query}→열린 일감 #${있음.id}`); continue; }
        if (세션) {
          const 묶음 = await 세션일감묶기(q, { c, 질문, 출처: "이기는 지면 분석", 오늘: 오늘().slice(0, 10), DRY: false });
          if (묶음) { made.push(`${it.query}→묶음 #${묶음.id}`); continue; }
        }
        const 키 = 세션 ? (있음?.dedupe_key ?? 세션글키(질문)) : `qdraft-${h}`;
        await 일감({ client_id: c.id, agent: "content", kind: "question-draft", key: 키, priority: 35,
          title: 세션 ? 세션글제목(c.name, 질문) : `겨냥 초안: 「${질문}」`,
          detail: `${it.reason ?? ""}\n이기는 곳: ${(it.targets ?? []).join(", ")}`,
          // 끝낸 세션 글을 24시간 뒤 다시 열면 7일 판정 창이 끝나기 전에 같은 글을 또 쓰라는 일감이 선다 — 30일 쉰다
          ...(세션 ? { status: "세션 대기", cooldownH: 24 * 30 } : {}),
          payload: { sticky: true, question: 질문, stage: "local", sources: it.targets ?? [] } });
      }
      made.push(`${it.query}→${it.action}`);
    }
    return { status: "관찰", nextTry: 뒤(24 * 7), evidence: `${오늘()} 분석: ${made.join(" · ") || "만든 일감 없음"}` };
  },

  // ── 콘텐츠
  async "weekly-draft"(t, c) {
    if (!c.conf?.publishes || c.id !== 1) return { status: "사람 대기", error: "이 고객사는 사이트 글을 우리가 올리지 않습니다 (clients.mjs publishes=false)" };
    /**
     * 주 1편(Step 43 D88). 이번 주(KST) 발행 1편이면 다음 월요일. 감수 중인 자동 초안이 있으면 감수가 끝날 때까지 내일 다시.
     * 한 주 2주제까지 — 이번 주 버림 2건이면 「못냄」 한 줄 남기고 다음 월요일.
     * 주제·쓰기는 auto-post.mjs --pick 한 곳(write.yml 도 같은 길). 질문 겨냥 초안도 여기 후보로만 들어온다(D92).
     * 쓰기 건너뜀(78)은 고장이 아니다 — 원장에게 올리지 않는다(2026-09-24 「없으면 패스」)
     */
    const 이번주 = await q(이번주글SQL, [c.id]);
    if (이번주.some((p) => p.published)) return { status: "대기", nextTry: 다음월요일(), evidence: `${오늘()} 이번 주 글이 이미 나감(주 1편)` };
    if (이번주.length) return { status: "대기", nextTry: 내일(), evidence: `${오늘()} 감수 중인 초안이 있어 새로 쓰지 않음 (/blog/${이번주[0].slug})` };
    const [주] = await q(`select count(*) filter (where kind='버림')::int 버림, count(*) filter (where kind='못냄')::int 못냄
        from academy.post_reviews where client_id=$1 and at >= (date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`, [c.id])
      .catch(() => [null]);
    if (!주) return { status: "실패", attempt: true, error: "글 기록 표(academy.post_reviews)를 못 읽음 — setup-post-reviews.mjs 를 먼저" };
    if (주.못냄) return { status: "대기", nextTry: 다음월요일(), evidence: `${오늘()} 이번 주는 못 냄으로 끝남` };
    if (주.버림 >= 2) {
      await 기록하기(q, { client: c.id, topic_key: `week:${KST날()}`, kind: "못냄", why: "주제 2개 다 3번 걸림" })
        .catch((e) => console.log("  ⚠ 못냄 기록 실패", e.message));
      await 활동(c.id, "content", "이번 주 글 못 냄", true, "주제 2개가 다 자동 감수에 3번 걸림 — 다음 월요일에 새 주제", t.id);
      return { status: "대기", nextTry: 다음월요일(), evidence: `${오늘()} 이번 주 못 냄 — 주제 2개 다 3번 걸림` };
    }
    const r = 실행(["scripts/auto-post.mjs", "--pick"]);
    let o = null;
    try { o = JSON.parse(/^AUTOPOST=(.+)$/m.exec(r.out)?.[1] ?? ""); } catch { o = null; }
    switch (o?.상태) {
      case "씀": return { status: "완료", link: `${ADMIN}/admin/drafts#${o.slug}`, evidence: `${오늘()} 초안 작성 /blog/${o.slug} (${o.모드} 글) — 주제 「${o.제목}」` };
      case "이번주있음": return { status: "대기", nextTry: 내일(), evidence: `${오늘()} 이번 주 글이 이미 있음 (/blog/${o.slug})` };
      case "후보없음": return { status: "대기", nextTry: 다음월요일(), evidence: `${오늘()} 이번 주 쓸 주제 없음 — 후보가 모두 걸러짐` };
      // 앞 후보 3개가 재료 부족으로 4주 미뤄졌다 — 내일은 그다음 후보를 본다
      case "재료부족": return { status: "대기", nextTry: 내일(), evidence: `${오늘()} 앞 후보 3개가 재료 부족 — 내일 다음 후보` };
      case "쓰기건너뜀": return { status: "대기", nextTry: 내일(), evidence: `${오늘()} 「${o.제목}」 쓰기가 빈손으로 끝남 — 내일 다음 주제` };
      default: return { status: "실패", attempt: true, error: 끝(o?.왜 ?? r.out) };
    }
  },

  async "question-draft"(t, c) {
    // write-draft 는 로봇&코딩학원(1번) 글만 쓴다. 다른 고객사 주제로 돌리면 학원 블로그에 남의 글이 들어간다(2026-09-17 아이로그 일감 5건)
    // 원장이 현황판에서 할 수 있는 게 없다 — 사람 대기로 올리면 「오늘 하실 일」만 채운다(2026-09-24 원장: 알아서 처리하라).
    // 관찰로 두고 한 달 뒤 다시 본다. 아직 이 주제를 집어 가는 자동 경로는 없다 — Claude 세션에서 고객사 저장소로 옮긴다(Known Gap KG-S16-1)
    if (!c.conf?.publishes || c.id !== 1) {
      // 글 쓰는 길이 세션인 고객(아이로그)은 세션 대기 — Claude 세션이 그 저장소에 쓴다(Step 30 D37). 원장 할 일에는 안 넣는다
      if (c.conf?.loop?.draft === "session") {
        return { status: "세션 대기", evidence: `${오늘()} 세션 글 일감으로 넘김`, error: 세션글할일(c) };
      }
      return { status: "관찰", nextTry: 뒤(24 * 30), evidence: `${오늘()} ${c.name} 저장소에서 쓸 주제 — 원장 할 일에서 뺌` };
    }
    // 학원(1번)은 여기서 직접 쓰지 않는다 — 주간 초안(auto-post --pick)의 주제 후보(경쟁이 이기는 질문)로만 들어간다(Step 43 D92).
    // 쓰는 길이 둘이면 주 1편이 깨진다. 후보는 대기·관찰 상태의 이 일감을 읽으니 관찰로 둔다
    return { status: "관찰", nextTry: 뒤(24 * 7), evidence: `${오늘()} 주제 후보로 넘김` };
  },

  async review(t) {
    const slug = t.payload.slug;
    const [post] = await q(`select slug, body, published, updated_at::text as updated, coalesce(review_notes,'{}'::jsonb) notes from academy.posts where slug=$1`, [slug]);
    if (!post || post.published) return { status: "닫힘", evidence: `${오늘()} 이미 발행됐거나 없음` };
    const 검사 = () => {
      const r = 실행(["scripts/slop-check.mjs", slug], 2 * 60 * 1000);
      return [...r.out.matchAll(/^\s{4}(.+?) (\d+)곳 — (.+)$/gm)].map((m) => ({ why: m[1], sample: m[3].split(", ") }));
    };
    let 티 = 검사();
    const notes = { ...post.notes, AI티: 티 };
    let 다듬음 = "";
    let 크레딧부족 = false;
    if (티.length && !post.notes.다듬음) {
      // 사실이 바뀌면 안 된다. 숫자(개수까지)·소제목·링크가 원문과 똑같을 때만 채택하고, 원문은 notes 에 남겨 되돌릴 수 있게 한다
      const 숫자들 = (s) => (s.match(/\d+/g) ?? []).sort().join(",");
      const 소제목 = (s) => (s.match(/^#{1,4}\s+.*$/gm) ?? []).map((x) => x.trim()).join("\n");
      const 링크 = (s) => (s.match(/\]\(([^)]+)\)/g) ?? []).sort().join("\n");
      const ans = await 물어보기([
        "아래 마크다운 글에서 지적된 표현이 든 문장만 고쳐 써라. 내용·사실·주장·순서·소제목·링크·숫자는 그대로 둔다. 문장을 지우지 마라.",
        "고칠 때는 문장을 짧게 끊고, 빈 강조·흐린 마무리·훈계조 대신 구체적인 판단으로 바꾼다.",
        `지적된 표현: ${티.map((x) => `${x.why}(${x.sample.join(", ")})`).join(" / ")}`,
        '형식: {"body":"고친 전체 마크다운"}',
        "",
        post.body,
      ].join("\n"), 12000, (j) => typeof j?.body === "string" && j.body.length > 0);
      const body = ans.json?.body;
      if (!body) { 다듬음 = `다듬기 실패: ${ans.error ?? "본문 없음"}`; 크레딧부족 = !!ans.돈없음; }
      else if (body.length < post.body.length * 0.9 || body.length > post.body.length * 1.15) 다듬음 = `다듬기 결과를 버림: 길이가 ${post.body.length}→${body.length}자로 너무 바뀜`;
      else if (숫자들(body) !== 숫자들(post.body)) 다듬음 = "다듬기 결과를 버림: 숫자가 원문과 달라짐";
      else if (소제목(body) !== 소제목(post.body) || 링크(body) !== 링크(post.body)) 다듬음 = "다듬기 결과를 버림: 소제목이나 링크가 바뀜";
      else {
        // 모델이 쓰는 동안 원장이 검토 화면에서 고쳤으면 덮어쓰지 않는다
        const upd = await q(`update academy.posts set body=$2, updated_at=now() where slug=$1 and not published and updated_at=$3::timestamptz returning slug`, [slug, body, post.updated]);
        if (!upd.length) 다듬음 = "다듬기 결과를 버림: 그사이 본문이 고쳐짐";
        else {
          notes.원문 = post.body;
          const 전 = 티.length;
          티 = 검사();
          다듬음 = `콘텐츠 담당이 AI 티 표현만 다듬음 (걸린 종류 ${전}→${티.length}). 숫자·소제목·링크는 원문과 같음을 확인했습니다. 원문은 검토 화면에서 볼 수 있습니다.`;
          notes.AI티 = 티;
        }
      }
      // 모델 호출이 실패한 건 「다듬음」으로 굳히지 않는다 — 다음 실행에서 다시 해 본다
      if (!다듬음.startsWith("다듬기 실패")) notes.다듬음 = 다듬음;
    }
    await q(`update academy.posts set review_notes=$2::jsonb where slug=$1`, [slug, JSON.stringify(notes)]);
    if (다듬음.startsWith("다듬기 실패") && 크레딧부족) {
      // 검사는 이미 했으니 원장이 읽을 수는 있다. 다듬기만 크레딧이 찰 때까지 미룬다
      return { status: "대기", nextTry: 뒤(12), evidence: `${오늘()} AI 티 ${티.length}종 · 크레딧이 없어 다듬기는 미룸`, link: `${ADMIN}/admin/drafts#${slug}` };
    }
    if (다듬음.startsWith("다듬기 실패") && t.attempts < 2) {
      return { status: "실패", attempt: true, evidence: `${오늘()} AI 티 ${티.length}종 · ${다듬음}`, error: 다듬음 };
    }
    return { status: "사람 대기", link: `${ADMIN}/admin/drafts#${slug}`,
      evidence: `${오늘()} AI 티 검사 ${티.length ? `걸림 ${티.length}종` : "걸린 표현 없음"}${다듬음 ? ` · ${다듬음}` : ""}`,
      error: "사실 확인 후 발행 (검토 화면에서 한 번에)" };
  },

  async illustrate(t) {
    const slug = t.payload.slug;
    // 매시 1편 — 구독 한도를 원장과 같이 쓴다. 이번 시간에 이미 그렸으면 다음 실행으로
    const [최근] = await q(`select count(*)::int n from geo.claude_calls where purpose='illustrate' and at > now() - interval '50 minutes'`).catch(() => [null]);
    if (!최근) return { status: "대기", nextTry: 뒤(1), evidence: `${오늘()} Claude 호출 수를 못 셈 — 다음 시간에` };
    if (최근.n > 0) return { status: "대기", nextTry: 뒤(1), evidence: `${오늘()} 이번 시간 도해는 이미 1편 그림 — 다음 시간에` };
    const r = 실행(["scripts/illustrate.mjs", "--slug", slug, "--task", String(t.id)], 12 * 60 * 1000);
    let o = null;
    try { o = JSON.parse(/^ILLUSTRATE=(.+)$/m.exec(r.out)?.[1] ?? ""); } catch { o = null; }
    const link = `${ADMIN}/admin/drafts#${slug}`;
    switch (o?.상태) {
      case "붙임": return { status: "완료", link, evidence: `${오늘()} 도해 ${o.장수}장 붙임${o.버린것?.length ? ` · 버림 ${o.버린것.length}장 (${끝(o.버린것.join(" / "), 200)})` : ""}` };
      // 도해는 무조건 — 다 버려졌어도 닫지 않고 다시 그린다. 두 번까지는 다음 시간, 그 뒤로는 6시간 간격(구독 한도를 원장과 같이 쓴다)
      case "다버림": return { status: "대기", attempt: true, nextTry: 뒤(o.시도 >= 2 ? 6 : 1), link,
        evidence: `${오늘()} 도해 ${o.시도}번째 시도 — 다 버림, 다시 그림 (${끝(o.버린것.join(" / "), 300)})` };
      case "대상없음": return { status: "닫힘", evidence: `${오늘()} 이미 그림이 있거나 발행됐거나 없음` };
      // 한도·설정 없음은 고장이 아니다. 실패로 세어 사람에게 넘기면 진짜 고장이 묻힌다
      case "하루몫": return { status: "대기", nextTry: 내일(), evidence: `${오늘()} 삽화 하루 몫을 다 씀 — 내일 (${끝(o.오류, 80)})` };
      case "한도": return { status: "대기", nextTry: 뒤(6), evidence: `${오늘()} Claude 한도 — 미룸 (${끝(o.오류, 120)})` };
      case "클로드없음": return { status: "대기", nextTry: 뒤(12), evidence: `${오늘()} Claude Code 가 없어 미룸` };
      case "고쳐짐": return { status: "실패", attempt: true, nextTry: 뒤(1), error: `그리는 사이 본문이 고쳐져 넣지 않음 — 새 본문으로 다시` };
      default: return { status: "실패", attempt: true, error: `도해 실패 ${끝(o?.오류 ?? r.out, 300)}` };
    }
  },

  // ── 유통
  async announce(t, c) {
    const slug = t.payload.slug;
    const r = 실행(["scripts/indexnow.mjs", "--client", c.slug, `/blog/${slug}`, "/blog", "/"]);
    const sent = r.ok && /접수됨/.test(r.out);
    if (!sent) return { status: "실패", attempt: true, nextTry: 뒤(1), error: `IndexNow ${끝(r.out, 200)}` };
    await 일감({ client_id: c.id, agent: "deliver", kind: "gsc-submit", key: `gsc-${slug}`, priority: 30, status: "로컬 대기",
      title: `구글 색인 요청: /blog/${slug}`, detail: "서치콘솔 로그인 창이 필요해 원장 PC 의 local-agent 가 합니다.",
      payload: { sticky: true, url: `https://${c.domain}/blog/${slug}` } });
    // 이미 네이버에 있는 글(세션이 손으로 옮김)은 이관 일감을 안 만든다 — 만들면 닫을 곳이 없다(Step 40)
    const [글] = await q(`select naver_log_no from academy.posts where client_id=$1 and slug=$2`, [c.id, slug]);
    if (글?.naver_log_no) {
      return { status: "완료", evidence: `${오늘()} IndexNow 접수 (Bing·Naver) · 구글 요청을 로컬 일감으로 넘김 · 네이버에는 이미 있음 logNo=${글.naver_log_no}` };
    }
    await 일감({ client_id: c.id, agent: "deliver", kind: "naver-transfer", key: `naver-post-${slug}`, priority: 30, status: "로컬 대기",
      title: `네이버 이관: /blog/${slug}`, detail: "네이버 블로그 로그인 창이 필요해 원장 PC 의 local-agent 가 합니다.",
      payload: { sticky: true, slug } });
    return { status: "완료", evidence: `${오늘()} IndexNow 접수 (Bing·Naver) · 구글 요청과 네이버 이관을 로컬 일감으로 넘김` };
  },

  async "crawl-push"(t, c) {
    const vendor = t.payload.vendor;
    const miss = await q(
      `with pages as (select path from academy.site_pages where client_id=$1
                      union select '/blog/' || slug from academy.posts where client_id=$1 and published)
       select path from pages p
        where not exists (select 1 from academy.crawl_hits h where h.client_id=$1 and h.vendor=$2 and h.path=p.path)
        order by path limit 100`, [c.id, vendor]);
    if (!miss.length) return { status: "완료", evidence: `${오늘()} ${vendor} 가 안 읽은 쪽이 없음` };
    if (t.attempts >= 3) {
      const how = { openai: "Bing Webmaster Tools 에서 URL 제출 (OpenAI 는 빙 색인에 기댑니다)", naver: "네이버 서치어드바이저 수집 요청·사이트맵 제출 (캡차가 떠 사람 몫)", google: "서치콘솔 사이트맵·색인 요청", anthropic: "외부 링크를 늘리는 수밖에 없습니다" }[vendor] ?? "robots·링크 구조 점검";
      return { status: "사람 대기", attempt: true, evidence: `${오늘()} 3주 동안 IndexNow 로 밀어도 ${vendor} 미수집 ${miss.length}쪽`, error: how };
    }
    const r = 실행(["scripts/indexnow.mjs", "--client", c.slug, ...miss.map((m) => m.path)]);
    const sent = r.ok && /접수됨/.test(r.out);
    return sent
      ? { status: "관찰", nextTry: 뒤(24 * 7), attempt: true, evidence: `${오늘()} ${vendor} 미수집 ${miss.length}쪽을 IndexNow 로 알림 — 7일 뒤 커버리지 다시 봄` }
      : { status: "실패", attempt: true, nextTry: 뒤(6), error: `IndexNow ${끝(r.out, 200)}` };
  },
};

// ─────────────────────────────────────────── 실행 루프
const 근무 = async (clients) => {
  // 멈춘 실행 중 일감 되살리기 (러너가 죽으면 실행 중으로 남는다)
  await q(`update geo.agent_tasks set status='대기', evidence = left(evidence || E'\n' || '실행 중 멈춰 되돌림', 4000)
            where status='실행 중' and kind <> 'naver-attempt' and updated_at < now() - interval '90 minutes'`);
  // 네이버 이관 시도가 멈췄으면 올라갔는지 모른다. 다시 돌리지 말고 원장에게 확인을 받는다
  await q(`update geo.agent_tasks set status='사람 대기', updated_at=now(),
              last_error='로컬 에이전트가 이관 중에 멈췄습니다. 네이버 블로그에 올라갔는지 확인해 주세요.'
            where status='실행 중' and kind = 'naver-attempt' and updated_at < now() - interval '3 hours'`);
  // 집는 순간 실행 중으로 바꾼다. 두 러너가 겹쳐도 같은 일감을 둘이 집지 않게
  const todo = await q(
    `update geo.agent_tasks set status='실행 중', updated_at=now()
      where id in (select id from geo.agent_tasks where status='대기' and next_try_at <= now() and kind = any($1)
                    order by priority, next_try_at limit $2 for update skip locked)
      returning *`, [Object.keys(EXEC), MAX]);
  todo.sort((a, b) => a.priority - b.priority);
  console.log(`\n── 실행할 일감 ${todo.length}건`);
  for (const t of todo) {
    if (Date.now() - START > BUDGET_MS) { console.log("  시간 예산 소진 — 다음 실행으로"); break; }
    const c = clientOf(clients, t.client_id);
    console.log(`  ▶ [${t.agent}] ${t.title}`);
    let res;
    try { res = await EXEC[t.kind](t, c, clients); }
    catch (e) { res = { status: "실패", error: e.message, attempt: true }; }
    // 실패로 센다 — 실행기가 실패라고 했거나, 시도를 하나 올리고도 안 끝났거나(다시 띄운 작업·다 버린 도해).
    // 사람 대기로 넘긴 건 이미 원장 앞에 있으니 뺀다
    const 실패함 = res.status === "실패" || (res.attempt && !["완료", "닫힘", "사람 대기"].includes(res.status));
    // 실패는 간격을 늘려 계속 다시 한다. 사람에게 넘기지 않는다 — 원장(2026-09-24): 「실패해도 스스로 다시 시작」.
    // 코드가 틀려 계속 실패하는 건 감사관 R1(되풀이 실패)이 잡아 조사로 올린다
    if (res.status === "실패") {
      const n = t.attempts + 1;
      res = { ...res, status: "대기", nextTry: res.nextTry ?? 다시해봄(n), error: `${n}번째 실패 — 다시 해 봄 · ${res.error ?? ""}` };
    }
    await 상태(t.id, res.status, res);
    const ok = !/실패/.test(`${res.error ?? ""} ${res.status} ${res.evidence ?? ""}`);
    await 활동(t.client_id, t.agent, t.title, ok, `${res.status} · ${(res.evidence ?? res.error ?? "").trim().slice(0, 300)}`, t.id);
    /**
     * 5번째 실패부터 총괄 보고의 「확인 필요」에 올린다(Step 19 D4). 다시 하기는 그대로 계속한다.
     * 할 일 목록(사람 대기)에는 안 올린다. 표시는 한 번만 — 일감이 닫혔다 다시 열리면 일감() 이 지운다
     */
    const 횟수 = t.attempts + (res.attempt ? 1 : 0);
    if (실패함 && 횟수 >= 5 && !t.payload?.escalated) {
      await q(`update geo.agent_tasks set payload = payload || '{"escalated": true}'::jsonb where id = $1`, [t.id]);
      await 활동(t.client_id, t.agent, "원장 확인 필요로 올림", true, `${횟수}번째 실패: ${t.title}`, t.id);
    }
    console.log(`    → ${res.status} ${(res.evidence ?? "").trim()} ${res.error ? `| ${res.error}` : ""}`);
  }
};

const main = async () => {
  await ensure();
  // 설정은 코드 3곳 + DB 고객(Step 37). 시험 고객(status test)은 매시 루프에 안 섞는다
  const 고객들 = await loadClients(q);
  const clients = (await q(`select id, slug, name, domain from geo.clients where coalesce(status,'') not in ('ended', 'test') order by id`)
    .catch(() => q(`select id, slug, name, domain from geo.clients order by id`)))
    .map((c) => ({ ...c, conf: 고객들.find((x) => x.id === c.id) }));

  console.log(`에이전트 회사 · ${오늘()} KST`);
  // 한 번 도는 데 수십 분 걸린다. 끝에만 적으면 도는 동안 현황판이 「2시간 넘게 안 돌았다」로 뜬다(2026-09-24) — 시작도 적는다
  if (!PLAN_ONLY) await 활동(HOUSE, "ops", "매시 점검 시작", true, "");
  const latest = await 출근기록();
  if (!PLAN_ONLY) await 밀린예약();
  await 계획(clients, latest);
  // 고객사 세팅 점검(Step 38) — 화면 등록 고객(active) 중 점검 없음·24시간 지난 3곳. 사이트를 열고 체크리스트 사람 칸을 일감으로
  await 세팅재점검(q, { admin: ADMIN }).catch((e) => console.log("  ⚠ 세팅 점검을 못 돌림", 끝(e.message, 200)));
  const [s] = await q(`select count(*) filter (where status='대기')::int wait, count(*) filter (where status='사람 대기')::int human,
      count(*) filter (where status='로컬 대기')::int local, count(*) filter (where status='관찰')::int watch from geo.agent_tasks`);
  console.log(`  일감: 대기 ${s.wait} · 관찰 ${s.watch} · 사람 대기 ${s.human} · 로컬 대기 ${s.local}`);
  if (!PLAN_ONLY) await 근무(clients);
  await 활동(HOUSE, "ops", "회사 루프", true, `대기 ${s.wait} · 관찰 ${s.watch} · 사람 대기 ${s.human} · 로컬 대기 ${s.local}`);
  // 아침 보고 — KST 08시 이후 첫 루프가 하루 한 장. 이미 있으면 덮어쓰지 않는다. 보고가 실패해도 루프는 실패로 치지 않는다
  if (!PLAN_ONLY) {
    await PM보고(q).then((r) => console.log(`  아침 보고: ${r.말}`))
      .catch((e) => console.log("  ⚠ 아침 보고를 못 만듦", 끝(e.message, 200)));
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = await q(`select agent, status, title from geo.agent_tasks where status not in ('완료','닫힘') order by priority`);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 에이전트 회사 ${오늘()}\n` + rows.map((r) => `- [${r.agent}] ${r.status} · ${r.title}`).join("\n") + "\n");
  }
};

main()
  .catch((e) => { console.log("실패:", e.stack ?? e.message); process.exitCode = 1; })
  .finally(() => pool.end());
