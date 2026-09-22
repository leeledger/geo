/**
 * 감사관 — 매일 아침 회사가 스스로를 의심하는 자리.
 *
 * 2026-09-22 에 찾은 문제는 전부 사람이 연 세션이 찾았다. 루프는 하나도 못 찾았다.
 * who-wins 12일 · optimize 반복 실패 · 측정 4일 정지 · 근거 없는 「완료」 · 모든 자동 측정에서 인용 0.
 * 회사 루프는 「일감을 집어 처리」는 하는데, 일감이 안 생기는 고장은 아무도 안 봤다.
 *
 * 한 번 돌 때
 *   1. 규칙     SQL·GitHub API 만으로 이상 신호를 찾는다 (LLM 없음)
 *   2. 조사 일감 신호마다 investigate 일감을 만든다. 신호가 사라지면 감사관이 닫는다
 *   3. 원인 조사 대기 중인 조사를 하루 2건까지 claude -p 로 좁힌다. 읽기만 한다 — 고치는 건 Step 10
 *
 *   node scripts/audit.mjs            규칙 + 일감 + 진단
 *   node scripts/audit.mjs --dry      신호만 찍는다 (DB 쓰기·claude 없음)
 *   node scripts/audit.mjs --no-diag  일감까지만 쓰고 claude 는 안 부른다
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { 클로드코드, 클로드코드있음 } from "./claude-code.mjs";

// Actions 에서는 .env.local 을 만들지 않는다 — 조사관이 Read 로 볼 수 있는 곳에 비밀을 두지 않으려고
const envFile = new URL("../.env.local", import.meta.url);
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const DRY = process.argv.includes("--dry");
const NO_DIAG = DRY || process.argv.includes("--no-diag");
const MAX_DIAG = Number(process.env.AUDIT_MAX_DIAG ?? 2);
const REPO = process.env.GITHUB_REPOSITORY || "leeledger/geo";
const RUN_URL = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
const HOUSE = 1; // 사이티드 자체 일은 첫 고객사 칸에 둔다 (company.mjs 와 같은 규칙)
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ENGINES = (process.env.MEASURE_ENGINES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const EVERY = Number(process.env.MEASURE_EVERY_DAYS) || 1;

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

// DB 시각은 UTC 다. 러너에서 그냥 찍으면 새벽 일이 오후로 나간다(2026-09 첫 크롤러 방문 사건)
const KST = (d = new Date()) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
const 오늘 = () => KST().slice(0, 10);
const 뒤 = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const 끝 = (s, n = 400) => String(s ?? "").replace(/\s+/g, " ").trim().slice(-n);
const 해시 = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);

const RULES = {
  R6: { name: "출근만 하는 회사", priority: 5 },
  R2: { name: "멈춘 측정", priority: 10 },
  R1: { name: "반복 실패", priority: 20 },
  R3: { name: "근거 없는 완료", priority: 30 },
  R4: { name: "영점 — 인용", priority: 40 },
  R5: { name: "영점 — 크롤러", priority: 50 },
};

const 신호들 = [];
const 읽음 = new Set(); // 읽는 데 성공한 규칙. 못 읽은 규칙의 조사는 「신호 사라짐」으로 닫지 않는다
const 콘솔 = []; // 신호는 아니지만 봤다는 기록 (회복·비활성·보류·제외)
let 회복 = 0;
const 신호 = (rule, client_id, subject, 요약, facts, link = null) => 신호들.push({ rule, client_id: client_id ?? HOUSE, subject, 요약, facts, link });
const 참고 = (rule, s) => 콘솔.push(`${rule} ${s}`);

const gh = async (path) => {
  if (!process.env.GH_TOKEN) return null;
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json" },
  }).catch(() => null);
  if (!r) return null;
  return r.ok ? r.json() : { __error: `${r.status} ${끝(await r.text(), 200)}` };
};

// ─────────────────────────────────────────── 1. 규칙
/** 숫자는 #, 주소는 지운다. 「경쟁 검색어 0/6 (9일째)」와 「(12일째)」가 같은 실패로 묶여야 한다 */
const 정규화 = (s) => String(s ?? "").replace(/https?:\/\/\S+/g, "").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 120);

