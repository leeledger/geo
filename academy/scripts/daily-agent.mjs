/**
 * 매일 AI 추천 개선 루프. 측정(ai-measure.mjs) 뒤에 돈다.
 *
 *   판정   끝난 행동이 그 질문의 적중률을 올렸는지 잰다 (기준일 전 14일 vs 기준일+7일 이후)
 *   고르기 최근 7일 적중률이 50% 미만이고 열린 행동이 없는 질문 하나
 *   행동   질문 단계별 사다리에서 아직 「효과 없음」이 안 난 첫 칸을 실제로 실행한다
 *            entity  홈 JSON-LD 에 주소가 있는지 가져와 본다
 *            content 답하는 글이 있으면 색인 알림 후 판정 대기, 없으면 초안을 쓴다
 *            offsite 대신 인용된 바깥 출처를 뽑아 등록할 곳으로 넘긴다
 *   원장   geo.agent_runs 에 하루 한 줄. 사람이 막는 일은 「사람 대기」로 남긴다
 *
 * 발행은 자동으로 하지 않는다. 초안까지다 (CLAUDE.md 「발행 전 사실 확인」).
 * 초안이 발행되면 다음 날 루프가 알아채 색인 알림을 보내고 판정 창을 연다.
 *
 *   node scripts/daily-agent.mjs          하루 한 번
 *   node scripts/daily-agent.mjs --dry    판단만 찍고 DB·초안·색인 알림은 건드리지 않는다
 *   node scripts/daily-agent.mjs --review 자기 점검(loop-review.mjs)만 찍고 끝낸다. DB 안 씀
 *   node scripts/daily-agent.mjs --complete "한 일" "근거"   사람이 오늘 행동을 끝냈을 때 (--id 행번호 · --client 슬러그)
 *   node scripts/daily-agent.mjs --client ilog --dry         한 고객만
 *   node scripts/daily-agent.mjs --session-done 28 "근거"      세션이 「세션 대기」 글 일감을 끝냈을 때
 *
 * 고객(Step 30): 학원과, 승인 질문이 있는 고객을 차례로 돈다. 사다리는 같고 고객마다 다른 것은 clients.mjs 의 loop 덩어리다 —
 * 이름 질문 적중 말, 홈 JSON-LD 검사, 글 쓰는 길(학원은 write-draft, 아이로그는 Claude 세션 일감), 넓힘 탐침 여부.
 *
 * 성과가 개수로 늘어나는 고리(Step 31, loop-grow.mjs): 「효과 있음」 처방을 같은 단계로 전파, 후퇴한 질문 맨 앞(불리던 글 재색인),
 * 경쟁사 우세 정렬, 불린 탐침 → 원장에게 승인 질문 후보 → 확장 질문, 안 불린 반경 → 세션 글 일감.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { 자기점검, 점검요약, 겹침, 곳 as 곳이름 } from "./loop-review.mjs";
import { CLIENTS } from "../clients.mjs";
import { 세션일감열기, 세션완료찾기, 세션일감닫기, 세션끝냄, 탐침글일감 } from "./session-task.mjs";
import { 전파찾기, 전파칸, 사다리짓기, 경쟁우세, 후보고르기, 불리던글, 승격일감, 확장넣기 } from "./loop-grow.mjs";
import { 경쟁사목록 } from "../pilot-report-core.mjs";
import { 측정설정 } from "../measure-targets.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const REVIEW = process.argv.includes("--review");
const DRY = process.argv.includes("--dry") || REVIEW;
const HOUSE = "robotncoding";
const KST = (d = new Date()) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const 오늘 = KST();
const 날더하기 = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const 퍼센트 = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const db = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => db.query(s, p).then((r) => r.rows);

const LADDER = {
  brand: ["entity", "content", "discover", "offsite"],
  local: ["content", "discover", "offsite"],
  problem: ["content", "discover", "offsite"],
  consider: ["content", "discover", "offsite"],
  keyword: ["content", "discover", "offsite"],
};
const DISCOVER_GROUP = { brand: "brand", local: "local", problem: "general", consider: "general", keyword: "general" };
const STAGE_ORDER = { local: 0, brand: 1, problem: 2, consider: 3, keyword: 4 };

/** 노드 스크립트를 셸 없이 부른다. Git Bash 경로 변환·& 문제를 피한다 */
const 실행 = (args) => {
  try {
    return { ok: true, out: execFileSync(process.execPath, args, { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 600000, env: process.env }) };
  } catch (e) {
    return { ok: false, code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}${e.message}` };
  }
};

const 준비 = async () => {
  await q(`create table if not exists geo.agent_runs(id bigserial primary key,client_id int not null references geo.clients(id),run_day date not null default current_date,trigger text not null default 'daily',status text not null default '행동 대기',facts jsonb not null default '{}'::jsonb,diagnosis text not null,action text not null,evidence text not null default '',started_at timestamptz not null default now(),completed_at timestamptz,unique(client_id,run_day,trigger))`);
  for (const col of [
    "target_prompt text", "action_kind text", "target_slug text",
    "verdict text not null default '판정 전'", "verdict_note text not null default ''",
    "effective_on date", "judged_at timestamptz",
  ]) await q(`alter table geo.agent_runs add column if not exists ${col}`);
};

/** 한 고객의 하루. 설정은 clients.mjs 의 loop 덩어리 */
const 돌기 = async (c, 설정) => {
  const SLUG = c.slug;
  if (process.argv.includes("--complete")) {
    const i = process.argv.indexOf("--complete");
    const [done = "", evidence = ""] = [process.argv[i + 1], process.argv[i + 2]];
    // 지난 「사람 대기」(offsite 등)를 끝냈으면 --id 로 그 행을 닫는다. 없으면 오늘 행
    const id = process.argv.includes("--id") ? Number(process.argv[process.argv.indexOf("--id") + 1]) : null;
    if (id !== null && !Number.isInteger(id)) throw new Error("--id 뒤에 행 번호를 주세요");
    const hit = await q(`update geo.agent_runs set status='완료',action=$2,evidence=$3,completed_at=now(),effective_on=$4::date
              where client_id=$1 and ${id ? "id=$5" : "run_day=$4::date and trigger='daily'"} returning id`,
      id ? [c.id, done, evidence, 오늘, id] : [c.id, done, evidence, 오늘]);
    console.log(hit.length ? `개선 루프 완료 기록 (행 ${hit[0].id}) · 7일 뒤부터 효과를 잽니다` : "닫을 행을 못 찾았습니다");
    if (!hit.length) process.exitCode = 1;
    return;
  }

  /** IndexNow 는 키 파일이 안 열리면 보내지 않고 종료코드 0 으로 끝난다. 「접수됨」이 찍혀야 보낸 것이다 */
  const 색인알림 = (path) => {
    if (DRY) return { ok: true, out: "(dry)" };
    const res = 실행(["scripts/indexnow.mjs", "--client", SLUG, path]);
    return { ok: res.ok && /접수됨/.test(res.out), out: res.out };
  };
  /** 홈 JSON-LD 가 고객 설정(loop.homeLd — 학원은 주소·석촌|송파)을 다 채우나. 못 가져왔으면 fetched=false — 사람 일로 적지 않는다 */
  const 홈확인 = async () => {
    const html = await fetch(`https://${c.domain}/`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
    return { fetched: Boolean(html), ok: 설정.homeLd.every((re) => re.test(ld)) };
  };

  // ── 재료
  const questions = await q(
    `select 'q' || q.position as prompt_id, q.stage, q.text from geo.pilot_questions q
       join geo.pilots p on p.id=q.pilot_id where p.client_id=$1 and q.approved order by q.position`, [c.id]);
  const rows = await q(
    `select prompt_id, measured_on::text as day, engine, mentioned, cited, citations, coalesce(raw->>'answer','') answer
       from academy.ai_measurements
      -- 자동 측정만 본다. 구독으로 도는 Claude Code 측정도 자동이다(2026-09-22 전환) — 빠뜨리면 「오늘 측정 없음」으로 판정이 선다
      where client_id=$1 and (collection_method like 'api-%' or collection_method like 'claude-code-headless-%')
        and measured_on >= $2::date`, [c.id, 날더하기(오늘, -70)]);
  const runs = await q(
    `select id, run_day::text as run_day, status, action_kind, target_prompt, target_slug, verdict, effective_on::text as effective_on
       from geo.agent_runs where client_id=$1 and target_prompt is not null order by run_day`, [c.id]);
  const posts = await q(`select slug, title, published, published_at,
                                coalesce(review_notes,'{}'::jsonb) ? '비공개이유' as archived
                           from academy.posts where client_id=$1`, [c.id]);
  const [todayRun] = await q(`select status, action_kind from geo.agent_runs where client_id=$1 and run_day=$2::date and trigger='daily'`, [c.id, 오늘]);
  // 자기 점검은 화면 측정(ChatGPT·Gemini·Perplexity)까지 본다. 판정용 rows 와 따로 둔다 — 판정에 화면 측정이 섞이면 안 된다
  const [탐침표] = await q(`select to_regclass('academy.ai_probe_questions')::text as t, to_regclass('academy.ai_probe_measurements')::text as m`);
  // 탐침 측정은 따로 표에 있다. 점검(widen)만 읽는다 — 승인 질문 숫자와 섞지 않는다
  const 점검rows = await q(
    `select prompt_id, measured_on::text as day, engine, collection_method, mentioned, cited, citations, coalesce(raw->>'answer','') answer
       from academy.ai_measurements
      where client_id=$1 and (collection_method like 'api-%' or collection_method like 'claude-code-headless-%' or collection_method like '%-web-logged-out')
        and measured_on >= $2::date` +
    (탐침표.m ? `
     union all
     select prompt_id, measured_on::text, engine, collection_method, mentioned, cited, citations, coalesce(raw->>'answer','')
       from academy.ai_probe_measurements where client_id=$1 and measured_on >= $2::date` : ""),
    [c.id, 날더하기(오늘, -20)]);
  const probes = 탐침표.t
    ? await q(`select prompt_id, source_prompt, radius, text, active, form, created_on::text as created_on
                 from academy.ai_probe_questions where client_id=$1 order by id`, [c.id])
    : [];

  const stageOf = Object.fromEntries(questions.map((x) => [x.prompt_id, x.stage]));
  // 브랜드 질문은 질문에 이름이 들어 있어 답이 따라 말한다. 인용이나 고객 설정 말(학원은 실제 위치 석촌)이 나와야 적중이다
  const 적중 = (r) => r.cited || (stageOf[r.prompt_id] === "brand" ? 설정.brandHit.test(r.answer) : r.mentioned);
  const 창 = (pid, from, to) => rows.filter((r) => r.prompt_id === pid && r.day >= from && (!to || r.day < to));
  const 기록 = [];

  // ── 1. 판정
  for (const r of runs.filter((x) => x.verdict === "판정 전")) {
    const post = posts.find((p) => p.slug === r.target_slug);
    // 초안이 발행됐으면 색인 알림을 보내고 판정 창을 연다
    if (r.action_kind === "content" && r.status === "사람 대기" && r.target_slug) {
      if (!post) {
        기록.push(`${r.target_prompt} 초안 ${r.target_slug} 이 지워졌습니다 → 취소`);
        if (!DRY) await q(`update geo.agent_runs set verdict='취소', verdict_note='초안 삭제됨', judged_at=now() where id=$1`, [r.id]);
        r.verdict = "취소";
      } else if (post.published) {
        const pub = KST(post.published_at ?? new Date());
        // 발행은 실제로 일어났으니 기준일은 발행일이다. 알림 실패는 근거에 남긴다 (사이트맵 전체 알림은 snapshot.yml 이 매일 한다)
        const res = 색인알림(`/blog/${r.target_slug}`);
        기록.push(`${r.target_prompt} 초안 발행 확인(${pub}) → 색인 알림 ${res.ok ? "접수" : "실패"}`);
        if (!DRY) await q(
          `update geo.agent_runs set status='완료', completed_at=now(), effective_on=$2::date,
             evidence = evidence || $3 where id=$1`,
          [r.id, pub, `\n${오늘} 발행 확인 · IndexNow ${res.ok ? "접수" : "실패"}`]);
        r.status = "완료";
        r.effective_on = pub;
      } else if (r.run_day <= 날더하기(오늘, -14)) {
        // 미발행 초안이 영원히 새 초안을 막지 않게 닫는다. 글은 지우지 않는다 — 나중에 발행해도 된다
        기록.push(`${r.target_prompt} 초안 ${r.target_slug} 14일 미발행 → 닫음`);
        if (!DRY) await q(`update geo.agent_runs set verdict='미처리', verdict_note='초안 14일 미발행', judged_at=now() where id=$1`, [r.id]);
        r.verdict = "미처리";
      }
      continue;
    }
    // 세션 글 일감(글 쓰는 길이 세션인 고객)을 끝냈으면 알아챈다 — 같은 질문의 question-draft 일감이 완료면 그날부터 효과를 잰다
    if (r.action_kind === "content" && r.status === "세션 대기" && !r.target_slug && 설정.draft === "session") {
      const 글 = questions.find((x) => x.prompt_id === r.target_prompt)?.text;
      const t = 글 ? await 세션완료찾기(q, c.id, 글, r.run_day) : undefined;
      if (t) {
        const 끝낸날 = KST(t.done_at ?? new Date());
        기록.push(`${r.target_prompt} 세션 글 일감 #${t.id} 완료(${끝낸날}) → 판정 창을 엽니다`);
        if (!DRY) await q(`update geo.agent_runs set status='완료', completed_at=now(), effective_on=$2::date, evidence = evidence || $3 where id=$1`,
          [r.id, 끝낸날, `\n${오늘} 일감 #${t.id} 완료 확인`]);
        r.status = "완료";
        r.effective_on = 끝낸날;
        continue;
      }
    }
    // 사람이 JSON-LD 를 고쳤으면 알아챈다
    if (r.action_kind === "entity" && r.status === "사람 대기") {
      const home = await 홈확인();
      if (home.fetched && home.ok) {
        기록.push(`${r.target_prompt} 홈 주소 구조화 데이터 확인 → 완료`);
        if (!DRY) await q(`update geo.agent_runs set status='완료', completed_at=now(), effective_on=$2::date, evidence = evidence || $3 where id=$1`,
          [r.id, 오늘, `\n${오늘} 홈 JSON-LD 주소 확인`]);
        r.status = "완료";
        r.effective_on = 오늘;
        continue;
      }
    }
    // 사람이 할 일이 14일 넘게 안 됐으면 닫는다. 「효과 없음」과 다르다 — 해 보지 않았다
    if ((r.status === "사람 대기" || r.status === "세션 대기") && r.run_day <= 날더하기(오늘, -14)) {
      기록.push(`${r.target_prompt} ${r.action_kind} 14일 미처리 → 닫음`);
      if (!DRY) await q(`update geo.agent_runs set verdict='미처리', verdict_note='14일 동안 사람 작업이 없었음', judged_at=now() where id=$1`, [r.id]);
      // 세션 글이면 짝 일감도 닫는다 — 안 닫으면 sticky 라 「세션에서 할 일」에 죽은 일감이 쌓인다
      if (r.status === "세션 대기") {
        const 글 = questions.find((x) => x.prompt_id === r.target_prompt)?.text;
        const 닫음 = 글 ? await 세션일감닫기(q, { clientId: c.id, 질문: 글, 오늘, DRY }) : [];
        if (닫음.length) 기록.push(`${r.target_prompt} 세션 글 일감 #${닫음.join(", #")} 닫음`);
      }
      r.verdict = "미처리";
      continue;
    }
    if (r.status !== "완료" || !r.effective_on) continue;
    /**
     * 전후는 같은 엔진끼리만 잰다. 2026-09-22 에 측정이 openrouter → claude-code-web 로 바뀌었다.
     * 섞으면 「전」은 한 엔진, 「후」는 다른 엔진이 되고, 엔진이 바뀐 차이가 「효과 있음」으로 적혀
     * 케이스 리포트(영업 숫자)로 간다 — 지어낸 숫자와 같다. 양쪽 다 5건 넘는 엔진이 없으면 판정을 미룬다.
     */
    const 전전부 = 창(r.target_prompt, 날더하기(r.effective_on, -14), r.effective_on);
    const 후전부 = 창(r.target_prompt, 날더하기(r.effective_on, 7));
    const 엔진후보 = [...new Set(전전부.map((x) => x.engine))]
      .map((e) => ({ e, 전: 전전부.filter((x) => x.engine === e), 후: 후전부.filter((x) => x.engine === e) }))
      .filter((x) => x.전.length >= 5 && x.후.length >= 5)
      .sort((a, b) => b.전.length + b.후.length - (a.전.length + a.후.length));
    const 고른 = 엔진후보[0];
    const 전 = 고른?.전 ?? [];
    const 후 = 고른?.후 ?? [];
    const 전율 = 퍼센트(전.filter(적중).length, 전.length);
    const 후율 = 퍼센트(후.filter(적중).length, 후.length);
    let verdict = null;
    let note = 고른
      ? `${고른.e} 전 ${전.filter(적중).length}/${전.length}(${전율}%) → 후 ${후.filter(적중).length}/${후.length}(${후율}%)`
      : `같은 엔진으로 전후 5건씩 모인 게 없음 (전 ${전전부.length}건 · 후 ${후전부.length}건, 엔진이 다르면 안 섞음)`;
    /**
     * 기준선이 없어도 「효과 없음」은 낼 수 있다. 후가 전부 0 이면 오른 게 없다.
     * 「효과 있음」은 영업 숫자로 가니 같은 엔진 전후가 있어야 하지만, 이쪽은 부풀릴 위험이 없다.
     * 이게 없어서 엔진이 바뀐 9/22 뒤로 판정이 하나도 안 나왔고 사다리가 멈췄다
     */
    const 후만 = [...new Set(후전부.map((x) => x.engine))]
      .map((e) => ({ e, 후: 후전부.filter((x) => x.engine === e) }))
      .filter((x) => x.후.length >= 5)
      .sort((a, b) => b.후.length - a.후.length)[0];
    if (고른) {
      verdict = 후율 - 전율 >= 20 && 후.filter(적중).length >= 2 ? "효과 있음" : "효과 없음";
    } else if (후만 && !후전부.some(적중)) {
      verdict = "효과 없음";
      note = `${후만.e} 전 비교 없음 — 후 0/${후만.후.length}`;
    } else if (r.effective_on <= 날더하기(오늘, -35)) {
      verdict = "표본 부족";
    }
    if (verdict) {
      기록.push(`${r.target_prompt} ${r.action_kind} 판정: ${verdict} · ${note}`);
      if (!DRY) await q(`update geo.agent_runs set verdict=$2, verdict_note=$3, judged_at=now() where id=$1`, [r.id, verdict, note]);
      r.verdict = verdict;
    }
  }

  // ── 2. 질문별 최근 7일 적중률
  const 주전 = 날더하기(오늘, -6);
  const 표 = questions.map((x) => {
    const w = 창(x.prompt_id, 주전);
    const h = w.filter(적중).length;
    return { ...x, n: w.length, hit: h, rate: 퍼센트(h, w.length) };
  });
  const 측정됨 = 표.filter((x) => x.n > 0);
  const 전체 = `최근 7일 자동 측정 적중 ${측정됨.reduce((s, x) => s + x.hit, 0)}/${측정됨.reduce((s, x) => s + x.n, 0)} · 측정된 질문 ${측정됨.length}/${questions.length}`;
  const 엔진별 = Object.entries(rows.filter((r) => r.day === 오늘).reduce((m, r) => {
    (m[r.engine] ??= [0, 0])[0] += 적중(r) ? 1 : 0;
    m[r.engine][1]++;
    return m;
  }, {})).map(([e, [h, n]]) => `${e} ${h}/${n}`).join(" · ") || "오늘 자동 측정 없음";

  // ── 자기 점검 (loop-review.mjs). 판정 뒤에 돈다 — 방금 닫힌 행동은 「멈춤」으로 안 센다
  const 점검 = 자기점검({
    questions, rows: 점검rows, 판정rows: rows, runs, posts, today: 오늘, domain: c.domain, probes, 적중, 탐침: 설정.probes, 변형: 설정.probeVariants,
    // 검색어 씨앗(source_prompt 없음)은 하루 한도에 안 센다
    새탐침한도: Math.max(0, 2 - probes.filter((p) => p.created_on === 오늘 && p.source_prompt).length),
  });
  // 발견성 일감: 원장 PC 가 Brave 색인을 본다. 열려 있거나 7일 안에 끝낸 일감은 다시 만들지 않는다
  const 일감들 = [];
  for (const d of 점검.discover.filter((x) => x.slugs.length)) {
    const key = `brave-index-${d.group}`;
    const [t] = await q(`select status, done_at > now() - interval '7 days' as recent from geo.agent_tasks where client_id=$1 and dedupe_key=$2`, [c.id, key]);
    if (t && !["완료", "닫힘"].includes(t.status)) d.finding.action += ` 이미 일감이 있습니다(${t.status}).`;
    else if (t?.recent) d.finding.action += " 7일 안에 확인했으니 다시 만들지 않습니다.";
    else 일감들.push({ key, ...d });
  }
  const 점검줄 = 점검요약(점검.findings);

  const facts = { day: 오늘, engines: 엔진별, week: 전체, questions: 표.map(({ prompt_id, n, hit }) => ({ prompt_id, n, hit })), judged: 기록, selfcheck: 점검.findings };
  // 전파(D38)로 올린 칸이면 근거에 원판정 행을 남긴다. 판정은 원래 규칙 그대로 따로 받는다
  let 전파중 = null;
  const 저장 = async (row) => {
    row = { ...row, diagnosis: 점검줄 ? `${점검줄}\n${row.diagnosis}` : row.diagnosis };
    if (전파중 && row.target_prompt === 전파중.pid && row.action_kind === 전파중.kind) {
      row.evidence = `${row.evidence ?? ""} · 전파: 행 #${전파중.id}(${전파중.from} ${전파중.kind} 「효과 있음」)`;
    }
    console.log(`\n진단: ${row.diagnosis}\n행동: ${row.action}\n상태: ${row.status}${row.evidence ? `\n근거: ${row.evidence}` : ""}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `### 개선 루프 ${오늘}\n- 상태: ${row.status}\n- 진단: ${row.diagnosis.replace(/\n/g, " · ")}\n- 행동: ${row.action}\n- 근거: ${row.evidence || "—"}\n` +
        (기록.length ? `- 판정·후속: ${기록.join(" / ")}\n` : ""));
    }
    if (DRY) return;
    await q(
      `insert into geo.agent_runs (client_id, run_day, trigger, status, facts, diagnosis, action, evidence, completed_at,
                                   target_prompt, action_kind, target_slug, effective_on)
       values ($1,$2::date,'daily',$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12::date)
       on conflict (client_id, run_day, trigger) do update set status=excluded.status, facts=excluded.facts,
         diagnosis=excluded.diagnosis, action=excluded.action, evidence=excluded.evidence, completed_at=excluded.completed_at,
         target_prompt=excluded.target_prompt, action_kind=excluded.action_kind, target_slug=excluded.target_slug,
         effective_on=excluded.effective_on, verdict='판정 전', started_at=now()`,
      [c.id, 오늘, row.status, JSON.stringify(facts), row.diagnosis, row.action, row.evidence ?? "",
        row.status === "완료" ? new Date() : null, row.target_prompt ?? null, row.action_kind ?? null,
        row.target_slug ?? null, row.effective_on ?? null]);
  };

  console.log(`${c.name} · ${오늘}\n  ${전체}\n  오늘: ${엔진별}`);
  for (const s of 기록) console.log(`  판정·후속: ${s}`);

  console.log(`\n자기 점검 ${점검.findings.length}건${점검.skipContent.size ? ` · 글 고치기 건너뛰는 단계: ${[...점검.skipContent].join(", ")}` : ""}`);
  for (const f of 점검.findings) console.log(`  [${f.code}] ${f.title}\n      근거: ${f.evidence}\n      할 일: ${f.action}`);
  if (점검줄) console.log(`  → ${점검줄}`);
  for (const t of 일감들) console.log(`  ${DRY ? "(dry) " : ""}발견성 일감 ${t.key}: ${t.slugs.join(", ")}`);
  for (const p of 점검.probes) console.log(`  ${DRY ? "(dry) " : ""}탐침 ${p.form} ${p.seed ? "씨앗" : `${p.source_prompt} →`} ${p.radius}「${p.text}」`);
  // ── 성과가 개수로 (Step 31). 일감 함수는 DRY 면 읽기만 한다
  for (const 줄 of await 확장넣기(q, { clientId: c.id, 오늘, DRY })) console.log(`  확장 질문: ${줄}`);
  for (const p of 점검.promote) {
    const r = await 승격일감(q, { clientId: c.id, p, 곳이름: 곳이름(p.method), DRY });
    console.log(`  ${DRY ? "(dry) " : ""}${r.title} · ${r.말}`);
  }
  if (점검.gaps.length) {
    const g = 점검.gaps[0];
    const r = await 탐침글일감(q, { c, 설정, gap: g, 곳이름: 곳이름(g.method), 오늘, DRY });
    console.log(`  안 불린 반경 ${g.prompt_id}「${g.text}」 ${g.n}번 모두 0 → ${r.말}`);
  }
  if (REVIEW) return;

  if (!DRY) {
    for (const t of 일감들) {
      // sticky: 회사 루프(company.mjs)는 자기 신호에 없는 일감을 닫는다. 이 일감은 개선 루프가 만든다
      await q(
        `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
         values ($1, 'deliver', 'brave-index-check', $2, $3, $4, '로컬 대기', 20, $5::jsonb)
         on conflict (client_id, dedupe_key) do update set status='로컬 대기', title=excluded.title, detail=excluded.detail,
           payload=excluded.payload, done_at=null, attempts=0, last_error='', updated_at=now()
         where geo.agent_tasks.status in ('완료','닫힘')
           and (geo.agent_tasks.done_at is null or geo.agent_tasks.done_at <= now() - interval '7 days')`,
        [c.id, t.key, `Brave 색인 확인: 글 ${t.slugs.length}편`,
          `${t.finding.evidence}. 원장 PC 의 로컬 에이전트가 이 글들이 Brave 색인에 있는지 봅니다. 없는 글이 있으면 제출할 명령을 남깁니다.`,
          JSON.stringify({ sticky: true, group: t.group, slugs: t.slugs })]);
    }
    if (점검.probes.length) {
      await q(`create table if not exists academy.ai_probe_questions (id serial primary key, client_id int not null, prompt_id text not null,
                 source_prompt text, radius text, text text not null, created_on date not null default current_date,
                 active bool not null default true, form text not null default 'sentence', unique (client_id, prompt_id))`);
      const [m] = await q(`select coalesce(max(substring(prompt_id from 2)::int), 0) as n from academy.ai_probe_questions
                            where client_id=$1 and prompt_id ~ '^p[0-9]+$'`, [c.id]);
      let n = m.n;
      for (const p of 점검.probes) {
        await q(`insert into academy.ai_probe_questions (client_id, prompt_id, source_prompt, radius, text, form, created_on)
                 values ($1,$2,$3,$4,$5,$6,$7::date) on conflict (client_id, prompt_id) do nothing`,
          [c.id, `p${++n}`, p.source_prompt, p.radius, p.text, p.form, 오늘]);
      }
    }
  }

  // 같은 날 두 번 돌면 초안을 두 번 쓴다. 이미 행동한 날은 판정만 하고 끝낸다
  if (todayRun?.status === "완료" || (todayRun?.action_kind && todayRun.status !== "실패")) {
    console.log(`\n오늘(${오늘}) 행동은 이미 기록돼 있습니다 — ${todayRun.action_kind ?? "수동 개선"} · ${todayRun.status}`);
    // 점검은 행동과 별개다. 오늘 행에 합친다
    if (!DRY) await q(`update geo.agent_runs set facts = facts || $3::jsonb where client_id=$1 and run_day=$2::date and trigger='daily'`,
      [c.id, 오늘, JSON.stringify({ selfcheck: 점검.findings })]);
    return;
  }

  if (!측정됨.length) {
    await 저장({ status: "실패", diagnosis: "최근 7일 자동 AI 측정이 없습니다", action: "ai-measure.mjs 로그에서 키·모델·한도 오류를 확인합니다.", evidence: 엔진별 });
    // 학원 밖 고객은 막 승인됐거나 하루 측정 예산에 밀려 못 잰 날일 수 있다 — 예산 부족은 측정기가 따로 일감으로 올린다.
    // 그 때문에 작업 전체를 빨갛게 하지 않는다. 기록(실패)은 남긴다
    if (c.slug === HOUSE) process.exitCode = 1;
    return;
  }

  // ── 3. 고르기
  // 실패한 날은 행동한 게 아니다. 질문을 잡아 두지 않는다
  const 열림 = new Set(runs.filter((r) => r.verdict === "판정 전" && r.status !== "실패").map((r) => r.target_prompt));
  // 원장이 초안을 버린 질문은 같은 초안을 다시 만들지 않는다. 삭제는 편집 판단이다.
  const 버린질문 = new Set(runs.filter((r) => r.action_kind === "content" && r.verdict === "취소").map((r) => r.target_prompt));
  // 회사 루프가 쓴 초안도 같은 검토 대기열이다. 열린 초안이 있으면 새 글을 쌓지 않는다.
  const 다른초안 = posts.find((p) => !p.published && !p.archived && p.slug);
  const 대기초안 = runs.find((r) => r.verdict === "판정 전" && r.action_kind === "content" && r.status === "사람 대기" && r.target_slug)
    ?? (다른초안 ? { target_slug: 다른초안.slug } : null);
  // 글 쓰는 길이 세션인 고객 — 넘긴 세션 글이 안 끝났으면 새로 넘기지 않는다
  const 대기세션 = 설정.draft === "session"
    ? runs.find((r) => r.verdict === "판정 전" && r.action_kind === "content" && r.status === "세션 대기" && !r.target_slug) ?? null
    : null;
  const 대기일 = 대기초안 ? `/blog/${대기초안.target_slug} 초안을 사실 확인 후 발행합니다.`
    : 대기세션 ? `${대기세션.target_prompt} 세션 글 일감을 끝내고 완료로 닫습니다.` : null;
  const 대기상태 = 대기초안 ? "사람 대기" : 대기세션 ? "세션 대기" : null;
  // 경쟁사 우세(D42) — 파일럿에 경쟁사가 적힌 고객만. 못 읽으면(칸 없음 등) 0 으로 두고 Step 31 전 순서대로
  const 경쟁사 = 경쟁사목록((await q(`select competitors from geo.pilots where client_id=$1 order by id limit 1`, [c.id]).catch(() => []))[0]?.competitors);
  let 우세 = {};
  if (경쟁사.length) {
    const [패턴] = await q(`select answer_pattern from geo.clients where id=$1`, [c.id]).catch(() => []);
    const 우리 = 측정설정({ ...c, answer_pattern: 패턴?.answer_pattern })?.answerRe;
    우세 = Object.fromEntries(questions.map((x) => [x.prompt_id, 경쟁우세(창(x.prompt_id, 주전), 우리, 경쟁사)]));
  }
  const 후퇴 = new Map(점검.regress.map((r) => [r.prompt_id, r]));
  const 후보 = 후보고르기(표, { 열림, 버린: 버린질문, 후퇴: new Set(후퇴.keys()), 우세, 단계순: STAGE_ORDER });

  if (!후보.length) {
    const why = 표.some((x) => x.n > 0 && x.rate < 50)
      ? `적중률 50% 미만 질문은 모두 행동이 진행 중입니다${대기초안 ? ` — 초안 ${대기초안.target_slug} 발행 전 사실 확인 대기` : 대기세션 ? ` — ${대기세션.target_prompt} 세션 글 대기` : ""}`
      : "측정된 질문이 모두 적중률 50% 이상입니다";
    await 저장({ status: 대기상태 ?? "완료", diagnosis: `${전체}. ${why}`, action: 대기일 ?? "측정만 이어 갑니다.", evidence: 엔진별 });
    return;
  }

  const published = posts.filter((p) => p.published);
  const tried = (pid) => new Map(runs.filter((r) => r.target_prompt === pid).map((r) => [r.action_kind, r.verdict]));
  let 막힘 = null;

  const 전파 = 전파찾기(runs, stageOf);

  질문: for (const x of 후보) {
    const t = tried(x.prompt_id);
    const 원 = 전파칸(전파.get(x.stage), x, t);
    전파중 = 원 ? { pid: x.prompt_id, kind: 원.action_kind, id: 원.id, from: 원.target_prompt } : null;
    const 진단 = `${x.prompt_id}「${x.text}」 최근 7일 적중 ${x.hit}/${x.n} (${x.stage})` +
      `${x.후퇴 ? " · 불리던 질문이 떨어짐" : ""}${우세[x.prompt_id] > 0 ? ` · 경쟁사 이름이 우리보다 ${우세[x.prompt_id]}번 더 나옴` : ""} · ${전체}`;

    // 후퇴(D39): 사다리보다 먼저 불리던 글을 다시 민다. 불리던 글이 없으면 사다리대로
    if (x.후퇴) {
      const r = 후퇴.get(x.prompt_id);
      const 글 = 불리던글(r.urls, published)
        ?? published.map((p) => ({ ...p, score: 겹침(x.text, p.title) })).sort((a, b) => b.score - a.score).find((p) => p.score >= 0.4);
      if (글) {
        const res = 색인알림(`/blog/${글.slug}`);
        await 저장({
          status: res.ok ? "완료" : "실패", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "content", target_slug: 글.slug, effective_on: 오늘,
          action: `불리던 질문이 떨어졌습니다. 불리던 글 「${글.title}」을 색인 알림으로 다시 밀고 7일 뒤부터 효과를 잽니다.`,
          evidence: `${r.곳들.map((g) => `${곳이름(g.method)} 앞 14일 ${g.앞[0]}/${g.앞[1]} → 최근 7일 ${g.뒤[0]}/${g.뒤[1]}`).join(", ")} · IndexNow ${res.ok ? "접수" : `실패: ${res.out.slice(-200)}`}`,
        });
        if (!res.ok) process.exitCode = 1;
        return;
      }
    }
    for (const kind of 사다리짓기(LADDER[x.stage] ?? LADDER.problem, 전파중?.kind)) {
      const v = t.get(kind);
      if (v === "효과 없음" || v === "표본 부족" || v === "통과") continue;
      // 검색 결과에 안 뜨는 단계는 글을 고쳐도 못 읽는다(자기 점검 repeat). 다음 칸으로
      if (kind === "content" && 점검.skipContent.has(x.stage)) continue;

      if (kind === "entity") {
        const home = await 홈확인();
        if (home.fetched && home.ok) continue; // 이미 갖춰져 있다. 다음 칸
        if (!home.fetched) {
          // 못 가져온 걸 사람 일로 적으면 멀쩡한 코드를 고치게 시킨다
          await 저장({ status: "실패", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "entity",
            action: "홈을 가져오지 못해 구조화 데이터를 확인하지 못했습니다. 내일 다시 봅니다.", evidence: `https://${c.domain}/ 응답 없음 또는 오류` });
          process.exitCode = 1;
          return;
        }
        await 저장({
          status: "사람 대기", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "entity",
          action: `홈(https://${c.domain}/) 구조화 데이터에 ${c.slug === HOUSE ? "주소가 없습니다" : "빠진 것이 있습니다"}. ${설정.homeLdFix}`,
          evidence: 설정.homeLdMissing,
        });
        return;
      }

      if (kind === "content") {
        const 맞는글 = published
          .map((p) => ({ ...p, score: 겹침(x.text, p.title) }))
          .sort((a, b) => b.score - a.score)[0];
        const 경로 = (s) => `/blog/${s}`;
        if (맞는글 && 맞는글.score >= 0.4) {
          const hits = await q(
            `select vendor, max(seen_at) at from academy.crawl_hits where client_id=$1 and path=$2 group by vendor`,
            [c.id, 경로(맞는글.slug)]).catch(() => []);
          const 크롤러 = hits.length ? hits.map((h) => `${h.vendor} ${KST(h.at)}`).join(", ") : "크롤러 방문 기록 없음";
          const res = 색인알림(경로(맞는글.slug));
          await 저장({
            status: res.ok ? "완료" : "실패", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "content",
            target_slug: 맞는글.slug, effective_on: 오늘,
            action: `이미 답하는 글 「${맞는글.title}」(겹침 ${Math.round(맞는글.score * 100)}%)을 색인 알림으로 다시 밀고 7일 뒤부터 효과를 잽니다.`,
            evidence: `IndexNow ${res.ok ? "접수" : `실패: ${res.out.slice(-200)}`} · ${크롤러}`,
          });
          if (!res.ok) process.exitCode = 1;
          return;
        }
        if (대기초안) {
          막힘 ??= `${x.prompt_id} 은 새 글이 필요한데 초안 ${대기초안.target_slug} 이 발행을 기다리고 있어 새로 쓰지 않았습니다`;
          // 이 질문의 다음 칸(offsite)으로 넘어가면 글을 안 써 본 질문이 바깥 지면으로 잠긴다. 다음 질문으로
          continue 질문;
        }
        const 경쟁 = Object.entries(창(x.prompt_id, 주전).flatMap((r) => r.citations ?? [])
          .map((s) => s.domain).filter((d) => d && d !== c.domain)
          .reduce((m, d) => ((m[d] = (m[d] ?? 0) + 1), m), {}))
          .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d]) => d);
        if (설정.draft === "session") {
          // 글이 DB 가 아니라 고객 저장소 코드다(아이로그 lib/guides.ts). write-draft 를 부르면 학원 블로그에 남의 글이 들어간다.
          // 세션 대기 일감으로 세션에 넘긴다. 한 번에 하나 — 열린 세션 글이 있으면 새로 쌓지 않는다
          if (대기세션) {
            막힘 ??= `${x.prompt_id} 은 새 글이 필요한데 ${대기세션.target_prompt} 세션 글 일감이 끝나기를 기다리고 있어 새로 넘기지 않았습니다`;
            continue 질문;
          }
          const 일감 = await 세션일감열기(q, { c, 설정, x, 경쟁, 오늘, DRY });
          await 저장({
            status: "세션 대기", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "content", target_slug: null,
            action: `${c.name} 글은 이 저장소에서 쓰지 않습니다. Claude 세션에서 「${x.text}」에 답하는 가이드 초안을 ${설정.draftWhere} 에 씁니다${일감.id ? ` (일감 #${일감.id})` : ""}. 세션이 --session-done 으로 닫으면 다음 날 루프가 효과 측정을 시작합니다.`,
            evidence: `대신 인용된 곳: ${경쟁.join(", ") || "없음"} · ${일감.말}`,
          });
          return;
        }
        if (DRY) {
          console.log(`\n(dry) ${x.prompt_id} 초안을 쓸 차례 — 대신 인용된 곳: ${경쟁.join(", ") || "없음"}`);
          return;
        }
        const res = 실행(["scripts/write-draft.mjs", "--question", x.text, "--stage", x.stage, "--sources", 경쟁.join(",")]);
        const slug = /DRAFT_SLUG=(\S+)/.exec(res.out)?.[1];
        // 78 = 건너뜀. 이번 주 글이 이미 있거나(주 1편) 글감이 없다 — 고장이 아니다(2026-09-24 원장: 없으면 패스)
        if (!slug && res.code === 78) {
          await 저장({
            // 주간 한도 때문에 아무 작업도 하지 않은 날은 이 질문을 「진행 중」으로 잠그지 않는다.
            // 다음 날 실제 기존 콘텐츠 개선이나 다른 질문을 고를 수 있어야 한다.
            status: "완료", diagnosis: 진단, target_prompt: null, action_kind: null, target_slug: null,
            action: /이번주있음/.test(res.out) ? "이번 주 글이 이미 있어 초안은 쓰지 않았습니다(주 1편)." : "글감이 없어 이번에는 초안을 건너뛰었습니다.",
            evidence: res.out.replace(/\s+/g, " ").slice(-200),
          });
          return;
        }
        const 슬롭 = slug ? 실행(["scripts/slop-check.mjs", slug]) : null;
        const 걸림 = 슬롭 ? (/0편에서 걸림/.test(슬롭.out) ? "AI 티 검사 통과" : "AI 티 검사 걸림 있음") : "";
        await 저장({
          status: slug ? "사람 대기" : "실패", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "content", target_slug: slug ?? null,
          action: slug
            ? `이 질문에 답하는 초안을 썼습니다(/blog/${slug}, 미발행). 사실 확인 후 발행하면 다음 날 루프가 색인 알림과 효과 측정을 시작합니다.`
            : "초안 작성에 실패했습니다. 로그를 확인합니다.",
          evidence: slug ? `대신 인용된 곳: ${경쟁.join(", ") || "없음"} · ${걸림}` : res.out.replace(/\s+/g, " ").slice(-300),
        });
        if (!slug) process.exitCode = 1;
        return;
      }

      if (kind === "discover") {
        // 글이 AI 검색 결과에 한 번도 들어가지 않았다면 바깥 출처를 더 만들기 전에
        // 실제 검색 색인부터 확인한다. 인용된 아무 도메인이나 "등록할 곳"으로 제시하면
        // 앱스토어·뉴스·개인 블로그처럼 우리가 등록할 수 없는 곳이 사람 일로 잘못 올라간다.
        const 발견 = 점검.discover.find((d) => d.group === DISCOVER_GROUP[x.stage] && d.slugs.length);
        if (!발견) continue;
        const key = `brave-index-${발견.group}`;
        const [task] = await q(
          `select id, status, detail, evidence from geo.agent_tasks where client_id=$1 and dedupe_key=$2`,
          [c.id, key]);
        await 저장({
          status: "사람 대기", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "discover",
          action: task?.detail || `Brave 색인에서 관련 글 ${발견.slugs.length}편을 확인하고, 빠진 주소는 URL 제출 화면에서 요청합니다.`,
          evidence: `${발견.finding.evidence}${task ? ` · 일감 #${task.id} ${task.status}${task.evidence ? ` · ${String(task.evidence).trim().split("\n").at(-1)}` : ""}` : ""}`,
        });
        return;
      }

      if (kind === "offsite") {
        const 출처 = Object.entries(창(x.prompt_id, 날더하기(오늘, -27)).flatMap((r) => r.citations ?? [])
          .map((s) => s.domain).filter((d) => d && d !== c.domain)
          .reduce((m, d) => ((m[d] = (m[d] ?? 0) + 1), m), {}))
          .sort((a, b) => b[1] - a[1]).slice(0, 5);
        await 저장({
          status: "사람 대기", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "offsite",
          action: 출처.length ? 설정.offsite[0] : 설정.offsite[1],
          evidence: (출처.length ? `AI 답변의 참고 출처(등록 대상 아님): ${출처.map(([d, n]) => `${d} ${n}회`).join(", ")}` : "출처 없음"),
        });
        return;
      }
    }
  }

  await 저장({
    status: 대기상태 ?? "사람 대기", diagnosis: `${전체}. ${막힘 ?? "후보 질문의 자동 행동이 모두 소진됐습니다"}`,
    action: 대기일 ?? "사다리를 다 쓴 질문은 사람이 원인을 새로 정합니다.",
    evidence: 엔진별,
  });
};

