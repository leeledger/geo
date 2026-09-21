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
 *   node scripts/daily-agent.mjs --complete "한 일" "근거"   사람이 오늘 행동을 끝냈을 때
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY = process.argv.includes("--dry");
const SLUG = "robotncoding";
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

const LADDER = { brand: ["entity", "content", "offsite"], local: ["content", "offsite"], problem: ["content", "offsite"], consider: ["content", "offsite"] };
const STAGE_ORDER = { local: 0, brand: 1, problem: 2, consider: 3 };

/** 노드 스크립트를 셸 없이 부른다. Git Bash 경로 변환·& 문제를 피한다 */
const 실행 = (args) => {
  try {
    return { ok: true, out: execFileSync(process.execPath, args, { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 600000, env: process.env }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}${e.message}` };
  }
};

const 두글자 = (s) => {
  const t = String(s).replace(/[^가-힣a-zA-Z0-9]/g, "").toLowerCase();
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
};
/** 질문의 두 글자 묶음이 제목에 얼마나 들어 있나. 0~1 */
const 겹침 = (question, title) => {
  const a = 두글자(question), b = 두글자(title);
  if (!a.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / a.size;
};

const main = async () => {
  const [c] = await q(`select id, name, domain from geo.clients where slug=$1`, [SLUG]);
  if (!c) throw new Error(`${SLUG} 없음`);

  await q(`create table if not exists geo.agent_runs(id bigserial primary key,client_id int not null references geo.clients(id),run_day date not null default current_date,trigger text not null default 'daily',status text not null default '행동 대기',facts jsonb not null default '{}'::jsonb,diagnosis text not null,action text not null,evidence text not null default '',started_at timestamptz not null default now(),completed_at timestamptz,unique(client_id,run_day,trigger))`);
  for (const col of [
    "target_prompt text", "action_kind text", "target_slug text",
    "verdict text not null default '판정 전'", "verdict_note text not null default ''",
    "effective_on date", "judged_at timestamptz",
  ]) await q(`alter table geo.agent_runs add column if not exists ${col}`);

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
  /** 홈 JSON-LD 에 주소가 있나. 못 가져왔으면 fetched=false — 사람 일로 적지 않는다 */
  const 홈확인 = async () => {
    const html = await fetch(`https://${c.domain}/`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
    return { fetched: Boolean(html), ok: /"address"/.test(ld) && /석촌|송파/.test(ld) };
  };

  // ── 재료
  const questions = await q(
    `select 'q' || q.position as prompt_id, q.stage, q.text from geo.pilot_questions q
       join geo.pilots p on p.id=q.pilot_id where p.client_id=$1 and q.approved order by q.position`, [c.id]);
  const rows = await q(
    `select prompt_id, measured_on::text as day, engine, mentioned, cited, citations, coalesce(raw->>'answer','') answer
       from academy.ai_measurements
      where client_id=$1 and collection_method like 'api-%' and measured_on >= $2::date`, [c.id, 날더하기(오늘, -70)]);
  const runs = await q(
    `select id, run_day::text as run_day, status, action_kind, target_prompt, target_slug, verdict, effective_on::text as effective_on
       from geo.agent_runs where client_id=$1 and target_prompt is not null order by run_day`, [c.id]);
  const posts = await q(`select slug, title, published, published_at from academy.posts where client_id=$1`, [c.id]);
  const [todayRun] = await q(`select status, action_kind from geo.agent_runs where client_id=$1 and run_day=$2::date and trigger='daily'`, [c.id, 오늘]);

  const stageOf = Object.fromEntries(questions.map((x) => [x.prompt_id, x.stage]));
  // 브랜드 질문은 질문에 이름이 들어 있어 답이 따라 말한다. 인용이나 실제 위치(석촌)가 나와야 적중이다
  const 적중 = (r) => r.cited || (stageOf[r.prompt_id] === "brand" ? /석촌/.test(r.answer) : r.mentioned);
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
    if (r.status === "사람 대기" && r.run_day <= 날더하기(오늘, -14)) {
      기록.push(`${r.target_prompt} ${r.action_kind} 14일 미처리 → 닫음`);
      if (!DRY) await q(`update geo.agent_runs set verdict='미처리', verdict_note='14일 동안 사람 작업이 없었음', judged_at=now() where id=$1`, [r.id]);
      r.verdict = "미처리";
      continue;
    }
    if (r.status !== "완료" || !r.effective_on) continue;
    const 전 = 창(r.target_prompt, 날더하기(r.effective_on, -14), r.effective_on);
    const 후 = 창(r.target_prompt, 날더하기(r.effective_on, 7));
    const 전율 = 퍼센트(전.filter(적중).length, 전.length);
    const 후율 = 퍼센트(후.filter(적중).length, 후.length);
    let verdict = null;
    let note = `전 ${전.filter(적중).length}/${전.length}(${전율}%) → 후 ${후.filter(적중).length}/${후.length}(${후율}%)`;
    if (전.length >= 5 && 후.length >= 5) {
      verdict = 후율 - 전율 >= 20 && 후.filter(적중).length >= 2 ? "효과 있음" : "효과 없음";
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

  const facts = { day: 오늘, engines: 엔진별, week: 전체, questions: 표.map(({ prompt_id, n, hit }) => ({ prompt_id, n, hit })), judged: 기록 };
  const 저장 = async (row) => {
    console.log(`\n진단: ${row.diagnosis}\n행동: ${row.action}\n상태: ${row.status}${row.evidence ? `\n근거: ${row.evidence}` : ""}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `### 개선 루프 ${오늘}\n- 상태: ${row.status}\n- 진단: ${row.diagnosis}\n- 행동: ${row.action}\n- 근거: ${row.evidence || "—"}\n` +
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

  // 같은 날 두 번 돌면 초안을 두 번 쓴다. 이미 행동한 날은 판정만 하고 끝낸다
  if (todayRun?.action_kind && todayRun.status !== "실패") {
    console.log(`\n오늘(${오늘}) 행동은 이미 기록돼 있습니다 — ${todayRun.action_kind} · ${todayRun.status}`);
    return;
  }

  if (!측정됨.length) {
    await 저장({ status: "실패", diagnosis: "최근 7일 자동 AI 측정이 없습니다", action: "ai-measure.mjs 로그에서 키·모델·한도 오류를 확인합니다.", evidence: 엔진별 });
    process.exitCode = 1;
    return;
  }

  // ── 3. 고르기
  // 실패한 날은 행동한 게 아니다. 질문을 잡아 두지 않는다
  const 열림 = new Set(runs.filter((r) => r.verdict === "판정 전" && r.status !== "실패").map((r) => r.target_prompt));
  // 원장이 초안을 버린 질문은 같은 초안을 다시 만들지 않는다. 삭제는 편집 판단이다.
  const 버린질문 = new Set(runs.filter((r) => r.action_kind === "content" && r.verdict === "취소").map((r) => r.target_prompt));
  // 회사 루프가 쓴 초안도 같은 검토 대기열이다. 열린 초안이 있으면 새 글을 쌓지 않는다.
  const 다른초안 = posts.find((p) => !p.published && p.slug);
  const 대기초안 = runs.find((r) => r.verdict === "판정 전" && r.action_kind === "content" && r.status === "사람 대기" && r.target_slug)
    ?? (다른초안 ? { target_slug: 다른초안.slug } : null);
  const 후보 = 표
    .filter((x) => x.n > 0 && x.rate < 50 && !열림.has(x.prompt_id) && !버린질문.has(x.prompt_id))
    .sort((a, b) => (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) || a.rate - b.rate);

  if (!후보.length) {
    const why = 표.some((x) => x.n > 0 && x.rate < 50)
      ? `적중률 50% 미만 질문은 모두 행동이 진행 중입니다${대기초안 ? ` — 초안 ${대기초안.target_slug} 발행 전 사실 확인 대기` : ""}`
      : "측정된 질문이 모두 적중률 50% 이상입니다";
    await 저장({ status: 대기초안 ? "사람 대기" : "완료", diagnosis: `${전체}. ${why}`, action: 대기초안 ? `/blog/${대기초안.target_slug} 초안을 사실 확인 후 발행합니다.` : "측정만 이어 갑니다.", evidence: 엔진별 });
    return;
  }

  const published = posts.filter((p) => p.published);
  const tried = (pid) => new Map(runs.filter((r) => r.target_prompt === pid).map((r) => [r.action_kind, r.verdict]));
  let 막힘 = null;

  질문: for (const x of 후보) {
    const t = tried(x.prompt_id);
    const 진단 = `${x.prompt_id}「${x.text}」 최근 7일 적중 ${x.hit}/${x.n} (${x.stage}) · ${전체}`;
    for (const kind of LADDER[x.stage] ?? LADDER.problem) {
      const v = t.get(kind);
      if (v === "효과 없음" || v === "표본 부족" || v === "통과") continue;

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
          action: `홈(https://${c.domain}/) 구조화 데이터에 주소가 없습니다. academy/app/page.tsx 의 JSON-LD 에 주소·지역을 넣고 배포합니다.`,
          evidence: "홈 JSON-LD 에 address 또는 석촌·송파 없음",
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
        if (DRY) {
          console.log(`\n(dry) ${x.prompt_id} 초안을 쓸 차례 — 대신 인용된 곳: ${경쟁.join(", ") || "없음"}`);
          return;
        }
        const res = 실행(["scripts/write-draft.mjs", "--question", x.text, "--stage", x.stage, "--sources", 경쟁.join(",")]);
        const slug = /DRAFT_SLUG=(\S+)/.exec(res.out)?.[1];
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

      if (kind === "offsite") {
        const 출처 = Object.entries(창(x.prompt_id, 날더하기(오늘, -27)).flatMap((r) => r.citations ?? [])
          .map((s) => s.domain).filter((d) => d && d !== c.domain)
          .reduce((m, d) => ((m[d] = (m[d] ?? 0) + 1), m), {}))
          .sort((a, b) => b[1] - a[1]).slice(0, 5);
        await 저장({
          status: "사람 대기", diagnosis: 진단, target_prompt: x.prompt_id, action_kind: "offsite",
          action: 출처.length
            ? `사이트 글로는 안 움직였습니다. AI 가 대신 읽는 곳에 학원 정보가 실리게 합니다: ${출처.map(([d]) => d).join(", ")}`
            : "사이트 글로는 안 움직였고, 답에 출처가 안 잡혀 등록할 곳을 고르지 못했습니다. 네이버 플레이스·지역 카페 노출을 먼저 확인합니다.",
          evidence: 출처.map(([d, n]) => `${d} ${n}회`).join(", ") || "출처 없음",
        });
        return;
      }
    }
  }

  await 저장({
    status: "사람 대기", diagnosis: `${전체}. ${막힘 ?? "후보 질문의 자동 행동이 모두 소진됐습니다"}`,
    action: 대기초안 ? `/blog/${대기초안.target_slug} 초안을 사실 확인 후 발행합니다.` : "사다리를 다 쓴 질문은 사람이 원인을 새로 정합니다.",
    evidence: 엔진별,
  });
};

main()
  .catch((e) => {
    console.log("실패:", e.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