const R1 = async () => {
  const rows = await q(`select agent, action, ok, summary, client_id, run_url, at,
      to_char(at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') kst
    from geo.agent_activity where at > now() - interval '7 days' order by at`);
  const 묶음 = new Map();
  for (const r of rows.filter((x) => !x.ok)) {
    const g = { agent: r.agent, action: 정규화(r.action), summary: 정규화(r.summary) };
    const k = JSON.stringify(g);
    if (!묶음.has(k)) 묶음.set(k, { ...g, fails: [] });
    묶음.get(k).fails.push(r);
  }
  for (const { agent, action, summary, fails } of 묶음.values()) {
    const 날들 = new Set(fails.map((f) => f.kst.slice(0, 10)));
    if (fails.length < 3 || 날들.size < 2) continue;
    const 마지막 = fails.at(-1);
    // 같은 (agent, action) 의 성공이 마지막 실패 뒤에 있으면 회복이다. 요약이 달라도 된다(실패 요약과 성공 요약은 원래 다르다)
    const 성공 = rows.filter((r) => r.ok && r.agent === agent && 정규화(r.action) === action && r.at > 마지막.at).at(-1);
    if (성공) { 회복++; 참고("R1", `회복 — ${agent} 「${action}」 실패 ${fails.length}건 · 마지막 성공 ${성공.kst}`); continue; }
    const client_id = fails.find((f) => f.client_id)?.client_id ?? HOUSE;
    신호("R1", client_id, `${agent}-${해시(`${action}|${summary}`)}`,
      `${agent} 「${action}」 ${fails.length}건 실패 (${[...날들].join(", ")}) · 뒤에 성공 없음`,
      { agent, action, summary, 건수: fails.length, 날짜: [...날들], 실패: fails.slice(-8).map((f) => ({ at: f.kst, action: f.action, summary: f.summary, run_url: f.run_url })) },
      마지막.run_url);
  }
};

const R2 = async () => {
  if (!ENGINES.length) 신호("R2", HOUSE, "engines", "MEASURE_ENGINES 가 비어 있음 — 자동 측정이 어느 엔진도 안 고른다", { MEASURE_ENGINES: process.env.MEASURE_ENGINES ?? null });
  const 오늘날 = new Date(`${오늘()}T00:00:00Z`);
  for (const engine of ENGINES) {
    const [r] = await q(`select max(measured_on)::text last, count(*)::int n from academy.ai_measurements where engine=$1`, [engine]);
    const 지난 = r.last ? Math.round((오늘날 - new Date(`${r.last}T00:00:00Z`)) / 86400000) : null;
    if (지난 === null || 지난 > EVERY + 1) {
      신호("R2", HOUSE, engine, `${engine} 마지막 측정 ${r.last ?? "없음"}${지난 === null ? "" : ` (${지난}일 전)`} · 주기 ${EVERY}일`,
        { engine, 마지막측정: r.last, 지난일: 지난, MEASURE_EVERY_DAYS: EVERY, 누적행: r.n });
    } else 참고("R2", `정상 — ${engine} 마지막 측정 ${r.last} (${지난}일 전, 주기 ${EVERY}일)`);
  }
};

// 측정 성격 일감 → 완료한 날 새 행이 있어야 하는 표 (company.mjs EXEC·ai-measure.mjs 에서 grep 한 것)
//   check-index            company.mjs 「check-index」 → check-index.mjs → academy.serp_checks
//   openrouter-credits     ai-measure.mjs 가 「실제로 잰 날」 완료로 닫는다 → academy.ai_measurements (9/22 일감 60 이 근거 없이 닫혔다)
const 측정일감 = [
  { match: "kind = 'check-index'", table: "serp_checks", sql: `select count(*)::int n from academy.serp_checks where client_id=$1 and day=$2::date` },
  { match: "dedupe_key = 'openrouter-credits'", table: "ai_measurements", sql: `select count(*)::int n from academy.ai_measurements where client_id=$1 and measured_on=$2::date` },
];