/**
 * 누구를 도나. --client 가 있으면 그 고객 하나, --complete 는 (--client 없으면) 학원 하나.
 * 없으면 학원 먼저, 그다음 승인 질문이 있는 고객을 번호 순으로. 학원만 있을 때 출력·기록은 Step 30 전과 같다
 */
const main = async () => {
  await 준비();
  if (process.argv.includes("--session-done")) {
    // 세션이 글을 쓰고 배포까지 끝냈을 때. 근거 없는 완료는 감사(R3)가 잡으니 근거를 받는다
    const k = process.argv.indexOf("--session-done");
    const r = await 세션끝냄(q, {
      id: Number(process.argv[k + 1]), 근거: process.argv[k + 2], DRY,
      시각: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16),
    });
    console.log(r.말);
    if (!r.ok) process.exitCode = 1;
    return;
  }
  const i = process.argv.indexOf("--client");
  const 지정 = i > 0 ? process.argv[i + 1] : null;
  const 대상 = 지정 || process.argv.includes("--complete")
    ? await q(`select id, slug, name, domain from geo.clients where slug=$1`, [지정 ?? HOUSE])
    : await q(`select c.id, c.slug, c.name, c.domain from geo.clients c
                where c.slug=$1 or exists (select 1 from geo.pilot_questions pq join geo.pilots p on p.id=pq.pilot_id
                                            where p.client_id=c.id and pq.approved)
                order by c.slug <> $1, c.id`, [HOUSE]);
  if (!대상.length) throw new Error(`${지정 ?? HOUSE} 없음`);
  for (const [n, c] of 대상.entries()) {
    if (n) console.log(`\n────────────────`);
    const 설정 = CLIENTS.find((x) => x.slug === c.slug)?.loop;
    if (!설정) {
      // 사다리의 고객별 칸(이름 질문 적중 말·홈 검사·글 쓰는 길)을 지어낼 수 없다. 조용히 빼지 않고 적는다
      console.log(`${c.name}: academy/clients.mjs 에 loop 설정이 없어 개선 루프를 건너뜁니다`);
      continue;
    }
    // 한 고객이 실패해도 다음 고객은 돈다
    await 돌기(c, 설정).catch((e) => {
      console.log("실패:", e.message);
      process.exitCode = 1;
    });
  }
};

main()
  .catch((e) => {
    console.log("실패:", e.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