const R3 = async () => {
  const 빈근거 = await q(`select id, client_id, kind, dedupe_key, title, evidence,
      to_char(done_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') done
    from geo.agent_tasks where status='완료' and done_at > now() - interval '7 days'
      and btrim(evidence, E' \n\r\t') in ('', '완료', '성공')`);
  for (const t of 빈근거) {
    신호("R3", t.client_id, `task-${t.id}`, `일감 ${t.id} 「${t.title}」 완료인데 근거 「${t.evidence.trim() || "없음"}」`,
      { task_id: Number(t.id), kind: t.kind, dedupe_key: t.dedupe_key, title: t.title, 완료: t.done, evidence: t.evidence });
  }
  for (const m of 측정일감) {
    const done = await q(`select id, client_id, kind, dedupe_key, title, evidence,
        to_char(done_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') done
      from geo.agent_tasks where status='완료' and done_at > now() - interval '7 days' and ${m.match}`);
    for (const t of done) {
      if (빈근거.some((x) => x.id === t.id)) continue; // 이미 위에서 신호로 올렸다
      const [r] = await q(m.sql, [t.client_id, t.done.slice(0, 10)]);
      if (r.n > 0) { 참고("R3", `근거 있음 — 일감 ${t.id} ${t.dedupe_key} ${t.done} · ${m.table} 그날 ${r.n}행`); continue; }
      신호("R3", t.client_id, `task-${t.id}`, `일감 ${t.id} 「${t.title}」 ${t.done} 완료인데 그날 ${m.table} 새 행 0`,
        { task_id: Number(t.id), kind: t.kind, dedupe_key: t.dedupe_key, 완료: t.done, 표: m.table, 그날행: 0, evidence: t.evidence });
    }
  }
};

const R4 = async () => {
  // 엔진끼리 섞어 세지 않는다(9/22 결정). 회차 = 한 엔진이 10문항 이상 잰 날
  const rows = await q(`select client_id, engine, measured_on::text as day, count(*)::int n, count(*) filter (where cited)::int cited,
      count(*) filter (where mentioned)::int mentioned
    from academy.ai_measurements group by 1,2,3 having count(*) >= 10 order by 1,2,3 desc`);
  const 엔진별 = new Map();
  for (const r of rows) {
    const k = `${r.client_id}|${r.engine}`;
    if (!엔진별.has(k)) 엔진별.set(k, []);
    엔진별.get(k).push(r);
  }
  for (const [, 회차] of 엔진별) {
    const [a, b] = 회차;
    const 이름 = `client ${a.client_id} ${a.engine}`;
    if (!b) { 참고("R4", `${이름} — 1회차(${a.day} 인용 ${a.cited}/${a.n}), 판단 보류`); continue; }
    if (a.cited > 0 || b.cited > 0) { 참고("R4", `${이름} — 인용 있음 (${a.day} ${a.cited}/${a.n} · ${b.day} ${b.cited}/${b.n})`); continue; }
    if (!ENGINES.includes(a.engine)) { 참고("R4", `${이름} — 2회차 인용 0 (${b.day} 0/${b.n} · ${a.day} 0/${a.n}) 이지만 비활성 엔진`); continue; }
    신호("R4", a.client_id, a.engine, `${a.engine} 최근 2회차 인용 0 (${b.day} 0/${b.n} · ${a.day} 0/${a.n})`,
      { engine: a.engine, 회차: [b, a].map((x) => ({ day: x.day, n: x.n, cited: x.cited, mentioned: x.mentioned })) });
  }
};

const R5 = async () => {
  // scout.mjs 는 openai·anthropic·google·naver 넷만 본다. Bing(ChatGPT·Copilot 색인)·Brave(Claude 색인)가 감시 밖이라 여기선 전부 본다
  const rows = await q(`select client_id, vendor, pages_crawled, pages_total, coverage_pct::float pct,
      to_char(first_seen at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') first, to_char(last_seen at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') last,
      round(extract(epoch from now() - first_seen) / 86400, 1)::float age
    from academy.coverage_by_vendor where coverage_pct < 20 order by client_id, coverage_pct`);
  for (const r of rows) {
    const 이름 = `client ${r.client_id} ${r.vendor} ${r.pct}% (${r.pages_crawled}/${r.pages_total})`;
    if (r.pages_total < 10) { 참고("R5", `제외 — ${이름}: 페이지 ${r.pages_total}개라 비율이 안 선다`); continue; }
    if (r.age <= 14) { 참고("R5", `제외 — ${이름}: 처음 온 지 ${r.age}일 (${r.first}), 14일 전엔 판단 안 함`); continue; }
    신호("R5", r.client_id, r.vendor, `${r.vendor} 크롤러 커버리지 ${r.pct}% (${r.pages_crawled}/${r.pages_total}) · 처음 온 지 ${r.age}일`,
      { vendor: r.vendor, pages_crawled: r.pages_crawled, pages_total: r.pages_total, coverage_pct: r.pct, first_seen: r.first, last_seen: r.last, 지난일: r.age });
  }
};

const R6 = async () => {
  // 출근·루프·자동 작업 기록은 「일했다」가 아니다. 그걸 빼고 남는 게 없으면 회사는 출근만 한 것이다
  const [a] = await q(`select count(*)::int n, max(to_char(at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')) last
    from geo.agent_activity where ok and at > now() - interval '48 hours'
      and action not like '%출근%' and action <> '회사 루프' and action not like '자동 작업 %' and action <> '감사'`);
  if (a.n === 0) 신호("R6", HOUSE, "activity", "최근 48시간 실제 일한 기록 0건 (출근·루프·자동 작업 제외)", { 최근48시간일한기록: 0 });
  else 참고("R6", `일한 기록 48시간 ${a.n}건 (마지막 ${a.last})`);
  let ghOk = true;
  for (const [file, 시간] of [["company.yml", 3], ["optimize.yml", 26]]) {
    const d = await gh(`/actions/workflows/${file}/runs?per_page=1`);
    if (!d || d.__error) { ghOk = false; 참고("R6", `못 봄 — ${file} ${d?.__error ?? "(GH_TOKEN 없음)"}`); continue; }
    const run = d.workflow_runs?.[0];
    const 지난 = run ? (Date.now() - new Date(run.created_at)) / 3600000 : null;
    if (지난 === null || 지난 > 시간) {
      신호("R6", HOUSE, file, `${file} 마지막 실행 ${run ? `${KST(run.created_at)} (${지난.toFixed(1)}시간 전)` : "없음"} · 기준 ${시간}시간`,
        { file, 마지막실행: run ? KST(run.created_at) : null, 지난시간: 지난 && Number(지난.toFixed(1)), 기준시간: 시간, 결과: run?.conclusion ?? null, url: run?.html_url ?? null },
        run?.html_url);
    } else 참고("R6", `정상 — ${file} ${KST(run.created_at)} (${지난.toFixed(1)}시간 전) ${run.conclusion ?? run.status}`);
  }
  // 워크플로를 못 읽었으면 그 규칙의 일감은 닫지 않는다 — 못 본 것을 「사라졌다」로 치면 쿨다운을 건너뛴다
  return ghOk;
};

// ─────────────────────────────────────────── 2. 조사 일감
const ensure = () => q(`create table if not exists geo.claude_calls (id bigserial primary key, at timestamptz not null default now(),
  purpose text not null, ok boolean not null, secs int, cost_usd numeric, task_id bigint, note text not null default '')`);

// company.mjs 일감()·상태() 의 SQL 을 그대로 옮겼다. import 하면 company.mjs 의 main 이 돈다
const 일감 = (t) => {
  const status = t.status ?? "대기";
  return q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority, status, link)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
     on conflict (client_id, dedupe_key) do update set
       title = excluded.title, detail = excluded.detail, payload = geo.agent_tasks.payload || excluded.payload,
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

const 열린상태 = ["대기", "관찰", "사람 대기", "수리 대기", "실패"];

const 일감쓰기 = async () => {
  const 있던 = new Map((await q(`select id, client_id, dedupe_key, detail, status, payload from geo.agent_tasks where agent='audit' and kind='investigate'`))
    .map((t) => [`${t.client_id}:${t.dedupe_key}`, t]));
  const 본키 = new Set();
  let 새로 = 0;
  for (const s of 신호들) {
    const key = `inv-${s.rule}-${s.subject}`;
    본키.add(`${s.client_id}:${key}`);
    const old = 있던.get(`${s.client_id}:${key}`);
    if (!old) 새로++;
    await 일감({
      client_id: s.client_id, agent: "audit", kind: "investigate", key, priority: RULES[s.rule].priority, cooldownH: 24 * 7, link: s.link,
      title: `조사 · ${RULES[s.rule].name}: ${s.요약}`.slice(0, 300),
      // 진단이 끝난 일감의 detail 은 「다음 할 일」이다. 매일 사실 요약으로 덮어쓰면 사람이 할 일을 잃는다
      detail: old?.payload?.diagnosis ? old.detail : `${s.요약}\n원인 조사 대기 — 감사관이 하루 ${MAX_DIAG}건씩 진단합니다.`,
      payload: { rule: s.rule, subject: s.subject, facts: s.facts, sticky: true },
    });
  }
  let 닫음 = 0;
  for (const [k, t] of 있던) {
    if (본키.has(k) || !열린상태.includes(t.status) || !읽음.has(t.payload?.rule)) continue;
    await 상태(t.id, "닫힘", { evidence: `${KST()} 신호 사라짐` });
    닫음++;
  }
  return { 새로, 닫음 };
};

// ─────────────────────────────────────────── 3. 원인 조사
/**
 * 시스템 프롬프트는 한 줄로 두고 규칙·출력 형식은 표준입력으로 넘긴다.
 * 윈도에서 claude 는 cmd 를 거치는데, 여러 줄 인자는 첫 줄에서 잘리고 뒤의 --tools 까지 버려진다 —
 * 2026-09-22 로컬 시험에서 도구 28개가 다 열린 채 규칙 없이 돌아 20턴을 다 쓰고 끝났다. 따옴표·| 도 cmd 가 먹는다
 */
const 조사관 = "너는 사이티드 운영 조사관이다. 고치지 않는다. 원인을 좁힌다. 규칙과 출력 형식은 사용자 메시지 앞머리에 있다.";
const 지침 = `사이티드는 AI 답변에 고객사 이름이 불리게 만드는 대행사다. 이 저장소가 그 회사 전체다 — academy/scripts 가 자동 작업, .github/workflows 가 일정, handoff/ 가 결정 기록.

규칙
- 먼저 handoff/BUILD-LOG.md 의 끝 80줄을 읽는다. 이미 아는 원인(예: Brave 색인 0건, 네이버 루트 422, Gemini 그라운딩 0)은 새 발견으로 쓰지 말고 "기지": true 로 표시한다
- 가설을 3개 이상 세운다. 각각 「참이면 보일 것」과 「거짓이면 보일 것」을 먼저 적고, 그다음 도구로 확인한다
- 숫자는 주어진 facts 에 있거나 도구로 직접 본 것만 쓴다. 추정은 추정이라고 쓴다
- 근거에는 도구로 실제로 본 것만 적는다. 파일:줄 또는 URL
- DB 는 볼 수 없다. 필요한 숫자는 facts 에 있다. .env 파일이나 비밀 값은 열지 않는다
- 알려진 대응: OpenAI(ChatGPT)는 Bing 색인에 기댄다 · Claude 웹 검색은 Brave 색인을 쓴다 · 구글은 IndexNow 에 참여하지 않는다
- 도구: 저장소는 Read·Grep·Glob, 바깥은 WebSearch·WebFetch
- 턴은 20번이 끝이다. 서로 기대지 않는 확인은 한 턴에 도구 여러 개를 같이 부른다. 파일 전체를 읽지 말고 Grep 으로 줄을 찾은 뒤 그 부분만 읽는다
- 14번째 턴쯤에는 멈추고 JSON 을 낸다. 확인 못 한 가설은 「모름」으로 두면 된다 — 턴이 다 떨어지면 조사 전체가 버려진다

분류
- code: 저장소 코드를 고치면 풀린다 (다음.파일 에 고칠 파일)
- config: 저장소 변수·시크릿·설정값 문제 (할일에 정확한 명령, 예: gh variable set …)
- index: 검색엔진 색인 문제 (할일에 명령 그대로, 예: node tools/brave-submit.mjs …)
- content: 글이 없거나 모자람 · money: 결제·크레딧 · login: 사람 로그인 필요 · human: 사람 판단 · unknown: 좁히지 못함

출력은 JSON 한 덩어리만. 다른 말을 붙이지 않는다.
{"가설":[{"내용":"","참이면":"","거짓이면":"","확인한것":"","판정":"참|거짓|모름"}],
 "결론":"한두 문장",
 "분류":"code|config|index|content|money|login|human|unknown",
 "기지":true,
 "근거":["파일:줄 또는 URL"],
 "다음":{"누가":"agent|local|human","할일":"30초 안에 끝낼 수 있게 구체적으로","파일":[]}}`;

const 분류들 = ["code", "config", "index", "content", "money", "login", "human", "unknown"];
const 읽기 = (text) => {
  const m = /\{[\s\S]*\}/.exec(String(text).replace(/^```(json)?|```$/gm, ""));
  try {
    const j = JSON.parse(m?.[0] ?? "");
    return j && typeof j.결론 === "string" && 분류들.includes(j.분류) && Array.isArray(j.가설) && Array.isArray(j.근거 ?? []) ? j : null;
  } catch { return null; }
};

const 진단 = async () => {
  const [{ n: 오늘쓴것 }] = await q(`select count(*)::int n from geo.claude_calls
    where purpose like 'audit%' and (at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date`);
  const 남은 = MAX_DIAG - 오늘쓴것;
  if (남은 <= 0) { console.log(`  진단: 오늘 ${오늘쓴것}건 써서 더 안 부름 (AUDIT_MAX_DIAG ${MAX_DIAG})`); return 0; }
  if (!클로드코드있음()) { console.log("  진단: Claude Code 없음 (CLAUDE_CODE_OAUTH_TOKEN 또는 CLAUDE_CODE_LOCAL=1) — 건너뜀"); return 0; }
  const todo = await q(`select * from geo.agent_tasks where agent='audit' and kind='investigate' and status='대기' and next_try_at <= now()
    order by priority, client_id, id limit $1`, [남은]);
  let 한 = 0;
  for (const t of todo) {
    const p = t.payload ?? {};
    console.log(`  ▶ 진단 ${t.id} [${p.rule}] ${t.title}`);
    const 시작 = Date.now();
    const r = await 클로드코드([
      지침,
      "",
      `조사할 신호: ${p.rule} ${RULES[p.rule]?.name ?? ""}`,
      `대상: ${p.subject} · client_id ${t.client_id}`,
      `요약: ${t.title}`,
      `facts (DB·GitHub 에서 방금 읽은 원문):`,
      JSON.stringify(p.facts ?? {}, null, 1),
      "",
      "왜 이런지 원인을 좁혀라. 출력 형식은 위 JSON 하나.",
    ].join("\n"), {
      cwd: ROOT, tools: ["Read", "Grep", "Glob", "WebSearch", "WebFetch"], model: "sonnet", maxTurns: 20, timeoutMs: 10 * 60 * 1000, system: 조사관,
      // 구독 인증(CLAUDE_CODE_OAUTH_TOKEN)만 남기고 비밀은 다 뺀다. 조사관은 DB·GitHub 를 직접 만지지 않는다
      envDrop: ["DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN", "LLM_PROXY_TOKEN", "LLM_PROXY_URL", "GEMINI_API_KEY", "GROQ_API_KEY"],
    });
    const secs = Math.round((Date.now() - 시작) / 1000);
    const j = r.ok ? 읽기(r.text) : null;
    await q(`insert into geo.claude_calls (purpose, ok, secs, cost_usd, task_id, note) values ('audit', $1, $2, $3, $4, $5)`,
      [Boolean(j), secs, r.cost ?? null, t.id, j ? j.분류 : 끝(r.error ?? `JSON 아님: ${r.text}`, 300)]);
    // 한도·인증은 이 일감 탓이 아니다. 시도로 세지 않고 오늘 남은 진단만 멈춘다
    if (r.한도 || r.인증실패) {
      console.log(`  ⚠ ${r.한도 ? "한도" : "인증 실패"} — 오늘 진단 중단: ${끝(r.error, 160)}`);
      await 상태(t.id, "대기", { error: `${KST()} ${r.한도 ? "한도" : "인증 실패"} ${끝(r.error, 200)}` });
      break;
    }
    if (!j) {
      const 셋째 = t.attempts + 1 >= 3;
      const 이유 = r.시간초과 ? "시간 초과" : r.ok ? "JSON 을 못 읽음" : "실행 실패";
      console.log(`  ✗ ${이유}${셋째 ? " — 3번째라 사람 대기" : " — 내일 다시"}`);
      await 상태(t.id, 셋째 ? "사람 대기" : "대기", { attempt: true, nextTry: 셋째 ? null : 뒤(24),
        error: `${KST()} 진단 ${이유}: ${끝(r.error ?? r.text, 300)}`,
        evidence: 셋째 ? `${KST()} 진단 3번 실패 — 사람이 봐야 합니다` : "" });
      continue;
    }
    const 근거 = (j.근거 ?? []).filter(Boolean);
    const 할일 = String(j.다음?.할일 ?? "").trim();
    // 근거 없는 진단은 믿지 않는다 — 분류와 상관없이 관찰
    const status = !근거.length || j.분류 === "unknown" ? "관찰" : j.분류 === "code" ? "수리 대기" : "사람 대기";
    const evidence = `${KST()} ${j.기지 ? "기지 · " : ""}${j.결론} · ${j.분류} · ${근거.slice(0, 2).join(" · ") || "근거 없음"}`;
    await q(`update geo.agent_tasks set payload = payload || jsonb_build_object('diagnosis', $2::jsonb),
        detail = case when $3::text = '' then detail else $3 end where id=$1`,
      [t.id, JSON.stringify(j), status === "사람 대기" ? 할일 : ""]);
    await 상태(t.id, status, { evidence, attempt: true, nextTry: status === "관찰" ? 뒤(24 * 3) : null });
    console.log(`  ✓ ${j.분류}${j.기지 ? " (기지)" : ""} → ${status} · ${끝(j.결론, 160)}`);
    한++;
  }
  return 한;
};

// ─────────────────────────────────────────── 실행
const 규칙실행 = async () => {
  for (const [rule, fn] of [["R1", R1], ["R2", R2], ["R3", R3], ["R4", R4], ["R5", R5], ["R6", R6]]) {
    try {
      const ok = await fn();
      if (ok !== false) 읽음.add(rule);
    } catch (e) { 참고(rule, `못 읽음 — ${e.message} (이 규칙의 조사는 닫지 않음)`); }
  }
};

const 요약표 = () => [
  `### 감사 ${KST()} KST`,
  "",
  "| 규칙 | 고객사 | 대상 | 신호 |",
  "|---|---|---|---|",
  ...신호들.map((s) => `| ${s.rule} ${RULES[s.rule].name} | ${s.client_id} | ${s.subject} | ${s.요약.replace(/\|/g, "/")} |`),
  "",
  ...콘솔.map((c) => `- ${c}`),
  "",
].join("\n");

try {
  console.log(`감사관 · ${KST()} KST${DRY ? " · --dry" : NO_DIAG ? " · --no-diag" : ""}`);
  await 규칙실행();
  console.log(`\n신호 ${신호들.length}`);
  for (const s of 신호들) console.log(`  ● ${s.rule} [client ${s.client_id}] ${s.subject} — ${s.요약}`);
  console.log(`\n참고`);
  for (const c of 콘솔) console.log(`  · ${c}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, 요약표());
  if (!DRY) {
    await ensure();
    const { 새로, 닫음 } = await 일감쓰기();
    console.log(`\n일감: 새 조사 ${새로} · 닫음 ${닫음}`);
    const 진단수 = NO_DIAG ? 0 : await 진단();
    await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url) values ($1,'audit','감사',true,$2,$3)`,
      [HOUSE, `신호 ${신호들.length} · 새 조사 ${새로} · 진단 ${진단수} · 회복 ${회복}`, RUN_URL]);
  }
} catch (e) {
  // 감사관이 죽으면 회사 루프가 audit.yml 실패로 일감을 연다. 여기서는 기록만 남기고 실패로 끝낸다
  console.error("감사 실패", e);
  if (!DRY) await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, run_url) values ($1,'audit','감사',false,$2,$3)`,
    [HOUSE, 끝(e.message, 500), RUN_URL]).catch(() => {});
  process.exitCode = 1;
} finally {
  await pool.end();
}
